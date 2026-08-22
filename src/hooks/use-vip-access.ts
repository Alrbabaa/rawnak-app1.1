"use client";

import { useAppStore } from "@/lib/store";
import { computeVipAccess, vipTrialDaysRemaining } from "@/lib/vip-access";

/**
 * Single client-side source of truth for "does she have VIP right now" —
 * combines real billing (profile.isPremium) with an active referral trial
 * (profile.vipTrialExpiresAt). Screens should read this instead of
 * `profile.isPremium` directly whenever the question is "can she use this
 * VIP feature" or "should the VIP badge show" — `profile.isPremium` alone
 * only reflects paid billing state and will under-report access for
 * someone currently on a referral trial.
 *
 * Server-side enforcement mirrors this via computeVipAccess() directly in
 * src/lib/feature-gate.ts and src/app/api/cabinet/scan/route.ts — this
 * hook is not itself an enforcement point, just the client's UI mirror of
 * the same rule.
 */
export function useHasVipAccess(): boolean {
  return useVipAccessStatus() === "vip";
}

export type VipAccessStatus = "unknown" | "vip" | "normal";

/**
 * Tri-state subscription resolution. Authenticated users remain unknown
 * until Firestore has supplied entitlement fields for their exact uid.
 * Unknown is fail-closed: callers never receive VIP access from it.
 */
export function useVipAccessStatus(): VipAccessStatus {
  const profile = useAppStore((s) => s.profile);
  const isAuthed = useAppStore((s) => s.isAuthed);
  const isGuest = useAppStore((s) => s.isGuest);
  const authUid = useAppStore((s) => s.authUid);
  const resolvedUid = useAppStore((s) => s.subscriptionResolvedUid);

  if (!isAuthed || isGuest) return "normal";
  if (!authUid || resolvedUid !== authUid) return "unknown";
  return computeVipAccess(profile.isPremium, profile.subscriptionExpiresAt, profile.vipTrialExpiresAt)
    ? "vip"
    : "normal";
}

/** Days left on an active referral VIP trial (0 if none/expired/on real billing). */
export function useVipTrialDaysRemaining(): number {
  const vipTrialExpiresAt = useAppStore((s) => s.profile.vipTrialExpiresAt);
  return vipTrialDaysRemaining(vipTrialExpiresAt);
}
