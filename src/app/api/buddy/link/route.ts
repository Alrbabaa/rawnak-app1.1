import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { buddyPairId } from "@/lib/buddy";

export const runtime = "nodejs";

interface ReqBody {
  code?: string;
}

/**
 * Accepts a buddy invite code and creates the buddyPairs/{pairId} doc.
 *
 * Deliberately one buddy at a time (matches the feature's real intent —
 * a single accountability partner, not a leaderboard). A user who is
 * already paired, or who submits her own code, is rejected before any
 * write happens.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const body = (await req.json()) as ReqBody;
    const code = body.code?.trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "أدخلي كود الدعوة" }, { status: 400 });

    const userRef = adminDb.collection("users").doc(session.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    if (userSnap.data()!.buddyPairId) {
      return NextResponse.json({ error: "لديكِ صديقة توهج بالفعل" }, { status: 409 });
    }

    const codeSnap = await adminDb.collection("buddyInviteCodes").doc(code).get();
    if (!codeSnap.exists) {
      return NextResponse.json({ error: "كود الدعوة غير صحيح" }, { status: 404 });
    }
    const buddyUid = codeSnap.data()!.uid as string;
    if (buddyUid === session.uid) {
      return NextResponse.json({ error: "لا يمكنكِ إضافة نفسكِ" }, { status: 400 });
    }

    const buddyRef = adminDb.collection("users").doc(buddyUid);
    const buddySnap = await buddyRef.get();
    if (!buddySnap.exists) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    if (buddySnap.data()!.buddyPairId) {
      return NextResponse.json({ error: "صديقتك لديها صديقة توهج بالفعل" }, { status: 409 });
    }

    const pairId = buddyPairId(session.uid, buddyUid);
    // .create() fails atomically if this pair already exists somehow —
    // same idempotency guard used everywhere else in this codebase.
    await adminDb.collection("buddyPairs").doc(pairId).create({
      uid1: session.uid,
      uid2: buddyUid,
      createdAt: Date.now(),
    });

    await Promise.all([
      userRef.set({ buddyPairId: pairId, buddyUid }, { merge: true }),
      buddyRef.set({ buddyPairId: pairId, buddyUid: session.uid }, { merge: true }),
    ]);

    return NextResponse.json({ ok: true, buddyName: (buddySnap.data()!.name as string) || "صديقتك" });
  } catch (err) {
    console.error("buddy/link error:", err);
    return NextResponse.json({ error: "حدث خطأ، حاولي مرة أخرى" }, { status: 500 });
  }
}
