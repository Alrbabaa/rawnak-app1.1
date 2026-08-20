"use client";

import { Capacitor } from "@capacitor/core";

export interface ShareImageOptions {
  blob: Blob;
  filename: string; // e.g. "rawnak-glow-89.png"
  text?: string;
  title?: string;
}

export interface ShareImageResult {
  ok: boolean;
  // "downloaded": web fallback, no native/Web Share API available.
  // "cancelled": the person closed the OS share sheet without picking anything.
  fallback?: "downloaded" | "cancelled";
}

/**
 * Shares a generated PNG (e.g. the glow card) through the OS share sheet.
 * - Capacitor (iOS/Android): writes to the app's cache dir, then hands the
 *   file URI to the native share sheet via @capacitor/share. Dynamically
 *   imported so these plugins never end up in the web bundle.
 * - Web: uses the Web Share API (level 2, file sharing) when the browser
 *   supports it; otherwise falls back to a plain image download so the
 *   person can still share it manually.
 */
export async function shareImage({ blob, filename, text, title }: ShareImageOptions): Promise<ShareImageResult> {
  if (Capacitor.isNativePlatform()) {
    return shareNative({ blob, filename, text, title });
  }
  return shareWeb({ blob, filename, text, title });
}

async function shareNative({ blob, filename, text, title }: ShareImageOptions): Promise<ShareImageResult> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

  const base64Data = await blobToBase64(blob);
  const written = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
  });

  try {
    await Share.share({ title, text, files: [written.uri], dialogTitle: title });
    return { ok: true };
  } catch (err) {
    // The native share sheet throws when the person backs out of it
    // without choosing an app — not a real error.
    if (isCancellation(err)) return { ok: false, fallback: "cancelled" };
    throw err;
  } finally {
    // Best-effort cleanup — a leftover cache file isn't worth surfacing an
    // error to the person over.
    Filesystem.deleteFile({ path: filename, directory: Directory.Cache }).catch(() => {});
  }
}

async function shareWeb({ blob, filename, text, title }: ShareImageOptions): Promise<ShareImageResult> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title });
      return { ok: true };
    } catch (err) {
      if (isCancellation(err)) return { ok: false, fallback: "cancelled" };
      // Any other Web Share failure — fall through to the download fallback
      // below rather than surfacing a dead end.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true, fallback: "downloaded" };
}

function isCancellation(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  const message = String((err as { message?: string } | null)?.message || "").toLowerCase();
  return name === "AbortError" || message.includes("cancel");
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Filesystem.writeFile wants raw base64 — strip the data: URL prefix.
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
