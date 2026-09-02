"use client";

import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  GoogleAuthProvider,
  signInWithCredential,
  type UserCredential,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

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

/** Android-only native Google account chooser, bridged back into the
 * existing Firebase Web SDK session used by the rest of the application. */
export async function signInWithGoogleNative(): Promise<UserCredential> {
  const result = await FirebaseAuthentication.signInWithGoogle({
    skipNativeAuth: true,
    useCredentialManager: true,
  });
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("لم يُرجع Google رمز تسجيل دخول صالحًا");
  return signInWithCredential(firebaseAuth, GoogleAuthProvider.credential(idToken));
}
