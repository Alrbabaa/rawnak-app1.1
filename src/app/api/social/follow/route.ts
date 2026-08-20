import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { isRateLimited } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

// One doc per follow edge, deterministic ID so following twice is a no-op
// (idempotent) instead of creating duplicate edges.
function followDocId(followerId: string, followingId: string): string {
  return `${followerId}_${followingId}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    if (await isRateLimited(`social-follow:user:${session.uid}`, 40, 60 * 1000)) {
      return NextResponse.json({ error: "طلبات كثيرة، حاولي بعد قليل" }, { status: 429 });
    }

    const { targetUid } = (await req.json()) as { targetUid?: string };
    if (!targetUid || typeof targetUid !== "string") {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }
    if (targetUid === session.uid) {
      return NextResponse.json({ error: "لا يمكنكِ متابعة نفسكِ" }, { status: 400 });
    }

    const [forwardBlock, reverseBlock] = await Promise.all([
      adminDb.collection("blocks").doc(`${session.uid}_${targetUid}`).get(),
      adminDb.collection("blocks").doc(`${targetUid}_${session.uid}`).get(),
    ]);
    if (forwardBlock.exists || reverseBlock.exists) {
      return NextResponse.json({ error: "لا يمكن إتمام هذا الإجراء" }, { status: 403 });
    }

    const targetSnap = await adminDb.collection("users").doc(targetUid).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    const edgeRef = adminDb.collection("follows").doc(followDocId(session.uid, targetUid));
    const edgeSnap = await edgeRef.get();
    if (edgeSnap.exists) {
      return NextResponse.json({ ok: true, alreadyFollowing: true });
    }

    const batch = adminDb.batch();
    batch.set(edgeRef, {
      followerId: session.uid,
      followingId: targetUid,
      createdAt: Date.now(),
    });
    batch.set(
      adminDb.collection("users").doc(session.uid),
      { followingCount: FieldValue.increment(1) },
      { merge: true }
    );
    batch.set(
      adminDb.collection("users").doc(targetUid),
      { followersCount: FieldValue.increment(1) },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/follow] error:", msg);
    return NextResponse.json({ error: "فشلت المتابعة" }, { status: 500 });
  }
}
