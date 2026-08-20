import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { ACCOUNT_TIERS, type AccountTier } from "@/lib/account-tiers";

export const runtime = "nodejs";

const VALID_TIERS = Object.keys(ACCOUNT_TIERS) as AccountTier[];

/**
 * Admin-only: sets a real user's account tier badge (standard/active/
 * featured/vip/influencer/business) on their Firestore user document.
 *
 * This is the field profile-screen.tsx reads to render the badge next to
 * the person's name. It must NEVER be settable through the self-service
 * /api/db/user route (which any signed-in user can call for their own
 * profile) — that's exactly how "every account becomes VIP" bugs happen.
 * Only an admin, via this route, can grant it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { id: targetUid } = await params;
  if (!targetUid) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  let body: { accountTier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const accountTier = body.accountTier as AccountTier | undefined;
  if (!accountTier || !VALID_TIERS.includes(accountTier)) {
    return NextResponse.json(
      { error: `accountTier يجب أن يكون أحد: ${VALID_TIERS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await adminDb.collection("users").doc(targetUid).set(
      { accountTier, accountTierUpdatedAt: Date.now(), accountTierSetBy: auth.user!.uid },
      { merge: true }
    );
    return NextResponse.json({ ok: true, id: targetUid, accountTier });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/users/tier PATCH] error:", msg);
    return NextResponse.json({ error: "فشل تحديث فئة الحساب" }, { status: 500 });
  }
}
