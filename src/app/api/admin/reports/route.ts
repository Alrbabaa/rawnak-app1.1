import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const snap = await adminDb.collection("reports").orderBy("createdAt", "desc").limit(300).get();
  const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ reports });
}
