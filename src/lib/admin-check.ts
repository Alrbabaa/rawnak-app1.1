import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Role } from "@/lib/firebase-session";

/**
 * Admin emails that automatically gain super_admin status come ONLY from
 * the ADMIN_EMAILS env var (comma-separated) — never hardcoded here.
 * Hardcoding personal addresses in source is a real exposure: it leaks
 * whose account to target, and it grants standing super_admin to whatever
 * account controls that address for as long as this code exists, with no
 * way to revoke it short of a code change. Configure real admins via
 * ADMIN_EMAILS (see .env.example), or via the Firestore `adminWhitelist`
 * collection / a user doc's `role` field — both already supported below.
 */
export function getAdminEmails(): string[] {
  const envEmails = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
    : [];
  return Array.from(new Set(envEmails)).filter(Boolean);
}

export function isConfiguredAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const adminEmails = getAdminEmails();
  // EXPLICIT STRICT MATCH ONLY — Never match prefixes like admin@ or domain suffixes
  return adminEmails.includes(normalized);
}

/**
 * Validates user email against Firestore adminWhitelist collection,
 * configured admin emails, and Firestore user role documents.
 * Assigns custom user claim immediately if matched.
 */
export async function checkAndSyncAdminRole(
  uid: string,
  email?: string | null
): Promise<Role | null> {
  if (!uid) return null;

  try {
    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    let assignedRole: Role | null = null;

    // 1. Check if email matches configured admin emails list (Strict exact match)
    if (normalizedEmail && isConfiguredAdminEmail(normalizedEmail)) {
      assignedRole = "super_admin";

      // Seed/ensure Firestore adminWhitelist entry exists
      await adminDb.collection("adminWhitelist").doc(normalizedEmail).set(
        {
          email: normalizedEmail,
          role: "super_admin",
          enabled: true,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    // 2. Check Firestore 'adminWhitelist' collection by email doc ID or email query
    if (!assignedRole && normalizedEmail) {
      const whitelistDoc = await adminDb
        .collection("adminWhitelist")
        .doc(normalizedEmail)
        .get();

      if (whitelistDoc.exists) {
        const data = whitelistDoc.data();
        if (
          data?.enabled !== false &&
          (data?.role === "admin" || data?.role === "super_admin")
        ) {
          assignedRole = data.role as Role;
        }
      } else {
        // Query adminWhitelist where email matches
        const querySnap = await adminDb
          .collection("adminWhitelist")
          .where("email", "==", normalizedEmail)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          const data = querySnap.docs[0].data();
          if (
            data?.enabled !== false &&
            (data?.role === "admin" || data?.role === "super_admin")
          ) {
            assignedRole = data.role as Role;
          }
        }
      }
    }

    // 3. Check if Firestore user document has explicit role: "admin" or "super_admin"
    if (!assignedRole) {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const docRole = userDoc.data()?.role as Role | undefined;
        if (docRole === "admin" || docRole === "super_admin") {
          assignedRole = docRole;
        }
      }
    }

    // If an admin role was determined, set custom claim on Firebase Auth immediately
    if (assignedRole) {
      await adminAuth.setCustomUserClaims(uid, { role: assignedRole });
      await adminDb
        .collection("users")
        .doc(uid)
        .set({ role: assignedRole }, { merge: true });

      if (normalizedEmail) {
        await adminDb.collection("adminWhitelist").doc(normalizedEmail).set(
          {
            email: normalizedEmail,
            role: assignedRole,
            enabled: true,
            lastSyncedUid: uid,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }

      return assignedRole;
    } else {
      // Security enforcement: Strip/revoke any stale admin claim from unauthorized users
      try {
        const userRecord = await adminAuth.getUser(uid);
        if (
          userRecord.customClaims?.role === "admin" ||
          userRecord.customClaims?.role === "super_admin"
        ) {
          console.warn(`[checkAndSyncAdminRole] Revoking unauthorized admin claim for user ${uid} (${email})`);
          await adminAuth.setCustomUserClaims(uid, { role: "user" });
          await adminDb.collection("users").doc(uid).set({ role: "user" }, { merge: true });
        }
      } catch {
        // Ignored
      }
    }
  } catch (err) {
    console.error("[checkAndSyncAdminRole] Error validating admin whitelist & syncing role:", err);
  }

  return null;
}

