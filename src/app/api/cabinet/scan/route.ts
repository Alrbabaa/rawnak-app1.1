import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { checkFeatureGate, recordFeatureUse } from "@/lib/feature-gate";
import { CABINET_CATEGORIES } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 90;

const VALID_SUBCATEGORIES = new Set<string>(CABINET_CATEGORIES.map((c) => c.id));
const MAX_ITEMS = 20;
const FEATURE_ID = "cabinetAiScan" as const;

interface ReqBody {
  image: string;
}

interface DetectedItemRaw {
  name?: string;
  brand?: string;
  subCategory?: string;
  confidence?: number;
}

interface ScanResult {
  items: DetectedItemRaw[];
}

const SCAN_PROMPT = `أنتِ خبيرة تصنيف منتجات تجميل وعناية بالبشرة. حلّلي الصورة المرفقة لمجموعة منتجات (قد تكون حقيبة مكياج أو رف منتجات) وحدّدي كل قطعة منتج ظاهرة بوضوح على حدة، كل قطعة على حدة وليس كمجموعة واحدة.

لكل منتج تكتشفينه، أعطي:
- name: اسم المنتج ونوعه بالعربية بشكل وصفي (مثال: "أحمر شفاه مطفي وردي"، "ماسكرا تكثيف وإطالة"، "كونسيلر بيج فاتح")
- brand: العلامة التجارية إن كانت مقروءة بوضوح من الصورة أو العبوة، وإلا اتركيها فارغة ""
- subCategory: واحدة بالضبط من هذه القيم فقط: cleanser, toner, serum, moisturizer, sunscreen, treatment, makeup, fragrance (لحقيبة مكياج، معظم القطع ستكون "makeup")
- confidence: عدد صحيح من 0 إلى 100 يعكس مدى ثقتكِ بدقة التعرّف على هذا المنتج تحديدًا (اسمه ونوعه، ليس بالضرورة العلامة التجارية)

قواعد مهمة:
- تجاهلي الخلفية والأدوات التي ليست منتجات (فرش مكياج بمفردها، أكياس، مرايا، إسفنجات بلا عبوة).
- لا تخترعي منتجات غير مرئية فعليًا بالصورة. لو الصورة غير واضحة أو لا تحتوي منتجات مميزة، أرجعي مصفوفة فارغة.
- لا تكرري نفس المنتج مرتين إن ظهر مرة واحدة فقط.

أعطي النتيجة بصيغة JSON صالحة فقط (بدون أي نص أو شرح إضافي، بدون markdown)، بالبنية التالية:
{
  "items": [
    { "name": "...", "brand": "...", "subCategory": "...", "confidence": 85 }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "cabinet-scan", { max: 6, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ReqBody;
    const { image } = body;
    if (!image || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 });
    }

    const gate = await checkFeatureGate(req, FEATURE_ID, "cabinet-scan");
    if (!gate.ok) return gate.response;

    const parsed = await aiService.visionJson<ScanResult>(SCAN_PROMPT, [image]);

    if (!Array.isArray(parsed.items)) {
      return NextResponse.json({ error: "تعذّر تفسير نتيجة المسح" }, { status: 500 });
    }

    const clampConfidence = (n: unknown) =>
      typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;

    const items = parsed.items
      .filter((it): it is DetectedItemRaw & { name: string } => typeof it.name === "string" && it.name.trim().length > 0)
      .slice(0, MAX_ITEMS)
      .map((it) => {
        const sub = it.subCategory && VALID_SUBCATEGORIES.has(it.subCategory) ? it.subCategory : "makeup";
        return {
          name: it.name.trim(),
          brand: typeof it.brand === "string" ? it.brand.trim() : "",
          subCategory: sub as "cleanser" | "toner" | "serum" | "moisturizer" | "sunscreen" | "treatment" | "makeup" | "fragrance",
          confidence: clampConfidence(it.confidence),
        };
      });

    const usage = await recordFeatureUse(
      gate.userRef,
      FEATURE_ID,
      "cabinet-scan",
      gate.usageCount,
      gate.isPremium,
      gate.limit
    );

    return NextResponse.json({
      items,
      usage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[cabinet-scan] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء مسح الصورة. حاولي مرة أخرى." },
      { status: 500 }
    );
  }
}
