import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { checkFeatureGate, recordFeatureUse } from "@/lib/feature-gate";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ReqBody {
  cabinetProducts: { name: string; category: string; subCategory: string }[];
  skinType?: string | null;
  concerns?: string[];
  goals?: string[];
}

const SKIN_TYPE_AR: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

const PROMPT = `أنتِ خبيرة عناية بالبشرة. ابنِ روتينًا يوميًا (صباحي ومسائي) باستخدام المنتجات التي تملكها المستخدمة فقط، مع إضافة منتجات ناقصة إن لزم.

أعطي النتيجة JSON صالحًا فقط بالبنية:
{
  "morning": [
    {"step": "<الخطوة>", "product": "<المنتج>", "note": "<ملاحظة قصيرة>"}
  ],
  "evening": [
    {"step": "<الخطوة>", "product": "<المنتج>", "note": "<ملاحظة>"}
  ],
  "missing": ["<منتج ناقص تحتاجه المستخدمة>"],
  "summary": "<ملخص قصير عن الروتين>"
}

استخدمي المنتجات المملوكة قدر الإمكان. أرجعي JSON صالحًا فقط بدون أي نص إضافي.`;

interface CabinetRoutineResult {
  morning: { step: string; product: string; note: string }[];
  evening: { step: string; product: string; note: string }[];
  missing: string[];
  summary: string;
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "cabinet-routine", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    // VIP-exclusive feature — the UI only shows this to VIP members and
    // paywalls everyone else, but that's a client-side button state, not
    // enforcement. This route previously had no session/tier check at all,
    // so anyone who called it directly — including a signed-out guest —
    // got the full AI routine for free. Mirrors every other AI route now.
    const gate = await checkFeatureGate(req, "cabinetRoutine", "cabinet-routine");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const { cabinetProducts, skinType, concerns, goals } = body;

    if (!Array.isArray(cabinetProducts) || cabinetProducts.length === 0) {
      return NextResponse.json(
        { error: "أضيفي منتجات إلى خزانتكِ أولًا" },
        { status: 400 }
      );
    }

    const ctx = `منتجات المستخدمة المملوكة:
${cabinetProducts.map((p, i) => `${i + 1}. ${p.name} (${p.subCategory || p.category})`).join("\n")}

نوع البشرة: ${skinType ? SKIN_TYPE_AR[skinType] || skinType : "غير محدد"}
المشاكل: ${concerns?.length ? concerns.join("، ") : "عامة"}
الأهداف: ${goals?.length ? goals.join("، ") : "عامة"}`;

    const parsed = await aiService.chatJson<CabinetRoutineResult>(PROMPT, ctx);

    if (!Array.isArray(parsed.morning)) parsed.morning = [];
    if (!Array.isArray(parsed.evening)) parsed.evening = [];
    if (!Array.isArray(parsed.missing)) parsed.missing = [];
    if (!parsed.summary) parsed.summary = "";

    await recordFeatureUse(gate.userRef, "cabinetRoutine", "cabinet-routine", gate.usageCount, gate.isPremium, gate.limit);

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[cabinet-routine] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء بناء الروتين من خزانتكِ" },
      { status: 500 }
    );
  }
}
