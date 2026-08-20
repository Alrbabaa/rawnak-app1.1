import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";

export const runtime = "nodejs";

/** Single cheap doc read — just enough for a notification dot on the
 * profile screen's "الدعم" card, without pulling the whole conversation
 * the way GET /api/support/thread does. */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const doc = await adminDb.collection("supportThreads").doc(session.uid).get();
  return NextResponse.json({ unread: Boolean(doc.data()?.unreadForUser) });
}
