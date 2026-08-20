import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

const VALID_REASONS = [
  "harassment", // مضايقة أو تحرش
  "impersonation", // انتحال شخصية
  "inappropriate_content", // محتوى غير لائق
  "spam", // إزعاج/سبام
  "other",
] as const;
type ReportReason = (typeof VALID_REASONS)[number];

/**
 * Reports land in the `reports` collection for a human moderator to
 * review in the admin dashboard (see /admin → البلاغات, admin/reports
 * API + reports-panel.tsx) — Apple Guideline 1.2 requires exactly this:
 * a way for users to flag objectionable content/people to a real person,
 * not just an automated filter.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    if (await isRateLimited(`social-report:user:${session.uid}`, 15, 60 * 1000)) {
      return NextResponse.json({ error: "طلبات كثيرة، حاولي بعد قليل" }, { status: 429 });
    }

    const body = (await req.json()) as { targetUid?: string; reason?: string; note?: string };
    const { targetUid, reason, note } = body;

    if (!targetUid || typeof targetUid !== "string") {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }
    if (targetUid === session.uid) {
      return NextResponse.json({ error: "لا يمكنكِ الإبلاغ عن نفسكِ" }, { status: 400 });
    }
    if (!reason || !VALID_REASONS.includes(reason as ReportReason)) {
      return NextResponse.json({ error: "سبب البلاغ غير صالح" }, { status: 400 });
    }
    const trimmedNote = typeof note === "string" ? note.slice(0, 500) : "";

    const [reporterSnap, targetSnap] = await Promise.all([
      adminDb.collection("users").doc(session.uid).get(),
      adminDb.collection("users").doc(targetUid).get(),
    ]);
    if (!targetSnap.exists) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    await adminDb.collection("reports").add({
      reporterId: session.uid,
      reporterName: (reporterSnap.data()?.name as string) || "غير معروف",
      reportedUserId: targetUid,
      reportedUserName: (targetSnap.data()?.name as string) || "غير معروف",
      reason: reason as ReportReason,
      note: trimmedNote,
      status: "open", // open | resolved | dismissed
      createdAt: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[social/report] error:", msg);
    return NextResponse.json({ error: "فشل إرسال البلاغ" }, { status: 500 });
  }
}
