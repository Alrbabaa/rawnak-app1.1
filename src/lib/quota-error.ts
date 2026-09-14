/**
 * Shared free-quota-exceeded UX (Rawnak 2.0, section 6).
 *
 * Every AI route's 403 response (see checkFeatureGate in feature-gate.ts)
 * already carries real backend data: `code: "QUOTA_EXCEEDED"`, the actual
 * `resetAt` timestamp for when the free balance renews, and
 * `upgradeRequired`. This turns that into one clear, human message
 * instead of each screen re-deriving (or ignoring) it differently —
 * never a hardcoded renewal date, always the real value the backend
 * already computed for that specific user/feature/tier.
 */
export interface QuotaErrorPayload {
  error?: string;
  code?: string;
  upgradeRequired?: boolean;
  limitReached?: boolean;
  featureName?: string;
  resetAt?: number;
}

export function isQuotaExceeded(payload: unknown): payload is QuotaErrorPayload {
  return !!payload && typeof payload === "object" && (payload as QuotaErrorPayload).code === "QUOTA_EXCEEDED";
}

/** "خلال 3 ساعات" / "خلال دقائق" / "الساعة 5:30 م" — whichever reads more
 * naturally for how far away the real resetAt is. */
function formatResetEta(resetAt: number): string {
  const diffMs = resetAt - Date.now();
  if (diffMs <= 0) return "قريبًا جدًا";

  const diffHours = diffMs / (60 * 60 * 1000);
  if (diffHours < 1) return "خلال دقائق";
  if (diffHours < 24) {
    const hours = Math.ceil(diffHours);
    return `خلال ${hours} ${hours === 1 ? "ساعة" : "ساعات"}`;
  }
  const date = new Date(resetAt);
  return `يوم ${date.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "short" })}`;
}

/** Full human message: what ended, when it renews, what to do next. */
export function describeQuotaError(payload: QuotaErrorPayload): string {
  const feature = payload.featureName ? `تجربتكِ المجانية من ${payload.featureName}` : "تجربتكِ المجانية";
  const resetPart = payload.resetAt ? ` — تُجدَّد ${formatResetEta(payload.resetAt)}` : "";
  const upgradePart = payload.upgradeRequired ? " أو رقّي لعضوية VIP لاستخدام غير محدود تقريبًا الآن." : "";
  return `استخدمتِ ${feature}${resetPart}.${upgradePart}`;
}
