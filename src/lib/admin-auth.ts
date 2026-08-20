import { getSessionFromRequest, type Role } from "@/lib/firebase-session";

export type { Role };

export const ROLE_LEVEL: Record<Role, number> = {
  user: 0,
  admin: 1,
  super_admin: 2,
};

/**
 * Admin authorization. Role comes from the verified Firebase ID token's
 * custom claims (see firebase-session.ts), which only the Admin SDK can
 * set — no database round-trip needed here.
 */
export async function requireRole(
  req: Request,
  minRole: Role = "admin"
): Promise<{
  ok: boolean;
  user?: { uid: string; email: string; role: Role };
  error?: string;
}> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return { ok: false, error: "غير مصرّح" };
  }
  if (ROLE_LEVEL[session.role] < ROLE_LEVEL[minRole]) {
    return { ok: false, error: "صلاحيات غير كافية" };
  }
  return { ok: true, user: { uid: session.uid, email: session.email, role: session.role } };
}

export async function requireAdmin(req: Request) {
  return requireRole(req, "admin");
}
