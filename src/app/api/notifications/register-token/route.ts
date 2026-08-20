import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";

export const runtime = "nodejs";

/**
 * Stores (or clears) the caller's FCM web-push token on their user doc.
 * Single-token-per-user for now (the simplest correct v1 — a user signed
 * in on two browsers would have the second registration overwrite the
 * first, so only the most-recently-registered device gets pushes). If
 * multi-device push turns out to matter, this is the one place to change
 * to an array/map instead of overwriting a single field — nothing else
 * in the app assumes single-token today.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  let body: { token?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  await adminDb.collection("users").doc(session.uid).set(
    { fcmToken: body.token || null, fcmTokenUpdatedAt: Date.now() },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
