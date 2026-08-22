import { timingSafeEqual } from "crypto";
import type { SubscriptionProvider, SubscriptionEvent, SubscriptionEventType } from "@/lib/subscription/service";

/**
 * RevenueCat provider.
 *
 * WEBHOOK AUTH — important, and easy to get wrong: RevenueCat does NOT sign
 * webhooks with an HMAC signature the way Stripe does. Instead, you set an
 * arbitrary "Authorization header value" in the RevenueCat dashboard
 * (Project Settings > Integrations > Webhooks), and RevenueCat sends that
 * EXACT value back as the `Authorization` header on every webhook request.
 * Verification is therefore a direct (constant-time) string comparison
 * against your own configured secret — not a signature computation. Docs:
 * https://www.revenuecat.com/docs/integrations/webhooks — reconfirm this
 * against RevenueCat's current documentation before going live; webhook
 * mechanisms can change between when this was written and when you deploy.
 *
 * EVENT PAYLOAD SHAPE reflects RevenueCat's documented webhook format at
 * the time of writing. Same caveat: verify field names against a real
 * received payload in RevenueCat's dashboard event log before trusting
 * this in production, since provider APIs evolve.
 *
 * IMPORTANT NUANCE this code gets right on purpose: a CANCELLATION event
 * means the user turned off auto-renew — it does NOT mean they lose access
 * immediately. They keep their entitlement until `expiration_at_ms`. Only
 * an EXPIRATION event (or expiration_at_ms actually passing) means access
 * is truly gone. Treating CANCELLATION as "remove access now" is a common,
 * costly mistake (it would cut off a paying customer mid-period).
 */

interface RevenueCatWebhookPayload {
  api_version?: string;
  event: {
    id: string;
    type: string;
    app_user_id: string;
    product_id: string;
    entitlement_ids?: string[];
    entitlement_id?: string; // deprecated singular form, some events still send it
    expiration_at_ms: number | null;
    event_timestamp_ms: number;
    price_in_purchased_currency?: number | null;
    currency?: string | null;
    environment?: "SANDBOX" | "PRODUCTION";
  };
}

const EVENT_TYPE_MAP: Record<string, SubscriptionEventType> = {
  INITIAL_PURCHASE: "initial_purchase",
  RENEWAL: "renewal",
  CANCELLATION: "cancellation",
  EXPIRATION: "expiration",
  BILLING_ISSUE: "billing_issue",
  PRODUCT_CHANGE: "product_change",
  UNCANCELLATION: "uncancellation",
};

function computeIsActive(type: SubscriptionEventType, expiresAt: number | null, nowMs: number): boolean {
  if (type === "expiration") return false;
  if (expiresAt === null) return true; // lifetime / non-expiring entitlement
  return expiresAt > nowMs;
}

export function createRevenueCatProvider(): SubscriptionProvider {
  return {
    name: "revenuecat",

    verifyWebhook(authHeader: string | null): boolean {
      const secret = process.env.REVENUECAT_WEBHOOK_AUTH_SECRET;
      if (!secret) {
        console.error(
          "[revenuecat] REVENUECAT_WEBHOOK_AUTH_SECRET is not set — refusing all webhooks until configured."
        );
        return false;
      }
      if (!authHeader) return false;

      const a = Buffer.from(authHeader);
      const b = Buffer.from(secret);
      if (a.length !== b.length) return false; // timingSafeEqual requires equal length
      return timingSafeEqual(a, b);
    },

    parseEvent(rawBody: string): SubscriptionEvent | null {
      let payload: RevenueCatWebhookPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return null;
      }

      const e = payload?.event;
      if (!e || !e.app_user_id || !e.type) return null;

      const type = EVENT_TYPE_MAP[e.type] || "other";
      const expiresAt = e.expiration_at_ms ?? null;
      const nowMs = e.event_timestamp_ms || Date.now();
      const entitlementIds = e.entitlement_ids || (e.entitlement_id ? [e.entitlement_id] : []);
      const expectedEntitlementId = process.env.REVENUECAT_VIP_ENTITLEMENT_ID;
      // A purchase event alone is not a VIP grant. It must carry a real
      // RevenueCat entitlement, optionally pinned to the configured VIP id.
      const hasVipEntitlement = entitlementIds.length > 0 &&
        (!expectedEntitlementId || entitlementIds.includes(expectedEntitlementId));

      return {
        uid: e.app_user_id,
        type,
        productId: e.product_id,
        entitlementIds,
        isActive: hasVipEntitlement && computeIsActive(type, expiresAt, nowMs),
        expiresAt,
        priceInCents:
          typeof e.price_in_purchased_currency === "number"
            ? Math.round(e.price_in_purchased_currency * 100)
            : null,
        currency: e.currency || null,
        eventId: e.id,
        eventTimestamp: nowMs,
        raw: payload,
      };
    },
  };
}
