"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

// Approximate hex equivalents of the app's --background CSS variable for
// each theme (a status bar color only needs to be "close enough" — it's a
// thin strip, not full UI). Keep in sync with globals.css if the palette
// changes.
const BG = {
  dark: "#1a1015",
  light: "#faf8f6",
};

/**
 * Keeps the native status bar (icons + background) in sync with the app's
 * own in-app theme toggle. Without this, the status bar was hardcoded to
 * always look dark, even when someone switched Rawnak to light mode —
 * icons would be invisible (light-on-light) and the strip would clash.
 *
 * No-op on web/PWA.
 */
export function useNativeStatusBar(theme: "light" | "dark") {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Style.Dark = light icons/text (for dark backgrounds).
    // Style.Light = dark icons/text (for light backgrounds).
    StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: theme === "dark" ? BG.dark : BG.light }).catch(() => {});
  }, [theme]);
}
