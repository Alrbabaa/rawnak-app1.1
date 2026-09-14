import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeYouTubeId } from "@/lib/youtube";

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

    // The admin "YouTube ID" field is free text — an admin may paste a
    // full watch/shorts/youtu.be URL instead of running it through the
    // AI-import step first. Normalize it the same way the user-facing
    // self-import modal does (academy-screen.tsx) so a pasted URL never
    // reaches Firestore un-extracted and breaks the embed src at playback
    // time (`youtube.com/embed/<full-url>` instead of `.../embed/<id>`).
    const normalizedYoutubeId = normalizeYouTubeId(body.youtubeId);
    if (!normalizedYoutubeId) {
      return NextResponse.json(
        { error: "معرّف يوتيوب غير صالح — تأكدي من الرابط أو المعرّف المُدخل" },
        { status: 400 }
      );
    }

    const docRef = await adminDb.collection("academyVideos").add({
      title: body.title, youtubeId: normalizedYoutubeId, category: body.category || "skincare",
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
