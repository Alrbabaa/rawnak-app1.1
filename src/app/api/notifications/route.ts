import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { sendPushToUser } from "@/lib/firebase/send-push";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ notifications: [] }, { status: 401 });

  const snap = await adminDb
    .collection("users")
    .doc(session.uid)
    .collection("notifications")
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();

  return NextResponse.json({
    notifications: snap.docs.map((d) => {
      const n = d.data();
      return { id: d.id, type: n.type, title: n.title, body: n.body, read: n.read, createdAt: n.createdAt };
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const notifRef = adminDb.collection("users").doc(session.uid).collection("notifications");
    const body = await req.json();

    if (body.markRead) {
      const unread = await notifRef.where("read", "==", false).get();
      const batch = adminDb.batch();
      unread.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
      return NextResponse.json({ ok: true });
    }

    if (!body.title) {
      return NextResponse.json({ error: "title مطلوب" }, { status: 400 });
    }

    const docRef = await notifRef.add({
      type: body.type || "general",
      title: body.title,
      body: body.body || "",
      read: false,
      createdAt: Date.now(),
    });
    // Best-effort, fire-and-forget — never let a push failure affect the
    // response. The in-app notification above is already saved regardless.
    sendPushToUser(session.uid, { title: body.title, body: body.body || "" }).catch(() => {});
    return NextResponse.json({ id: docRef.id, ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[notifications] error:", msg);
    return NextResponse.json({ error: "فشل" }, { status: 500 });
  }
}
