import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { checkFeatureGate, recordFeatureUse } from "@/lib/feature-gate";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ReqBody {
  condition: string;
  skinType?: string | null;
}

const SKIN_TYPE_AR: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

const CONDITION_AR: Record<string, string> = {
  hot_dry: "حار وجاف",
  hot_humid: "حار ورطب",
  cold_dry: "بارد وجاف",
  mild: "معتدل",
  windy: "عاصف",
  sunny: "مشمس قوي",
  rainy: "ممطر",
};

const PROMPT = `أنتِ خبيرة عناية بالبشرة متخصصة في التأثيرات المناخية. قدّمي نصائح مخصصة للعناية بالبشرة حسب الطقس الحالي ونوع بشرة المستخدمة.

أعطي النتيجة JSON صالحة فقط بالبنية:
{
  "summary": "<ملخص بالعربية 2-3 أسطر عن تأثير الطقس على البشرة>",
  "tips": [
    {"title": "<عنوان النصيحة>", "detail": "<التفاصيل>", "icon": "<emoji>"},
    {"title": "...", "detail": "...", "icon": "..."}
  ],
  "routineAdjust": ["<تعديل على الروتين 1>", "<2>", "<3>"],
  "mustHave": "<منتج أساسي لهذا الطقس>",
  "avoid": "<ما يجب تجنبه>"
}

قدّمي 5 نصائح. أرجعي JSON صالحًا فقط بدون أي نص إضافي.`;

interface WeatherResult {
  summary: string;
  tips: Array<{ title: string; detail: string; icon: string }>;
  routineAdjust: string[];
  mustHave: string;
  avoid: string;
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "weather-tips", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const gate = await checkFeatureGate(req, "weatherTips", "weather-tips");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const { condition, skinType } = body;

    const ctx = `الطقس الحالي: ${CONDITION_AR[condition] || condition}
نوع بشرة المستخدمة: ${skinType ? SKIN_TYPE_AR[skinType] || skinType : "عادية"}`;

    const parsed = await aiService.chatJson<WeatherResult>(PROMPT, ctx);

    if (!parsed.tips) {
      return NextResponse.json({ error: "تعذّر تفسير النصائح" }, { status: 500 });
    }

    if (!Array.isArray(parsed.routineAdjust)) parsed.routineAdjust = [];

    const usage = await recordFeatureUse(gate.userRef, "weatherTips", "weather-tips", gate.usageCount, gate.isPremium, gate.limit);

    return NextResponse.json({ ...parsed, usage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[weather-tips] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء توليد نصائح الطقس" },
      { status: 500 }
    );
  }
}
