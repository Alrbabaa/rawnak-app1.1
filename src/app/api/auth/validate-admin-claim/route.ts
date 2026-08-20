import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { checkAndSyncAdminRole } from "@/lib/admin-check";

export const runtime = "nodejs";

/**
 * Endpoint for validating user email claims against the Firestore adminWhitelist collection
 * and assigning the 'role' custom claim immediately upon login or token refresh.
 */
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
    const uid = decoded.uid;
    const email = decoded.email;

    // Check whitelist and sync admin custom claims
    const syncedRole = await checkAndSyncAdminRole(uid, email);

    if (syncedRole === "admin" || syncedRole === "super_admin") {
      return NextResponse.json({
        ok: true,
        role: syncedRole,
        whitelisted: true,
        message: "تم التحقق من الحساب وإسناد صلاحية المسؤول بنجاح",
      });
    }

    return NextResponse.json({
      ok: true,
      role: "user",
      whitelisted: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    console.error("[/api/auth/validate-admin-claim] Error:", msg);
    return NextResponse.json(
      { error: "فشل التحقق من قائمة المسؤولين المعتمدة" },
      { status: 500 }
    );
  }
}
