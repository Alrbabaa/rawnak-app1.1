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
  occasion: string; // wedding | university | meeting | travel | party | date
  occasionLabel?: string;
  daysUntil?: number;
  // Shared personalization context (profile, latest analysis, cabinet,
  // routine, VIP, real weather) — see src/lib/personalization.ts. Older
  // clients may still send the legacy flat fields below; both are
  // supported so this route doesn't need a coordinated client release.
  context?: ServerPersonalizationContext;
  skinType?: string | null;
  skinTone?: string | null;
  concerns?: string[];
  makeupLevel?: string | null;
  cabinetProducts?: string[]; // names of owned products
}

const SKIN_TYPE_AR: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

const PROMPT = `أنتِ خبيرة تجميل ومكياج محترفة. صمّمي خطة جمال متكاملة لمناسبة معينة، مخصّصة بالكامل للمستخدمة بناءً على نوع بشرتها ولونها وأهدافها والمنتجات التي تملكها.

أعطي النتيجة JSON صالحًا فقط بالبنية:
{
  "steps": [
    {"phase": "<مرحلة مثل: قبل المناسبة بيوم | صباح المناسبة | التحضير | المكياج | اللمسات الأخيرة>", "items": ["<خطوة 1>", "<خطوة 2>"]}
  ],
  "products": ["<منتج موصى به 1>", "<2>", "<3>", "<4>"],
  "duration": "<الوقت التقديري الكلي>",
  "tips": ["<نصيحة 1>", "<نصيحة 2>", "<نصيحة 3>"]
}

كوني دقيقة وعملية. إذا ذكرتِ منتجات تملكها المستخدمة، استخدميها في الخطة. أرجعي JSON صالحًا فقط بدون أي نص إضافي.`;

interface PlannerResult {
  steps: { phase: string; items: string[] }[];
  products: string[];
  duration: string;
  tips: string[];
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "planner", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const gate = await checkFeatureGate(req, "planner", "planner");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const { occasion, occasionLabel, daysUntil, context, skinType, skinTone, concerns, makeupLevel, cabinetProducts } =
      body;

    const occasionLine = [
      `المناسبة: ${occasionLabel || occasion}`,
      daysUntil ? `بعد ${daysUntil} يوم` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Occasion is handled explicitly above (occasionLabel/daysUntil), so
    // skip re-stating it from context to avoid duplicating the same line.
    const personalizedBlock = context
      ? formatPersonalizationContext(context, { upcomingOccasion: false })
      : "";

    // Legacy fallback for clients that haven't upgraded to the shared
    // context yet — kept minimal, matches the old prompt shape exactly.
    const legacyLines = [
      !context && skinType ? `نوع البشرة: ${SKIN_TYPE_AR[skinType] || skinType}` : "",
      !context && skinTone ? `لون البشرة: ${skinTone}` : "",
      !context && concerns?.length ? `المشاكل: ${concerns.join("، ")}` : "",
      !context && makeupLevel ? `مستوى المكياج: ${makeupLevel}` : "",
      !context && cabinetProducts?.length
        ? `منتجات تملكها المستخدمة (استخدميها في الخطة): ${cabinetProducts.join("، ")}`
        : "",
    ].filter(Boolean);

    const ctx = [occasionLine, personalizedBlock, ...legacyLines].filter(Boolean).join("\n\n");

    const parsed = await aiService.chatJson<PlannerResult>(PROMPT, ctx);

    if (!Array.isArray(parsed.steps)) parsed.steps = [];
    if (!Array.isArray(parsed.products)) parsed.products = [];
    if (!Array.isArray(parsed.tips)) parsed.tips = [];
    if (!parsed.duration) parsed.duration = "30-45 دقيقة";

    const usage = await recordFeatureUse(gate.userRef, "planner", "planner", gate.usageCount, gate.isPremium, gate.limit);

    return NextResponse.json({ ...parsed, usage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[planner] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء توليد الخطة الجمالية" },
      { status: 500 }
    );
  }
}
