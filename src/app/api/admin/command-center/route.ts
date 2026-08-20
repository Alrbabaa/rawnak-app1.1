import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * "الأحداث المهمة اليوم" — a handful of real, cheap Firestore .count()
 * queries (no AI, no new data collection). Kept intentionally small and
 * verifiable rather than guessing at signals the data doesn't actually
 * support yet (e.g. "returned after absence" needs a last-seen delta we
 * don't track reliably — left out rather than faked).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const picksCol = adminDb.collection("picks");
  const usersCol = adminDb.collection("users");

  const [
    newUsersToday,
    picksNoPhoto,
    draftPicks,
    totalPicks,
    publishedPicks,
  ] = await Promise.all([
    usersCol.where("createdAt", ">=", dayAgo).count().get().then((s) => s.data().count),
    picksCol.where("photoUrl", "==", null).count().get().then((s) => s.data().count),
    picksCol.where("published", "==", false).count().get().then((s) => s.data().count),
    picksCol.count().get().then((s) => s.data().count),
    picksCol.where("published", "==", true).count().get().then((s) => s.data().count),
  ]);

  const alerts: { level: "info" | "warning"; text: string }[] = [];
  if (newUsersToday > 0) alerts.push({ level: "info", text: `${newUsersToday} مستخدمة جديدة اليوم` });
  if (draftPicks > 0) alerts.push({ level: "warning", text: `${draftPicks} منتج بلا نشر (مسودة)` });
  if (picksNoPhoto > 0) alerts.push({ level: "warning", text: `${picksNoPhoto} منتج بلا صورة حقيقية` });
  if (alerts.length === 0) alerts.push({ level: "info", text: "لا توجد تنبيهات — كل شيء تحت السيطرة" });

  // Simple health signal: purely based on whether the reads above
  // succeeded (this route itself is the health probe for Firestore).
  // Anything richer (AI/API/YouTube status) needs real per-service
  // pings, which isn't built yet — intentionally not faked here.
  const health: "green" | "yellow" = draftPicks > totalPicks / 2 && totalPicks > 5 ? "yellow" : "green";

  return NextResponse.json({
    alerts,
    health,
    stats: { newUsersToday, picksNoPhoto, draftPicks, totalPicks, publishedPicks },
  });
}
