import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

function randomCode(seed?: string): string {
  const base = (seed || "RAWNAK").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "RAWNAK";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const partnersSnap = await adminDb.collection("referralPartners").orderBy("createdAt", "desc").get();

  const partners = await Promise.all(
    partnersSnap.docs.map(async (doc) => {
      const p = doc.data();
      const referralsSnap = await doc.ref.collection("referrals").orderBy("registeredAt", "desc").get();
      return {
        id: doc.id, name: p.name, email: p.email, referralCode: p.referralCode,
        discountPercentage: p.discountPercentage, commissionPercentage: p.commissionPercentage,
        status: p.status, notes: p.notes, createdAt: p.createdAt,
        stats: {
          totalRegistrations: referralsSnap.size, totalClicks: null,
          totalPremiumSubscriptions: 0, estimatedRevenueCents: 0, estimatedCommissionCents: 0,
        },
        referredUsers: referralsSnap.docs.map((r) => {
          const d = r.data();
          return {
            referralId: r.id, userId: r.id, name: d.name, email: d.email,
            registeredAt: d.registeredAt, subscriptionStatus: d.subscriptionStatus || "none",
          };
        }),
      };
    })
  );

  return NextResponse.json({ partners });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "اسم الشريك مطلوب" }, { status: 400 });
    }

    let code = (body.referralCode?.trim() || randomCode(body.name)).toUpperCase();
    for (let i = 0; i < 5; i++) {
      const exists = await adminDb.collection("referralPartners").where("referralCode", "==", code).limit(1).get();
      if (exists.empty) break;
      code = randomCode(body.name);
    }

    const docRef = await adminDb.collection("referralPartners").add({
      name: body.name.trim(), email: body.email?.trim() || null, referralCode: code,
      discountPercentage: Number(body.discountPercentage) || 0,
      commissionPercentage: Number(body.commissionPercentage) || 0,
      status: body.status === "inactive" ? "inactive" : "active",
      notes: body.notes?.trim() || null, createdAt: Date.now(),
    });
    return NextResponse.json({ ok: true, id: docRef.id, referralCode: code });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/referral-partners POST] error:", msg);
    return NextResponse.json({ error: "فشل إنشاء الشريك" }, { status: 500 });
  }
}
