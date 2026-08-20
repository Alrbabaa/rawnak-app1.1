"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { onForegroundPush } from "@/lib/firebase/messaging";

/**
 * Shows a toast for FCM pushes that arrive while the tab is focused.
 * Web push only (see messaging.ts) — silently does nothing on native,
 * where local-notifications already covers on-device reminders.
 *
 * Firebase's SDK only auto-shows a system notification for BACKGROUND
 * messages (handled by public/firebase-messaging-sw.js) — a foreground
 * message doesn't get any UI unless the app provides one itself, which is
 * what this hook does, mounted once at the app root (see app-shell.tsx).
 */
export function usePushNotifications() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    onForegroundPush(({ title, body }: { title?: string; body?: string }) => {
      if (title) toast(title, { description: body });
    }).then((unsub: () => void) => {
      if (cancelled) unsub();
      else unsubscribe = unsub;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
}
