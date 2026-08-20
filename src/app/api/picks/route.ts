import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { isProductVisibleInCountry } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // The client sends the ISO2 country code for the user's currently
    // selected country (see selectedCountry in the app store, driven by
    // the currency/country selector). Products are filtered so a user only
    // sees items available in her own country, plus anything marked global.
    const { searchParams } = new URL(req.url);
    const country = (searchParams.get("country") || "GLOBAL").toUpperCase();

    const snap = await adminDb
      .collection("picks")
      .where("published", "==", true)
      .get();

    // Sort in memory so this public catalog does not fail completely when
    // the optional published+createdAt composite index has not been deployed.
    // Admin additions now appear immediately with the same newest-first order.
    const picks = [...snap.docs]
      .sort((a, b) => Number(b.data().createdAt || 0) - Number(a.data().createdAt || 0))
      .map((d) => {
        const p = d.data();
        return {
          id: d.id,
          name: p.name,
          brand: p.brand,
          department: p.department || "beauty",
          category: p.category,
          description: p.description,
          price: p.price,
          store: p.store,
          purchaseUrl: p.purchaseUrl,
          emoji: p.imageEmoji,
          photoUrl: p.photoUrl || null,
          countries: p.countries || ["GLOBAL"],
          rating: p.rating,
          reasons: p.reasons || [],
          bestFor: p.bestFor || [],
          trending: p.trending === true,
          engagementCount: typeof p.engagementCount === "number" ? p.engagementCount : 0,
          order: typeof p.order === "number" ? p.order : null,
        };
      })
      .filter((p) => isProductVisibleInCountry(p.countries, country));

    return NextResponse.json({ picks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[picks GET] error:", msg);
    return NextResponse.json({ error: "فشل تحميل الاختيارات" }, { status: 500 });
  }
}
