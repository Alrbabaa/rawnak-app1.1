import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const snap = await adminDb.collection("picks").orderBy("createdAt", "desc").get();
  return NextResponse.json({
    picks: snap.docs.map((d) => {
      const p = d.data();
      return {
        id: d.id, name: p.name, brand: p.brand,
        department: p.department || "beauty", category: p.category,
        description: p.description, price: p.price, store: p.store,
        purchaseUrl: p.purchaseUrl, emoji: p.imageEmoji, photoUrl: p.photoUrl || null,
        countries: p.countries || ["GLOBAL"], rating: p.rating,
        reasons: p.reasons || [], bestFor: p.bestFor || [],
        published: p.published, trending: p.trending === true, createdAt: p.createdAt,
        engagementCount: typeof p.engagementCount === "number" ? p.engagementCount : 0,
        order: typeof p.order === "number" ? p.order : null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    const countries: string[] =
      Array.isArray(body.countries) && body.countries.length > 0 ? body.countries : ["GLOBAL"];
    const docRef = await adminDb.collection("picks").add({
      name: body.name, brand: body.brand || "",
      department: body.department || "beauty", category: body.category || "serum",
      description: body.description || "", price: body.price || "", store: body.store || "",
      purchaseUrl: body.purchaseUrl || "", imageEmoji: body.emoji || "💄",
      photoUrl: body.photoUrl || null, countries,
      rating: Number(body.rating) || 5, reasons: body.reasons || [], bestFor: body.bestFor || [],
      published: body.published !== false, trending: body.trending === true, createdAt: Date.now(),
      engagementCount: 0,
    });
    await logAdminAction(
      {
        adminEmail: auth.user!.email,
        adminUid: auth.user!.uid,
        action: "create",
        resource: "picks",
        resourceId: docRef.id,
        resourceLabel: body.name,
      },
      req
    );
    return NextResponse.json({ id: docRef.id, ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/picks POST] error:", msg);
    return NextResponse.json({ error: "فشل الإنشاء" }, { status: 500 });
  }
}
