/**
 * Effective VIP access = real subscription (isPremium, billing truth from
 * the RevenueCat webhook) OR an active referral VIP trial
 * (vipTrialExpiresAt, granted every 3 successful invites — see
 * src/lib/referral.ts and /api/auth/complete-signup). Kept as one shared
 * helper so server-side enforcement (feature-gate.ts) and every client
 * screen agree on exactly the same definition of "has VIP right now",
 * instead of five places each re-deriving it slightly differently.
 *
 * isPremium itself is never mutated by the trial — it keeps meaning
 * exactly what it always meant (paid, active RevenueCat subscription).
 */
export function hasActiveVipTrial(vipTrialExpiresAt: number | null | undefined): boolean {
  return !!vipTrialExpiresAt && vipTrialExpiresAt > Date.now();
}

export function computeVipAccess(
  isPremium: boolean | null | undefined,
  subscriptionExpiresAt: number | null | undefined,
  vipTrialExpiresAt: number | null | undefined
): boolean {
  const billingActive = !!isPremium && (subscriptionExpiresAt == null || subscriptionExpiresAt > Date.now());
  return billingActive || hasActiveVipTrial(vipTrialExpiresAt);
}

/**
 * Days left on the referral VIP trial, rounded up (0 if none/expired) —
 * for display only (e.g. "VIP trial: 4 days left"). Never used for
 * enforcement; computeVipAccess()/hasActiveVipTrial() are the source of
 * truth for whether access is actually granted.
 */
export function vipTrialDaysRemaining(vipTrialExpiresAt: number | null | undefined): number {
  if (!hasActiveVipTrial(vipTrialExpiresAt)) return 0;
  return Math.ceil((vipTrialExpiresAt! - Date.now()) / (24 * 60 * 60 * 1000));
}
