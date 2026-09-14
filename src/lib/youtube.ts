/**
 * Single source of truth for turning admin/user input (a pasted YouTube
 * URL, a shorts link, or a bare 11-char ID) into a clean, embeddable
 * video ID.
 *
 * Used by both the AI-assisted admin import draft (import-video/route.ts)
 * AND the admin video create/update routes, so a raw URL pasted directly
 * into the admin "YouTube ID" field is normalized exactly the same way a
 * user's self-imported link is (see YouTubeImportModal in
 * academy-screen.tsx) — instead of being stored as-is and producing a
 * broken `youtube.com/embed/<full-url>` src at playback time.
 */
export function extractYouTubeId(str: string): string | null {
  if (!str) return null;
  const cleaned = str.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) {
    return cleaned;
  }

  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i,
  ];

  for (const pat of patterns) {
    const match = cleaned.match(pat);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function isValidYouTubeId(id: string | null | undefined): id is string {
  return !!id && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/**
 * Normalizes any admin-entered YouTube ID/URL field to a clean 11-char ID.
 * Returns null if the input doesn't resolve to a valid ID (caller decides
 * whether that's an error).
 */
export function normalizeYouTubeId(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (isValidYouTubeId(trimmed)) return trimmed;
  const extracted = extractYouTubeId(trimmed);
  return isValidYouTubeId(extracted) ? extracted : null;
}
