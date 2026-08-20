import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";

export const runtime = "nodejs";

/**
 * Lets an admin close out a report — "resolved" (action was taken, e.g.
 * the reported user was warned/removed) or "dismissed" (no action
 * needed). This is the human-review half of App Store Review Guideline
 * 1.2: users can report (see /api/social/report), and someone on our
 * side actually looks at it and closes the loop.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { id } = await params;
  const { status, adminNote } = (await req.json().catch(() => ({}))) as {
    status?: "resolved" | "dismissed";
    adminNote?: string;
  };

  if (status !== "resolved" && status !== "dismissed") {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  const reportRef = adminDb.collection("reports").doc(id);
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) {
    return NextResponse.json({ error: "البلاغ غير موجود" }, { status: 404 });
  }
  const report = reportSnap.data()!;

  await reportRef.set(
    {
      status,
      adminNote: typeof adminNote === "string" ? adminNote.slice(0, 500) : "",
      reviewedBy: auth.user!.email,
      reviewedAt: Date.now(),
    },
    { merge: true }
  );

  await logAdminAction(
    {
      adminEmail: auth.user!.email,
      adminUid: auth.user!.uid,
      action: "update",
      resource: "reports",
      resourceId: id,
      resourceLabel: `بلاغ ضد ${report.reportedUserName || report.reportedUserId}`,
      meta: { status, reason: report.reason },
    },
    req
  );

  return NextResponse.json({ ok: true });
}
