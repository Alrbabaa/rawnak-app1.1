import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { isRateLimited } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

// One doc per block edge, deterministic ID — same convention as
// followDocId() in follow/route.ts.
function blockDocId(blockerId: string, blockedId: string): string {
  return `${blockerId}_${blockedId}`;
}

/**
 * Blocking someone also severs any existing follow relationship in BOTH
 * directions (a blocked person shouldn't keep seeing the blocker's
 * public profile/streak just because she was already following her, and
 * the blocker shouldn't stay in the blocked person's followers list
 * either). This mirrors how iOS/Android social apps generally behave and
 * is what a reasonable App Store reviewer will expect to see happen.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    if (await isRateLimited(`social-block:user:${session.uid}`, 30, 60 * 1000)) {
      return NextResponse.json({ error: "طلبات كثيرة، حاولي بعد قليل" }, { status: 429 });
    }

    const { targetUid } = (await req.json()) as { targetUid?: string };
    if (!targetUid || typeof targetUid !== "string") {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }
    if (targetUid === session.uid) {
      return NextResponse.json({ error: "لا يمكنكِ حظر نفسكِ" }, { status: 400 });
    }

    const blockRef = adminDb.collection("blocks").doc(blockDocId(session.uid, targetUid));
    const blockSnap = await blockRef.get();
    if (blockSnap.exists) {
      return NextResponse.json({ ok: true, alreadyBlocked: true });
    }

    const batch = adminDb.batch();
    batch.set(blockRef, {
      blockerId: session.uid,
      blockedId: targetUid,
      createdAt: Date.now(),
    });

    // Sever the follow edge in both directions, if present, and keep the
    // counters on both user docs honest.
    const forwardEdgeRef = adminDb.collection("follows").doc(`${session.uid}_${targetUid}`);
    const reverseEdgeRef = adminDb.collection("follows").doc(`${targetUid}_${session.uid}`);
    const [forwardSnap, reverseSnap] = await Promise.all([forwardEdgeRef.get(), reverseEdgeRef.get()]);

    if (forwardSnap.exists) {
      batch.delete(forwardEdgeRef);
      batch.set(adminDb.collection("users").doc(session.uid), { followingCount: FieldValue.increment(-1) }, { merge: true });
      batch.set(adminDb.collection("users").doc(targetUid), { followersCount: FieldValue.increment(-1) }, { merge: true });
    }
    if (reverseSnap.exists) {
      batch.delete(reverseEdgeRef);
      batch.set(adminDb.collection("users").doc(targetUid), { followingCount: FieldValue.increment(-1) }, { merge: true });
      batch.set(adminDb.collection("users").doc(session.uid), { followersCount: FieldValue.increment(-1) }, { merge: true });
    }

    // Also tear down any active "buddy" pairing between the two, so a
    // blocked buddy can't keep seeing daily check-ins.
    const meSnap = await adminDb.collection("users").doc(session.uid).get();
    const me = meSnap.data();
    if (me?.buddyUid === targetUid && me?.buddyPairId) {
      batch.set(adminDb.collection("users").doc(session.uid), { buddyPairId: null, buddyUid: null }, { merge: true });
      batch.set(adminDb.collection("users").doc(targetUid), { buddyPairId: null, buddyUid: null }, { merge: true });
      batch.delete(adminDb.collection("buddyPairs").doc(me.buddyPairId as string));
    }

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/block] error:", msg);
    return NextResponse.json({ error: "فشل الحظر" }, { status: 500 });
  }
}
