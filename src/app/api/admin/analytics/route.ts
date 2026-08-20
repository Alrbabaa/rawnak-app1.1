import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const usersCol = adminDb.collection("users");

  const [
    totalUsers, activeToday, activeWeek, activeMonth,
    totalAnalyses, totalCabinet, totalPicks, totalVideos, totalArticles,
    recentActivitySnap,
  ] = await Promise.all([
    usersCol.count().get().then((s) => s.data().count),
    usersCol.where("updatedAt", ">=", dayAgo).count().get().then((s) => s.data().count),
    usersCol.where("updatedAt", ">=", weekAgo).count().get().then((s) => s.data().count),
    usersCol.where("updatedAt", ">=", monthAgo).count().get().then((s) => s.data().count),
    adminDb.collectionGroup("analyses").count().get().then((s) => s.data().count),
    adminDb.collectionGroup("cabinet").count().get().then((s) => s.data().count),
    adminDb.collection("picks").count().get().then((s) => s.data().count),
    adminDb.collection("academyVideos").count().get().then((s) => s.data().count),
    adminDb.collection("articles").count().get().then((s) => s.data().count),
    adminDb.collection("activity").orderBy("createdAt", "desc").limit(500).get(),
  ]);

  const dailyNewUsers: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now - i * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + 24 * 60 * 60 * 1000;
    const count = await usersCol
      .where("createdAt", ">=", start.getTime()).where("createdAt", "<", end)
      .count().get().then((s) => s.data().count);
    dailyNewUsers.push({ date: start.toISOString().slice(0, 10), count });
  }

  const eventCounts = new Map<string, number>();
  recentActivitySnap.docs.forEach((d) => {
    const event = d.data().event as string;
    eventCounts.set(event, (eventCounts.get(event) || 0) + 1);
  });
  const topEvents = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([event, count]) => ({ event, count }));

  return NextResponse.json({
    metrics: { totalUsers, activeToday, activeWeek, activeMonth, totalAnalyses, totalCabinet, totalPicks, totalVideos, totalArticles },
    charts: { dailyNewUsers, topEvents },
    recentActivities: recentActivitySnap.docs.slice(0, 20).map((d) => {
      const a = d.data();
      return { id: d.id, event: a.event, email: a.email, meta: a.meta || {}, createdAt: a.createdAt };
    }),
  });
}
