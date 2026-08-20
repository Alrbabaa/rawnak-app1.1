"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

/**
 * Native keyboard handling for Capacitor (iOS + Android).
 *
 * iOS's WKWebView does NOT automatically resize the visible viewport when
 * the keyboard appears the way mobile Safari does — without this, the
 * keyboard silently overlaps whatever input the user is focused on (chat
 * box, auth form, admin forms...). This hook exposes the live keyboard
 * height as a CSS variable (--kb-height) that fixed-bottom input bars use
 * to lift themselves above the keyboard, and nudges the focused input into
 * view.
 *
 * No-op on web/PWA — @capacitor/keyboard's listeners simply never fire
 * outside the native shell, and the browser's own viewport resize already
 * handles it there.
 */
export function useKeyboardInsets() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.style.setProperty("--kb-height", "0px");

    const showHandle = Keyboard.addListener("keyboardWillShow", (info) => {
      const h = info.keyboardHeight || 0;
      setHeight(h);
      document.documentElement.style.setProperty("--kb-height", `${h}px`);
      // Give the focused input a moment to settle above the keyboard.
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        active?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      }, 80);
    });

    const hideHandle = Keyboard.addListener("keyboardWillHide", () => {
      setHeight(0);
      document.documentElement.style.setProperty("--kb-height", "0px");
    });

    return () => {
      showHandle.then((h) => h.remove());
      hideHandle.then((h) => h.remove());
    };
  }, []);

  return height;
}
