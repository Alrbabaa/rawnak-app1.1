import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { isRateLimited } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

function followDocId(followerId: string, followingId: string): string {
  return `${followerId}_${followingId}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    if (await isRateLimited(`social-unfollow:user:${session.uid}`, 40, 60 * 1000)) {
      return NextResponse.json({ error: "طلبات كثيرة، حاولي بعد قليل" }, { status: 429 });
    }

    const { targetUid } = (await req.json()) as { targetUid?: string };
    if (!targetUid || typeof targetUid !== "string") {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    const edgeRef = adminDb.collection("follows").doc(followDocId(session.uid, targetUid));
    const edgeSnap = await edgeRef.get();
    if (!edgeSnap.exists) {
      return NextResponse.json({ ok: true, wasFollowing: false });
    }

    const batch = adminDb.batch();
    batch.delete(edgeRef);
    batch.set(
      adminDb.collection("users").doc(session.uid),
      { followingCount: FieldValue.increment(-1) },
      { merge: true }
    );
    batch.set(
      adminDb.collection("users").doc(targetUid),
      { followersCount: FieldValue.increment(-1) },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/unfollow] error:", msg);
    return NextResponse.json({ error: "فشل إلغاء المتابعة" }, { status: 500 });
  }
}
