import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { checkFeatureGate, recordFeatureUse } from "@/lib/feature-gate";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ReqBody {
  image: string;
  userSkinType?: string | null;
  userConcerns?: string[];
}

const SCAN_PROMPT = `أنتِ خبيرة في تحليل منتجات التجميل والعناية بالبشرة. حلّلي صورة المنتج (العبوة و/أو قائمة المكونات) بدقة.

أعطي النتيجة بصيغة JSON صالحة فقط (بدون نص إضافي)، بالبنية التالية:
{
  "name": "<اسم المنتج بالعربية أو كما هو مكتوب>",
  "brand": "<العلامة التجارية>",
  "category": "<الفئة: غسول | مرطب | سيروم | واقي شمس | تونر | كريم | ماسك | مكياج | غير ذلك>",
  "ingredients": ["<مكون 1>", "<مكون 2>", "..."],
  "compatibility": <number 0-100, مدى ملاءمته العام>,
  "benefits": ["<فائدة 1>", "<فائدة 2>"],
  "warnings": ["<تحذير أو ملاحظة 1>", "..."],
  "usage": "<طريقة الاستخدام بالعربية>"
}

إن لم تستطيعي قراءة بعض المعلومات، ضعي قيمة فارغة أو "غير محدد". أرجعي JSON فقط.`;

interface ProductScanResult {
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  compatibility: number;
  benefits: string[];
  warnings: string[];
  usage: string;
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "product-scan", { max: 8, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const gate = await checkFeatureGate(req, "productScan");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const { image, userSkinType, userConcerns } = body;

    if (!image || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 });
    }

    const contextLine =
      userSkinType || userConcerns?.length
        ? `\nبشرة المستخدمة: ${userSkinType || ""} ${
            userConcerns?.length ? "— مشاكل: " + userConcerns.join("، ") : ""
          }. خذي ذلك في الاعتبار عند تقييم الملاءمة.`
        : "";

    const parsed = await aiService.visionJson<ProductScanResult>(
      SCAN_PROMPT + contextLine,
      [image]
    );

    if (typeof parsed.name !== "string") {
      return NextResponse.json(
        { error: "تعذّر تفسير بيانات المنتج" },
        { status: 500 }
      );
    }

    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    if (typeof parsed.compatibility === "number") {
      parsed.compatibility = clamp(parsed.compatibility);
    } else {
      parsed.compatibility = 70;
    }
    if (!Array.isArray(parsed.ingredients)) parsed.ingredients = [];
    if (!Array.isArray(parsed.benefits)) parsed.benefits = [];
    if (!Array.isArray(parsed.warnings)) parsed.warnings = [];
    if (!parsed.usage) parsed.usage = "استخدمي حسب تعليمات العبوة.";

    const usage = await recordFeatureUse(gate.userRef, "productScan", gate.usageCount, gate.isPremium, gate.limit);

    return NextResponse.json({ ...parsed, usage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[product-scan] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحليل المنتج. حاولي مرة أخرى." },
      { status: 500 }
    );
  }
}
