import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource");
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

  let query: FirebaseFirestore.Query = adminDb.collection("auditLog");
  if (resource && resource !== "all") {
    query = query.where("resource", "==", resource);
  }
  const snap = await query.orderBy("createdAt", "desc").limit(limit).get();

  return NextResponse.json({
    entries: snap.docs.map((d) => {
      const e = d.data();
      return {
        id: d.id,
        adminEmail: e.adminEmail,
        action: e.action,
        resource: e.resource,
        resourceId: e.resourceId || null,
        resourceLabel: e.resourceLabel || null,
        meta: e.meta || null,
        ip: e.ip || null,
        createdAt: e.createdAt,
      };
    }),
  });
}
