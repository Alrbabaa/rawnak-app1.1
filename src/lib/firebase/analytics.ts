"use client";

import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { firebaseApp } from "@/lib/firebase/client";

/**
 * Firebase Analytics — lazy, guarded initialization.
 *
 * WHY LAZY (not eager like firebaseAuth in client.ts): getAnalytics()
 * relies on browser APIs (IndexedDB, etc.) that aren't guaranteed in every
 * environment this app runs in — SSR obviously doesn't have them, and some
 * Capacitor/WebView combinations don't reliably either. isSupported() is
 * Firebase's own documented guard for exactly this. Initializing on first
 * real call and caching the result (including a "not supported" result,
 * so we don't recheck every time) means this can be called from anywhere
 * without every call site needing its own environment check.
 *
 * Analytics requires NEXT_PUBLIC_FIREBASE_APP_ID specifically (not just
 * the other Firebase config fields) — already present in .env.example.
 */
let analyticsPromise: Promise<Analytics | null> | null = null;

function getAnalyticsInstance(): Promise<Analytics | null> {
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported: boolean) => (supported ? getAnalytics(firebaseApp) : null))
      .catch(() => null);
  }
  return analyticsPromise!;
}

/**
 * Fires a Firebase Analytics event. Best-effort and silent — analytics
 * must never throw into or block whatever triggered it.
 */
export async function logAnalyticsEvent(
  name: string,
  params?: Record<string, unknown>
): Promise<void> {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  try {
    logEvent(analytics, name, params);
  } catch {
    // Best-effort — swallow. A broken analytics call should never surface
    // to the user or block the feature that triggered it.
  }
}
