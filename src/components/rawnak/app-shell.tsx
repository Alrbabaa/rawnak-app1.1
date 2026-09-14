"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/lib/store";
import { BottomNav } from "./bottom-nav";
import { HomeDashboard } from "./screens/home-dashboard";
import { TopBar } from "./top-bar";
import { OfflineIndicator } from "./offline-indicator";
import { AchievementCelebration } from "./achievement-celebration";
import { WelcomeBackOverlay } from "./welcome-back-overlay";
import { AppTourOverlay } from "./app-tour-overlay";
import { ErrorBoundary } from "./error-boundary";
import { VipFloatingChatButton } from "./vip-floating-chat-button";
import { Button } from "@/components/ui/button";

// Skeleton loader for lazily fetched view components to improve perceived performance
function ScreenSkeleton() {
  return (
    <div className="space-y-6 animate-pulse py-2" aria-busy="true" aria-label="جاري تحميل المحتوى...">
      {/* Header / Title skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28 rounded-full bg-primary/10" />
        <Skeleton className="h-7 w-56 rounded-xl bg-muted/80" />
        <Skeleton className="h-3.5 w-72 rounded-lg bg-muted/50" />
      </div>

      {/* Main Banner / Featured Card skeleton */}
      <div className="rounded-3xl border border-border/50 bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-2xl bg-primary/15" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded-md bg-muted/80" />
              <Skeleton className="h-3 w-20 rounded-md bg-muted/50" />
            </div>
          </div>
          <Skeleton className="w-8 h-8 rounded-full bg-muted/60" />
        </div>
        <Skeleton className="h-3.5 w-full rounded-md bg-muted/60" />
        <Skeleton className="h-3.5 w-4/5 rounded-md bg-muted/40" />
        <div className="pt-2 flex items-center justify-between">
          <Skeleton className="h-10 w-32 rounded-xl bg-primary/20" />
          <Skeleton className="h-6 w-16 rounded-full bg-muted/60" />
        </div>
      </div>

      {/* Category Pills / Filters skeleton */}
      <div className="flex gap-2 overflow-hidden py-1">
        <Skeleton className="h-9 w-24 rounded-full bg-primary/15 shrink-0" />
        <Skeleton className="h-9 w-28 rounded-full bg-muted/70 shrink-0" />
        <Skeleton className="h-9 w-20 rounded-full bg-muted/60 shrink-0" />
        <Skeleton className="h-9 w-32 rounded-full bg-muted/50 shrink-0" />
      </div>

      {/* Content Grid / Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl bg-muted/80 shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-3/4 rounded-md bg-muted/80" />
                <Skeleton className="h-3 w-1/2 rounded-md bg-muted/50" />
              </div>
            </div>
            <Skeleton className="h-3 w-full rounded-md bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

const JourneyScreen = dynamic(() => import("./screens/journey-screen").then((m) => m.JourneyScreen), { loading: ScreenSkeleton });
const AiChat = dynamic(() => import("./screens/ai-chat").then((m) => m.AiChat), { loading: ScreenSkeleton });
const SkinAnalysis = dynamic(() => import("./screens/skin-analysis").then((m) => m.SkinAnalysis), { loading: ScreenSkeleton });
const ResultsScreen = dynamic(() => import("./screens/results-screen").then((m) => m.ResultsScreen), { loading: ScreenSkeleton });
const MakeupScanner = dynamic(() => import("./screens/makeup-scanner").then((m) => m.MakeupScanner), { loading: ScreenSkeleton });
const LibraryScreen = dynamic(() => import("./screens/library-screen").then((m) => m.LibraryScreen), { loading: ScreenSkeleton });
const ProfileScreen = dynamic(() => import("./screens/profile-screen").then((m) => m.ProfileScreen), { loading: ScreenSkeleton });
const ProductsScreen = dynamic(() => import("./screens/products-screen").then((m) => m.ProductsScreen), { loading: ScreenSkeleton });
const AchievementsScreen = dynamic(() => import("./screens/achievements-screen").then((m) => m.AchievementsScreen), { loading: ScreenSkeleton });
const CompareScreen = dynamic(() => import("./screens/compare-screen").then((m) => m.CompareScreen), { loading: ScreenSkeleton });
const CabinetScreen = dynamic(() => import("./screens/cabinet-screen").then((m) => m.CabinetScreen), { loading: ScreenSkeleton });
const PlannerScreen = dynamic(() => import("./screens/planner-screen").then((m) => m.PlannerScreen), { loading: ScreenSkeleton });
const TimelineScreen = dynamic(() => import("./screens/timeline-screen").then((m) => m.TimelineScreen), { loading: ScreenSkeleton });
const AcademyScreen = dynamic(() => import("./screens/academy-screen").then((m) => m.AcademyScreen), { loading: ScreenSkeleton });
const PicksScreen = dynamic(() => import("./screens/picks-screen").then((m) => m.PicksScreen), { loading: ScreenSkeleton });
const ArticlesScreen = dynamic(() => import("./screens/articles-screen").then((m) => m.ArticlesScreen), { loading: ScreenSkeleton });
const AboutScreen = dynamic(() => import("./screens/about-screen").then((m) => m.AboutScreen), { loading: ScreenSkeleton });
const VipScreen = dynamic(() => import("./screens/vip-screen").then((m) => m.VipScreen), { loading: ScreenSkeleton });
const InviteScreen = dynamic(() => import("./screens/invite-screen").then((m) => m.InviteScreen), { loading: ScreenSkeleton });
const CabinetScanScreen = dynamic(() => import("./screens/cabinet-scan-screen").then((m) => m.CabinetScanScreen), { loading: ScreenSkeleton });
const StyleStudioScreen = dynamic(() => import("./screens/style-studio-screen").then((m) => m.StyleStudioScreen), { loading: ScreenSkeleton });
const SupportScreen = dynamic(() => import("./screens/support-screen").then((m) => m.SupportScreen), { loading: ScreenSkeleton });
import { useDbSync } from "@/hooks/use-db-sync";
import { useAndroidBackButton } from "@/hooks/use-android-back-button";
import { useKeyboardInsets } from "@/hooks/use-keyboard-insets";
import { useRoutineReminders } from "@/hooks/use-routine-reminders";
import { useStreakGuard } from "@/hooks/use-streak-guard";
import { useBuddyGuard } from "@/hooks/use-buddy-guard";
import { useAnalysisReminder } from "@/hooks/use-analysis-reminder";
import { useRepurchaseReminder } from "@/hooks/use-repurchase-reminder";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export function AppShell() {
  const view = useAppStore((s) => s.view);
  const remindersEnabled = useAppStore((s) => s.profile.remindersEnabled);
  const routine = useAppStore((s) => s.routine);
  const streak = useAppStore((s) => s.streak);
  const isAuthed = useAppStore((s) => s.isAuthed);
  const isGuest = useAppStore((s) => s.isGuest);
  const logout = useAppStore((s) => s.logout);
  const analyses = useAppStore((s) => s.analyses);
  const cabinet = useAppStore((s) => s.cabinet);
  const ensureCountryDetected = useAppStore((s) => s.ensureCountryDetected);
  const routineProgress =
    routine.length > 0 ? Math.round((routine.filter((r) => r.done).length / routine.length) * 100) : 0;
  const guestAuthRequired = isGuest && ["chat", "analysis", "scanner", "cabinet-scan"].includes(view);
  // Persist user data to Firestore (offline-first + server backup)
  useDbSync();
  // Real Android back button/gesture navigates the app's own screen stack
  useAndroidBackButton();
  // iOS/Android: keeps the focused input visible above the keyboard
  useKeyboardInsets();
  // Opt-in daily routine reminder (local notification, native only)
  useRoutineReminders(remindersEnabled);
  // Opt-in "your streak is about to end" nudge — same toggle, state-aware
  useStreakGuard(remindersEnabled, routineProgress, streak);
  // "صديقة التوهج": reports today's completion server-side for any paired
  // buddy to see (guest sessions are local-only and have nothing to
  // report), and nudges her to check on her buddy if enabled
  useBuddyGuard(remindersEnabled, routineProgress, isAuthed);
  // Opt-in "come see your skin's progress" nudge, timed off her last analysis
  useAnalysisReminder(remindersEnabled, analyses[0]?.ts ?? null);
  // Opt-in "this is about to run out, repurchase it" nudge — picks whichever
  // cabinet product is soonest to expire
  useRepurchaseReminder(remindersEnabled, cabinet);
  // Foreground FCM push → toast (web only, opt-in via profile-screen.tsx)
  usePushNotifications();

  // Country/currency auto-detection for accounts that onboarded before this
  // existed — completeOnboarding() already covers new users; this is a
  // one-time catch-up for everyone else (guarded by countryAutoDetected,
  // see store.ts).
  useEffect(() => {
    ensureCountryDetected();
  }, [ensureCountryDetected]);

  // Register service worker for offline caching of Beauty Academy and assets
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then(() => {
          console.log("[SW] Registered service worker for Beauty Academy offline caching");
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <WelcomeBackOverlay />
      <AppTourOverlay />
      <OfflineIndicator />
      <AchievementCelebration />
      <TopBar />
      <main
        className="flex-1 w-full mx-auto max-w-2xl px-4 pt-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
      >
        <ErrorBoundary>
          {guestAuthRequired && (
            <div className="min-h-[60vh] grid place-items-center text-center px-6">
              <div className="space-y-4 max-w-sm">
                <h1 className="text-xl font-extrabold">هذه الأداة تحتاج حسابًا</h1>
                <p className="text-sm text-muted-foreground">
                  سجّلي الدخول لحماية نتائجكِ وحفظها. يمكنكِ متابعة تصفح المكتبة والأكاديمية والمنتجات كضيفة.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => useAppStore.getState().setView("home")}>العودة</Button>
                  <Button onClick={logout}>تسجيل الدخول</Button>
                </div>
              </div>
            </div>
          )}
          {!guestAuthRequired && view === "home" && <HomeDashboard />}
          {view === "journey" && <JourneyScreen />}
          {!guestAuthRequired && view === "chat" && <AiChat />}
          {!guestAuthRequired && view === "analysis" && <SkinAnalysis />}
          {view === "results" && <ResultsScreen />}
          {!guestAuthRequired && view === "scanner" && <MakeupScanner />}
          {view === "library" && <LibraryScreen />}
          {view === "profile" && <ProfileScreen />}
          {view === "products" && <ProductsScreen />}
          {view === "achievements" && <AchievementsScreen />}
          {view === "compare" && <CompareScreen />}
          {view === "cabinet" && <CabinetScreen />}
          {view === "planner" && <PlannerScreen />}
          {view === "timeline" && <TimelineScreen />}
          {view === "academy" && <AcademyScreen />}
          {view === "picks" && <PicksScreen />}
          {view === "articles" && <ArticlesScreen />}
          {view === "about" && <AboutScreen />}
          {view === "vip" && <VipScreen />}
          {view === "invite" && <InviteScreen />}
          {!guestAuthRequired && view === "cabinet-scan" && <CabinetScanScreen />}
          {view === "style" && <StyleStudioScreen />}
          {view === "support" && <SupportScreen />}
        </ErrorBoundary>
      </main>
      <VipFloatingChatButton />
      <BottomNav />
    </div>
  );
}
