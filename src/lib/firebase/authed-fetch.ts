"use client";

import { firebaseAuth } from "@/lib/firebase/client";

/**
 * Drop-in replacement for `fetch()` against any of our own protected API
 * routes. The old cookie-based session was sent automatically by the
 * browser on every same-origin request; a Firebase ID token has to be
 * attached explicitly on each call instead.
 */
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // On a fresh page load Firebase restores the persisted user asynchronously.
  // Reading currentUser before that initial check settles can produce a
  // transient null and send protected API requests without a bearer token.
  await firebaseAuth.authStateReady();

  const user = firebaseAuth.currentUser;
  const idToken = user ? await user.getIdToken() : null;

  const headers = new Headers(options.headers);
  if (idToken) headers.set("Authorization", `Bearer ${idToken}`);

  return fetch(url, { ...options, headers });
}
