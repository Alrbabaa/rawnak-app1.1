/**
 * "صديقة التوهج" — mutual accountability buddy system.
 *
 * Shared by the server (api/buddy/*) and the client (invite-screen.tsx,
 * use-buddy-guard.ts) so the code format and privacy contract never drift
 * into two copies of the same logic — same pattern as src/lib/referral.ts.
 *
 * Privacy contract (deliberate, load-bearing): a buddy can ONLY ever see a
 * boolean — did her partner complete today's routine, yes or no. Never the
 * partner's streak count, skin analysis, photos, or any other profile
 * data. Every API route in api/buddy/* must preserve this; it is not an
 * implementation detail, it is the entire reason this feature is safe to
 * ship.
 */

// Unambiguous uppercase alphabet — no 0/O, 1/I/L — same alphabet as
// referral codes so both are equally easy to read aloud or retype.
const BUDDY_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateBuddyCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += BUDDY_CODE_ALPHABET[Math.floor(Math.random() * BUDDY_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Deterministic pair id from two uids, independent of who invited whom —
 * lets both the invite/accept route and any future lookup find the same
 * buddyPairs/{pairId} doc without a query, just like referralCodes/{code}
 * gives referral.ts a single-doc lookup instead of a query.
 */
export function buddyPairId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

export interface BuddyStatus {
  hasBuddy: boolean;
  buddyName: string | null;
  /** Did the CURRENT user complete her routine today. */
  meDoneToday: boolean;
  /** Did the BUDDY complete her routine today — the only fact she ever sees about her partner. */
  buddyDoneToday: boolean;
  /** This user's own invite code, so the screen can render/share it even before anyone has paired. */
  myCode: string;
  /** True once the pairing was created on a previous day, so a same-day pairing doesn't immediately show a false "she skipped today" before she's had a chance to do it as a buddy at all. */
  pairPredatesToday: boolean;
}

export function todayKeyUTC(d = new Date()): string {
  // Calendar-day key, not a timestamp — matches the "toDateString" style
  // day comparisons already used client-side in store.ts's checkIn().
  return d.toISOString().slice(0, 10);
}
