import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { checkFeatureGate, recordFeatureUse } from "@/lib/feature-gate";
import {
  formatPersonalizationContext,
  type ServerPersonalizationContext,
} from "@/lib/ai/personalization-context";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ReqBody {
  profile: {
    skinType?: string | null;
    concerns?: string[];
    goals?: string[];
    age?: number | null;
  };
  latestAnalysis?: {
    overall?: number;
    skinType?: string;
    metrics?: Record<string, number>;
  } | null;
  // Shared personalization context — adds cabinet (so the AI can avoid
  // recommending duplicates of what she already owns), routine, and VIP
  // depth on top of the legacy profile/latestAnalysis fields above, which
  // stay supported for older clients.
  context?: ServerPersonalizationContext;
}

const SKIN_TYPE_AR: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

const PROMPT = `أنتِ خبيرة منتجات عناية بالبشرة. اقترحي 6 منتجات مخصصة للمستخدمة بناءً على ملفها وتحليلها.

أعطي النتيجة JSON صالحة فقط، مصفوفة من المنتجات بالبنية:
[
  {
    "id": "<معرّف فريد قصير>",
    "name": "<اسم المنتج>",
    "brand": "<العلامة>",
    "category": "<غسول | مرطب | سيروم | واقي شمس | تونر | علاج>",
    "description": "<وصف قصير بالعربية>",
    "keyIngredient": "<المكون الرئيسي>",
    "benefit": "<الفائدة الأساسية بالعربية>",
    "priceRange": "<$$ أو $$$>",
    "rating": <number 4-5>,
    "tag": "<للصباح | للمساء | لكلا الوقتين>"
  }
]

اجعلي المنتجات واقعية ومعروفة عالميًا، مناسبة للبشرة المحددة. إن ذُكرت منتجات تملكها المستخدمة بالفعل، لا تكرّري اقتراح نفس المنتج أو بديل مطابق له تمامًا. أرجعي JSON صالحًا فقط بدون أي نص إضافي.`;

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  keyIngredient: string;
  benefit: string;
  priceRange: string;
  rating: number;
  tag: string;
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "recommendations", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const gate = await checkFeatureGate(req, "recommendations", "recommendations");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const { profile, latestAnalysis, context } = body;

    const legacyBlock = `ملف المستخدمة:
- نوع البشرة: ${profile.skinType ? SKIN_TYPE_AR[profile.skinType] || profile.skinType : "غير محدد"}
- العمر: ${profile.age || "غير محدد"}
- المشاكل: ${profile.concerns?.join("، ") || "غير محدد"}
- الأهداف: ${profile.goals?.join("، ") || "غير محدد"}
${
  latestAnalysis
    ? `\nأحدث تحليل: النتيجة العامة ${latestAnalysis.overall}/100`
    : ""
}`;

    // Prefer the shared context (adds cabinet + routine + VIP depth) when
    // sent; fall back to the legacy flat fields for older clients so this
    // route doesn't require a coordinated release with every screen.
    const ctx = context ? formatPersonalizationContext(context) : legacyBlock;

    const parsed = await aiService.chatJson<Product[]>(PROMPT, ctx);

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "تعذّر تفسير التوصيات" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      products: parsed.slice(0, 6),
      usage: await recordFeatureUse(gate.userRef, "recommendations", "recommendations", gate.usageCount, gate.isPremium, gate.limit),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[recommendations] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء توليد التوصيات" },
      { status: 500 }
    );
  }
}
