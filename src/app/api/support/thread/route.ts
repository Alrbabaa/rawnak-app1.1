import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;

/**
 * One support thread per user, doc id = uid — this is a dedicated
 * customer-service relationship (see assignedAdminId on the user doc,
 * set by a super_admin in Users panel), not a ticket queue, so there's
 * no need for multiple concurrent threads per user.
 */
function threadRef(uid: string) {
  return adminDb.collection("supportThreads").doc(uid);
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const [userDoc, messagesSnap] = await Promise.all([
    adminDb.collection("users").doc(session.uid).get(),
    threadRef(session.uid).collection("messages").orderBy("createdAt", "asc").limit(200).get(),
  ]);

  const u = userDoc.data();
  const messages = messagesSnap.docs.map((d) => {
    const m = d.data();
    return {
      id: d.id,
      senderRole: m.senderRole as "user" | "admin",
      senderName: m.senderName as string | null,
      text: m.text as string,
      createdAt: m.createdAt as number,
    };
  });

  // Mark as read for the user the moment she opens the thread.
  if (messages.length > 0) {
    await threadRef(session.uid).set({ unreadForUser: false }, { merge: true }).catch(() => {});
  }

  return NextResponse.json({
    assignedAdminName: u?.assignedAdminName || null,
    messages,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });
  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "الرسالة طويلة جدًا" }, { status: 400 });
  }

  const userDoc = await adminDb.collection("users").doc(session.uid).get();
  const u = userDoc.data();
  const now = Date.now();
  const ref = threadRef(session.uid);
  const existingThread = await ref.get();

  await ref.collection("messages").add({
    senderId: session.uid,
    senderRole: "user",
    senderName: u?.name || session.email || null,
    text,
    createdAt: now,
  });

  await ref.set(
    {
      userId: session.uid,
      userEmail: u?.email || session.email || null,
      userName: u?.name || null,
      status: "open",
      lastMessageAt: now,
      lastMessagePreview: text.slice(0, 140),
      lastSenderRole: "user",
      unreadForAdmin: true,
      unreadForUser: false,
      ...(existingThread.exists ? {} : { createdAt: now }),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
