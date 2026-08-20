import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import {
  canUseFeature,
  remainingFreeUses,
  currentMonthKey,
  vipMonthlyCapReached,
  FEATURE_LIMITS,
  type FeatureLimit,
  type FeatureId,
} from "@/lib/features";
import { computeVipAccess } from "@/lib/vip-access";

/**
 * Shared "requires login + VIP-or-free-trial" check for AI feature routes.
 * Mirrors the reference implementation in /api/cabinet/scan/route.ts —
 * pulled out into one place so every AI route enforces the same rule the
 * same way, instead of five near-identical copies drifting apart over time.
 *
 * Usage in a route handler, after the rate-limit check and before doing the
 * expensive AI call:
 *   const gate = await checkFeatureGate(req, "skinAnalysis");
 *   if (!gate.ok) return gate.response;
 *   ... do the AI work ...
 *   await recordFeatureUse(gate.userRef, "skinAnalysis");
 */
export async function checkFeatureGate(
  req: NextRequest,
  featureId: FeatureId
): Promise<
  | { ok: true; uid: string; userRef: FirebaseFirestore.DocumentReference; isPremium: boolean; usageCount: number; limit: FeatureLimit }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "يجب تسجيل الدخول لاستخدام هذه الميزة" }, { status: 401 }),
    };
  }

  const userRef = adminDb.collection("users").doc(session.uid);
  const [userSnap, settingsSnap] = await Promise.all([
    userRef.get(),
    adminDb.collection("settings").doc("general").get(),
  ]);
  if (!userSnap.exists) {
    return {
      ok: false,
      response: NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 }),
    };
  }

  const user = userSnap.data()!;
  // Effective VIP access = real billing (isPremium) OR an active referral
  // trial (vipTrialExpiresAt) — see src/lib/vip-access.ts. Everything
  // below this line (and everywhere this gate's `isPremium` is echoed back
  // to the client) means "does she have VIP access right now", not
  // strictly "is she a paying subscriber".
  const isPremium = computeVipAccess(user.isPremium, user.subscriptionExpiresAt, user.vipTrialExpiresAt);
  const usageCount = (user.featureUsage?.[featureId] as number | undefined) || 0;
  const configured = settingsSnap.data()?.aiLimits?.[featureId] as Partial<FeatureLimit> | undefined;
  const defaults = FEATURE_LIMITS[featureId];
  const limit: FeatureLimit = {
    freeUses: Number.isInteger(configured?.freeUses) && configured!.freeUses! >= 0 ? configured!.freeUses! : defaults.freeUses,
    vipMonthlyCap: Number.isInteger(configured?.vipMonthlyCap) && configured!.vipMonthlyCap! >= 0 ? configured!.vipMonthlyCap! : defaults.vipMonthlyCap,
  };

  if (!canUseFeature(featureId, isPremium, usageCount, limit)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "استخدمتِ تجربتكِ المجانية لهذه الميزة. رقّي لـ VIP لاستخدامها بلا حدود.",
          upgradeRequired: true,
        },
        { status: 403 }
      ),
    };
  }

  // VIP "unlimited" is a soft monthly cap, not literally infinite — see
  // the doc comment on FEATURE_LIMITS in features.ts for why. Sized to
  // never affect a normal user; free-trial users never reach this check.
  if (isPremium) {
    const monthKey = currentMonthKey();
    const monthlyCount =
      (user.featureUsageMonthly?.[featureId]?.[monthKey] as number | undefined) || 0;
    if (vipMonthlyCapReached(featureId, monthlyCount, limit)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "وصلتِ للحد الشهري لهذه الميزة ضمن VIP. سيُعاد الحد تلقائيًا مطلع الشهر القادم.",
            monthlyLimitReached: true,
          },
          { status: 429 }
        ),
      };
    }
  }

  return { ok: true, uid: session.uid, userRef, isPremium, usageCount, limit };
}

/** Call after a successful AI call. Returns usage info for the response payload. */
export async function recordFeatureUse(
  userRef: FirebaseFirestore.DocumentReference,
  featureId: FeatureId,
  usageCountBefore: number,
  isPremium: boolean,
  limit?: FeatureLimit
) {
  const update: Record<string, FirebaseFirestore.FieldValue> = {
    [`featureUsage.${featureId}`]: FieldValue.increment(1),
  };
  // Only VIP/trial users need the monthly counter — free-trial users are
  // already bounded by the lifetime featureUsage count above.
  if (isPremium) {
    update[`featureUsageMonthly.${featureId}.${currentMonthKey()}`] = FieldValue.increment(1);
  }
  await userRef.set(update, { merge: true });
  return {
    isPremium,
    used: usageCountBefore + 1,
    remainingFree: remainingFreeUses(featureId, usageCountBefore + 1, limit),
  };
}
