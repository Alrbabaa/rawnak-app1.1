import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Increments/decrements a pick's `engagementCount` — a simple demand
 * signal (heart it / add it to the cabinet) used to compute the automatic
 * "الأكثر طلبًا" badge in picks-screen.tsx. This is a plain Firestore
 * counter, not AI — it does not touch feature-gate.ts or any model call,
 * so it carries none of the app's AI cost risk.
 *
 * Rate-limited per user/IP (not auth-gated — liking doesn't require an
 * account) to blunt naive spam of the counter; a determined abuser could
 * still inflate one product, same tradeoff every public "likes" counter
 * makes. Fails open/silently on any error since this is a cosmetic
 * signal, never something the UI should block on.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const limited = await isRateLimited(await rateLimitKey(req, "picks-engage"), 40, 5 * 60 * 1000);
  if (limited) return NextResponse.json({ ok: true }); // silently ignore, don't surface a rate-limit error for a "like"

  try {
    const body = await req.json().catch(() => ({}));
    const delta = body?.action === "unlike" ? -1 : 1;
    await adminDb
      .collection("picks")
      .doc(id)
      .update({ engagementCount: FieldValue.increment(delta) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[picks/engage] error:", err);
    return NextResponse.json({ ok: true }); // best-effort — never break the like button over this
  }
}
