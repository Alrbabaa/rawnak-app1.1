/**
 * One-time script: promote a Firebase user to super_admin via Custom Claims.
 * Usage: node scripts/set-admin-claim.js abood2001.abd2019@gmail.com super_admin
 */
require("dotenv").config();
const admin = require("firebase-admin");

const VALID_ROLES = ["admin", "super_admin"];

async function main() {
  const email = process.argv[2];
  const role = process.argv[3] || "super_admin";

  if (!email) {
    console.error("Usage: node scripts/set-admin-claim.js <email> [admin|super_admin]");
    process.exit(1);
  }
  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in your environment."
    );
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (err) {
    console.error(`No Firebase user found for ${email}.`);
    console.error("They must sign up in the app FIRST, then re-run this script.");
    process.exit(1);
  }

  await admin.auth().setCustomUserClaims(user.uid, { role });

  console.log(`✅ ${email} (uid: ${user.uid}) is now "${role}".`);
  console.log("→ They need to sign out and back in for this to take effect immediately.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
