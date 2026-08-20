import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * An admin only ever sees threads for users a super_admin has assigned
 * to them (assignedAdminId on the user doc — see Users panel). A
 * super_admin sees everything, including unassigned threads, since
 * assigning is their job to begin with.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  let userIds: string[] | null = null; // null = no scoping (super_admin sees all)
  if (auth.user!.role === "admin") {
    const assignedSnap = await adminDb
      .collection("users")
      .where("assignedAdminId", "==", auth.user!.uid)
      .get();
    userIds = assignedSnap.docs.map((d) => d.id);
    if (userIds.length === 0) {
      return NextResponse.json({ threads: [] });
    }
  }

  const threadsSnap = await adminDb.collection("supportThreads").orderBy("lastMessageAt", "desc").limit(200).get();
  const visibleDocs = threadsSnap.docs.filter((d) => !userIds || userIds.includes(d.id));

  // super_admin needs to see who (if anyone) each thread is assigned to,
  // to spot unassigned ones — an admin already knows every thread here
  // is theirs (that's how userIds scoped the query above), so skip the
  // extra reads for that case.
  const assignments = new Map<string, { assignedAdminId: string | null; assignedAdminName: string | null }>();
  if (auth.user!.role === "super_admin" && visibleDocs.length > 0) {
    const userDocs = await adminDb.getAll(
      ...visibleDocs.map((d) => adminDb.collection("users").doc(d.id))
    );
    userDocs.forEach((doc) => {
      assignments.set(doc.id, {
        assignedAdminId: doc.data()?.assignedAdminId || null,
        assignedAdminName: doc.data()?.assignedAdminName || null,
      });
    });
  }

  const threads = visibleDocs.map((d) => {
    const t = d.data();
    return {
      userId: d.id,
      userEmail: t.userEmail || null,
      userName: t.userName || null,
      status: t.status || "open",
      lastMessageAt: t.lastMessageAt || null,
      lastMessagePreview: t.lastMessagePreview || "",
      lastSenderRole: t.lastSenderRole || "user",
      unreadForAdmin: Boolean(t.unreadForAdmin),
      assignedAdminId: assignments.get(d.id)?.assignedAdminId ?? null,
      assignedAdminName: assignments.get(d.id)?.assignedAdminName ?? null,
    };
  });

  return NextResponse.json({ threads });
}
