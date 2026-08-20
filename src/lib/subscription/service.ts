/**
 * Subscription Service Layer — provider-agnostic abstraction over
 * subscription/payment webhook events, mirroring src/lib/ai/service.ts's
 * proven pattern exactly.
 *
 * Design goals (same as the AI layer):
 *  - Business logic (the webhook route, referral commission linking) never
 *    imports a specific payment SDK — only this interface.
 *  - Swapping or adding a provider requires editing ONLY the registry below
 *    and adding a new provider file.
 *
 * WHY RevenueCat, not Stripe directly, for the mobile apps:
 * Apple's App Store Review Guideline 3.1.1 requires digital subscriptions
 * consumed INSIDE an iOS app to go through StoreKit (In-App Purchase) —
 * Stripe cannot be used there without risking rejection. Google Play has
 * an equivalent requirement (Play Billing) for most digital-goods cases.
 * RevenueCat is the standard way to unify StoreKit + Play Billing behind
 * one API/webhook instead of building and maintaining two fragile native
 * integrations directly. A pure-web Stripe checkout (for a browser-only
 * purchase path outside the app) is a legitimate SEPARATE future addition,
 * not a replacement for this — it would be its own provider file here.
 *
 * To activate RevenueCat: set SUBSCRIPTION_PROVIDER=revenuecat,
 * REVENUECAT_WEBHOOK_AUTH_SECRET=... (see provider-revenuecat.ts).
 */

import { createRevenueCatProvider } from "@/lib/subscription/provider-revenuecat";

export type SubscriptionEventType =
  | "initial_purchase"
  | "renewal"
  | "cancellation"
  | "expiration"
  | "billing_issue"
  | "product_change"
  | "uncancellation"
  | "other";

export interface SubscriptionEvent {
  /** Our own app user id — the Firebase UID, set as RevenueCat's
   * `app_user_id` when the client SDK is configured (see use-subscription.ts). */
  uid: string;
  type: SubscriptionEventType;
  productId: string;
  entitlementIds: string[];
  isActive: boolean;
  expiresAt: number | null; // epoch ms, null = lifetime/unknown
  priceInCents: number | null;
  currency: string | null;
  eventId: string; // for idempotency — see webhook route
  eventTimestamp: number;
  raw: unknown; // original payload, kept for debugging/audit only
}

export interface SubscriptionProvider {
  readonly name: string;
  /** Verifies the webhook truly came from the provider. MUST be checked
   * before trusting any event — this is the entire security boundary for
   * granting paid entitlements. */
  verifyWebhook(authHeader: string | null): boolean;
  /** Parses a raw webhook body into our normalized event shape. Returns
   * null for event types we don't care about (rather than throwing). */
  parseEvent(rawBody: string): SubscriptionEvent | null;
}

let cachedProvider: SubscriptionProvider | null = null;

export function getSubscriptionProvider(): SubscriptionProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.SUBSCRIPTION_PROVIDER || "revenuecat";

  switch (providerName) {
    case "revenuecat": {
      cachedProvider = createRevenueCatProvider();
      break;
    }
    // case "stripe":
    //   cachedProvider = createStripeProvider();
    //   break;
    default:
      throw new Error(`Unknown subscription provider: ${providerName}`);
  }

  return cachedProvider!;
}
