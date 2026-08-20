import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { getAccountTierMeta, type AccountTier } from "@/lib/account-tiers";

export const runtime = "nodejs";

/**
 * A public profile view of another user. `isFollowing` — and therefore
 * whether the streak story is included at all — is computed HERE,
 * server-side, from the real follow-edge doc, not trusted from anything
 * the client sends. The streak field itself is simply omitted from the
 * response when the viewer doesn't follow this person, rather than being
 * sent and hidden client-side, so there's nothing to inspect in devtools
 * to see a non-followed person's streak.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const { uid: targetUid } = await params;
    if (!targetUid) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });

    const targetSnap = await adminDb.collection("users").doc(targetUid).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }
    const u = targetSnap.data()!;

    const isSelf = targetUid === session.uid;

    if (!isSelf) {
      const [blockedByMe, blockedMe] = await Promise.all([
        adminDb.collection("blocks").doc(`${session.uid}_${targetUid}`).get(),
        adminDb.collection("blocks").doc(`${targetUid}_${session.uid}`).get(),
      ]);
      if (blockedByMe.exists || blockedMe.exists) {
        // Deliberately minimal — no name/avatar/bio/counts leak through
        // to someone on either side of a block.
        return NextResponse.json({
          id: targetUid,
          blocked: true,
          blockedByMe: blockedByMe.exists,
        });
      }
    }

    let isFollowing = isSelf;
    if (!isSelf) {
      const edgeSnap = await adminDb.collection("follows").doc(`${session.uid}_${targetUid}`).get();
      isFollowing = edgeSnap.exists;
    }

    const tier = (u.accountTier as AccountTier) || "standard";

    return NextResponse.json({
      id: targetUid,
      name: u.name || "عضوة رَونق",
      avatar: u.avatar || "🌸",
      accountTier: tier,
      verified: getAccountTierMeta(tier).verifiedMark,
      bio: u.bio || "",
      followersCount: u.followersCount || 0,
      followingCount: u.followingCount || 0,
      isFollowing,
      isSelf,
      // Streak story: only present in the response at all when the
      // viewer actually follows this person (or is viewing herself).
      streak: isFollowing ? (u.streak ?? 0) : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/profile] error:", msg);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}
