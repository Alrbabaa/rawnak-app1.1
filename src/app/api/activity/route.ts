import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

interface ReqBody {
  event: string;
  uid?: string;
  email?: string;
  meta?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body.event) {
      return NextResponse.json({ error: "event مطلوب" }, { status: 400 });
    }

    await adminDb.collection("activity").add({
      userId: body.uid || null,
      email: body.email || null,
      event: body.event,
      meta: body.meta || {},
      createdAt: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[activity] error:", msg);
    return NextResponse.json({ error: "فشل تسجيل النشاط" }, { status: 500 });
  }
}
