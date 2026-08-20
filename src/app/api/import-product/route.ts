import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { fetchPage, htmlToPlainText } from "@/lib/page-fetch";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ReqBody {
  url: string;
  userSkinType?: string | null;
}

const PROMPT = `أنتِ خبيرة في تحليل صفحات منتجات التجميل والعناية بالبشرة. استخرجي بيانات المنتج من محتوى الصفحة التالي.

أعطي النتيجة JSON صالحًا فقط بالبنية:
{
  "name": "<اسم المنتج>",
  "brand": "<العلامة التجارية>",
  "category": "<cleanser | toner | serum | moisturizer | sunscreen | treatment | makeup | fragrance | other>",
  "subCategory": "<الفئة الفرعية بالعربية: غسول، مرطب، سيروم...>",
  "description": "<وصف قصير بالعربية>",
  "ingredients": ["<مكون 1>", "<مكون 2>"],
  "price": "<السعر مع العملة إن وُجد، أو 'غير متوفر'>",
  "imageFound": <true|false>,
  "store": "<اسم المتجر: Sephora | Amazon | Noon | غير ذلك>"
}

إن لم تجدي معلومة، ضعي قيمة فارغة أو "غير متوفر". أرجعي JSON صالحًا فقط بدون أي نص إضافي.`;

interface ImportedProduct {
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  description: string;
  ingredients: string[];
  price: string;
  imageFound: boolean;
  store: string;
}

function categoryToSubCat(cat: string): string {
  const map: Record<string, string> = {
    cleanser: "cleanser",
    toner: "toner",
    serum: "serum",
    moisturizer: "moisturizer",
    sunscreen: "sunscreen",
    treatment: "treatment",
    makeup: "makeup",
    fragrance: "fragrance",
  };
  return map[cat] || "cleanser";
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "import-product", { max: 8, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ReqBody;
    const { url } = body;

    if (!url || !/^https?:\/\//.test(url)) {
      return NextResponse.json(
        { error: "رابط غير صالح. الصقي رابط منتج كامل يبدأ بـ http" },
        { status: 400 }
      );
    }

    // Step 1: fetch the product page
    let pageText = "";
    let pageTitle = "";
    try {
      const { title, html } = await fetchPage(url);
      pageTitle = title;
      pageText = htmlToPlainText(html);
    } catch {
      return NextResponse.json(
        {
          error:
            "تعذّر قراءة صفحة المنتج. تأكدي من الرابط أو أضيفي المنتج يدويًا.",
        },
        { status: 502 }
      );
    }

    if (!pageText || pageText.length < 30) {
      return NextResponse.json(
        {
          error:
            "لم أتمكن من استخراج محتوى كافٍ من الصفحة. أضيفي المنتج يدويًا.",
        },
        { status: 422 }
      );
    }

    // Step 2: extract structured product data with LLM
    const truncated =
      pageText.slice(0, 6000) +
      (pageTitle ? `\n\nعنوان الصفحة: ${pageTitle}` : "");

    const parsed = await aiService.chatJson<ImportedProduct>(PROMPT, `رابط المنتج: ${url}\n\nمحتوى الصفحة:\n${truncated}`);

    if (!parsed.name || parsed.name === "غير متوفر") {
      return NextResponse.json(
        {
          error:
            "لم أتمكن من التعرّف على بيانات المنتج من الصفحة. أضيفيه يدويًا.",
        },
        { status: 422 }
      );
    }

    // Normalize
    parsed.subCategory =
      parsed.subCategory || categoryToSubCat(parsed.category);
    if (!Array.isArray(parsed.ingredients)) parsed.ingredients = [];
    if (!parsed.price) parsed.price = "غير متوفر";
    if (!parsed.brand) parsed.brand = "غير محدد";
    if (!parsed.description) parsed.description = "";
    if (!parsed.store) parsed.store = "متجر إلكتروني";

    return NextResponse.json({
      ...parsed,
      sourceUrl: url,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[import-product] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء استيراد المنتج. حاولي مرة أخرى." },
      { status: 500 }
    );
  }
}
