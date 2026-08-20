"use client";

import { GoogleAuthProvider } from "firebase/auth";

/**
 * Shared Google OAuth provider for Firebase Auth. One instance reused by
 * both the web popup flow and the Capacitor redirect flow (see
 * `signInWithGoogle` in `@/lib/store`) so their behavior — scopes, prompt
 * behavior, etc. — never drifts apart.
 *
 * `prompt: "select_account"` forces the account chooser every time instead
 * of silently re-using whatever Google session happens to be active in the
 * WebView/browser — important on shared devices.
 */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
