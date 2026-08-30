"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { useAppStore, type View } from "@/lib/store";

// Only these are safe to jump to directly from an external link — the same
// top-level destinations the bottom nav exposes, plus a couple of
// content screens that make sense to share.
const DEEPLINK_VIEWS: View[] = [
  "home",
  "chat",
  "cabinet",
  "profile",
  "journey",
  "library",
  "academy",
  "picks",
  "articles",
];

/**
 * Handles native deep links and is a no-op on web/PWA:
 *  - rawnak://open/<view> and rawnak://referral/<code> — custom scheme,
 *    registered in Info.plist / AndroidManifest.xml. This is Android's
 *    native route and needs no domain verification or Digital Asset Links.
 *  - An https referral may still arrive from iOS Universal Links when that
 *    platform's Associated Domains setup is active. On Android, shared
 *    https links intentionally stay web links; referral credit still works
 *    through the query parameter on the hosted Next.js app.
 */
export function useDeepLinks() {
  const setView = useAppStore((s) => s.setView);
  const setPendingReferral = useAppStore((s) => s.setPendingReferral);
  const isAuthed = useAppStore((s) => s.isAuthed);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = App.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);

        if (parsed.protocol === "https:") {
          // iOS Universal Link — same shape as referralShareLink(). Only
          // the referral case is
          // handled here; any other rawnak.app path (e.g. /admin) simply
          // falls through and does nothing special, same as a normal
          // page load would.
          const ref = parsed.searchParams.get("ref");
          if (ref) setPendingReferral(ref.toUpperCase());
          return;
        }

        // Custom scheme — "rawnak://open/chat" parses with host="open",
        // pathname="/chat".
        const host = parsed.hostname; // "open" | "referral"
        const param = parsed.pathname.replace(/^\/+/, "");

        if (host === "referral" && param) {
          // AuthScreen renders automatically whenever the person isn't
          // logged in (see page.tsx) — it reads this pending code on mount
          // regardless of the current `view`, so there's nothing else to do.
          setPendingReferral(param.toUpperCase());
          return;
        }

        if (host === "open" && DEEPLINK_VIEWS.includes(param as View)) {
          if (isAuthed) setView(param as View);
          // If not authed, the link is remembered by staying on the auth
          // screen — there's nothing meaningful to deep-link into yet.
        }
      } catch {
        // Malformed/unexpected URL — ignore rather than crash.
      }
    });

    return () => {
      handle.then((h) => h.remove());
    };
  }, [setView, setPendingReferral, isAuthed]);
}
