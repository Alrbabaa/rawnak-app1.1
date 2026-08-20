"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Web counterpart to the Capacitor `rawnak://referral/<code>` deep link
 * (see use-deep-links.ts, native-only). Most invite-link clicks land here
 * first — the recipient usually doesn't have the app installed yet — so
 * this is the primary path for the peer-referral growth loop, not a
 * secondary one.
 *
 * Reads `?ref=CODE` once on mount and clears it from the URL bar (keeps
 * the code in the store via setPendingReferral, same as the native path;
 * AuthScreen reads it from there whenever it renders).
 */
export function useReferralQueryParam() {
  const setPendingReferral = useAppStore((s) => s.setPendingReferral);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;

    setPendingReferral(ref.trim().toUpperCase());

    // Tidy the URL so the code doesn't linger visibly / get re-applied on
    // every refresh — the value's already captured in the store.
    params.delete("ref");
    const rest = params.toString();
    const newUrl = window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }, [setPendingReferral]);
}
