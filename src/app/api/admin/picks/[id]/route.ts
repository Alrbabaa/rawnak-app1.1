import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.brand !== undefined) data.brand = patch.brand;
    if (patch.department !== undefined) data.department = patch.department;
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.price !== undefined) data.price = patch.price;
    if (patch.store !== undefined) data.store = patch.store;
    if (patch.purchaseUrl !== undefined) data.purchaseUrl = patch.purchaseUrl;
    if (patch.emoji !== undefined) data.imageEmoji = patch.emoji;
    if (patch.photoUrl !== undefined) data.photoUrl = patch.photoUrl;
    if (patch.countries !== undefined) {
      data.countries = Array.isArray(patch.countries) && patch.countries.length > 0 ? patch.countries : ["GLOBAL"];
    }
    if (patch.rating !== undefined) data.rating = Number(patch.rating);
    if (patch.reasons !== undefined) data.reasons = patch.reasons;
    if (patch.bestFor !== undefined) data.bestFor = patch.bestFor;
    if (patch.published !== undefined) data.published = patch.published;
    if (patch.trending !== undefined) data.trending = patch.trending === true;
    if (patch.order !== undefined) data.order = Number(patch.order);
    await adminDb.collection("picks").doc(id).update(data);
    // Toggle calls from the table (togglePublished) send just {id, published};
    // a full edit-form save sends everything, so only label the narrow
    // toggle case as publish/unpublish — a full save is always "update".
    const isPublishToggle = Object.keys(patch).length === 1 && patch.published !== undefined;
    await logAdminAction(
      {
        adminEmail: auth.user!.email,
        adminUid: auth.user!.uid,
        action: isPublishToggle ? (patch.published ? "publish" : "unpublish") : "update",
        resource: "picks",
        resourceId: id,
        resourceLabel: patch.name,
        meta: { fields: Object.keys(data) },
      },
      req
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/picks PUT] error:", msg);
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
    const snap = await adminDb.collection("picks").doc(id).get();
    const label = snap.exists ? (snap.data()?.name as string | undefined) : undefined;
    await adminDb.collection("picks").doc(id).delete();
    await logAdminAction(
      {
        adminEmail: auth.user!.email,
        adminUid: auth.user!.uid,
        action: "delete",
        resource: "picks",
        resourceId: id,
        resourceLabel: label,
      },
      req
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/picks DELETE] error:", msg);
    return NextResponse.json({ error: "فشل الحذف" }, { status: 500 });
  }
}
