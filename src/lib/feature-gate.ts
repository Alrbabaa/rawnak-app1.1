import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import {
  canUseFeature,
  defaultResetIntervalHours,
  FEATURE_LIMITS,
  remainingFreeUses,
  usageWindowHours,
  type FeatureId,
  type FeatureLimit,
} from "@/lib/features";
import { computeVipAccess } from "@/lib/vip-access";

/** Server-side usage gate shared by every AI route. */
export async function checkFeatureGate(
  req: NextRequest,
  featureId: FeatureId,
  featureName: string
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
    normalResetIntervalHours: Number.isInteger(configured?.normalResetIntervalHours) && configured!.normalResetIntervalHours! > 0 ? configured!.normalResetIntervalHours! : defaultResetIntervalHours(featureId, false),
    vipResetIntervalHours: Number.isInteger(configured?.vipResetIntervalHours) && configured!.vipResetIntervalHours! > 0 ? configured!.vipResetIntervalHours! : defaultResetIntervalHours(featureId, true),
  };

  const tier = isPremium ? "vip" : "normal";
  const resetIntervalHours = isPremium ? limit.vipResetIntervalHours : limit.normalResetIntervalHours;
  const window = usageWindowHours(resetIntervalHours);
  const usageCount = (user.featureUsageWindows?.[featureName]?.[tier]?.aiDaily?.[window.key] as number | undefined) || 0;

  if (!canUseFeature(featureId, isPremium, usageCount, limit)) {
    return {
      ok: false,
      response: NextResponse.json({
        error: `وصلتِ إلى الحد المتاح لأداة ${featureName}. سيُعاد ضبطه تلقائيًا بعد ${resetIntervalHours} ساعة.`,
        upgradeRequired: !isPremium,
        limitReached: true,
        featureName,
        resetAt: window.resetAt,
      }, { status: 403 }),
    };
  }

  return { ok: true, uid: session.uid, userRef, isPremium, usageCount, limit };
}

/** Records a successful call in the current tier-specific time window. */
export async function recordFeatureUse(
  userRef: FirebaseFirestore.DocumentReference,
  featureId: FeatureId,
  featureName: string,
  usageCountBefore: number,
  isPremium: boolean,
  limit?: FeatureLimit
) {
  const resetIntervalHours = isPremium
    ? (limit?.vipResetIntervalHours ?? defaultResetIntervalHours(featureId, true))
    : (limit?.normalResetIntervalHours ?? defaultResetIntervalHours(featureId, false));
  const window = usageWindowHours(resetIntervalHours);
  const tier = isPremium ? "vip" : "normal";

  await userRef.set(
    {
      [`featureUsageWindows.${featureName}.${tier}.aiDaily.${window.key}`]: FieldValue.increment(1),
    },
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
