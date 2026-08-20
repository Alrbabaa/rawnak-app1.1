import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const { targetUid } = (await req.json()) as { targetUid?: string };
    if (!targetUid || typeof targetUid !== "string") {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    await adminDb.collection("blocks").doc(`${session.uid}_${targetUid}`).delete();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/unblock] error:", msg);
    return NextResponse.json({ error: "فشل إلغاء الحظر" }, { status: 500 });
  }
}
