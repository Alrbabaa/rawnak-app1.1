import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * The list of people a super_admin can hand a user off to for customer
 * service (see /api/admin/users/[id] PATCH's assignedAdminId). Reads the
 * Firestore `role` field rather than re-verifying each Auth custom claim
 * one by one — `role` is kept in sync with the claim on every grant/revoke
 * (see admin-check.ts and users/[id]'s PATCH), so it's a safe, much
 * cheaper source for a plain listing. Any admin can read this (they need
 * it to see who else is on the team), only super_admin can act on it.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const snap = await adminDb
    .collection("users")
    .where("role", "in", ["admin", "super_admin"])
    .get();

  const admins = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      email: d.email || null,
      name: d.name || null,
      role: d.role,
    };
  });

  return NextResponse.json({ admins });
}
