/**
 * Central registry of "free trial, then VIP" feature usage caps.
 *
 * To gate a new feature this way:
 *   1. Add an entry here with its free-use count.
 *   2. On the server route: read the user's current usage count for this
 *      feature (users/{uid}.featureUsage.<id>), call canUseFeature()
 *      BEFORE doing the expensive work, reject with 403 if false.
 *   3. After a successful use, increment users/{uid}.featureUsage.<id> via
 *      FieldValue.increment(1).
 *   See /api/cabinet/scan/route.ts for the reference implementation.
 *
 * Client code can use canUseFeature()/remainingFreeUses() too, purely for
 * UI (showing "1 free scan left" / a VIP prompt before the user tries) —
 * the server-side check is what actually enforces the limit; the client
 * can't be trusted to self-report usage honestly.
 *
 * `vipMonthlyCap` is a SEPARATE, generous safety net for VIP/trial users —
 * "unlimited" in the marketing sense still needs a real ceiling, or a bug,
 * abuse, or one unusually heavy account has unbounded AI cost exposure
 * (skinAnalysis alone is two provider calls per use, see
 * src/lib/ai/image-analysis.ts). These numbers are sized to never be
 * noticed by a normal user — see checkFeatureGate() in feature-gate.ts for
 * how it's enforced and recordFeatureUse() for how it's tracked
 * (resets automatically every calendar month, no cron job needed).
 */
export const FEATURE_LIMITS = {
  cabinetAiScan: { freeUses: 1, vipMonthlyCap: 60, label: "مسح خزانة المكياج بالذكاء الاصطناعي" },
  skinAnalysis: { freeUses: 1, vipMonthlyCap: 30, label: "تحليل البشرة بالذكاء الاصطناعي" },
  aiChat: { freeUses: 1, vipMonthlyCap: 300, label: "استشارة خبيرة الجمال بالذكاء الاصطناعي" },
  productScan: { freeUses: 1, vipMonthlyCap: 60, label: "مسح المنتج بالذكاء الاصطناعي" },
  nutritionTips: { freeUses: 1, vipMonthlyCap: 60, label: "نصائح التغذية بالذكاء الاصطناعي" },
  recommendations: { freeUses: 1, vipMonthlyCap: 60, label: "التوصيات الذكية" },
  // Every AI feature now follows the same one-trial-then-VIP rule, incl.
  // this one (previously zero free uses). The "build my routine" button
  // in cabinet-screen.tsx was never client-gated by hasVipAccess to begin
  // with — only the server enforced it — so this change alone gives
  // everyone their first build for free with no UI edit needed.
  cabinetRoutine: { freeUses: 1, vipMonthlyCap: 60, label: "بناء روتين من الخزانة بالذكاء الاصطناعي" },
} as const;

export type FeatureId = keyof typeof FEATURE_LIMITS;
export interface FeatureLimit {
  freeUses: number;
  vipMonthlyCap: number;
  normalPeriodDays: number;
  vipPeriodDays: number;
}

export function defaultPeriodDays(featureId: FeatureId, isPremium: boolean): number {
  return isPremium ? 7 : 1;
}

export function defaultAiLimits(): Record<FeatureId, FeatureLimit> {
  return Object.fromEntries(
    Object.entries(FEATURE_LIMITS).map(([id, limit]) => [id, {
      freeUses: limit.freeUses,
      vipMonthlyCap: limit.vipMonthlyCap,
      normalPeriodDays: defaultPeriodDays(id as FeatureId, false),
      vipPeriodDays: defaultPeriodDays(id as FeatureId, true),
    }])
  ) as Record<FeatureId, FeatureLimit>;
}

export function canUseFeature(featureId: FeatureId, isPremium: boolean, usageCount: number, override?: FeatureLimit): boolean {
  const limit = override || FEATURE_LIMITS[featureId];
  if (!limit) return true; // unknown id — fail open, this is a growth gate not a security boundary
  return usageCount < (isPremium ? limit.vipMonthlyCap : limit.freeUses);
}

export function remainingFreeUses(featureId: FeatureId, usageCount: number, override?: FeatureLimit): number {
  const limit = override || FEATURE_LIMITS[featureId];
  if (!limit) return Infinity;
  return Math.max(0, limit.freeUses - usageCount);
}

/** UTC calendar-month key, e.g. "2026-08" — used to auto-reset
 * vipMonthlyCap counters with no scheduled job: each month just writes to
 * a differently-named field. */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Fixed UTC usage window. A new key automatically resets the counter. */
export function usageWindow(periodDays: number, now = Date.now()): { key: string; resetAt: number } {
  const safeDays = Math.max(1, Math.floor(periodDays));
  const windowMs = safeDays * 24 * 60 * 60 * 1000;
  const index = Math.floor(now / windowMs);
  return { key: `${safeDays}d-${index}`, resetAt: (index + 1) * windowMs };
}

/** True when a VIP/trial user has hit this month's soft cap. Free-trial
 * users never reach this — canUseFeature() already stops them first. */
export function vipMonthlyCapReached(featureId: FeatureId, monthlyCount: number, override?: FeatureLimit): boolean {
  const limit = override || FEATURE_LIMITS[featureId];
  if (!limit || limit.vipMonthlyCap === undefined) return false;
  return monthlyCount >= limit.vipMonthlyCap;
}
