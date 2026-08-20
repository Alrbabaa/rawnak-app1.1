// Firebase Cloud Messaging background handler — required by Firebase for
// web push to work when the tab/app is NOT in the foreground. Foreground
// messages are handled instead by onForegroundPush() in
// src/lib/firebase/messaging.ts, so this file only needs to cover the
// background case.
//
// This file MUST be a plain, unbundled script at the site root
// (/firebase-messaging-sw.js) — Next.js's build pipeline doesn't process
// files under public/, so this can't import from the rest of the app or
// read process.env. The config values below are the same NEXT_PUBLIC_*
// values already shipped in the client bundle (see src/lib/firebase/
// client.ts's comment: these are documented by Firebase as not secret —
// access control is enforced by Security Rules + Auth, not by hiding
// this config).
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBcoI_nJFtIM1k2il9BdSFBztvg92I1kYE",
  authDomain: "rawnak-c504e.firebaseapp.com",
  projectId: "rawnak-c504e",
  storageBucket: "rawnak-c504e.firebasestorage.app",
  messagingSenderId: "478008831293",
  appId: "1:478008831293:web:8a61a3775324a917942954",
});

const messaging = firebase.messaging();

// Offline Caching Strategy for Beauty Academy & App Content
const CACHE_NAME = "rawnak-beauty-academy-v1";
const OFFLINE_ACADEMY_URLS = [
  "/api/academy-videos",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cache-first / Network-fallback for Beauty Academy API
  if (url.pathname.includes("/api/academy-videos")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            return cache.match(event.request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return new Response(JSON.stringify({ offline: true, videos: [] }), {
                headers: { "Content-Type": "application/json" },
              });
            });
          });
      })
    );
  }
});
