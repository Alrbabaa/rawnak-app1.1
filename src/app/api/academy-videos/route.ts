import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("academyVideos")
      .where("published", "==", true)
      .orderBy("createdAt", "desc")
      .get();

    return NextResponse.json({
      videos: snap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id, title: v.title, youtubeId: v.youtubeId, category: v.category,
          channel: v.channel, duration: v.duration, description: v.description,
          thumbnail: `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`,
          relatedProductNames: v.relatedProductNames || [], bestFor: v.bestFor || [],
          keyTakeaways: v.keyTakeaways || [],
        };
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[academy-videos GET] error:", msg);
    return NextResponse.json({ error: "فشل تحميل الفيديوهات" }, { status: 500 });
  }
}
