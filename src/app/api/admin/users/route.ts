import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const usersSnap = await adminDb.collection("users").orderBy("createdAt", "desc").limit(200).get();

  const users = await Promise.all(
    usersSnap.docs.map(async (doc) => {
      const u = doc.data();
      const uid = doc.id;

      const [analysesCount, cabinetCount, activityCount, role] = await Promise.all([
        userRef(uid, "analyses").count().get().then((s) => s.data().count),
        userRef(uid, "cabinet").count().get().then((s) => s.data().count),
        adminDb.collection("activity").where("userId", "==", uid).count().get().then((s) => s.data().count),
        adminAuth.getUser(uid).then((fbUser) => (fbUser.customClaims?.role as string) || "user").catch(() => "user"),
      ]);

      return {
        id: uid, email: u.email, name: u.name, role,
        skinType: u.skinType, skinTone: u.skinTone,
        createdAt: new Date(u.createdAt).toISOString(),
        lastActive: new Date(u.updatedAt || u.createdAt).toISOString(),
        analysesCount, cabinetCount, activityCount,
        referralInvitesCount: u.referralInvitesCount || 0,
        assignedAdminId: u.assignedAdminId || null,
        assignedAdminName: u.assignedAdminName || null,
      };
    })
  );

  return NextResponse.json({ users });
}

function userRef(uid: string, subcollection: string) {
  return adminDb.collection("users").doc(uid).collection(subcollection);
}
