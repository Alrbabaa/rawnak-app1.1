import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("partners")
      .where("published", "==", true)
      .orderBy("order", "asc")
      .orderBy("createdAt", "desc")
      .get();

    return NextResponse.json({
      partners: snap.docs.map((d) => {
        const p = d.data();
        return { id: d.id, name: p.name, logoUrl: p.logoUrl, websiteUrl: p.websiteUrl, order: p.order };
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[partners] error:", msg);
    return NextResponse.json({ partners: [] }, { status: 500 });
  }
}
