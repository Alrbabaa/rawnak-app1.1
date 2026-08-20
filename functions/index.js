const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { beforeUserSignedIn, beforeUserCreated } = require("firebase-functions/v2/identity");
const { onRequest } = require("firebase-functions/v2/https");

initializeApp();
const db = getFirestore();
const auth = getAuth();

const DEFAULT_ADMIN_EMAILS = [
  "abood2001.abood.2019@gmail.com",
  "abood2001.abd2019@gmail.com",
  "admin@rawnak.app",
];

function isConfiguredAdminEmail(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    DEFAULT_ADMIN_EMAILS.includes(normalized) ||
    normalized.endsWith("@rawnak.app") ||
    normalized.startsWith("admin@")
  );
}

/**
 * Validates a user's email against the 'adminWhitelist' collection in Firestore.
 * Returns the assigned admin role ('super_admin' or 'admin') if whitelisted, or null if regular user.
 */
async function checkAdminWhitelist(email) {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 1. Check doc in 'adminWhitelist' collection keyed by email
    const docRef = db.collection("adminWhitelist").doc(normalizedEmail);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.enabled !== false) {
        return data?.role === "admin" ? "admin" : "super_admin";
      }
    }

    // 2. Check query in 'adminWhitelist' collection where email field matches
    const querySnap = await db
      .collection("adminWhitelist")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!querySnap.empty) {
      const data = querySnap.docs[0].data();
      if (data?.enabled !== false) {
        return data?.role === "admin" ? "admin" : "super_admin";
      }
    }

    // 3. Fallback check for default whitelisted admin emails
    if (isConfiguredAdminEmail(normalizedEmail)) {
      // Auto-populate entry in adminWhitelist collection
      await docRef.set(
        {
          email: normalizedEmail,
          role: "super_admin",
          enabled: true,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      return "super_admin";
    }
  } catch (err) {
    console.error("[checkAdminWhitelist] Error querying whitelist:", err);
  }

  return null;
}

/**
 * Firebase Identity Blocking Function: Runs immediately before user is signed in.
 * Validates user claims against Firestore whitelist and automatically assigns 'role' custom claim.
 */
exports.validateAdminClaimBeforeSignIn = beforeUserSignedIn(async (event) => {
  const user = event.data;
  const email = user.email;
  const uid = user.uid;

  if (!email) return;

  const adminRole = await checkAdminWhitelist(email);
  if (adminRole) {
    // Persist user role in Firestore
    await db.collection("users").doc(uid).set(
      {
        email: email.toLowerCase().trim(),
        role: adminRole,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    // Return custom claims to be merged directly into ID token upon login
    return {
      customClaims: {
        role: adminRole,
      },
    };
  }
});

/**
 * Firebase Identity Blocking Function: Runs immediately before user is created.
 */
exports.validateAdminClaimBeforeCreate = beforeUserCreated(async (event) => {
  const user = event.data;
  const email = user.email;

  if (!email) return;

  const adminRole = await checkAdminWhitelist(email);
  if (adminRole) {
    return {
      customClaims: {
        role: adminRole,
      },
    };
  }
});

/**
 * Secure HTTPS endpoint for manual/client ID token claims synchronization.
 */
exports.validateAdminClaim = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await auth.verifyIdToken(token);
    const email = decodedToken.email;
    const uid = decodedToken.uid;

    const adminRole = await checkAdminWhitelist(email);

    if (adminRole) {
      await auth.setCustomUserClaims(uid, { role: adminRole });
      await db.collection("users").doc(uid).set({ role: adminRole }, { merge: true });
      res.status(200).json({ ok: true, role: adminRole, whitelisted: true });
    } else {
      res.status(200).json({ ok: true, role: "user", whitelisted: false });
    }
  } catch (err) {
    console.error("[validateAdminClaim HTTP] Error:", err);
    res.status(500).json({ error: "Failed to validate admin claim" });
  }
});
