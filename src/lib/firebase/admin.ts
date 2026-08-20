import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import firebaseConfig from "../../../firebase-applet-config.json";

/**
 * Firebase Admin SDK — SERVER ONLY. Full project access (can verify any
 * user's token, set custom claims, read/write anything). Never import this
 * file from a "use client" component.
 */
let appInstance: App | null = null;

function getAdminApp(): App {
  if (appInstance) return appInstance;
  if (getApps().length > 0) {
    appInstance = getApps()[0]!;
    return appInstance;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
    || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    || firebaseConfig.storageBucket;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey) {
    appInstance = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    });
  } else {
    appInstance = initializeApp({
      projectId: projectId || firebaseConfig.projectId,
      storageBucket,
    });
  }

  return appInstance;
}

function createLazyProxy<T extends object>(initializer: () => T): T {
  let target: T | null = null;
  return new Proxy({} as T, {
    get(_, prop) {
      if (!target) {
        target = initializer();
      }
      const val = (target as any)[prop];
      if (typeof val === "function") {
        return val.bind(target);
      }
      return val;
    },
  });
}

export const adminAuth: Auth = createLazyProxy(() => getAuth(getAdminApp()));
export const adminDb: Firestore = createLazyProxy(() => getFirestore(getAdminApp()));
export const adminStorage: Storage = createLazyProxy(() => getStorage(getAdminApp()));
export const adminMessaging: Messaging = createLazyProxy(() => getMessaging(getAdminApp()));
