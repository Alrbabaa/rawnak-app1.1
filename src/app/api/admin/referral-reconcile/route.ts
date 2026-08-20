import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { REFERRAL_REWARD_THRESHOLD } from "@/lib/referral";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 300;

/**
 * Recomputes `referralInvitesCount` for every user from the actual
 * `referralInvites` subcollection (the source of truth — same
 * subcollection /api/auth/complete-signup writes to) and corrects any
 * drift. See the doc comment on ReferralReconcileCard in users-panel.tsx
 * for why this exists: a one-off manual repair tool for accounts that
 * may predate the 2026-08 atomic-crediting fix, not something that runs
 * automatically. Read-mostly and safe to re-run any time — it only ever
 * writes a corrected count (and, if newly earned, the one-time badge),
 * never removes or reduces anything a user already has.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  let checked = 0;
  let fixed = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  try {
    while (true) {
      let query = adminDb.collection("users").orderBy("__name__").limit(BATCH_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const snap = await query.get();
      if (snap.empty) break;

      await Promise.all(
        snap.docs.map(async (doc) => {
          checked++;
          const data = doc.data();
          const storedCount = (data.referralInvitesCount as number) || 0;
          const actualCount = (
            await doc.ref.collection("referralInvites").count().get()
          ).data().count;

          if (actualCount === storedCount) return;

          const updates: Record<string, unknown> = { referralInvitesCount: actualCount };
          if (actualCount >= REFERRAL_REWARD_THRESHOLD && !data.referralRewardUnlockedAt) {
            updates.referralRewardUnlockedAt = Date.now();
          }
          await doc.ref.set(updates, { merge: true });
          fixed++;
        })
      );

      cursor = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < BATCH_SIZE) break;
    }

    await logAdminAction(
      {
        adminEmail: auth.user!.email,
        adminUid: auth.user!.uid,
        action: "update",
        resource: "referral-reconcile",
        meta: { checked, fixed },
      },
      req
    );

    return NextResponse.json({ ok: true, checked, fixed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/referral-reconcile] error:", msg);
    return NextResponse.json({ error: "فشلت المطابقة", checked, fixed }, { status: 500 });
  }
}
