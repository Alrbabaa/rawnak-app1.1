"use client";

import { firebaseAuth } from "@/lib/firebase/client";
import { apiUrl } from "@/lib/api-url";

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

  const response = await fetch(apiUrl(url), { ...options, headers });

  // Some hosting/platform failures return an empty 5xx response. Admin
  // screens expect JSON, so turn that empty body into a useful JSON error
  // instead of throwing "Unexpected end of JSON input" in the browser.
  if (!response.ok && !(await response.clone().text())) {
    return new Response(
      JSON.stringify({ error: "تعذّر تنفيذ الطلب على الخادم. راجعي سجلات Vercel وإعدادات Firebase Admin." }),
      {
        status: response.status,
        statusText: response.statusText,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return new Response(
      JSON.stringify({ error: "تعذّر الاتصال بخادم رَونق. تحققي من عنوان الخادم ثم حاولي مرة أخرى." }),
      {
        status: response.ok ? 502 : response.status,
        statusText: response.ok ? "Bad Gateway" : response.statusText,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  return response;
}
