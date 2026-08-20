"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAppStore } from "@/lib/store";

const COLOR_THEME_CLASSES = [
  "theme-rose",
  "theme-lavender",
  "theme-ocean",
  "theme-mocha",
  "theme-pearl",
  "theme-midnight",
];

/**
 * Keeps the DOM in sync with the store, which is the single source of
 * truth for both light/dark and the color personality (colorTheme).
 * next-themes owns the "dark"/"light" class (attribute="class" below);
 * we drive it from the store rather than its own internal state so the
 * profile screen's toggle — previously a no-op, since nothing called
 * next-themes' setTheme — actually changes the app. The color theme is a
 * second, independent class applied directly, since next-themes only
 * manages a single class slot.
 */
function ThemeSync() {
  const { setTheme } = useTheme();
  const storeTheme = useAppStore((s) => s.theme);
  const colorTheme = useAppStore((s) => s.colorTheme);

  useEffect(() => {
    setTheme(storeTheme);
  }, [storeTheme, setTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...COLOR_THEME_CLASSES);
    root.classList.add(`theme-${colorTheme}`);
  }, [colorTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}
