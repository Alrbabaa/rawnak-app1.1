import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { getAccountTierMeta, type AccountTier } from "@/lib/account-tiers";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const edgesSnap = await adminDb
      .collection("follows")
      .where("followerId", "==", session.uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const targetIds = edgesSnap.docs.map((d) => d.data().followingId as string);
    if (targetIds.length === 0) return NextResponse.json({ users: [] });

    // Firestore `in` queries cap at 30 values per query — chunk if needed.
    const chunks: string[][] = [];
    for (let i = 0; i < targetIds.length; i += 30) chunks.push(targetIds.slice(i, i + 30));

    const userDocs = (
      await Promise.all(
        chunks.map((chunk) =>
          adminDb
            .collection("users")
            .where("__name__", "in", chunk)
            .get()
        )
      )
    ).flatMap((snap) => snap.docs);

    const byId = new Map(userDocs.map((d) => [d.id, d.data()]));
    const users = targetIds
      .filter((id) => byId.has(id))
      .map((id) => {
        const u = byId.get(id)!;
        const tier = (u.accountTier as AccountTier) || "standard";
        return {
          id,
          name: u.name || "عضوة رَونق",
          avatar: u.avatar || "🌸",
          accountTier: tier,
          verified: getAccountTierMeta(tier).verifiedMark,
        };
      });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/following] error:", msg);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}
