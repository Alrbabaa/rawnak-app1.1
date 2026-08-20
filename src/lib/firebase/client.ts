"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase client SDK — browser-side only.
 *
 * These NEXT_PUBLIC_* values are NOT secrets (Firebase's own docs confirm
 * this — access control is enforced by Security Rules + Auth, not by
 * hiding the config). Safe to ship in the client bundle.
 *
 * Guarded with getApps().length so Next.js's hot-reload / multiple imports
 * during dev don't try to initialize the app twice.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForBuildVerificationOnly00",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef",
};

function getClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp(firebaseConfig);
}

function createLazyProxy<T extends object>(initializer: () => T): T {
  let target: T | null = null;
  return new Proxy({} as T, {
    get(_, prop) {
      if (!target) {
        try {
          target = initializer();
        } catch (e) {
          console.warn("[Firebase Client] Initialization warning:", e);
          target = {} as T;
        }
      }
      const val = (target as any)[prop];
      if (typeof val === "function") {
        return val.bind(target);
      }
      return val;
    },
  });
}

export const firebaseApp: FirebaseApp = createLazyProxy(() => getClientApp());

export const firebaseAuth: Auth = createLazyProxy(() => getAuth(getClientApp()));
