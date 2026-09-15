import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { generateReferralCode, extendVipTrial, REFERRAL_REWARD_THRESHOLD, WELCOME_GIFT_TRIAL_MS } from "@/lib/referral";

export const runtime = "nodejs";

interface ReqBody {
  name?: string;
  referralCode?: string;
}

interface MinimalUserData {
  name: string;
  email: string;
}

/**
 * Attributes `referralCode` to `userRef` (uid) exactly once, however many
 * times this whole route ends up being called for the same person.
 *
 * Why this needs to be its own transaction (fixed 2026-08 — was previously
 * plain sequential reads/writes, only ever run once at brand-new-signup
 * time): a network hiccup, an OAuth-redirect reload, or simply the
 * "idempotent, safe to call on every login" design this route documents
 * means complete-signup can genuinely run more than once for the same
 * account — including a first call that creates users/{uid} but then
 * drops offline before it reaches the referral-crediting step below. The
 * OLD code only ever tried to credit a referral inside the "brand new
 * user" branch, so a retry after that kind of partial failure would see
 * the user doc already exists and skip referral crediting forever —
 * silently costing the referrer (person, company, or influencer) a
 * referral they genuinely earned. Running the whole "already credited? →
 * no → credit it" check-and-write as one Firestore transaction closes
 * that gap (safe to call again any time) and also makes two concurrent
 * calls (e.g. a double-tap, or web + native both finishing an OAuth
 * redirect) impossible to double-count, since Firestore transactions
 * serialize conflicting reads/writes automatically.
 */
async function creditReferral(
  userRef: FirebaseFirestore.DocumentReference,
  uid: string,
  referralCode: string,
  userData: MinimalUserData
): Promise<void> {
  try {
    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const existingData = userSnap.data() || {};

      // Already attributed — by this call or an earlier one, partner or
      // peer. Never re-attribute (protects the FIRST genuine referrer's
      // credit from being overwritten by a later/different code, and
      // guarantees this whole function only ever runs its writes once).
      if (existingData.referredByPartnerId || existingData.referredByUid) return;

      // Try a B2B partner code first — reads must all happen before any
      // writes in a Firestore transaction, so this and the peer-code read
      // below both go through `tx.get()`.
      const partnerQuery = adminDb
        .collection("referralPartners")
        .where("referralCode", "==", referralCode)
        .limit(1);
      const partnerSnap = await tx.get(partnerQuery);

      if (!partnerSnap.empty) {
        const partnerDoc = partnerSnap.docs[0];
        const partner = partnerDoc.data();
        if (partner.status === "active") {
          tx.set(partnerDoc.ref.collection("referrals").doc(uid), {
            referralCode: partner.referralCode,
            name: userData.name,
            email: userData.email,
            registeredAt: Date.now(),
            subscriptionStatus: "none",
            totalRevenueCents: 0,
            commissionAmountCents: 0,
          });
          // Denormalized reverse pointer: lets the subscription webhook
          // find "which partner referred this user" with a single doc
          // read (users/{uid}.referredByPartnerId) instead of a fragile
          // collectionGroup lookup across every partner's referrals
          // subcollection by document ID.
          tx.set(userRef, { referredByPartnerId: partnerDoc.id }, { merge: true });
        }
        // Matched a partner code (active or not) — never also try
        // resolving it as a peer code, same as before.
        return;
      }

      // Not a partner code — try resolving it as another user's personal
      // invite code instead. Same input field on the auth screen serves
      // both purposes; whichever collection actually has the code wins.
      const codeSnap = await tx.get(adminDb.collection("referralCodes").doc(referralCode));
      if (!codeSnap.exists) return;

      const referrerUid = codeSnap.data()!.uid as string;
      // Defensive — a self-referral shouldn't be reachable (the new
      // user's own code is minted separately) but guard anyway.
      if (!referrerUid || referrerUid === uid) return;

      const referrerRef = adminDb.collection("users").doc(referrerUid);
      const referrerSnap = await tx.get(referrerRef);
      const referrerData = referrerSnap.data() || {};
      const newCount = ((referrerData.referralInvitesCount as number) || 0) + 1;

      tx.set(referrerRef.collection("referralInvites").doc(uid), {
        name: userData.name,
        email: userData.email,
        joinedAt: Date.now(),
      });
      // referredByName is denormalized here (not looked up live) purely
      // for display — "🎁 <name> أهدتكِ 3 أيام VIP" on the invitee's home
      // screen (see rawnak-gift-welcome.tsx) — so that banner never needs
      // an extra read of the referrer's own profile.
      tx.set(
        userRef,
        {
          referredByUid: referrerUid,
          referredByName: referrerData.name || null,
          // "أهدي VIP" — the invitee's welcome gift: a real VIP trial,
          // granted once, immediately, funded by the exact same
          // vipTrialExpiresAt/extendVipTrial mechanism the referrer's own
          // every-3-invites reward uses below. Never touches isPremium or
          // RevenueCat — this is trial time, same as any other trial time.
          // existingData.vipTrialExpiresAt is whatever she already had
          // before this signup (normally none, but stacks safely either
          // way — see extendVipTrial's doc comment).
          vipTrialExpiresAt: extendVipTrial(
            existingData.vipTrialExpiresAt as number | null | undefined,
            WELCOME_GIFT_TRIAL_MS
          ),
        },
        { merge: true }
      );

      const rewardUpdates: Record<string, unknown> = { referralInvitesCount: newCount };
      // One-time cosmetic badge — first crossing of the threshold only.
      if (newCount >= REFERRAL_REWARD_THRESHOLD && !referrerData.referralRewardUnlockedAt) {
        rewardUpdates.referralRewardUnlockedAt = Date.now();
      }
      // Repeatable VIP trial — every multiple of the threshold (3, 6, 9…)
      // adds another week, stacking on any time she already has left.
      if (newCount > 0 && newCount % REFERRAL_REWARD_THRESHOLD === 0) {
        const currentExpiresAt = referrerData.vipTrialExpiresAt as number | null | undefined;
        rewardUpdates.vipTrialExpiresAt = extendVipTrial(currentExpiresAt);
      }
      tx.set(referrerRef, rewardUpdates, { merge: true });
    });
  } catch (e) {
    console.error("[complete-signup] referral crediting failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Creates users/{firebaseUid} directly — the Firebase UID IS the document
 * ID. Every new user also gets their own personal referral code
 * (peer-to-peer growth loop, separate from the B2B partner system) — see
 * src/lib/referral.ts. `referralCodes/{code}` is a flat lookup collection
 * (code -> uid) so resolving someone else's code back to a referrer is a
 * single doc read instead of a query; `.create()` on that collection is
 * what actually enforces code uniqueness (fails if the code is taken).
 *
 * Idempotent and safe to call on every sign-in (email/password, Google,
 * or Apple — the client calls this exact same endpoint after all three):
 * an existing account just gets its profile re-returned (+ a one-time
 * referral-code backfill for pre-feature accounts). Referral crediting
 * itself (see creditReferral above) is *also* safe to re-run — it's a
 * no-op once already attributed — so it runs on every call that carries
 * a referralCode, not just the brand-new-account path.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const body = (await req.json()) as ReqBody;
    const name = body.name?.trim();
    const referralCode = body.referralCode?.trim().toUpperCase();

    const userRef = adminDb.collection("users").doc(session.uid);
    const existing = await userRef.get();

    if (existing.exists) {
      const u = existing.data()!;
      let existingReferralCode = (u.referralCode as string | undefined) || null;

      // Backfill for accounts created before the peer-referral feature
      // existed — same collision-safe generation as new signups.
      if (!existingReferralCode) {
        for (let attempt = 0; attempt < 5 && !existingReferralCode; attempt++) {
          const candidate = generateReferralCode();
          try {
            await adminDb.collection("referralCodes").doc(candidate).create({
              uid: session.uid,
              createdAt: Date.now(),
            });
            existingReferralCode = candidate;
            await userRef.set({ referralCode: candidate }, { merge: true });
          } catch {
            // Collision — try again.
          }
        }
      }

      // See creditReferral's doc comment: this is what closes the "user
      // doc got created but the app never got the referral-crediting
      // step to finish" gap. No-ops instantly if already attributed.
      if (referralCode) {
        await creditReferral(userRef, session.uid, referralCode, {
          name: u.name || "",
          email: u.email || session.email,
        });
      }

      return NextResponse.json({
        ok: true,
        user: { id: session.uid, email: u.email, name: u.name, referralCode: existingReferralCode },
      });
    }

    const userData: MinimalUserData & Record<string, unknown> = {
      email: session.email,
      name: name || session.email.split("@")[0],
      age: null,
      skinType: null,
      skinTone: null,
      concerns: [],
      goals: [],
      makeupLevel: null,
      lifestyle: [],
      avatar: "",
      createdAt: Date.now(),
    };
    await userRef.set(userData);

    // Personal referral code (peer growth loop) — retry on the rare
    // collision instead of trusting randomness alone; `.create()` fails
    // atomically if the code is already taken.
    let myReferralCode: string | null = null;
    for (let attempt = 0; attempt < 5 && !myReferralCode; attempt++) {
      const candidate = generateReferralCode();
      try {
        await adminDb.collection("referralCodes").doc(candidate).create({
          uid: session.uid,
          createdAt: Date.now(),
        });
        myReferralCode = candidate;
      } catch {
        // Collision (doc already exists) — try again with a new candidate.
      }
    }
    if (myReferralCode) {
      await userRef.set({ referralCode: myReferralCode }, { merge: true });
    } else {
      console.error("[complete-signup] could not allocate a unique referral code after 5 attempts");
    }

    if (referralCode) {
      await creditReferral(userRef, session.uid, referralCode, userData);
    }

    return NextResponse.json({
      ok: true,
      user: { id: session.uid, email: userData.email, name: userData.name, referralCode: myReferralCode },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[auth/complete-signup] error:", msg);
    return NextResponse.json({ error: "فشل إكمال إنشاء الحساب" }, { status: 500 });
  }
}
