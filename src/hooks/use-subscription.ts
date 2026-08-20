"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL, PURCHASES_ERROR_CODE, type PurchasesOffering } from "@revenuecat/purchases-capacitor";
import { firebaseAuth } from "@/lib/firebase/client";
import { useAppStore } from "@/lib/store";
import { computeVipAccess } from "@/lib/vip-access";

/**
 * RevenueCat client-side integration — NATIVE ONLY (iOS/Android via
 * Capacitor). This wraps StoreKit + Play Billing, which don't exist on the
 * web. A browser-based purchase path would need a completely separate
 * integration (RevenueCat Web Billing, or a plain Stripe checkout for a
 * web-only "buy outside the app" flow) — not something this hook attempts,
 * and not silently pretended to work here.
 *
 * CRITICAL — this is a cross-account safety boundary, not just config
 * plumbing: RevenueCat must always be identified as the CURRENTLY signed-in
 * Firebase user, for exactly as long as they're signed in, and never for
 * anyone else. The webhook (src/app/api/webhooks/revenuecat/route.ts)
 * trusts `event.app_user_id` completely and writes straight to
 * `users/{app_user_id}` — whatever RevenueCat has identified is exactly
 * whose Firestore doc gets the subscription.
 *
 * RevenueCat's own rule: Purchases.configure() must run exactly ONCE per
 * app process. Switching *which* user is identified afterward must go
 * through Purchases.logIn()/logOut() — never a second configure() call.
 * This previously used a bare `let configured = false` that only gated the
 * FIRST configure() call and was never reset. Consequence: if User A signs
 * out and User B signs in later in the same app session (same device,
 * without force-quitting the app — an entirely normal thing to do), that
 * guard was already `true`, so RevenueCat silently stayed identified as
 * User A. Any purchase User B made afterward was attributed to User A:
 * RevenueCat's webhook fired with `app_user_id = A`, and A's Firestore doc
 * received B's subscription. That's the exact "referrer's account affected
 * by the referred user's purchase" bug — same device, two accounts, one
 * stale identity. Fixed by tracking WHO is currently identified (not just
 * "was configure ever called") and calling logIn()/logOut() to follow the
 * real signed-in user on every change.
 */

let sdkConfigured = false; // true once Purchases.configure() has run this process — must only ever happen once
let identifiedUid: string | null = null; // whichever Firebase uid RevenueCat is CURRENTLY logged in as; null = anonymous

export function useSubscription() {
  const profile = useAppStore((s) => s.profile);
  const isAuthed = useAppStore((s) => s.isAuthed);
  const isGuest = useAppStore((s) => s.isGuest);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirrors identifiedUid into React state purely so fetchOfferings/purchase
  // below can gate correctly without needing identifiedUid itself as a hook
  // dependency (it's a plain module variable, not tracked by React).
  const [ready, setReady] = useState(identifiedUid !== null);

  const isNative = Capacitor.isNativePlatform();

  // Keep RevenueCat's identified user in lockstep with the actual
  // signed-in Firebase user: configure() at most once ever, then
  // logIn()/logOut() to follow every account switch, including sign-out.
  useEffect(() => {
    if (!isNative) return;

    const uid = isAuthed && !isGuest ? firebaseAuth.currentUser?.uid ?? null : null;

    (async () => {
      if (!sdkConfigured) {
        const apiKey = Capacitor.getPlatform() === "ios"
          ? process.env.NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY
          : process.env.NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY;
        if (!apiKey) {
          console.warn("[useSubscription] RevenueCat API key not available yet");
          return;
        }
        Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
        // Configure anonymously (no appUserID) — identification always
        // happens via logIn() below, uniformly for the very first launch
        // and every later account switch, so there's exactly one code
        // path that ever sets the identity, not two.
        await Purchases.configure({ apiKey });
        sdkConfigured = true;
      }

      if (uid && identifiedUid !== uid) {
        await Purchases.logIn({ appUserID: uid });
        identifiedUid = uid;
        setReady(true);
      } else if (!uid && identifiedUid !== null) {
        // Signed out, or now a guest — revert to anonymous so nothing
        // afterward (e.g. a different person on a shared device) can ever
        // get attributed to the account that just signed out.
        await Purchases.logOut();
        identifiedUid = null;
        setReady(false);
      }
    })().catch((err) => {
      console.error("[useSubscription] RevenueCat identity sync failed:", err);
    });
  }, [isNative, isAuthed, isGuest]);

  const fetchOfferings = useCallback(async () => {
    if (!isNative || !sdkConfigured || !ready) {
      return { __unavailable__: true as const };
    }
    setLoading(true);
    setError(null);
    try {
      const result = await Purchases.getOfferings();
      setOffering(result.current);
      return { __unavailable__: false as const };
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل باقات الاشتراك");
      return { __unavailable__: false as const };
    } finally {
      setLoading(false);
    }
  }, [isNative, ready]);

  const purchase = useCallback(async (packageIdentifier: string) => {
    if (!ready) return { ok: false, error: "يجب تسجيل الدخول أولًا" };
    if (!offering) return { ok: false, error: "لا توجد عروض متاحة" };
    const pkg = offering.availablePackages.find((p) => p.identifier === packageIdentifier);
    if (!pkg) return { ok: false, error: "الباقة غير موجودة" };

    setLoading(true);
    setError(null);
    try {
      await Purchases.purchasePackage({ aPackage: pkg });
      // Entitlement state itself arrives via the RevenueCat webhook →
      // Firestore → the next db/sync fetch, not read directly from this
      // purchase response, so the app's server-side billing truth and the
      // client's UI state can never disagree.
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { ok: false, error: "تم إلغاء عملية الشراء" };
      return { ok: false, error: err instanceof Error ? err.message : "فشلت عملية الشراء" };
    } finally {
      setLoading(false);
    }
  }, [offering, ready]);

  const restore = useCallback(async () => {
    if (!isNative || !sdkConfigured || !ready) return { ok: false, error: "غير متاح على الويب" };
    setLoading(true);
    setError(null);
    try {
      await Purchases.restorePurchases();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "فشلت استعادة المشتريات" };
    } finally {
      setLoading(false);
    }
  }, [isNative, ready]);

  // Server-authoritative — from Firestore via db/sync, written only by the
  // webhook (isPremium/subscriptionExpiresAt) or by complete-signup
  // (vipTrialExpiresAt, referral trial). Never derived from the client
  // purchase response above. Includes the referral VIP trial, not just
  // real billing — see src/lib/vip-access.ts.
  const isPremiumActive = computeVipAccess(
    profile.isPremium,
    profile.subscriptionExpiresAt,
    profile.vipTrialExpiresAt
  );

  return { isNative, offering, loading, error, isPremiumActive, fetchOfferings, purchase, restore };
}
