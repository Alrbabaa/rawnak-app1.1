"use client";

import { getMessaging, getToken, onMessage, isSupported, type Messaging, type MessagePayload } from "firebase/messaging";
import { firebaseApp } from "@/lib/firebase/client";
import { authedFetch } from "@/lib/firebase/authed-fetch";

/**
 * Firebase Cloud Messaging — WEB PUSH ONLY.
 *
 * Native push (iOS/Android via Capacitor) is a SEPARATE, larger piece of
 * work not attempted here: it needs the @capacitor/push-notifications
 * plugin added (a new native dependency, requiring `npx cap sync` and a
 * real device/simulator build to verify — not something that can be
 * built or tested in this environment) plus an APNs key/certificate from
 * Apple. This file only covers browsers.
 *
 * REQUIRES, to actually work (both must be set for this to do anything):
 *   - NEXT_PUBLIC_FIREBASE_VAPID_KEY — generate in Firebase Console →
 *     Project Settings → Cloud Messaging → Web Push certificates.
 *   - public/firebase-messaging-sw.js must be reachable at the site root
 *     (it already is — see that file).
 * Without the VAPID key, every function here silently no-ops (returns
 * null / does nothing) rather than throwing — push is a nice-to-have
 * layered on top of the existing in-app notification inbox, never a
 * requirement for the app to function.
 */
let messagingPromise: Promise<Messaging | null> | null = null;

function getMessagingInstance(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported: boolean) => (supported ? getMessaging(firebaseApp) : null))
      .catch(() => null);
  }
  return messagingPromise!;
}

/**
 * Requests notification permission (if not already granted/denied),
 * registers the service worker, gets an FCM token, and saves it to the
 * signed-in user's account via /api/notifications/register-token.
 *
 * Returns the token on success, or null if push isn't available/granted/
 * configured — callers should treat null as "silently unavailable", not
 * an error to surface to the user.
 */
export async function requestAndRegisterPush(): Promise<string | null> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("[push] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set — push unavailable");
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return null;

    await authedFetch("/api/notifications/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});

    return token;
  } catch (err) {
    console.warn("[push] registration failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Clears the caller's registered push token (call BEFORE signOut() —
 * this needs the current Firebase ID token to identify whose token to
 * clear, so it must run while the user is still authenticated, exactly
 * the ordering constraint documented at the call site in store.ts's
 * logout()). Without this, a signed-out device would keep receiving the
 * previous user's pushes — the same class of bug already fixed for
 * RevenueCat (see src/lib/subscription/client.ts). */
export async function clearRegisteredPush(): Promise<void> {
  await authedFetch("/api/notifications/register-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: null }),
  }).catch(() => {});
}

/**
 * Foreground message listener — FCM only auto-shows a system notification
 * when the app/tab is in the BACKGROUND (handled by
 * firebase-messaging-sw.js). When the tab is open and focused, the app
 * has to show something itself; wire this up wherever the app already
 * shows toasts, so a foreground push looks like the existing in-app
 * notification pattern rather than introducing a new UI paradigm.
 */
export async function onForegroundPush(
  callback: (payload: { title?: string; body?: string }) => void
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload: MessagePayload) => {
    callback({ title: payload.notification?.title, body: payload.notification?.body });
  });
}
