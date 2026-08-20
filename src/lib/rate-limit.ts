import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Firestore-backed rate limiting (collection: "rateLimits"). Replaces the
 * earlier in-memory Map version — that one was correct on the app's
 * current single-instance deployment (see Caddyfile: everything proxies to
 * one `localhost:3000` process), but would silently stop working the
 * moment a second instance is added (each process had its own Map, so a
 * user could get `max` requests per instance instead of total). This
 * version uses a Firestore transaction per check, so the limit is correct
 * regardless of how many server instances are running — no new
 * infrastructure needed, reuses the Firestore project already in place.
 *
 * One doc per (route, user-or-ip) bucket, keyed deterministically by
 * `key` — so document count tracks active users×routes, not request
 * volume, and existing docs are overwritten in place rather than
 * accumulating. Optional cleanup: a Firestore TTL policy on the `resetAt`
 * field (console-only setting, no code change) will auto-expire old
 * buckets; not required for correctness, only for tidiness.
 *
 * Fails OPEN on any Firestore/transaction error (logged, not thrown) — a
 * rate-limiter outage should never be the reason a real feature goes
 * down; the AI usage quotas (feature-gate.ts) are the actual cost backstop.
 */

function sanitizeDocId(key: string): string {
  // Firestore doc IDs can't contain "/" — everything else in our keys
  // (":" from "<prefix>:user:<uid>" / "<prefix>:ip:<ip>") is safe.
  return key.replace(/\//g, "_");
}

export async function isRateLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const ref = adminDb.collection("rateLimits").doc(sanitizeDocId(key));

  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? (snap.data() as { count: number; resetAt: number }) : null;

      if (!data || data.resetAt < now) {
        tx.set(ref, { count: 1, resetAt: now + windowMs });
        return false;
      }

      const newCount = data.count + 1;
      tx.update(ref, { count: newCount });
      return newCount > max;
    });
  } catch (err) {
    console.error("[rate-limit] Firestore check failed, allowing request through:", err);
    return false;
  }
}

/** Prefer the logged-in user's id (stable, can't be spoofed by rotating
 * IPs); fall back to IP for guests, who have no session. */
export async function rateLimitKey(req: NextRequest, prefix: string): Promise<string> {
  const session = await getSessionFromRequest(req);
  if (session) return `${prefix}:user:${session.uid}`;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:ip:${ip}`;
}

/** Convenience wrapper for the common case in an AI route handler. */
export async function checkAiRateLimit(
  req: NextRequest,
  routeName: string,
  opts: { max: number; windowMs: number }
): Promise<boolean> {
  return isRateLimited(await rateLimitKey(req, routeName), opts.max, opts.windowMs);
}
