"use client";

import { Capacitor } from "@capacitor/core";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (!path.startsWith("/api/")) return path;
  if (!Capacitor.isNativePlatform() || !backendUrl) return path;
  return `${backendUrl}${path}`;
}

let installed = false;

export function installApiRouting(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  if (Capacitor.isNativePlatform() && !backendUrl) {
    console.error("[API] NEXT_PUBLIC_BACKEND_URL is required for native builds.");
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string") return nativeFetch(apiUrl(input), init);
    if (input instanceof URL) return nativeFetch(apiUrl(input.toString()), init);
    if (input instanceof Request) return nativeFetch(apiUrl(input.url), init);
    return nativeFetch(input, init);
  };
}