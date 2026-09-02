"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { SplashScreen } from "@/components/rawnak/screens/splash-screen";
import { AuthScreen } from "@/components/rawnak/screens/auth-screen";
import { OnboardingFlow } from "@/components/rawnak/screens/onboarding-flow";
import { AppShell } from "@/components/rawnak/app-shell";
import { ErrorBoundary } from "@/components/rawnak/error-boundary";
import { useNativeStatusBar } from "@/hooks/use-native-status-bar";
import { useDeepLinks } from "@/hooks/use-deep-links";
import { useReferralQueryParam } from "@/hooks/use-referral-query-param";
import { useFirebaseAuthListener } from "@/hooks/use-firebase-auth";
import { Capacitor } from "@capacitor/core";
import { SplashScreen as NativeSplashScreen } from "@capacitor/splash-screen";

export default function Home() {
  const router = useRouter();
  const view = useAppStore((s) => s.view);
  const isAuthed = useAppStore((s) => s.isAuthed);
  const isGuest = useAppStore((s) => s.isGuest);
  const authChecked = useAppStore((s) => s.authChecked);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const role = useAppStore((s) => s.role);
  const theme = useAppStore((s) => s.theme);

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // Native status bar (iOS + Android) follows the same in-app theme toggle
  useNativeStatusBar(theme);
  // rawnak://open/<view> and rawnak://referral/<code> — works logged-out too
  useDeepLinks();
  // Web equivalent of the referral deep link above: ?ref=CODE in the URL
  useReferralQueryParam();

  // Firebase's client SDK persists and restores the login session itself
  // (IndexedDB, survives reloads) — this listens for that state instead of
  // a fetch-based session check. Guests never touch Firebase at all.
  useFirebaseAuthListener();

  // Reveal the locally-bundled app only once both the React frame is ready
  // AND critical init (Firebase auth restoration) has settled. The native
  // configuration retains a finite fallback (1500ms) for safety.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!authChecked) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void NativeSplashScreen.hide().catch(() => {});
      });
    });
  }, [authChecked]);

  // Admin/super_admin accounts land in the admin dashboard automatically,
  // not the consumer app — this is a UX convenience only, not a security
  // boundary: /admin/page.tsx independently re-verifies the role itself
  // (and every admin API route re-verifies server-side regardless), so
  // this redirect firing incorrectly could at most be a wrong navigation,
  // never an access-control gap. Checked before the onboarding gate below
  // since the consumer onboarding flow (skin type, concerns, goals...)
  // doesn't apply to an admin account.
  useEffect(() => {
    if (isAuthed && !isGuest && (role === "admin" || role === "super_admin")) {
      router.replace("/admin");
    }
  }, [isAuthed, isGuest, role, router]);

  // Decide route
  if (!isGuest && !authChecked) {
    return (
      <ErrorBoundary>
        <SplashScreen />
      </ErrorBoundary>
    );
  }

  if (!isAuthed) {
    return (
      <ErrorBoundary>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  if (role === "admin" || role === "super_admin") {
    // Redirecting (see effect above) — render nothing/splash rather than
    // flashing the consumer onboarding/home screen for the instant before
    // the navigation completes.
    return (
      <ErrorBoundary>
        <SplashScreen />
      </ErrorBoundary>
    );
  }

  if (!hasOnboarded) {
    return (
      <ErrorBoundary>
        <OnboardingFlow />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
