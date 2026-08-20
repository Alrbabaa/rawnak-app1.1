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
      .where("followingId", "==", session.uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const followerIds = edgesSnap.docs.map((d) => d.data().followerId as string);
    if (followerIds.length === 0) return NextResponse.json({ users: [] });

    const chunks: string[][] = [];
    for (let i = 0; i < followerIds.length; i += 30) chunks.push(followerIds.slice(i, i + 30));

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

    // Also tell the client which of her followers she follows back, so the
    // UI can show "متابَعة" vs a "متابعة" button without a second round trip.
    const myFollowingSnap = await adminDb
      .collection("follows")
      .where("followerId", "==", session.uid)
      .where("followingId", "in", followerIds.length > 0 ? followerIds.slice(0, 30) : ["_none_"])
      .get();
    const iFollowSet = new Set(myFollowingSnap.docs.map((d) => d.data().followingId as string));

    const byId = new Map(userDocs.map((d) => [d.id, d.data()]));
    const users = followerIds
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
          followedByMe: iFollowSet.has(id),
        };
      });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/followers] error:", msg);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}
