"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { useAppStore } from "@/lib/store";

/**
 * Wires the Android hardware/gesture back button to the app's internal
 * navigation history (see goBack() in store.ts) instead of the default
 * Capacitor behavior, which would otherwise close the whole app immediately
 * regardless of how deep the user is in a flow.
 *
 * No-op on web/PWA — the browser already handles its own back button there,
 * and @capacitor/app's listener simply never fires outside the native shell.
 */
export function useAndroidBackButton() {
  const goBack = useAppStore((s) => s.goBack);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = App.addListener("backButton", () => {
      const navigated = goBack();
      if (!navigated) {
        App.exitApp();
      }
    });

    return () => {
      handle.then((h) => h.remove());
    };
  }, [goBack]);
}
