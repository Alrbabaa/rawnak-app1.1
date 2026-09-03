import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { computeVipAccess } from "@/lib/vip-access";
import { usageWindow } from "@/lib/features";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const snapshot = await adminDb.collection("users").doc(session.uid).get();
  if (!snapshot.exists) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });

  const user = snapshot.data() || {};
  const isVip = computeVipAccess(user.isPremium, user.subscriptionExpiresAt, user.vipTrialExpiresAt);
  const window = usageWindow(1);
  const dailyUsage = (user.featureUsageWindows?.normal?.aiDaily?.[window.key] as number | undefined) || 0;

  return NextResponse.json({
    uid: session.uid,
    isVip,
    freeDailyLimit: 1,
    dailyUsage,
    dailyRemaining: isVip ? null : Math.max(0, 1 - dailyUsage),
    resetAt: window.resetAt,
    quotaPolicy: "shared-daily-v1",
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || "local",
  });
}