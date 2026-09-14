/**
 * Server-side counterpart to src/lib/personalization.ts.
 *
 * Turns the shared PersonalizationContext payload (sent by every
 * personalized screen — Rawnak Today, Occasion Planner, Weather Tips,
 * Recommendations, and any future feature) into a single prioritized
 * Arabic context block for the AI prompt.
 *
 * "Prioritize the most important context" (Rawnak 2.0 spec, section 3):
 * skin profile and the latest analysis matter most for beauty advice, so
 * they're listed first; cabinet/routine/occasion/weather follow, each
 * only when present. Nothing here is invented — a missing section is
 * simply omitted, never padded with a placeholder.
 */

export interface ServerPersonalizationContext {
  profile?: {
    age?: number | null;
    skinType?: string | null;
    skinTone?: string | null;
    concerns?: string[];
    goals?: string[];
    makeupLevel?: string | null;
    lifestyle?: string[];
  } | null;
  latestAnalysis?: {
    ts?: number;
    overall?: number;
    skinType?: string;
    metrics?: Record<string, number>;
    summary?: string;
  } | null;
  cabinet?: {
    total?: number;
    products?: { name: string; category?: string; favorite?: boolean }[];
  } | null;
  routine?: {
    morningPending?: string[];
    eveningPending?: string[];
    streak?: number;
  } | null;
  upcomingOccasion?: {
    occasion?: string;
    occasionLabel?: string;
    daysUntil?: number;
  } | null;
  weather?: { tempC?: number; label?: string } | null;
  vip?: { isVip?: boolean; onTrial?: boolean } | null;
  history?: { recentlyWatchedCount?: number; hasPastPlans?: boolean } | null;
}

/** Builds the shared "here's everything real we know about her" block.
 * `sections` lets a route opt out of sections it doesn't need (e.g. the
 * weather-tips route already asks for weather explicitly and doesn't
 * need cabinet/occasion) to keep prompts from growing unnecessarily. */
export function formatPersonalizationContext(
  ctx: ServerPersonalizationContext,
  sections?: Partial<Record<keyof ServerPersonalizationContext, boolean>>
): string {
  const include = (key: keyof ServerPersonalizationContext) => sections?.[key] !== false;
  const lines: string[] = [];

  if (include("profile") && ctx.profile) {
    const p = ctx.profile;
    const profileLines = [
      p.age ? `العمر: ${p.age}` : "",
      p.skinType ? `نوع البشرة: ${p.skinType}` : "",
      p.skinTone ? `لون البشرة: ${p.skinTone}` : "",
      p.concerns?.length ? `مشاكل البشرة: ${p.concerns.join("، ")}` : "",
      p.goals?.length ? `أهداف الجمال: ${p.goals.join("، ")}` : "",
      p.makeupLevel ? `مستوى خبرة المكياج: ${p.makeupLevel}` : "",
      p.lifestyle?.length ? `نمط الحياة: ${p.lifestyle.join("، ")}` : "",
    ].filter(Boolean);
    if (profileLines.length) lines.push(`ملف المستخدمة:\n${profileLines.join("\n")}`);
  }

  if (include("latestAnalysis") && ctx.latestAnalysis) {
    const a = ctx.latestAnalysis;
    const daysAgo = a.ts ? Math.floor((Date.now() - a.ts) / (24 * 60 * 60 * 1000)) : null;
    lines.push(
      `أحدث تحليل بشرة (${daysAgo !== null ? `منذ ${daysAgo} يوم` : "حديث"}): النتيجة العامة ${a.overall ?? "؟"}/100${
        a.summary ? ` — ${a.summary}` : ""
      }`
    );
  }

  if (include("cabinet") && ctx.cabinet?.products?.length) {
    const names = ctx.cabinet.products.map((p) => p.name).join("، ");
    lines.push(`منتجات تملكها المستخدمة في خزانتها (استخدميها عند الملاءمة): ${names}`);
  }

  if (include("routine") && ctx.routine) {
    const r = ctx.routine;
    const routineLines = [
      r.morningPending?.length ? `خطوات الصباح المتبقية اليوم: ${r.morningPending.join("، ")}` : "",
      r.eveningPending?.length ? `خطوات المساء المتبقية اليوم: ${r.eveningPending.join("، ")}` : "",
      r.streak ? `سلسلة الالتزام الحالية: ${r.streak} يوم متتالي` : "",
    ].filter(Boolean);
    if (routineLines.length) lines.push(routineLines.join("\n"));
  }

  if (include("upcomingOccasion") && ctx.upcomingOccasion?.occasionLabel) {
    const o = ctx.upcomingOccasion;
    lines.push(
      `مناسبة قادمة: ${o.occasionLabel}${o.daysUntil !== undefined ? ` (بعد ${o.daysUntil} يوم)` : ""}`
    );
  }

  if (include("weather") && ctx.weather?.label) {
    lines.push(`طقس اليوم الفعلي عند المستخدمة: ${ctx.weather.label}${ctx.weather.tempC !== undefined ? ` (${ctx.weather.tempC}°م)` : ""}`);
  }

  if (include("vip") && ctx.vip?.isVip) {
    lines.push(`المستخدمة عضوة VIP${ctx.vip.onTrial ? " (فترة تجريبية)" : ""} — يمكنكِ تقديم نصائح أعمق وأكثر تخصصًا.`);
  }

  return lines.join("\n\n");
}
