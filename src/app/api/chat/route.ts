import { NextRequest, NextResponse } from "next/server";
import { aiService, type ChatMessage } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { checkFeatureGate, recordFeatureUse } from "@/lib/feature-gate";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReqBody {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  hoursSinceLastMessage?: number | null;
  profile?: {
    name?: string;
    age?: number | null;
    skinType?: string | null;
    skinTone?: string | null;
    concerns?: string[];
    goals?: string[];
    makeupLevel?: string | null;
    personalityMode?: "professional" | "romantic";
    dialect?: "msa" | "khaleeji" | "masri" | "shami" | "iraqi" | "jazaeri";
    // Custom AI companion name — VIP-only perk. Re-validated below against
    // gate.isPremium (server truth from the just-checked feature gate), so
    // a modified client can't send this for a non-VIP account and have it
    // used.
    companionName?: string | null;
  };
  latestAnalysis?: {
    overall?: number;
    skinType?: string;
    summary?: string;
  } | null;
  cabinetProducts?: string[];
  streak?: number;
}

const SKIN_TYPE_AR: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

const CONCERN_AR: Record<string, string> = {
  acne: "حب الشباب",
  aging: "علامات التقدم في العمر",
  dryness: "الجفاف",
  darkspots: "البقع الداكنة",
  darkcircles: "الهالات السوداء",
  pores: "اتساع المسام",
  redness: "الاحمرار",
  dullness: "البهتان",
  sensitivity: "الحساسية",
};

const GOAL_AR: Record<string, string> = {
  glow: "إشراقة طبيعية",
  antiaging: "مكافحة الشيخوخة",
  acnefree: "بشرة خالية من الحبوب",
  hydration: "ترطيب عميق",
  evening: "توحيد لون البشرة",
  protection: "حماية من الشمس",
};

// Only "khaleeji" | "masri" | "shami" | "iraqi" | "jazaeri" get an entry —
// "msa" (the default) intentionally has none, so a user who never touches
// this setting gets zero prompt change and the exact original Fusha-only
// behavior.
const DIALECT_INSTRUCTIONS: Record<string, string> = {
  khaleeji: `- تتحدثين باللهجة الخليجية في حديثكِ اليومي (مو الفصحى الكاملة): استخدمي مفردات زي "وايد" بدل "كثير"، "زين"/"حلو" بدل "جيد"، "شلونك/شلونج" للسؤال عن الحال، "أبغى" بدل "أريد" أحيانًا. حافظي على النبرة الدافئة والاحترافية، والمصطلحات العلمية (اسم المكوّن، نوع البشرة) تبقى بالفصحى دائمًا لأنها مصطلحات دقيقة، لا لهجة.`,
  masri: `- تتحدثين باللهجة المصرية في حديثكِ اليومي (مو الفصحى الكاملة): استخدمي مفردات زي "قوي" بدل "جدًا"، "كده" بدل "هكذا"، "إزيّك" للسؤال عن الحال، "عايزة" بدل "أريد" أحيانًا. حافظي على النبرة الدافئة والاحترافية، والمصطلحات العلمية (اسم المكوّن، نوع البشرة) تبقى بالفصحى دائمًا لأنها مصطلحات دقيقة، لا لهجة.`,
  shami: `- تتحدثين باللهجة الشامية (سوريا/لبنان/الأردن/فلسطين) في حديثكِ اليومي (مو الفصحى الكاملة): استخدمي مفردات زي "كتير" بدل "كثير"، "هيك" بدل "هكذا"، "كيفك" للسؤال عن الحال، "بدّي" بدل "أريد" أحيانًا. حافظي على النبرة الدافئة والاحترافية، والمصطلحات العلمية (اسم المكوّن، نوع البشرة) تبقى بالفصحى دائمًا لأنها مصطلحات دقيقة، لا لهجة.`,
  iraqi: `- تتحدثين باللهجة العراقية في حديثكِ اليومي (مو الفصحى الكاملة): استخدمي مفردات زي "هواي" بدل "كثير"، "زين" بدل "جيد"، "شلونچ" للسؤال عن الحال، "أريد" أو "اريد" تُلفظ عادي بس ممكن "أبچي أكو/ماكو" للتعبير عن التوفر. حافظي على النبرة الدافئة والاحترافية، والمصطلحات العلمية (اسم المكوّن، نوع البشرة) تبقى بالفصحى دائمًا لأنها مصطلحات دقيقة، لا لهجة.`,
  jazaeri: `- تتحدثين باللهجة الجزائرية في حديثكِ اليومي (مو الفصحى الكاملة): استخدمي مفردات زي "بزاف" بدل "كثير"، "واعر"/"مليح" بدل "جيد"، "كيفاش رايك" أو "لاباس" للسؤال عن الحال، "نحب" بدل "أريد" أحيانًا. حافظي على النبرة الدافئة والاحترافية، والمصطلحات العلمية (اسم المكوّن، نوع البشرة) تبقى بالفصحى دائمًا لأنها مصطلحات دقيقة، لا لهجة.`,
};

/**
 * Companion warmth/flattery system.
 *
 * Design goal: avoid the "same compliment every time" feeling. Two levers:
 *  1. One angle is randomly picked per REQUEST from a pool (not per
 *     conversation) — mechanically guarantees the instruction itself
 *     varies turn to turn, independent of what the model does with it.
 *  2. The model is explicitly told to check the conversation history
 *     already in its context and avoid repeating a style/metaphor/opening
 *     it just used.
 *
 * Two separate pools, not one gated by personalityMode: professional mode
 * gets genuine but non-flirtatious warmth (praising consistency, care,
 * trust — never appearance-focused flattery), romantic mode gets poetic/
 * playful compliments. Neither mode is mandatory-every-reply anymore —
 * that "always end with a compliment" rule was itself a major source of
 * the repetitive, robotic feeling.
 */
const PROFESSIONAL_WARMTH_STYLES = [
  "إن كان مناسبًا، امتدحي التزامها أو اهتمامها بالتفاصيل بجملة قصيرة وصادقة — لا مجاملة عامة فارغة.",
  "إن كان مناسبًا، عبّري عن تقديرك لثقتها بمشاركة تفاصيلها معكِ، بجملة دافئة قصيرة.",
  "إن كان هناك تحسّن أو نتيجة جيدة بتحليلها، احتفي بها بصدق كإنجاز تستحقه، لا كمجاملة روتينية.",
  "إن كانت لديها سلسلة التزام يومية، أشيدي بانضباطها بأسلوب مشجّع غير مبالغ فيه.",
  "لا تُضيفي أي إطراء بهذا الرد — أجيبي بشكل مباشر ومهني فقط. هذا اختيار طبيعي وصحي، ليس كل رد يحتاج ثناء.",
  "إن كان مناسبًا، اسأليها سؤالًا فضوليًا لطيفًا عن تجربتها بدل المجاملة — الاهتمام الحقيقي يُظهر بالسؤال أحيانًا أكثر من الثناء.",
];

const ROMANTIC_FLATTERY_STYLES = [
  "اغزلي جمالها الداخلي — ذوقها، شخصيتها، وعيها بنفسها — لا شكلها الخارجي فقط.",
  "استخدمي تشبيهًا شاعريًا جديدًا ومبتكرًا (تجنّبي أي تشبيه استخدمتِه سابقًا بهذه المحادثة) مستوحى من الطبيعة أو الضوء أو الوقت.",
  "إطراء واثق ومرح بروح خفيفة الظل لا جدّية مفرطة — اجعليها تبتسم.",
  "احتفي بتفصيل شخصي ذكرته (هدفها، مناسبتها، يومها) بطريقة تُشعرها بالتفرّد — لا مجاملة عامة تصلح لأي أحد.",
  "إن كانت لديها سلسلة التزام يومية أو نتيجة تحليل جيدة، امزجي الفخر بها مع لمسة غزل أنيقة.",
  "ادمجي لمسة الغزل داخل الجملة نفسها بدل أن تكون جملة منفصلة بنهاية الرد.",
  "لا تُضيفي أي إطراء بهذا الرد — أجيبي بدفء طبيعي فقط دون غزل. التنويع يشمل أحيانًا عدم الإطراء إطلاقًا.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "chat", { max: 20, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const gate = await checkFeatureGate(req, "aiChat", "chat");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const { message, history = [], profile, latestAnalysis, cabinetProducts, hoursSinceLastMessage, streak } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });
    }

    // VIP-only perk — re-validated against gate.isPremium (server truth),
    // never trusted from the client alone.
    const companionName =
      gate.isPremium && profile?.companionName ? profile.companionName.trim().slice(0, 30) || null : null;
    const displayName = companionName || "رَونق";

    const profileLines: string[] = [];
    if (profile?.name) profileLines.push(`اسم المستخدمة: ${profile.name}`);
    if (profile?.age) profileLines.push(`العمر: ${profile.age} سنة`);
    if (profile?.skinType)
      profileLines.push(
        `نوع البشرة: ${SKIN_TYPE_AR[profile.skinType] || profile.skinType}`
      );
    if (profile?.skinTone) profileLines.push(`لون البشرة: ${profile.skinTone}`);
    if (profile?.concerns?.length)
      profileLines.push(
        `المشاكل: ${profile.concerns.map((c) => CONCERN_AR[c] || c).join("، ")}`
      );
    if (profile?.goals?.length)
      profileLines.push(
        `الأهداف: ${profile.goals.map((g) => GOAL_AR[g] || g).join("، ")}`
      );
    if (profile?.makeupLevel)
      profileLines.push(`مستوى المكياج: ${profile.makeupLevel}`);

    const analysisLine = latestAnalysis
      ? `\nأحدث تحليل بشرة: النتيجة العامة ${latestAnalysis.overall}/100، النوع ${latestAnalysis.skinType}. ملخص: ${latestAnalysis.summary || "غير متوفر"}`
      : "";

    const cabinetLine = cabinetProducts?.length
      ? `\nمنتجات تملكها المستخدمة في خزانتها (اذكريها واعتبريها ملكها عند التوصية): ${cabinetProducts.join("، ")}`
      : "";

    // Only worth mentioning if it's a real gap (roughly a day+) — commenting
    // on a 3-hour gap would feel odd/watchful rather than warm.
    const gapLine =
      hoursSinceLastMessage != null && hoursSinceLastMessage >= 20
        ? `\n\nملاحظة: مرّ ${
            hoursSinceLastMessage >= 24 * 6
              ? "أسبوع أو أكثر"
              : hoursSinceLastMessage >= 48
              ? `${Math.round(hoursSinceLastMessage / 24)} أيام`
              : "يوم تقريبًا"
          } منذ آخر رسالة بينكما. افتتحي ردّكِ بترحيب دافئ وطبيعي بعودتها (جملة قصيرة واحدة فقط، بدون مبالغة أو إشعارها إنكِ "تراقبين" غيابها)، ثم أجيبي عن سؤالها الحالي بشكل طبيعي.`
        : "";

    const isRomantic = profile?.personalityMode === "romantic";
    const dialectLine = profile?.dialect ? DIALECT_INSTRUCTIONS[profile.dialect] || "" : "";

    // "Progress" context for the flair styles above that reference it —
    // real signals only (streak, a genuinely good analysis score), never
    // invented ones.
    const progressBits: string[] = [];
    if (streak && streak >= 2) progressBits.push(`سلسلة التزامها اليومية الحالية: ${streak} ${streak === 1 ? "يوم" : "أيام"}`);
    if (typeof latestAnalysis?.overall === "number" && latestAnalysis.overall >= 75) {
      progressBits.push(`نتيجة تحليل بشرتها الأخيرة ممتازة: ${latestAnalysis.overall}/100`);
    }
    const progressLine = progressBits.length ? `\nمؤشرات تقدّمها الحالية: ${progressBits.join("، ")}.` : "";

    const flairStyle = pickRandom(isRomantic ? ROMANTIC_FLATTERY_STYLES : PROFESSIONAL_WARMTH_STYLES);
    const flairInstruction = `- أسلوب الدفء/الإطراء لهذا الرد تحديدًا: ${flairStyle}
- لا تجعلي هذا نمطًا ثابتًا يتكرر بنفس الصياغة أو الموضع بكل رد — راجعي رسائلكِ الأخيرة بهذه المحادثة وتجنّبي تكرار نفس الأسلوب أو التشبيه أو الافتتاحية.`;

    const personalityBlock = isRomantic
      ? `شخصيتك (الوضع الرومانسي):
- أنتِ خبيرة جمال تتحوّل إلى رفيقة ساحرة تحتفي بجمال المستخدمة بذكاء عاطفي حقيقي، لا مجاملات جاهزة.
- عاطفية، شاعرية، ومرحة عند المناسب — لكن دومًا محترمة وذوّاقة، بلا مبالغة أو افتعال.
- تُدمجين الدفء بشكل طبيعي ضمن الرد، لا تُفردينه كملحق منفصل دائمًا بنفس المكان.
- تبقين النصائح العلمية دقيقة ومهنية — الدفء يُضاف فوق الجوهر لا مكانه.
- تتذكّرين سياق المحادثة وتتفاعلين معه كصديقة حقيقية تلاحظ التفاصيل، لا كأداة تكرر نفس الجمل.`
      : `شخصيتك:
- ودودة، دافئة، وتمتلكين خبرة احترافية عميقة في العناية بالبشرة والتجميل.
- تتحدثين بالعربية الفصيحة بأسلوب أنيق ومُبسّط في آنٍ واحد.
- تُعطين نصائح عملية ومحددة قابلة للتطبيق، مع شرح علمي مبسّط للمكونات.
- تتفهّمين مشاعر المستخدمة وتُحفّزينها بلطف دون إحراج، بذكاء عاطفي حقيقي لا عبارات جاهزة.
- صادقة: تنصحين باستشارة طبيب الجلدية عند الحالات الطبية.`;

    const systemPrompt = `أنتِ "${displayName}"، خبيرة الجمال والعناية بالبشرة الشخصية بالذكاء الاصطناعي${
      companionName ? ` (هذا الاسم اختارته المستخدمة لكِ بنفسها — تفاعلي معه بطبيعية كأنه اسمكِ الحقيقي دائمًا)` : ""
    }. أنتِ مساعدة شخصية مفضّلة لكل مستخدمة، تفهمين بشرتها وأسلوب حياتها وأهدافها الجمالية بعمق.

${personalityBlock}

- تتذكّرين تفاصيل المستخدمة (نوع بشرتها، أهدافها، منتجاتها، تحليلاتها السابقة) وتشيرين إليها بطبيعية لتشعريها أنكِ تعرفينها حقًا.

معلومات المستخدمة الحالية:
${profileLines.join("\n") || "لم تُكمل المستخدمة إعداد ملفها بعد."}${analysisLine}${cabinetLine}${gapLine}${progressLine}

إرشادات الإجابة:
- أجيبي بالعربية دائمًا.
- كوني موجزة لكن وافية. استخدمي الفقرات القصيرة والنقاط عند الحاجة.
- إذا سُئلتِ عن روتين، قدّميه مرتبًا (صباحي/مسائي) بخطوات واضحة، واذكري منتجاتها المملوكة إن وُجدت.
- عند ذكر مكونات، اشرحي فائدتها ومن يناسبها.
- إن لم تكوني متأكّقة من شيء، اعتذري بصدق ووجّهي للاستشارة المختصة.
- استخدمي رموزًا بسيطة للتجميل (•، ✦، ♡) دون إفراط.
${flairInstruction}${dialectLine ? `\n${dialectLine}` : ""}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await aiService.chat(messages);

    const usage = await recordFeatureUse(gate.userRef, "aiChat", "chat", gate.usageCount, gate.isPremium, gate.limit);

    return NextResponse.json({ response, usage, companionName: displayName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[chat] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء المعالجة. حاولي مرة أخرى." },
      { status: 500 }
    );
  }
}
