import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";
import { SEED_PARTNER_CARDS } from "@/lib/partner-cards-data";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const snap = await adminDb.collection("partnerDiscountCards").get();

    if (snap.empty) {
      // Seed initial cards into Firestore if empty
      for (const card of SEED_PARTNER_CARDS) {
        await adminDb.collection("partnerDiscountCards").doc(card.id).set(card);
      }
      return NextResponse.json({ cards: SEED_PARTNER_CARDS });
    }

    const cards = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ cards });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();

    if (!body.partnerName?.trim() || !body.discountCode?.trim()) {
      return NextResponse.json({ error: "اسم الشريك وكود الخصم مطلوبان" }, { status: 400 });
    }

    const id = `card-${Date.now()}`;
    const newCard = {
      id,
      partnerName: body.partnerName.trim(),
      branchName: body.branchName?.trim() || "الفرع الرئيسي",
      brandLogoUrl: body.brandLogoUrl?.trim() || "",
      bannerImageUrl: body.bannerImageUrl?.trim() || "",
      discountCode: body.discountCode.trim().toUpperCase(),
      discountLabel: body.discountLabel?.trim() || "خصم حصري",
      badgeText: body.badgeText?.trim() || "",
      description: body.description?.trim() || "",
      storeUrl: body.storeUrl?.trim() || "#",
      category: body.category || "متاجر إلكترونية",
      country: body.country || "الجميع",
      cardDesign: body.cardDesign || "rosegold",
      expiresAt: body.expiresAt?.trim() || "",
      pinned: Boolean(body.pinned),
      status: body.status || "active",
      clickCount: 0,
      copyCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("partnerDiscountCards").doc(id).set(newCard);

    return NextResponse.json({ card: newCard });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ عند إنشاء البطاقة";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
