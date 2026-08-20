import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireRole, type Role } from "@/lib/admin-auth";

export const runtime = "nodejs";

const VALID_ROLES: Role[] = ["user", "admin", "super_admin"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { id: targetUid } = await params;
  if (!targetUid) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  let body: { role?: string; assignedAdminId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  // Customer-service assignment — independent of the role change below,
  // so a super_admin can send either field, or both, in one request.
  if (Object.prototype.hasOwnProperty.call(body, "assignedAdminId")) {
    const assignedAdminId = body.assignedAdminId;
    if (assignedAdminId !== null) {
      if (typeof assignedAdminId !== "string" || !assignedAdminId) {
        return NextResponse.json({ error: "assignedAdminId غير صالح" }, { status: 400 });
      }
      const targetDoc = await adminDb.collection("users").doc(assignedAdminId).get();
      const targetRole = targetDoc.data()?.role;
      if (!targetDoc.exists || (targetRole !== "admin" && targetRole !== "super_admin")) {
        return NextResponse.json(
          { error: "لا يمكن إسناد خدمة العملاء إلا لحساب مسؤول أو مسؤول أعلى" },
          { status: 400 }
        );
      }
      await adminDb.collection("users").doc(targetUid).set(
        {
          assignedAdminId,
          assignedAdminName: targetDoc.data()?.name || targetDoc.data()?.email || null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } else {
      await adminDb.collection("users").doc(targetUid).set(
        { assignedAdminId: null, assignedAdminName: null, updatedAt: Date.now() },
        { merge: true }
      );
    }
    // A request that only touches assignment (no role field) is done here.
    if (body.role === undefined) {
      return NextResponse.json({ ok: true, id: targetUid, assignedAdminId });
    }
  }

  const role = body.role as Role | undefined;
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role يجب أن يكون أحد: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  if (targetUid === auth.user!.uid && role !== "super_admin") {
    return NextResponse.json(
      { error: "لا يمكنك تغيير دورك الخاص من هنا" },
      { status: 400 }
    );
  }

  try {
    const existing = await adminAuth.getUser(targetUid);
    await adminAuth.setCustomUserClaims(targetUid, {
      ...existing.customClaims,
      role,
    });

    // Update Firestore user document
    await adminDb.collection("users").doc(targetUid).set(
      { role, updatedAt: Date.now() },
      { merge: true }
    );

    // Update Firestore adminWhitelist if email exists
    if (existing.email) {
      const normalizedEmail = existing.email.toLowerCase().trim();
      if (role === "admin" || role === "super_admin") {
        await adminDb.collection("adminWhitelist").doc(normalizedEmail).set(
          {
            email: normalizedEmail,
            role,
            enabled: true,
            lastSyncedUid: targetUid,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } else {
        // Demoted to user
        await adminDb.collection("adminWhitelist").doc(normalizedEmail).set(
          {
            enabled: false,
            role: "user",
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
    }

    await adminAuth.revokeRefreshTokens(targetUid);

    // Demoting this account out of admin/super_admin means it can no
    // longer own customer-service threads — clear it from any user still
    // pointing at it so the support panel doesn't hand tickets to a
    // now-plain user. Best-effort: a partial failure here just leaves a
    // stale pointer to clean up later, it doesn't affect the role change
    // that already succeeded above.
    if (role === "user") {
      try {
        const orphaned = await adminDb.collection("users").where("assignedAdminId", "==", targetUid).get();
        if (!orphaned.empty) {
          const batch = adminDb.batch();
          orphaned.docs.forEach((d) => batch.set(d.ref, { assignedAdminId: null, assignedAdminName: null }, { merge: true }));
          await batch.commit();
        }
      } catch (err) {
        console.error("[admin/users PATCH] failed to clear assignedAdminId for demoted admin:", err);
      }
    }

    return NextResponse.json({ ok: true, id: targetUid, role });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/users PATCH] error:", msg);
    return NextResponse.json({ error: "فشل تحديث الدور" }, { status: 500 });
  }
}

