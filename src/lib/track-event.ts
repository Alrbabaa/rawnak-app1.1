"use client";

import { logAnalyticsEvent } from "@/lib/firebase/analytics";
import { firebaseAuth } from "@/lib/firebase/client";

/**
 * Single entry point for product-analytics events. Fires BOTH:
 *
 * 1. Firebase Analytics (logAnalyticsEvent) — standard funnels/retention
 *    reporting in the Firebase console.
 *
 * 2. POST /api/activity — this app's own Firestore-backed event log.
 *    IMPORTANT CONTEXT: this route and the `activity` collection it writes
 *    to already existed, fully built, before this change — and so did the
 *    admin dashboard's Analytics panel, which reads that exact collection
 *    (src/app/api/admin/analytics/route.ts). But nothing in the client
 *    app ever called POST /api/activity. The admin Analytics panel has
 *    been reading an empty/near-empty collection. This function is the
 *    fix for that — same route, same collection, same panel, just
 *    actually wired up now, not a new subsystem.
 *
 * Best-effort, fire-and-forget by design — call sites should NOT await
 * this. A tracking failure must never block or surface to the user.
 */
export function trackEvent(event: string, meta?: Record<string, unknown>): void {
  const user = firebaseAuth.currentUser;

  logAnalyticsEvent(event, meta).catch(() => {});

  fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      uid: user?.uid,
      email: user?.email || undefined,
      meta: meta || {},
    }),
  }).catch(() => {
    // Best-effort — same reasoning as logAnalyticsEvent above.
  });
}
