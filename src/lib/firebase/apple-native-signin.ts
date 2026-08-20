"use client";

import { SignInWithApple, type SignInWithAppleResponse } from "@capacitor-community/apple-sign-in";
import { OAuthProvider, signInWithCredential, type UserCredential } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

/**
 * Native "Sign in with Apple" on iOS via ASAuthorizationAppleIDProvider
 * (wrapped by @capacitor-community/apple-sign-in), instead of the web
 * OAuth redirect/popup flow used on Android and the browser.
 *
 * Why this exists: App Store Review Guideline 4.8 expects the native
 * Apple ID sheet — not a webview — when an app also offers another
 * third-party login (this app offers Google). The web-flow
 * (`signInWithPopup`/`signInWithRedirect` with `OAuthProvider("apple.com")`
 * in apple-provider.ts / store.ts) still exists and is still what runs on
 * Android + web; this file is ONLY invoked on iOS native, from
 * `signInWithApple()` in store.ts.
 *
 * Setup required before this works (cannot be done from code alone):
 *   1. In the Apple Developer portal, enable "Sign in with Apple" as a
 *      capability on this app's App ID (com.artisticminds.rawnak).
 *   2. In Xcode, add the "Sign in with Apple" capability under Signing &
 *      Capabilities for the App target (this repo's App.entitlements
 *      already declares the entitlement key, but Xcode's project
 *      capability toggle is a separate step that has to happen once,
 *      locally, with a valid Apple Developer account attached).
 *   3. `npm install` (pulls in @capacitor-community/apple-sign-in, added
 *      to package.json) then `npx cap sync ios`.
 *   4. Firebase Console → Authentication → Sign-in method → Apple must
 *      already be enabled (likely already is, since the web flow works).
 */

const CLIENT_ID = "com.artisticminds.rawnak"; // must match capacitor.config.ts appId / the App ID registered for Sign in with Apple

function randomNonce(length = 32): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AppleNativeSignInResult {
  credential: UserCredential;
  /**
   * Short-lived (~5 min) code from Apple, needed to revoke this specific
   * sign-in server-side. Only relevant for the delete-account revoke
   * flow — see revokeNativeAppleToken() in this file and
   * /api/apple/revoke/route.ts.
   */
  authorizationCode: string;
}

/**
 * Runs the native Apple ID sheet and signs the result into Firebase.
 * Used both for normal sign-in AND as the "re-authenticate right before
 * deleting" step deleteAccount() needs to get a fresh authorizationCode
 * to revoke (Apple only lets you revoke a code/token you can still
 * produce — there's no way to revoke on demand without one).
 */
export async function signInWithAppleNative(): Promise<AppleNativeSignInResult> {
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  const response: any = await SignInWithApple.authorize({
    clientId: CLIENT_ID,
    redirectURI: "https://rawnak.app/auth/apple/callback", // unused for native flow, but required by the plugin's options type
    scopes: "email name",
    nonce: hashedNonce,
  });

  if (!response.identityToken) {
    throw new Error("لم يتم استلام رمز الهوية من Apple");
  }

  const provider = new OAuthProvider("apple.com");
  const oauthCredential = provider.credential({
    idToken: response.identityToken,
    rawNonce,
  });

  const credential = await signInWithCredential(firebaseAuth, oauthCredential);

  return { credential, authorizationCode: response.authorizationCode };
}

/**
 * Calls our server route to exchange the authorizationCode for an Apple
 * refresh token and revoke it — the native-flow equivalent of
 * revokeAppleTokenViaPopup() in store.ts (which uses Firebase's
 * revokeAccessToken() helper, only available for the web OAuth flow).
 * Never throws — a failed revoke should not block account deletion, same
 * reasoning as the web-flow path.
 */
export async function revokeNativeAppleToken(authorizationCode: string): Promise<void> {
  try {
    const idToken = await firebaseAuth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch("/api/apple/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ authorizationCode }),
    });
  } catch {
    // Swallow — see doc comment above.
  }
}
