import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { todayKeyUTC } from "@/lib/buddy";

export const runtime = "nodejs";

/**
 * Records that this user completed today's routine — the ONLY server-side
 * trace of the streak system, added specifically so a buddy pairing has
 * something to read. The full streak (count, history) stays exactly where
 * it already lived, client-side in store.ts; this is deliberately just
 * one date string, not a duplicate of that state.
 *
 * Called from use-buddy-guard.ts the moment routineProgress hits 100,
 * same trigger as the existing local checkIn() action in store.ts — this
 * is the server-side twin of that action, not a replacement for it.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    await adminDb
      .collection("users")
      .doc(session.uid)
      .set({ lastRoutineCompletionDate: todayKeyUTC() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("buddy/checkin error:", err);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
