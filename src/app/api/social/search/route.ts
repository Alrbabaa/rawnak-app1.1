import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { isRateLimited } from "@/lib/rate-limit";
import { getAccountTierMeta, type AccountTier } from "@/lib/account-tiers";

export const runtime = "nodejs";

/**
 * Public name-search directory ("بحث بالاسم") backing the "استكشاف" tab in
 * followers-modal.tsx. Reads `users/{uid}` directly via the Admin SDK
 * (server-only — the client Firebase SDK is never used for this, same
 * "everything through our own API routes" architecture as the rest of the
 * app; see firestore.rules header) and returns ONLY the safe, public-facing
 * fields below — never email, skin concerns, analyses, or anything else on
 * that document. A user is excluded if she's turned off
 * `socialDiscoverable` in her profile.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    if (await isRateLimited(`social-search:user:${session.uid}`, 30, 60 * 1000)) {
      return NextResponse.json({ error: "طلبات كثيرة، حاولي بعد قليل" }, { status: 429 });
    }

    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const snap = await adminDb
      .collection("users")
      .where("nameLower", ">=", q)
      .where("nameLower", "<=", q + "\uf8ff")
      .limit(20)
      .get();

    // Exclude anyone this user blocked, or who blocked this user — same
    // reasoning as the profile/follow routes: blocked people shouldn't
    // surface each other anywhere in the social surface.
    const blocksSnap = await adminDb
      .collection("blocks")
      .where("blockerId", "==", session.uid)
      .get();
    const iBlockedSnap = await adminDb
      .collection("blocks")
      .where("blockedId", "==", session.uid)
      .get();
    const hiddenIds = new Set<string>([
      ...blocksSnap.docs.map((d) => d.data().blockedId as string),
      ...iBlockedSnap.docs.map((d) => d.data().blockerId as string),
    ]);

    const users = snap.docs
      .filter(
        (d) =>
          d.id !== session.uid &&
          !hiddenIds.has(d.id) &&
          d.data().socialDiscoverable !== false &&
          d.data().name
      )
      .slice(0, 15)
      .map((d) => {
        const u = d.data();
        const tier = (u.accountTier as AccountTier) || "standard";
        return {
          id: d.id,
          name: u.name as string,
          avatar: (u.avatar as string) || "🌸",
          accountTier: tier,
          verified: getAccountTierMeta(tier).verifiedMark,
          bio: (u.bio as string) || "",
          levelTitle: (u.levelTitle as string) || null,
        };
      });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/search] error:", msg);
    return NextResponse.json({ error: "فشل البحث" }, { status: 500 });
  }
}
