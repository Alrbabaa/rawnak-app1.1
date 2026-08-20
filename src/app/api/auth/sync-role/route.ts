import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { checkAndSyncAdminRole } from "@/lib/admin-check";
import type { Role } from "@/lib/firebase-session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);

    // Auto-check and sync admin role for admin emails or Firestore roles
    const syncedRole = await checkAndSyncAdminRole(decoded.uid, decoded.email);
    if (syncedRole === "admin" || syncedRole === "super_admin") {
      return NextResponse.json({ ok: true, role: syncedRole, updated: true });
    }

    return NextResponse.json({ ok: true, role: "user" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    console.error("[/api/auth/sync-role] Error:", msg);
    return NextResponse.json({ error: "فشل التحقق من الدور" }, { status: 500 });
  }
}
