import { adminAuth } from "@/lib/firebase/admin";

/**
 * Server-side session verification — Firebase ID token from the
 * `Authorization: Bearer <token>` header. Role comes from Firebase Custom
 * Claims embedded IN the verified token itself.
 *
 * Deliberately does NOT call checkAndSyncAdminRole() here. That function
 * does several Firestore reads (and sometimes writes) — fine as a one-off
 * at sign-in/token-refresh time (see /api/auth/sync-role and
 * /api/auth/validate-admin-claim, which the client calls and then forces
 * an ID-token refresh — see use-firebase-auth.ts), but calling it again on
 * EVERY authenticated API request would mean 2-4 extra Firestore ops per
 * request for every user, admin or not. The verified token's own custom
 * claim is the already-synced source of truth for the lifetime of that
 * token; trust it here.
 */
export type Role = "user" | "admin" | "super_admin";

export interface SessionPayload {
  uid: string;
  email: string;
  role: Role;
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function getSessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const token = readBearerToken(req);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const claimRole = decoded.role;
    const role: Role = claimRole === "admin" || claimRole === "super_admin" ? claimRole : "user";

    return { uid: decoded.uid, email: decoded.email || "", role };
  } catch {
    return null;
  }
}
