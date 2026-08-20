"use client";

import { OAuthProvider } from "firebase/auth";

/**
 * Shared "Sign in with Apple" provider for Firebase Auth. Firebase has no
 * dedicated AppleAuthProvider class — Apple is just OAuthProvider("apple.com").
 * One instance reused by both the web popup flow and the Capacitor redirect
 * flow (see `signInWithApple` in `@/lib/store`).
 *
 * `email` + `name` scopes are what let Firebase populate
 * `user.email` / `user.displayName` on first sign-in — Apple only ever
 * sends the name once, the very first time a given user authorizes this
 * app, so requesting the scope up front matters.
 *
 * Note: this drives Apple's *web* OAuth flow (redirect/popup through
 * appleid.apple.com), which is what Firebase's JS SDK supports directly
 * and is fine for web + Android. Apple's App Store review guideline 4.8
 * generally expects the *native* AuthenticationServices "Sign in with
 * Apple" UI on iOS specifically (not a webview redirect) when other
 * third-party logins are offered — if this app is submitted to the iOS
 * App Store, that native integration (e.g. a Capacitor Apple Sign-In
 * plugin feeding its identityToken into `signInWithCredential`) is worth
 * revisiting then. Not implemented here to keep this change scoped to
 * Firebase's own client SDK, as requested.
 */
export const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");
