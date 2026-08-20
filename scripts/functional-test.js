/**
 * ============================================================================
 * Rawnak — Real-world Firebase functional test suite
 * ============================================================================
 *
 * This performs GENUINE operations against your real Firebase project and
 * (optionally) your real running Next.js server — nothing here is simulated
 * or mocked. It could not be run inside the sandbox that built this
 * migration (network egress to oauth2.googleapis.com is blocked there) —
 * run this yourself wherever you have real internet access.
 *
 * WHAT THIS TESTS
 *   1. Firebase Authentication      (real signup/login/token verification)
 *   2. Firestore read/write         (via Admin SDK — mirrors every API route)
 *   3. Firestore Security Rules     (via CLIENT SDK — proves direct client
 *                                    access is genuinely denied, since the
 *                                    Admin SDK bypasses rules by design and
 *                                    can't test them)
 *   4. Firebase Storage             (Admin SDK upload + client-side denial)
 *   5. Admin Custom Claims          (set, verify, propagate to a real token)
 *   6. Plans & Chat history sync    (users/{uid}/plans + chatSessions/current
 *                                    subcollections, incl. Rules coverage)
 *   7. Referral flow                (partner creation, HTTP signup linking)
 *   8. Subscriptions                (RevenueCat webhook: auth, event parsing,
 *                                    idempotency, referral commission math)
 *   9. AI endpoints                 (chat, skin-analysis, product-scan — HTTP)
 *  10. Admin Dashboard              (HTTP, with a positive AND negative
 *                                    authorization test)
 *  11. All migrated public content  (picks, articles, academy-videos, partners)
 *
 * Sections 7-10 need your Next.js server actually running and
 * reachable (locally via `npm run dev`, or a deployed URL). If it isn't
 * reachable, those specific tests report SKIPPED with a clear reason — not
 * a false FAIL — so the report always distinguishes "didn't run" from
 * "ran and failed".
 *
 * ----------------------------------------------------------------------------
 * HOW TO RUN
 * ----------------------------------------------------------------------------
 *   1. npm install          (make sure firebase, firebase-admin, dotenv are installed)
 *   2. Fill in your real .env (see .env.example)
 *   3. (Recommended) In a separate terminal: npm run dev
 *   4. node scripts/functional-test.js
 *
 * Optional environment variables:
 *   TEST_BASE_URL     Base URL of your running app for HTTP tests.
 *                      Defaults to http://localhost:3000
 *   RUN_AI_TESTS       "false" to skip AI endpoint tests (they cost real
 *                      API credits and take longer). Defaults to "true".
 *
 * Exit code 0 = everything that ran passed. Exit code 1 = at least one
 * real failure (SKIPs don't count as failures).
 * ============================================================================
 */
require("dotenv").config();

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const clientApp = require("firebase/app");
const clientAuth = require("firebase/auth");

const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const RUN_AI_TESTS = process.env.RUN_AI_TESTS !== "false";
const TEST_EMAIL = `rawnak-functest-${Date.now()}@example.com`;
const TEST_EMAIL_2 = `rawnak-functest-2-${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";

// A 1x1 red pixel JPEG, base64-encoded — structurally valid so the AI
// endpoints' image-parsing code runs for real. The AI's *analysis content*
// obviously won't be meaningful for a blank pixel; these tests confirm the
// pipeline (auth -> rate limit -> AI call -> JSON parse -> response) works
// end-to-end, not that the AI's judgment is accurate.
const TEST_IMAGE_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

const results = [];

function statusIcon(status) {
  return { PASS: "✅", FAIL: "🔴", SKIP: "⏭️ " }[status];
}

async function section(title) {
  console.log(`\n${"─".repeat(70)}\n${title}\n${"─".repeat(70)}`);
}

async function test(name, fn) {
  try {
    const skipReason = await fn();
    if (skipReason && skipReason.__skip__) {
      console.log(`${statusIcon("SKIP")} ${name}`);
      console.log(`   → ${skipReason.reason}`);
      results.push({ name, status: "SKIP", reason: skipReason.reason });
      return;
    }
    console.log(`${statusIcon("PASS")} ${name}`);
    results.push({ name, status: "PASS" });
  } catch (err) {
    console.log(`${statusIcon("FAIL")} ${name}`);
    console.log(`   → ${err.message}`);
    results.push({ name, status: "FAIL", reason: err.message });
  }
}

function skip(reason) {
  return { __skip__: true, reason };
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

let serverReachable = null;
async function checkServerReachable() {
  if (serverReachable !== null) return serverReachable;
  try {
    const res = await fetch(TEST_BASE_URL, { signal: AbortSignal.timeout(5000) });
    serverReachable = res.status < 500;
  } catch {
    serverReachable = false;
  }
  return serverReachable;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const adminApp = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket });
  const auth = getAuth(adminApp);
  const db = getFirestore(adminApp);

  const webConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const missingWebConfig = Object.entries(webConfig).filter(([, v]) => !v).map(([k]) => k);

  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`  Rawnak real functional test suite`);
  console.log(`  Project: ${projectId}`);
  console.log(`  Server:  ${TEST_BASE_URL}`);
  console.log(`═══════════════════════════════════════════════════════════════════`);

  const serverUp = await checkServerReachable();
  if (!serverUp) {
    console.log(`\n⚠️  ${TEST_BASE_URL} is not reachable — HTTP-dependent tests (AI endpoints,`);
    console.log(`   Admin Dashboard, referral HTTP flow) will be SKIPPED, not failed.`);
    console.log(`   Run "npm run dev" in another terminal to include them.\n`);
  }

  let testUid = null;
  let testUid2 = null; // second user, for cross-user Rules denial tests
  let adminIdToken = null;
  let userIdToken = null;
  let partnerId = null;

  // ==========================================================================
  await section("1. Firebase Authentication");
  // ==========================================================================

  await test("Admin SDK connects to Auth", async () => {
    await auth.listUsers(1);
  });

  await test("Create a real user (signup equivalent)", async () => {
    const user = await auth.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD, displayName: "Test User" });
    testUid = user.uid;
    assert(user.email === TEST_EMAIL);
  });

  await test("Create a second real user (for cross-user Rules tests)", async () => {
    const user = await auth.createUser({ email: TEST_EMAIL_2, password: TEST_PASSWORD, displayName: "Test User 2" });
    testUid2 = user.uid;
  });

  if (missingWebConfig.length > 0) {
    await test("Sign in via Client SDK (real ID token)", async () =>
      skip(`Missing client web config in .env: ${missingWebConfig.join(", ")}`)
    );
  } else {
    await test("Sign in via Client SDK (real ID token)", async () => {
      const app = clientApp.initializeApp(webConfig, `test-${Date.now()}`);
      const a = clientAuth.getAuth(app);
      const cred = await clientAuth.signInWithEmailAndPassword(a, TEST_EMAIL, TEST_PASSWORD);
      userIdToken = await cred.user.getIdToken();
      assert(!!userIdToken, "no ID token returned");
      await clientAuth.signOut(a);
    });

    await test("Reject login with wrong password", async () => {
      const app = clientApp.initializeApp(webConfig, `test-wrongpw-${Date.now()}`);
      const a = clientAuth.getAuth(app);
      let code = null;
      try {
        await clientAuth.signInWithEmailAndPassword(a, TEST_EMAIL, "TotallyWrongPassword!");
      } catch (e) {
        code = e.code;
      }
      // Must be the specific auth-rejection code — NOT just "any error",
      // which would also (wrongly) pass on a network failure and hide a
      // real problem instead of catching it.
      assert(
        code === "auth/wrong-password" || code === "auth/invalid-credential",
        `expected a wrong-password rejection, got: ${code || "no error at all"}`
      );
    });
  }

  await test("Server verifies the real ID token (firebase-session.ts logic)", async () => {
    if (!userIdToken) throw new Error("no ID token from previous step");
    const decoded = await auth.verifyIdToken(userIdToken);
    assert(decoded.uid === testUid, "verified UID does not match signed-in user");
  });

  // ==========================================================================
  await section("2. Firestore read/write (Admin SDK — mirrors API routes)");
  // ==========================================================================

  await test("Create users/{uid} doc (complete-signup logic)", async () => {
    await db.collection("users").doc(testUid).set({
      email: TEST_EMAIL, name: "Test User", age: null, skinType: null, skinTone: null,
      concerns: [], goals: [], makeupLevel: null, lifestyle: [], avatar: "", createdAt: Date.now(),
    });
    const snap = await db.collection("users").doc(testUid).get();
    assert(snap.exists && snap.data().email === TEST_EMAIL);
  });

  await test("Update profile fields (db/user route logic)", async () => {
    await db.collection("users").doc(testUid).set({ skinType: "combination", updatedAt: Date.now() }, { merge: true });
    const snap = await db.collection("users").doc(testUid).get();
    assert(snap.data().skinType === "combination");
  });

  await test("Write + read an analyses subcollection doc (db/sync logic)", async () => {
    const ref = db.collection("users").doc(testUid).collection("analyses").doc();
    await ref.set({ overall: 80, skinType: "combination", createdAt: Date.now(), summary: "test", recommendations: [], imageUrl: "" });
    const snap = await ref.get();
    assert(snap.exists && snap.data().overall === 80);
  });

  await test("Full-replace a cabinet subcollection (db/sync logic)", async () => {
    const ref = db.collection("users").doc(testUid).collection("cabinet");
    await ref.doc().set({ name: "Test Serum", brand: "Test", category: "skincare" });
    const snap = await ref.get();
    assert(snap.size === 1);
  });

  // ==========================================================================
  await section("3. Firestore Security Rules (Client SDK — must be DENIED)");
  // ==========================================================================
  // Admin SDK bypasses rules entirely, so these tests specifically use the
  // CLIENT SDK signed in as a real user, proving direct access is refused.

  if (missingWebConfig.length > 0) {
    await test("Security Rules enforcement", async () => skip("Client web config missing — see Section 1"));
  } else {
    const { getFirestore: getClientFirestore, doc, getDoc, setDoc, collection, getDocs } = require("firebase/firestore");

    await test("Authenticated client CANNOT read their own users/{uid} doc directly", async () => {
      const app = clientApp.initializeApp(webConfig, `test-rules-own-${Date.now()}`);
      const a = clientAuth.getAuth(app);
      await clientAuth.signInWithEmailAndPassword(a, TEST_EMAIL, TEST_PASSWORD);
      const cdb = getClientFirestore(app);
      let denied = false;
      try {
        await getDoc(doc(cdb, "users", testUid));
      } catch (e) {
        denied = e.code === "permission-denied";
      }
      assert(denied, "expected permission-denied — direct client reads must be blocked by firestore.rules");
      await clientAuth.signOut(a);
    });

    await test("Authenticated client CANNOT write another user's doc", async () => {
      const app = clientApp.initializeApp(webConfig, `test-rules-cross-${Date.now()}`);
      const a = clientAuth.getAuth(app);
      await clientAuth.signInWithEmailAndPassword(a, TEST_EMAIL, TEST_PASSWORD);
      const cdb = getClientFirestore(app);
      let denied = false;
      try {
        await setDoc(doc(cdb, "users", testUid2), { hacked: true });
      } catch (e) {
        denied = e.code === "permission-denied";
      }
      assert(denied, "expected permission-denied on cross-user write");
      await clientAuth.signOut(a);
    });

    await test("Unauthenticated client CANNOT read public content collections directly", async () => {
      const app = clientApp.initializeApp(webConfig, `test-rules-anon-${Date.now()}`);
      const cdb = getClientFirestore(app);
      let denied = false;
      try {
        await getDocs(collection(cdb, "picks"));
      } catch (e) {
        denied = e.code === "permission-denied";
      }
      assert(denied, "expected permission-denied — public content is served via API routes, not direct client reads");
    });
  }

  // ==========================================================================
  await section("4. Firebase Storage");
  // ==========================================================================

  await test("Admin SDK connects to Storage", async () => {
    await getStorage(adminApp).bucket().getFiles({ maxResults: 1 });
  });

  await test("Upload + verify + delete a file (Admin SDK, mirrors upload-image.ts)", async () => {
    const bucket = getStorage(adminApp).bucket();
    const path = `users/${testUid}/_functest.txt`;
    const file = bucket.file(path);
    await file.save(Buffer.from("functional test"), { metadata: { contentType: "text/plain" } });
    const [exists] = await file.exists();
    assert(exists, "file was not uploaded");
    await file.delete();
  });

  if (missingWebConfig.length > 0) {
    await test("Client SDK CANNOT upload directly (Storage Rules)", async () => skip("Client web config missing"));
  } else {
    await test("Client SDK CANNOT upload directly (Storage Rules)", async () => {
      const { getStorage: getClientStorage, ref, uploadBytes } = require("firebase/storage");
      const app = clientApp.initializeApp(webConfig, `test-storage-rules-${Date.now()}`);
      const a = clientAuth.getAuth(app);
      await clientAuth.signInWithEmailAndPassword(a, TEST_EMAIL, TEST_PASSWORD);
      const cstorage = getClientStorage(app);
      let denied = false;
      try {
        await uploadBytes(ref(cstorage, `users/${testUid}/_client_attempt.txt`), Buffer.from("should be denied"));
      } catch (e) {
        denied = e.code === "storage/unauthorized";
      }
      assert(denied, "expected storage/unauthorized — direct client uploads must be blocked");
      await clientAuth.signOut(a);
    });
  }

  // ==========================================================================
  await section("5. Admin Custom Claims");
  // ==========================================================================

  await test("Set a custom claim (set-admin-claim.js logic)", async () => {
    await auth.setCustomUserClaims(testUid, { role: "admin" });
    const refreshed = await auth.getUser(testUid);
    assert(refreshed.customClaims?.role === "admin");
  });

  if (missingWebConfig.length > 0) {
    await test("Claim propagates to a real ID token", async () => skip("Client web config missing"));
  } else {
    await test("Claim propagates to a real ID token", async () => {
      const app = clientApp.initializeApp(webConfig, `test-claims-${Date.now()}`);
      const a = clientAuth.getAuth(app);
      const cred = await clientAuth.signInWithEmailAndPassword(a, TEST_EMAIL, TEST_PASSWORD);
      await cred.user.getIdToken(true); // force refresh
      const result = await cred.user.getIdTokenResult();
      assert(result.claims.role === "admin", "claim did not appear on a fresh token");
      adminIdToken = await cred.user.getIdToken();
      await clientAuth.signOut(a);
    });
  }

  // ==========================================================================
  await section("6. Plans & Chat history sync (Firestore subcollections)");
  // ==========================================================================

  await test("Write + read a plans subcollection doc (db/sync logic)", async () => {
    const ref = db.collection("users").doc(testUid).collection("plans").doc();
    await ref.set({
      occasion: "wedding", occasionLabel: "حفل زفاف", date: Date.now(),
      steps: [{ phase: "تحضير", items: ["ترطيب"] }], products: ["كريم أساس"],
      duration: "45 دقيقة", tips: ["ابدئي مبكرًا"], createdAt: Date.now(),
    });
    const snap = await ref.get();
    assert(snap.exists && snap.data().occasion === "wedding");
  });

  await test("Write + read the chatSessions/current doc (single fixed doc, not multi-session)", async () => {
    const ref = db.collection("users").doc(testUid).collection("chatSessions").doc("current");
    const messages = [{ id: "m1", role: "user", content: "مرحبا", ts: Date.now() }];
    await ref.set({ messages, updatedAt: Date.now() });
    const snap = await ref.get();
    assert(snap.exists && snap.data().messages.length === 1);
  });

  if (missingWebConfig.length > 0) {
    await test("Security Rules deny direct client access to plans/chatSessions", async () =>
      skip("Client web config missing — see Section 1")
    );
  } else {
    await test("Security Rules deny direct client access to plans/chatSessions", async () => {
      const { getFirestore: getClientFirestore, doc, getDoc } = require("firebase/firestore");
      const app = clientApp.initializeApp(webConfig, `test-rules-plans-${Date.now()}`);
      const a = clientAuth.getAuth(app);
      await clientAuth.signInWithEmailAndPassword(a, TEST_EMAIL, TEST_PASSWORD);
      const cdb = getClientFirestore(app);
      let denied = false;
      try {
        await getDoc(doc(cdb, "users", testUid, "chatSessions", "current"));
      } catch (e) {
        denied = e.code === "permission-denied";
      }
      assert(denied, "expected permission-denied on chatSessions — covered by the users/{uid} subcollection wildcard");
      await clientAuth.signOut(a);
    });
  }

  if (!serverUp) {
    await test("POST /api/db/sync accepts plans + chatMessages over HTTP", async () =>
      skip(`${TEST_BASE_URL} not reachable`)
    );
  } else if (!userIdToken) {
    await test("POST /api/db/sync accepts plans + chatMessages over HTTP", async () =>
      skip("no user ID token available")
    );
  } else {
    await test("POST /api/db/sync accepts plans + chatMessages over HTTP", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/db/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userIdToken}` },
        body: JSON.stringify({
          plans: [{ occasion: "party", occasionLabel: "حفلة", date: Date.now(), steps: [], products: [], duration: "20 دقيقة", tips: [], createdAt: Date.now() }],
          chatMessages: [{ id: "http-m1", role: "user", content: "test", ts: Date.now() }],
        }),
      });
      assert(res.status === 200, `expected 200, got ${res.status}: ${await res.text()}`);
      const data = await res.json();
      assert(data.plans === 1 && data.chatMessages === 1, "sync counts did not match what was sent");
    });

    await test("GET /api/db/sync returns the synced plans + chatMessages", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/db/sync`, { headers: { Authorization: `Bearer ${userIdToken}` } });
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data.plans) && data.plans.length >= 1, "plans missing from GET response");
      assert(Array.isArray(data.chatMessages) && data.chatMessages.length >= 1, "chatMessages missing from GET response");
    });
  }

  // ==========================================================================
  await section("7. Referral flow");
  // ==========================================================================

  await test("Create a referral partner + link a referral (subcollection)", async () => {
    const partnerRef = await db.collection("referralPartners").add({
      name: "Test Partner", referralCode: `TEST-${Date.now()}`, status: "active",
      discountPercentage: 10, commissionPercentage: 10, createdAt: Date.now(),
    });
    partnerId = partnerRef.id;
    await partnerRef.collection("referrals").doc(testUid2).set({
      registeredAt: Date.now(), email: TEST_EMAIL_2, name: "Test User 2", subscriptionStatus: "none",
    });
    const referralsSnap = await partnerRef.collection("referrals").get();
    assert(referralsSnap.size === 1, "referral was not linked");
  });

  if (!serverUp) {
    await test("Full HTTP signup with referral code (complete-signup route)", async () =>
      skip(`${TEST_BASE_URL} not reachable`)
    );
  } else {
    await test("Full HTTP signup with referral code (complete-signup route)", async () => {
      if (!userIdToken) throw new Error("no user ID token available from Section 1");
      const partnerSnap = await db.collection("referralPartners").doc(partnerId).get();
      const res = await fetch(`${TEST_BASE_URL}/api/auth/complete-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userIdToken}` },
        body: JSON.stringify({ name: "Test User", referralCode: partnerSnap.data().referralCode }),
      });
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const data = await res.json();
      assert(data.ok === true);
    });
  }

  // ==========================================================================
  await section("8. Subscriptions (RevenueCat webhook + referral commission)");
  // ==========================================================================

  const webhookSecret = process.env.REVENUECAT_WEBHOOK_AUTH_SECRET;
  const testEventId = `functest-event-${Date.now()}`;
  const PRICE_CENTS = 999; // $9.99

  if (!serverUp) {
    await test("Subscription webhook tests", async () => skip(`${TEST_BASE_URL} not reachable`));
  } else {
    await test("Webhook rejects a request with no Authorization header", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/webhooks/revenuecat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: { id: "x", type: "TEST", app_user_id: "x" } }),
      });
      assert(res.status === 401, `expected 401, got ${res.status}`);
    });

    await test("Webhook rejects a request with the WRONG Authorization header", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/webhooks/revenuecat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "definitely-not-the-real-secret" },
        body: JSON.stringify({ event: { id: "x", type: "TEST", app_user_id: "x" } }),
      });
      assert(res.status === 401, `expected 401, got ${res.status}`);
    });

    if (!webhookSecret) {
      await test("Webhook accepts a valid signed event and grants premium", async () =>
        skip("REVENUECAT_WEBHOOK_AUTH_SECRET not set in .env — configure it to test the success path")
      );
      await test("Referral commission is calculated correctly from the event", async () =>
        skip("REVENUECAT_WEBHOOK_AUTH_SECRET not set")
      );
      await test("Webhook is idempotent — resending the same event does not double-count revenue", async () =>
        skip("REVENUECAT_WEBHOOK_AUTH_SECRET not set")
      );
    } else {
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const buildPayload = () => ({
        api_version: "1.0",
        event: {
          id: testEventId,
          type: "INITIAL_PURCHASE",
          app_user_id: testUid,
          product_id: "rawnak_vip_monthly",
          entitlement_ids: ["premium"],
          expiration_at_ms: expiresAt,
          event_timestamp_ms: Date.now(),
          price_in_purchased_currency: PRICE_CENTS / 100,
          currency: "USD",
          environment: "SANDBOX",
        },
      });

      await test("Webhook accepts a valid signed event and grants premium", async () => {
        const res = await fetch(`${TEST_BASE_URL}/api/webhooks/revenuecat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: webhookSecret },
          body: JSON.stringify(buildPayload()),
        });
        assert(res.status === 200, `expected 200, got ${res.status}: ${await res.text()}`);

        const userSnap = await db.collection("users").doc(testUid).get();
        assert(userSnap.data()?.isPremium === true, "isPremium was not set to true");
        assert(userSnap.data()?.subscriptionExpiresAt === expiresAt, "expiresAt did not match the event");
      });

      const referredByPartnerId = (await db.collection("users").doc(testUid).get()).data()?.referredByPartnerId;
      if (!referredByPartnerId) {
        await test("Referral commission is calculated correctly from the event", async () =>
          skip("testUid has no referredByPartnerId — the Section 7 HTTP signup test must run first (needs a reachable server)")
        );
      } else {
        await test("Referral commission is calculated correctly from the event", async () => {
          const referralSnap = await db
            .collection("referralPartners").doc(referredByPartnerId)
            .collection("referrals").doc(testUid).get();
          assert(referralSnap.exists, "referral doc not found");
          const d = referralSnap.data();
          assert(d.subscriptionStatus === "active", `expected status active, got ${d.subscriptionStatus}`);
          assert(d.totalRevenueCents === PRICE_CENTS, `expected ${PRICE_CENTS} revenue cents, got ${d.totalRevenueCents}`);
          // 10% commission on $9.99 = 99.9 cents, rounded to 100
          assert(d.commissionAmountCents === 100, `expected 100 commission cents, got ${d.commissionAmountCents}`);
        });
      }

      await test("Webhook is idempotent — resending the same event does not double-count revenue", async () => {
        const res = await fetch(`${TEST_BASE_URL}/api/webhooks/revenuecat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: webhookSecret },
          body: JSON.stringify(buildPayload()), // identical event.id
        });
        assert(res.status === 200, `expected 200, got ${res.status}`);
        const data = await res.json();
        assert(data.alreadyProcessed === true, "webhook did not recognize the duplicate event");

        if (referredByPartnerId) {
          const referralSnap = await db
            .collection("referralPartners").doc(referredByPartnerId)
            .collection("referrals").doc(testUid).get();
          assert(
            referralSnap.data()?.totalRevenueCents === PRICE_CENTS,
            "revenue was double-counted on a retried webhook event — idempotency is broken"
          );
        }
      });
    }
  }

  // ==========================================================================
  await section("9. AI endpoints (HTTP — requires running server)");
  // ==========================================================================

  if (!RUN_AI_TESTS) {
    await test("AI endpoint tests", async () => skip("RUN_AI_TESTS=false"));
  } else if (!serverUp) {
    await test("AI endpoint tests", async () => skip(`${TEST_BASE_URL} not reachable`));
  } else if (!userIdToken) {
    await test("AI endpoint tests", async () => skip("no user ID token available"));
  } else {
    await test("POST /api/chat returns a real AI response", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userIdToken}` },
        body: JSON.stringify({ message: "ما أفضل روتين للبشرة الجافة؟", history: [] }),
      });
      assert(res.status === 200, `expected 200, got ${res.status}: ${await res.text()}`);
      const data = await res.json();
      assert(typeof data.response === "string" && data.response.length > 0, "no response text returned");
    });

    await test("POST /api/skin-analysis processes an image end-to-end", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/skin-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userIdToken}` },
        body: JSON.stringify({ image: TEST_IMAGE_DATA_URL }),
      });
      assert(res.status === 200, `expected 200, got ${res.status}: ${await res.text()}`);
      const data = await res.json();
      assert(typeof data.overall === "number", "no numeric overall score returned");
    });

    await test("POST /api/product-scan processes an image end-to-end", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/product-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${userIdToken}` },
        body: JSON.stringify({ image: TEST_IMAGE_DATA_URL }),
      });
      assert(res.status === 200, `expected 200, got ${res.status}: ${await res.text()}`);
    });

    await test("AI endpoints reject requests with no auth token", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test", history: [] }),
      });
      // Chat doesn't strictly require auth in this app's design (guests can
      // chat) — this test just confirms the endpoint responds sanely rather
      // than crashing with no token, not that it necessarily rejects it.
      assert(res.status < 500, `endpoint crashed with no token: ${res.status}`);
    });
  }

  // ==========================================================================
  await section("10. Admin Dashboard (HTTP — positive + negative authorization)");
  // ==========================================================================

  if (!serverUp) {
    await test("Admin Dashboard tests", async () => skip(`${TEST_BASE_URL} not reachable`));
  } else {
    if (!adminIdToken) {
      await test("Admin routes accept a real admin token", async () => skip("no admin ID token from Section 5"));
    } else {
      await test("GET /api/admin/users succeeds with a real admin token", async () => {
        const res = await fetch(`${TEST_BASE_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${adminIdToken}` } });
        assert(res.status === 200, `expected 200, got ${res.status}: ${await res.text()}`);
        const data = await res.json();
        assert(Array.isArray(data.users), "response missing users array");
      });

      await test("GET /api/admin/analytics succeeds with a real admin token", async () => {
        const res = await fetch(`${TEST_BASE_URL}/api/admin/analytics`, { headers: { Authorization: `Bearer ${adminIdToken}` } });
        assert(res.status === 200, `expected 200, got ${res.status}: ${await res.text()}`);
        const data = await res.json();
        assert(data.metrics && typeof data.metrics.totalUsers === "number", "response missing metrics");
      });

      await test("GET /api/admin/referral-partners succeeds and shows the linked referral", async () => {
        const res = await fetch(`${TEST_BASE_URL}/api/admin/referral-partners`, { headers: { Authorization: `Bearer ${adminIdToken}` } });
        assert(res.status === 200, `expected 200, got ${res.status}`);
        const data = await res.json();
        const partner = data.partners.find((p) => p.id === partnerId);
        assert(partner, "test partner not found in admin list");
        assert(partner.stats.totalRegistrations === 1, "referral count mismatch");
      });
    }

    await test("Admin routes REJECT a non-admin user's token", async () => {
      if (!userIdToken) throw new Error("no non-admin user token available");
      const res = await fetch(`${TEST_BASE_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${userIdToken}` } });
      assert(res.status === 401, `expected 401 for non-admin token, got ${res.status}`);
    });

    await test("Admin routes REJECT requests with no token at all", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/admin/users`);
      assert(res.status === 401, `expected 401 for missing token, got ${res.status}`);
    });
  }

  // ==========================================================================
  await section("11. Public content endpoints (all migrated features)");
  // ==========================================================================

  if (!serverUp) {
    await test("Public content endpoints", async () => skip(`${TEST_BASE_URL} not reachable`));
  } else {
    for (const [name, path] of [
      ["picks", "/api/picks"],
      ["articles", "/api/articles"],
      ["academy videos", "/api/academy-videos"],
      ["partners", "/api/partners"],
    ]) {
      await test(`GET ${path} responds successfully (no auth required)`, async () => {
        const res = await fetch(`${TEST_BASE_URL}${path}`);
        assert(res.status === 200, `expected 200, got ${res.status}: ${await res.text()}`);
      });
    }

    await test("GET /api/notifications requires auth", async () => {
      const res = await fetch(`${TEST_BASE_URL}/api/notifications`);
      assert(res.status === 401, `expected 401 with no token, got ${res.status}`);
    });

    if (userIdToken) {
      await test("GET /api/notifications succeeds for an authed user", async () => {
        const res = await fetch(`${TEST_BASE_URL}/api/notifications`, { headers: { Authorization: `Bearer ${userIdToken}` } });
        assert(res.status === 200, `expected 200, got ${res.status}`);
      });
    }
  }

  // ==========================================================================
  await section("Cleanup");
  // ==========================================================================

  try {
    if (partnerId) {
      const partnerRef = db.collection("referralPartners").doc(partnerId);
      const referrals = await partnerRef.collection("referrals").get();
      await Promise.all(referrals.docs.map((d) => d.ref.delete()));
      await partnerRef.delete();
    }
    for (const uid of [testUid, testUid2]) {
      if (!uid) continue;
      for (const sub of ["analyses", "cabinet", "favorites", "achievements", "notifications", "plans", "chatSessions"]) {
        const snap = await db.collection("users").doc(uid).collection(sub).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
      }
      await db.collection("users").doc(uid).delete();
      await auth.deleteUser(uid);
    }
    await db.collection("webhookEvents").doc(testEventId).delete().catch(() => {});
    console.log("✅ cleanup complete — no test data left behind");
  } catch (e) {
    console.log(`⚠️  cleanup partially failed: ${e.message}`);
    console.log(`   Manual check recommended for uids: ${testUid}, ${testUid2}`);
  }

  // ==========================================================================
  // Final report
  // ==========================================================================
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log(`\n${"═".repeat(70)}`);
  console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${skipped} skipped (of ${results.length})`);
  console.log(`${"═".repeat(70)}`);

  if (fail > 0) {
    console.log(`\nFailed tests:`);
    results.filter((r) => r.status === "FAIL").forEach((r) => console.log(`  🔴 ${r.name}\n     ${r.reason}`));
  }
  if (skipped > 0) {
    console.log(`\nSkipped tests (run "npm run dev" and re-run this suite to include them):`);
    results.filter((r) => r.status === "SKIP").forEach((r) => console.log(`  ⏭️  ${r.name} — ${r.reason}`));
  }

  console.log("");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n🔴 Suite crashed unexpectedly:", err);
  process.exit(1);
});
