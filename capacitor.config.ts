import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * Rawnak (رَونق) — Android app shell via Capacitor.
 *
 * IMPORTANT: this app has real server-side routes (auth, AI, admin, DB) that
 * cannot run inside the Android WebView. Capacitor here wraps your LIVE,
 * hosted HTTPS deployment — it does not bundle the app to run offline.
 *
 * The native shell loads the production Next.js deployment inside
 * Capacitor's BridgeActivity WebView. Android deep links use the custom
 * `rawnak://` scheme and require no App Links or Digital Asset Links.
 */
const config: CapacitorConfig = {
  // Must remain identical to the package already registered in Google Play.
  appId: "com.rawnakapp.www.twa",
  appName: "رَونق",
  webDir: "public", // unused while server.url is set, but required by the CLI schema

  server: {
    url: "https://www.rawnakapp.com",
    androidScheme: "https",
    // Set to true ONLY during local development against `npm run dev` on
    // your own machine (cleartext HTTP on your LAN) — must be false/removed
    // for the production build you submit to Google Play.
    allowNavigation: ["www.rawnakapp.com", "rawnakapp.com"],
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
      // Capacitor's DARK style renders a light foreground on Android.
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
