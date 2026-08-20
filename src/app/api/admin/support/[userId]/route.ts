import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;

/** Plain admins may only touch a thread for a user assigned to them;
 * super_admin can touch any thread (including picking up an unassigned
 * one before formally assigning it in Users panel). */
async function canAccessThread(uid: string, adminRole: string, adminUid: string): Promise<boolean> {
  if (adminRole === "super_admin") return true;
  const userDoc = await adminDb.collection("users").doc(uid).get();
  return userDoc.data()?.assignedAdminId === adminUid;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireRole(req, "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { userId } = await params;
  if (!(await canAccessThread(userId, auth.user!.role, auth.user!.uid))) {
    return NextResponse.json({ error: "هذه المحادثة ليست مُسندة إليكِ" }, { status: 403 });
  }

  const messagesSnap = await adminDb
    .collection("supportThreads")
    .doc(userId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limit(200)
    .get();

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

  await adminDb.collection("supportThreads").doc(userId).set({ unreadForAdmin: false }, { merge: true }).catch(() => {});

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireRole(req, "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { userId } = await params;
  if (!(await canAccessThread(userId, auth.user!.role, auth.user!.uid))) {
    return NextResponse.json({ error: "هذه المحادثة ليست مُسندة إليكِ" }, { status: 403 });
  }

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

  const now = Date.now();
  const ref = adminDb.collection("supportThreads").doc(userId);

  await ref.collection("messages").add({
    senderId: auth.user!.uid,
    senderRole: "admin",
    senderName: auth.user!.email,
    text,
    createdAt: now,
  });

  await ref.set(
    {
      status: "open",
      lastMessageAt: now,
      lastMessagePreview: text.slice(0, 140),
      lastSenderRole: "admin",
      unreadForUser: true,
      unreadForAdmin: false,
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
