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
  context: ServerPersonalizationContext;
}

const PROMPT = `أنتِ "رَونق" — مستشارة جمال ذكية تعرف المستخدمة شخصيًا وتقدّم لها كل يوم أهم شيء تحتاج معرفته أو فعله اليوم بالتحديد، بناءً على المعلومات الحقيقية المتوفرة عنها فقط.

لا تخترعي أي معلومة غير مذكورة (لا منتجات، لا طقس، لا مناسبات). إذا كانت معلومة ما غير متوفرة، تجاهليها بدل تعويضها بشيء عام.

أعطي النتيجة JSON صالحًا فقط بالبنية:
{
  "greeting": "<تحية قصيرة شخصية ودافئة بالعربية، سطر واحد>",
  "headline": "<أهم شيء لهذا اليوم تحديدًا، جملة أو جملتين>",
  "priorityAction": {
    "title": "<الإجراء الأهم الذي يجب أن تفعله اليوم — عنوان قصير>",
    "reason": "<لماذا هذا الإجراء تحديدًا مهم لها اليوم، مبني على معلوماتها الفعلية>"
  },
  "cabinetTip": "<نصيحة عن استخدام منتج من خزانتها إن وُجدت منتجات، وإلا اتركيه فارغًا "">",
  "routineNote": "<ملاحظة قصيرة عن روتينها المتبقي اليوم إن وُجد، وإلا اتركيه فارغًا "">",
  "weatherNote": "<ملاحظة قصيرة عن تأثير طقس اليوم على بشرتها إن توفر الطقس، وإلا اتركيه فارغًا "">",
  "occasionNote": "<ملاحظة عن مناسبة قادمة إن وُجدت، وإلا اتركيه فارغًا "">"
}

أرجعي JSON صالحًا فقط بدون أي نص إضافي.`;

interface TodayResult {
  greeting: string;
  headline: string;
  priorityAction: { title: string; reason: string };
  cabinetTip: string;
  routineNote: string;
  weatherNote: string;
  occasionNote: string;
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "today", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const gate = await checkFeatureGate(req, "rawnakToday", "today");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const ctx = formatPersonalizationContext(body.context || {});

    // No real context at all (brand-new user, nothing filled in yet) —
    // don't call the AI with an empty prompt; return an honest, gentle
    // onboarding nudge instead of a generic-sounding "personalized" reply.
    if (!ctx.trim()) {
      return NextResponse.json({
        greeting: "أهلًا بكِ في رَونق ✦",
        headline: "أكملي ملفكِ الجمالي لتبدأ رَونق بفهم بشرتكِ واحتياجاتكِ يوميًا.",
        priorityAction: {
          title: "أكملي ملفكِ الشخصي",
          reason: "كلما عرفت رَونق المزيد عن نوع بشرتكِ وأهدافكِ، كانت نصائحها اليومية أدق.",
        },
        cabinetTip: "",
        routineNote: "",
        weatherNote: "",
        occasionNote: "",
        usage: null,
      });
    }

    const parsed = await aiService.chatJson<TodayResult>(PROMPT, ctx);

    if (!parsed.greeting || !parsed.headline) {
      return NextResponse.json({ error: "تعذّر تفسير ملخص اليوم" }, { status: 500 });
    }

    const usage = await recordFeatureUse(gate.userRef, "rawnakToday", "today", gate.usageCount, gate.isPremium, gate.limit);

    return NextResponse.json({
      greeting: parsed.greeting,
      headline: parsed.headline,
      priorityAction: parsed.priorityAction || null,
      cabinetTip: parsed.cabinetTip || "",
      routineNote: parsed.routineNote || "",
      weatherNote: parsed.weatherNote || "",
      occasionNote: parsed.occasionNote || "",
      usage,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[today] error:", msg);
    return NextResponse.json(
      { error: "تعذّر تحميل ملخص اليوم" },
      { status: 500 }
    );
  }
}
