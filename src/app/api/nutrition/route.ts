import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { checkFeatureGate, recordFeatureUse } from "@/lib/feature-gate";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ReqBody {
  skinType?: string | null;
  concerns?: string[];
}

const SKIN_TYPE_AR: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

const PROMPT = `أنتِ خبيرة تغذية و جمال. قدّمي إرشادات تغذوية مرتبطة بصحة البشرة مخصصة للمستخدمة.

أعطي النتيجة JSON صالحة فقط بالبنية:
{
  "intro": "<مقدمة قصيرة بالعربية>",
  "recommended": [
    {"name": "<اسم الطعام>", "benefit": "<فائدته للبشرة>", "icon": "<emoji>"},
    {"name": "...", "benefit": "...", "icon": "..."}
  ],
  "avoid": [
    {"name": "<اسم الطعام>", "reason": "<سبب تجنبه>", "icon": "<emoji>"},
    {"name": "...", "reason": "...", "icon": "..."}
  ],
  "lifestyle": ["<نصيحة نمط حياة 1>", "<2>", "<3>"],
  "dailyTip": "<نصيحة اليوم>"
}

قدّمي 6 أطعمة موصى بها و4 للتجنب. أرجعي JSON صالحًا فقط بدون أي نص إضافي.`;

interface NutritionResult {
  intro: string;
  recommended: Array<{ name: string; benefit: string; icon: string }>;
  avoid: Array<{ name: string; reason: string; icon: string }>;
  lifestyle: string[];
  dailyTip: string;
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "nutrition", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const gate = await checkFeatureGate(req, "nutritionTips", "nutrition");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const { skinType, concerns } = body;

    const ctx = `بشرة المستخدمة: ${skinType ? SKIN_TYPE_AR[skinType] || skinType : "عادية"}
المشاكل: ${concerns?.length ? concerns.join("، ") : "عامة"}`;

    const parsed = await aiService.chatJson<NutritionResult>(PROMPT, ctx);

    if (!parsed.recommended) {
      return NextResponse.json(
        { error: "تعذّر تفسير الإرشادات" },
        { status: 500 }
      );
    }

    if (!Array.isArray(parsed.recommended)) parsed.recommended = [];
    if (!Array.isArray(parsed.avoid)) parsed.avoid = [];
    if (!Array.isArray(parsed.lifestyle)) parsed.lifestyle = [];
    if (!parsed.dailyTip) parsed.dailyTip = "";
    if (!parsed.intro) parsed.intro = "";

    const usage = await recordFeatureUse(gate.userRef, "nutritionTips", "nutrition", gate.usageCount, gate.isPremium, gate.limit);

    return NextResponse.json({ ...parsed, usage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[nutrition] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء توليد الإرشادات الغذائية" },
      { status: 500 }
    );
  }
}
