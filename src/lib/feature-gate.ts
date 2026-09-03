import { NextRequest, NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
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
  const settingsSnap = await adminDb.collection("settings").doc("general").get();
  const configured = settingsSnap.data()?.aiLimits?.[featureId] as Partial<FeatureLimit> | undefined;
  const defaults = FEATURE_LIMITS[featureId];
  const limit: FeatureLimit = {
    freeUses: Number.isInteger(configured?.freeUses) && configured!.freeUses! >= 0 ? configured!.freeUses! : defaults.freeUses,
    vipMonthlyCap: Number.isInteger(configured?.vipMonthlyCap) && configured!.vipMonthlyCap! >= 0 ? configured!.vipMonthlyCap! : defaults.vipMonthlyCap,
    normalResetIntervalHours: Number.isInteger(configured?.normalResetIntervalHours) && configured!.normalResetIntervalHours! > 0 ? configured!.normalResetIntervalHours! : defaultResetIntervalHours(featureId, false),
    vipResetIntervalHours: Number.isInteger(configured?.vipResetIntervalHours) && configured!.vipResetIntervalHours! > 0 ? configured!.vipResetIntervalHours! : defaultResetIntervalHours(featureId, true),
  };

  const reservation = await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { kind: "missing" as const };

    const user = userSnap.data()!;
    const isPremium = computeVipAccess(user.isPremium, user.subscriptionExpiresAt, user.vipTrialExpiresAt);
    const tier = isPremium ? "vip" : "normal";
    const resetIntervalHours = isPremium ? limit.vipResetIntervalHours : limit.normalResetIntervalHours;
    const window = usageWindowHours(resetIntervalHours);
    const usageCount = (user.featureUsageWindows?.[featureName]?.[tier]?.aiDaily?.[window.key] as number | undefined) || 0;
    const quotaPath = `users/${session.uid}/featureUsageWindows/${featureName}/${tier}/aiDaily/${window.key}`;

    if (!canUseFeature(featureId, isPremium, usageCount, limit)) {
      console.info("[quota] denied", {
        uid: session.uid,
        featureId,
        featureName,
        tier,
        usageCount,
        limit: isPremium ? limit.vipMonthlyCap : limit.freeUses,
        resetIntervalHours,
        windowKey: window.key,
        quotaPath,
      });
      return { kind: "rejected" as const, isPremium, resetIntervalHours, window };
    }

    // Reserve the allowance before any provider call. Firestore serializes
    // concurrent requests for the same user document, so only one request
    // can reserve a one-use quota window.
    tx.update(
      userRef,
      new FieldPath("featureUsageWindows", featureName, tier, "aiDaily", window.key),
      FieldValue.increment(1)
    );
    console.info("[quota] reserved", {
      uid: session.uid,
      featureId,
      featureName,
      tier,
      usageBefore: usageCount,
      usageAfter: usageCount + 1,
      resetIntervalHours,
      windowKey: window.key,
      quotaPath,
    });
    return { kind: "reserved" as const, isPremium, usageCount, window };
  });

  if (reservation.kind === "missing") {
    return { ok: false, response: NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 }) };
  }
  if (reservation.kind === "rejected") {
    return {
      ok: false,
      response: NextResponse.json({
        error: `وصلتِ إلى الحد المتاح لأداة ${featureName}. سيُعاد ضبطه تلقائيًا بعد ${reservation.resetIntervalHours} ساعة.`,
        code: "QUOTA_EXCEEDED",
        upgradeRequired: !reservation.isPremium,
        limitReached: true,
        featureName,
        resetAt: reservation.window.resetAt,
      }, { status: 403 }),
    };
  }

  return { ok: true, uid: session.uid, userRef, isPremium: reservation.isPremium, usageCount: reservation.usageCount, limit };
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

  return {
    isPremium,
    used: usageCountBefore + 1,
    remainingFree: isPremium
      ? Math.max(0, (limit?.vipMonthlyCap ?? FEATURE_LIMITS[featureId].vipMonthlyCap) - usageCountBefore - 1)
      : remainingFreeUses(featureId, usageCountBefore + 1, limit),
    resetAt: window.resetAt,
  };
}
