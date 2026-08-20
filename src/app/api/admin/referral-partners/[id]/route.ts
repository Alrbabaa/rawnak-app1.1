import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = String(patch.name).trim();
    if (patch.email !== undefined) data.email = patch.email?.trim() || null;
    if (patch.discountPercentage !== undefined) data.discountPercentage = Number(patch.discountPercentage) || 0;
    if (patch.commissionPercentage !== undefined) data.commissionPercentage = Number(patch.commissionPercentage) || 0;
    if (patch.status !== undefined) data.status = patch.status === "inactive" ? "inactive" : "active";
    if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;

    if (patch.referralCode !== undefined) {
      const newCode = String(patch.referralCode).trim().toUpperCase();
      if (newCode) {
        const clash = await adminDb.collection("referralPartners").where("referralCode", "==", newCode).limit(1).get();
        if (!clash.empty && clash.docs[0].id !== id) {
          return NextResponse.json({ error: "رمز الإحالة هذا مستخدم بالفعل" }, { status: 409 });
        }
        data.referralCode = newCode;
      }
    }

    await adminDb.collection("referralPartners").doc(id).update(data);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/referral-partners PUT] error:", msg);
    return NextResponse.json({ error: "فشل التحديث" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

    const partnerRef = adminDb.collection("referralPartners").doc(id);
    const referralsSnap = await partnerRef.collection("referrals").get();
    const batch = adminDb.batch();
    referralsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(partnerRef);
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/referral-partners DELETE] error:", msg);
    return NextResponse.json({ error: "فشل الحذف" }, { status: 500 });
  }
}
