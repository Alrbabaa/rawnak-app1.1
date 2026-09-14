import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeYouTubeId } from "@/lib/youtube";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.youtubeId !== undefined) {
      // Same normalization as the create route — an edit may replace a
      // clean ID with a freshly pasted full URL, so re-validate on every
      // update rather than trusting the field is already a bare ID.
      const normalizedYoutubeId = normalizeYouTubeId(patch.youtubeId);
      if (!normalizedYoutubeId) {
        return NextResponse.json(
          { error: "معرّف يوتيوب غير صالح — تأكدي من الرابط أو المعرّف المُدخل" },
          { status: 400 }
        );
      }
      data.youtubeId = normalizedYoutubeId;
    }
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.channel !== undefined) data.channel = patch.channel;
    if (patch.duration !== undefined) data.duration = patch.duration;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.thumbnail !== undefined) data.thumbnail = patch.thumbnail;
    if (patch.featured !== undefined) data.featured = patch.featured;
    if (patch.published !== undefined) data.published = patch.published;
    if (patch.relatedProductNames !== undefined) data.relatedProductNames = patch.relatedProductNames;
    if (patch.bestFor !== undefined) data.bestFor = patch.bestFor;
    if (patch.keyTakeaways !== undefined) data.keyTakeaways = patch.keyTakeaways;
    await adminDb.collection("academyVideos").doc(id).update(data);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/videos PUT] error:", msg);
    return NextResponse.json({ error: "فشل التحديث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    await adminDb.collection("academyVideos").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/videos DELETE] error:", msg);
    return NextResponse.json({ error: "فشل الحذف" }, { status: 500 });
  }
}
