import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    if (patch.slug !== undefined) {
      const clash = await adminDb.collection("articles").where("slug", "==", patch.slug).limit(1).get();
      if (!clash.empty && clash.docs[0].id !== id) {
        return NextResponse.json({ error: "الرابط (slug) مستخدم بالفعل" }, { status: 409 });
      }
    }

    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.slug !== undefined) data.slug = patch.slug;
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.excerpt !== undefined) data.excerpt = patch.excerpt;
    if (patch.content !== undefined) data.content = patch.content;
    if (patch.coverEmoji !== undefined) data.coverEmoji = patch.coverEmoji;
    if (patch.readMinutes !== undefined) data.readMinutes = Number(patch.readMinutes);
    if (patch.bestFor !== undefined) data.bestFor = patch.bestFor;
    if (patch.published !== undefined) data.published = patch.published;
    await adminDb.collection("articles").doc(id).update(data);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/articles PUT] error:", msg);
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
    await adminDb.collection("articles").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/articles DELETE] error:", msg);
    return NextResponse.json({ error: "فشل الحذف" }, { status: 500 });
  }
}
