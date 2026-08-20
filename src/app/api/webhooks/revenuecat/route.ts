import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSubscriptionProvider } from "@/lib/subscription/service";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Receives RevenueCat webhook events. NOT authenticated via Firebase — the
 * caller is RevenueCat's own servers, not a logged-in app user. Trust comes
 * exclusively from the provider's verifyWebhook() check against a shared
 * secret configured in both RevenueCat's dashboard and this project's env
 * (REVENUECAT_WEBHOOK_AUTH_SECRET). Never relax or bypass this check.
 */
export async function POST(req: NextRequest) {
  const provider = getSubscriptionProvider();

  const authHeader = req.headers.get("authorization");
  if (!provider.verifyWebhook(authHeader)) {
    console.error("[webhooks/revenuecat] rejected — invalid or missing Authorization header");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();
  const event = provider.parseEvent(rawBody);

  if (!event) {
    // Not an error — e.g. a TEST event or a type we don't act on. RevenueCat
    // expects 200 for anything we're intentionally ignoring, or it will
    // keep retrying.
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Idempotency + atomicity: RevenueCat retries webhooks on any non-2xx
  // response, and can occasionally redeliver the same event even after a
  // 200 (per their own docs). The whole thing runs inside one Firestore
  // transaction — not just a "check then write" — for two reasons:
  //   1. If a crash happened between writing the referral commission and
  //      marking the event processed, a naive check-then-write would let a
  //      retry re-read the ALREADY-incremented revenue and add the price
  //      again, double-counting commission for that one event.
  //   2. Two truly simultaneous duplicate deliveries (not just sequential
  //      retries) could both pass a non-atomic "does this event exist yet"
  //      check before either had finished writing.
  // A transaction closes both gaps: everything commits together, or none
  // of it does, and Firestore itself serializes concurrent transactions
  // touching the same documents.
  const eventRef = adminDb.collection("webhookEvents").doc(event.eventId);

  try {
    const alreadyProcessed = await adminDb.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      if (eventSnap.exists) return true;

      const userRef = adminDb.collection("users").doc(event.uid);
      const userSnap = await tx.get(userRef);
      const referredByPartnerId = userSnap.data()?.referredByPartnerId as string | undefined;

      // Referral commission linkage — closes the loop on the placeholder
      // fields (subscriptionStatus/totalRevenueCents/commissionAmountCents)
      // that have existed on the Referral shape since the referral system
      // was first built, unpopulated until now.
      let referralRef: FirebaseFirestore.DocumentReference | null = null;
      let commissionPercentage = 0;
      let priorRevenue = 0;

      if (referredByPartnerId && event.priceInCents !== null) {
        const partnerRef = adminDb.collection("referralPartners").doc(referredByPartnerId);
        const partnerSnap = await tx.get(partnerRef);
        if (partnerSnap.exists) {
          commissionPercentage = (partnerSnap.data()?.commissionPercentage as number) || 0;
          referralRef = partnerRef.collection("referrals").doc(event.uid);
          const referralSnap = await tx.get(referralRef);
          priorRevenue = (referralSnap.data()?.totalRevenueCents as number) || 0;
        }
      }

      // ---- all reads are done above; everything below is writes only,
      // as Firestore transactions require ----

      // Subscription state — the only user this ever touches is the
      // purchaser (event.uid), which is exactly and only whatever
      // RevenueCat identified as the app_user_id on their end (see
      // src/hooks/use-subscription.ts for how that identity is kept in
      // sync with the signed-in Firebase user). This write can never
      // reach a referrer's document — there is no code path here that
      // takes a referrer's uid as the write target.
      tx.set(
        userRef,
        {
          isPremium: event.isActive,
          subscriptionExpiresAt: event.expiresAt,
          subscriptionProductId: event.productId,
          subscriptionEntitlements: event.entitlementIds,
          subscriptionProvider: "revenuecat",
          subscriptionUpdatedAt: Date.now(),
        },
        { merge: true }
      );

      if (referralRef) {
        // Only accumulate revenue for genuine revenue-generating events —
        // a CANCELLATION or EXPIRATION shouldn't add more revenue, just
        // update the status shown in the admin panel.
        const isRevenueEvent = event.type === "initial_purchase" || event.type === "renewal";
        const newRevenue = isRevenueEvent ? priorRevenue + (event.priceInCents as number) : priorRevenue;

        // This writes to referralPartners/{partnerId}/referrals/{event.uid}
        // — a record OWNED BY THE PARTNER, tracking commission earned on
        // this purchaser. It never writes to the referrer/partner's own
        // users/{uid} doc, and never touches isPremium/subscriptionExpiresAt
        // for anyone. Commission is bookkeeping data, not an entitlement.
        tx.set(
          referralRef,
          {
            subscriptionStatus: event.isActive ? "active" : event.type === "cancellation" ? "canceled" : "expired",
            totalRevenueCents: newRevenue,
            commissionAmountCents: Math.round((newRevenue * commissionPercentage) / 100),
          },
          { merge: true }
        );
      }

      tx.set(eventRef, {
        type: event.type,
        uid: event.uid,
        processedAt: Date.now(),
      });

      return false;
    });

    return NextResponse.json({ ok: true, alreadyProcessed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[webhooks/revenuecat] processing error:", msg);
    // 500 so RevenueCat retries — this is a real transient failure, not an
    // event we're intentionally ignoring.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
