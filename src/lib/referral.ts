/**
 * Shared by both the server (api/auth/complete-signup) and the client
 * (invite-screen.tsx) so the reward threshold and code format never drift
 * into two copies of the same number/logic.
 */

// Invite 3 friends → unlock the "circle-of-glow" achievement (see
// DEFAULT_ACHIEVEMENTS in store.ts) — a one-time cosmetic badge, first
// crossing only.
//
// On top of that, EVERY multiple of REFERRAL_REWARD_THRESHOLD (3, 6, 9…)
// grants VIP_TRIAL_DAYS_PER_REWARD days of real VIP access
// (users/{uid}.vipTrialExpiresAt) — repeatable for as long as she keeps
// inviting. This trial is intentionally kept separate from isPremium:
// isPremium stays exactly what it always meant (paid, active RevenueCat
// subscription, written only by the webhook) and is never mutated here.
// The trial is combined with real billing state at read time by
// computeVipAccess() (src/lib/vip-access.ts) — that shared helper is what
// every server route and client screen should call to know "does she have
// VIP right now", instead of checking isPremium directly.
export const REFERRAL_REWARD_THRESHOLD = 3;

// One reward cycle (3 invites) = one week of VIP access.
export const VIP_TRIAL_DAYS_PER_REWARD = 7;
const VIP_TRIAL_MS_PER_REWARD = VIP_TRIAL_DAYS_PER_REWARD * 24 * 60 * 60 * 1000;

/**
 * Stacking/renewable extension: if she already has time left on an active
 * trial, the new week is added on top of that remaining time rather than
 * overwriting it (inviting again before the current trial runs out should
 * never shorten what she already earned). If the previous trial already
 * expired (or never existed), the new week starts fresh from now.
 */
export function extendVipTrial(currentExpiresAt: number | null | undefined): number {
  const base = currentExpiresAt && currentExpiresAt > Date.now() ? currentExpiresAt : Date.now();
  return base + VIP_TRIAL_MS_PER_REWARD;
}

// Unambiguous uppercase alphabet — no 0/O, 1/I/L — so a code read aloud or
// retyped from a screenshot doesn't get misread.
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateReferralCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
  }
  return code;
}

export function referralShareLink(code: string): string {
  // Web link — works whether or not the app is installed (falls through to
  // the PWA/web experience, which is how most invitees will land on their
  // first click). The Capacitor deep link (rawnak://referral/<code>) is a
  // separate, native-only path already handled in use-deep-links.ts for
  // people who already have the app.
  return `https://www.rawnakapp.com/?ref=${code}`;
}
