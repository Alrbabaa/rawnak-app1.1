import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const snap = await adminDb.collection("academyVideos").orderBy("createdAt", "desc").get();
  return NextResponse.json({
    videos: snap.docs.map((d) => {
      const v = d.data();
      return {
        id: d.id, title: v.title, youtubeId: v.youtubeId, category: v.category,
        channel: v.channel, duration: v.duration, description: v.description,
        thumbnail: v.thumbnail, featured: v.featured, published: v.published,
        relatedProductNames: v.relatedProductNames || [], bestFor: v.bestFor || [],
        keyTakeaways: v.keyTakeaways || [],
        createdAt: v.createdAt,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    const docRef = await adminDb.collection("academyVideos").add({
      title: body.title, youtubeId: body.youtubeId, category: body.category || "skincare",
      channel: body.channel || "", duration: body.duration || "", description: body.description || "",
      thumbnail: body.thumbnail || null, featured: body.featured || false,
      relatedProductNames: body.relatedProductNames || [], bestFor: body.bestFor || [],
      keyTakeaways: body.keyTakeaways || [],
      published: body.published !== false, createdAt: Date.now(),
    });
    return NextResponse.json({ id: docRef.id, ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/videos POST] error:", msg);
    return NextResponse.json({ error: "فشل الإنشاء" }, { status: 500 });
  }
}
