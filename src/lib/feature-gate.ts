import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import {
  canUseFeature,
  defaultPeriodDays,
  FEATURE_LIMITS,
  remainingFreeUses,
  usageWindow,
  type FeatureId,
  type FeatureLimit,
} from "@/lib/features";
import { computeVipAccess } from "@/lib/vip-access";

/** Server-side usage gate shared by every AI route. */
export async function checkFeatureGate(
  req: NextRequest,
  featureId: FeatureId
): Promise<
  | { ok: true; uid: string; userRef: FirebaseFirestore.DocumentReference; isPremium: boolean; usageCount: number; limit: FeatureLimit }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "يجب تسجيل الدخول لاستخدام هذه الميزة" }, { status: 401 }) };
  }

  const userRef = adminDb.collection("users").doc(session.uid);
  const [userSnap, settingsSnap] = await Promise.all([
    userRef.get(),
    adminDb.collection("settings").doc("general").get(),
  ]);
  if (!userSnap.exists) {
    return { ok: false, response: NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 }) };
  }

  const user = userSnap.data()!;
  const isPremium = computeVipAccess(user.isPremium, user.subscriptionExpiresAt, user.vipTrialExpiresAt);
  const configured = settingsSnap.data()?.aiLimits?.[featureId] as Partial<FeatureLimit> | undefined;
  const defaults = FEATURE_LIMITS[featureId];
  const limit: FeatureLimit = {
    freeUses: Number.isInteger(configured?.freeUses) && configured!.freeUses! >= 0 ? configured!.freeUses! : defaults.freeUses,
    vipMonthlyCap: Number.isInteger(configured?.vipMonthlyCap) && configured!.vipMonthlyCap! >= 0 ? configured!.vipMonthlyCap! : defaults.vipMonthlyCap,
    // All free AI features have one daily allowance. Keep this invariant
    // even if an older admin setting stores a longer period in Firestore.
    normalPeriodDays: 1,
    vipPeriodDays: Number.isInteger(configured?.vipPeriodDays) && configured!.vipPeriodDays! > 0 ? configured!.vipPeriodDays! : defaultPeriodDays(featureId, true),
  };

  const tier = isPremium ? "vip" : "normal";
  const window = usageWindow(isPremium ? limit.vipPeriodDays : limit.normalPeriodDays);
  const usageCount = (user.featureUsageWindows?.[tier]?.[featureId]?.[window.key] as number | undefined) || 0;

  if (!canUseFeature(featureId, isPremium, usageCount, limit)) {
    const periodDays = isPremium ? limit.vipPeriodDays : limit.normalPeriodDays;
    return {
      ok: false,
      response: NextResponse.json({
        error: `وصلتِ إلى الحد المتاح لهذه الميزة. سيُعاد ضبطه تلقائيًا كل ${periodDays} ${periodDays === 1 ? "يوم" : "أيام"}.`,
        upgradeRequired: !isPremium,
        limitReached: true,
        resetAt: window.resetAt,
      }, { status: 429 }),
    };
  }

  return { ok: true, uid: session.uid, userRef, isPremium, usageCount, limit };
}

/** Records a successful call in the current tier-specific time window. */
export async function recordFeatureUse(
  userRef: FirebaseFirestore.DocumentReference,
  featureId: FeatureId,
  usageCountBefore: number,
  isPremium: boolean,
  limit?: FeatureLimit
) {
  const periodDays = isPremium
    ? (limit?.vipPeriodDays ?? defaultPeriodDays(featureId, true))
    : (limit?.normalPeriodDays ?? defaultPeriodDays(featureId, false));
  const window = usageWindow(periodDays);
  const tier = isPremium ? "vip" : "normal";

  await userRef.set(
    { [`featureUsageWindows.${tier}.${featureId}.${window.key}`]: FieldValue.increment(1) },
    { merge: true }
  );

  return {
    isPremium,
    used: usageCountBefore + 1,
    remainingFree: isPremium
      ? Math.max(0, (limit?.vipMonthlyCap ?? FEATURE_LIMITS[featureId].vipMonthlyCap) - usageCountBefore - 1)
      : remainingFreeUses(featureId, usageCountBefore + 1, limit),
    resetAt: window.resetAt,
  };
}
