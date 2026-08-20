import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { SEED_PARTNER_CARDS } from "@/lib/partner-cards-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("partnerDiscountCards")
      .where("status", "==", "active")
      .get();

    if (snap.empty) {
      return NextResponse.json({ cards: SEED_PARTNER_CARDS });
    }

    const cards = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Sort pinned cards first
    cards.sort((a: any, b: any) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

    return NextResponse.json({ cards });
  } catch (err: unknown) {
    console.error("[partner-cards GET] error, returning seed fallback:", err);
    return NextResponse.json({ cards: SEED_PARTNER_CARDS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { cardId, action } = await req.json(); // action = "click" | "copy"
    if (!cardId) {
      return NextResponse.json({ error: "معرف البطاقة مطلوب" }, { status: 400 });
    }

    const docRef = adminDb.collection("partnerDiscountCards").doc(cardId);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data() || {};
      if (action === "copy") {
        await docRef.update({ copyCount: (data.copyCount || 0) + 1 });
      } else {
        await docRef.update({ clickCount: (data.clickCount || 0) + 1 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: true }); // silent fallback for tracking
  }
}
