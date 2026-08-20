import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";

/**
 * Permanently deletes the authenticated user's account and all data tied
 * to it — Firebase Auth record, Firestore documents across every
 * user-scoped collection, and any uploaded photos (skin-analysis,
 * product-scan, cabinet) in Storage.
 *
 * Required by:
 *  - Apple App Store Review Guideline 5.1.1(v) — in-app account deletion,
 *    not just deactivation.
 *  - Google Play User Data policy — in-app account + data deletion path.
 *
 * This is intentionally NOT a "deactivate" flag: the account row and its
 * dependents are actually removed, except where we're legally required to
 * retain something (see the `feedback` note below).
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "غير مصرح لكِ بهذا الإجراء" }, { status: 401 });
  }

  const uid = session.uid;

  try {
    // 1) Break the buddy pairing (if any) so the other side isn't left
    //    pointing at a deleted uid.
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data()! : null;

    if (userData?.buddyPairId && userData?.buddyUid) {
      const buddyRef = adminDb.collection("users").doc(userData.buddyUid as string);
      await buddyRef
        .set({ buddyPairId: null, buddyUid: null }, { merge: true })
        .catch(() => {});
      await adminDb
        .collection("buddyPairs")
        .doc(userData.buddyPairId as string)
        .delete()
        .catch(() => {});
    }
    if (userData?.buddyCode) {
      await adminDb.collection("buddyInviteCodes").doc(userData.buddyCode as string).delete().catch(() => {});
    }
    if (userData?.referralCode) {
      await adminDb.collection("referralCodes").doc(userData.referralCode as string).delete().catch(() => {});
    }

    // 2) Delete follow edges in both directions.
    const [asFollower, asFollowing] = await Promise.all([
      adminDb.collection("follows").where("followerId", "==", uid).get(),
      adminDb.collection("follows").where("followingId", "==", uid).get(),
    ]);
    const followDeletes = [...asFollower.docs, ...asFollowing.docs].map((d) => d.ref.delete());

    // 3) Delete other user-scoped collections.
    const [activitySnap, usageSnap] = await Promise.all([
      adminDb.collection("activity").where("userId", "==", uid).get(),
      adminDb.collection("imageAnalysisUsage").where("userId", "==", uid).get(),
    ]);
    const otherDeletes = [
      ...activitySnap.docs.map((d) => d.ref.delete()),
      ...usageSnap.docs.map((d) => d.ref.delete()),
      adminDb.collection("supportThreads").doc(uid).delete().catch(() => {}),
    ];

    await Promise.all([...followDeletes, ...otherDeletes]);

    // Feedback notes: retained but disassociated from the account rather
    // than deleted outright, since it may be needed as a business record
    // of past support interactions. Remove this block if that's not
    // desired for your use case.
    const feedbackSnap = await adminDb.collection("feedback").where("userId", "==", uid).get();
    await Promise.all(
      feedbackSnap.docs.map((d) => d.ref.set({ userId: null, userEmail: null }, { merge: true }))
    );

    // 4) Delete all uploaded files for this user (skin-analysis photos,
    //    product scans, cabinet images, avatar, etc.).
    try {
      const bucket = adminStorage.bucket();
      await bucket.deleteFiles({ prefix: `users/${uid}/` });
    } catch (storageErr) {
      console.error("[account/delete] storage cleanup failed:", storageErr);
      // Don't block deletion on storage cleanup failing — the account and
      // Firestore data deletion below is the part that must succeed.
    }

    // 5) Delete the Firestore user document itself.
    await userRef.delete().catch(() => {});

    // 6) Finally, delete the Firebase Auth user. If this app supports
    //    "Sign in with Apple", revoke the Apple token BEFORE this step
    //    (see Apple's Sign in with Apple REST API — token revocation is
    //    required by 5.1.1(v) when that provider was used).
    await adminAuth.deleteUser(uid);

    return NextResponse.json({
      success: true,
      message: "تم حذف حسابكِ وجميع بياناتكِ بنجاح.",
    });
  } catch (error: any) {
    console.error("[account/delete] error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف الحساب. يرجى المحاولة لاحقاً أو التواصل مع الدعم." },
      { status: 500 }
    );
  }
}
