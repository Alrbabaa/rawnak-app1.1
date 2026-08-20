import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const blocksSnap = await adminDb
      .collection("blocks")
      .where("blockerId", "==", session.uid)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const blockedIds = blocksSnap.docs.map((d) => d.data().blockedId as string);
    if (blockedIds.length === 0) return NextResponse.json({ users: [] });

    const chunks: string[][] = [];
    for (let i = 0; i < blockedIds.length; i += 30) chunks.push(blockedIds.slice(i, i + 30));

    const userDocs = (
      await Promise.all(chunks.map((chunk) => adminDb.collection("users").where("__name__", "in", chunk).get()))
    ).flatMap((snap) => snap.docs);

    const users = blockedIds
      .map((id) => {
        const doc = userDocs.find((d) => d.id === id);
        if (!doc) return null; // account since deleted
        const u = doc.data();
        return { id, name: (u.name as string) || "عضوة رَونق", avatar: (u.avatar as string) || "🌸" };
      })
      .filter((u): u is { id: string; name: string; avatar: string } => u !== null);

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/blocked] error:", msg);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}
