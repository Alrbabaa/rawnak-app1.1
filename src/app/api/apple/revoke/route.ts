import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionFromRequest } from "@/lib/firebase-session";

/**
 * Revokes the Apple refresh token tied to a native "Sign in with Apple"
 * authorization code, as part of account deletion — the native-iOS
 * counterpart to the web flow's revokeAppleTokenViaPopup()/
 * revokeAccessToken() in store.ts. Required by App Store Review
 * Guideline 5.1.1(v).
 *
 * Why this route has to exist at all: Firebase's client SDK only exposes
 * revokeAccessToken() for the *web* OAuth flow. Native Sign in with Apple
 * (ASAuthorizationAppleIDProvider, via apple-native-signin.ts) hands back
 * an `authorizationCode` instead of an access token, and turning that
 * into something revocable requires calling Apple's own REST API with a
 * signed client secret — which needs your Apple Developer private key,
 * so it has to happen server-side.
 *
 * ── REQUIRED SETUP (cannot be done from code — needs your real Apple
 *    Developer account) ──────────────────────────────────────────────
 * 1. Apple Developer portal → Certificates, IDs & Profiles → Keys →
 *    create a new key with "Sign in with Apple" enabled. Download the
 *    .p8 file (you only get one chance to download it).
 * 2. Note the Key ID (shown when you create the key) and your Team ID
 *    (top-right of the Developer portal, or Membership page).
 * 3. Set these environment variables wherever this Next.js app is
 *    deployed:
 *      APPLE_TEAM_ID          — 10-character Team ID
 *      APPLE_KEY_ID           — 10-character Key ID for the key above
 *      APPLE_PRIVATE_KEY      — full contents of the .p8 file, including
 *                                the -----BEGIN/END PRIVATE KEY----- lines
 *                                (if your host needs it on one line, keep
 *                                the literal "\n" sequences — the code
 *                                below converts them back to real newlines)
 *      APPLE_CLIENT_ID        — com.artisticminds.rawnak (the App ID /
 *                                bundle ID used for native Sign in with
 *                                Apple — same value as CLIENT_ID in
 *                                apple-native-signin.ts)
 * Without these four variables set, this route intentionally no-ops
 * (logs a warning, returns ok) rather than blocking account deletion —
 * see the early return below.
 */

function buildClientSecretJWT(): string | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const rawKey = process.env.APPLE_PRIVATE_KEY;
  if (!teamId || !keyId || !clientId || !rawKey) return null;

  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 300, // short-lived — this JWT is only used immediately, once
    aud: "https://appleid.apple.com",
    sub: clientId,
  };

  const base64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsigned = `${base64url(header)}.${base64url(payload)}`;

  // Apple requires the raw (P1363) ECDSA signature format, not the DER
  // format Node's crypto.sign gives by default for EC keys — hence
  // dsaEncoding: "ieee-p1363".
  const signature = crypto
    .sign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${unsigned}.${signature}`;
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { authorizationCode } = await req.json().catch(() => ({ authorizationCode: null }));
  if (!authorizationCode) {
    return NextResponse.json({ error: "authorizationCode مفقود" }, { status: 400 });
  }

  const clientSecret = buildClientSecretJWT();
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientSecret || !clientId) {
    console.warn(
      "[apple/revoke] APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY/APPLE_CLIENT_ID not configured — " +
        "skipping Apple-side revocation. Account deletion still proceeds; see this file's setup comment."
    );
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    // 1) Exchange the short-lived authorization code for a refresh token.
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      console.error("[apple/revoke] token exchange failed:", tokenData);
      // Don't block deletion — see doc comment above.
      return NextResponse.json({ success: true, revoked: false });
    }

    // 2) Revoke that refresh token.
    const revokeRes = await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: tokenData.refresh_token,
        token_type_hint: "refresh_token",
      }),
    });

    if (!revokeRes.ok) {
      const errText = await revokeRes.text().catch(() => "");
      console.error("[apple/revoke] revoke call failed:", errText);
      return NextResponse.json({ success: true, revoked: false });
    }

    return NextResponse.json({ success: true, revoked: true });
  } catch (error) {
    console.error("[apple/revoke] unexpected error:", error);
    // Still don't block deletion on our own transient error.
    return NextResponse.json({ success: true, revoked: false });
  }
}
