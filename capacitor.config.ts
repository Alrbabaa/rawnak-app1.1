import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Rawnak (رَونق) — Android app shell via Capacitor.
 *
 * IMPORTANT: this app has real server-side routes (auth, AI, admin, DB) that
 * cannot run inside the Android WebView. Capacitor here wraps your LIVE,
 * hosted HTTPS deployment — it does not bundle the app to run offline.
 *
 * Before building the APK:
 *   1. Deploy this Next.js app to a real host (Vercel, your own server, etc.)
 *      with a real domain and valid HTTPS certificate.
 *   2. Replace `server.url` below with that domain.
 *   3. Re-run `npx cap sync android`.
 *
 * Until step 2 is done, the app will try to load the placeholder URL and
 * show a blank/error screen — that's expected, not a bug.
 */
const config: CapacitorConfig = {
  appId: "com.artisticminds.rawnak",
  appName: "رَونق",
  webDir: "public", // unused while server.url is set, but required by the CLI schema

  server: {
    // 🔴 REPLACE with your real production domain once hosted, e.g.:
    // url: "https://rawnak.app",
    url: "https://REPLACE-WITH-YOUR-DOMAIN.example.com",
    androidScheme: "https",
    // Set to true ONLY during local development against `npm run dev` on
    // your own machine (cleartext HTTP on your LAN) — must be false/removed
    // for the production build you submit to Google Play.
    allowNavigation: [],
  },

  android: {
    // Matches the app's rose-gold brand background instead of a jarring
    // default white/black flash on cold start.
    backgroundColor: "#1a1015",
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#1a1015",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a1015",
    },
    Keyboard: {
      // Resizes the WebView's visible viewport (like Android's
      // adjustResize) instead of the keyboard overlaying fixed content.
      // Combined with normal document flow (no fixed-position input bars),
      // this is enough on both platforms without per-screen math.
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
