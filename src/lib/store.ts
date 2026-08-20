import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Capacitor } from "@capacitor/core";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  signOut,
  updateProfile as updateFirebaseProfile,
  revokeAccessToken,
  OAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { googleProvider } from "@/lib/firebase/google-provider";
import { appleProvider } from "@/lib/firebase/apple-provider";
import { firebaseAuthErrorMessage } from "@/lib/firebase/error-messages";
import { clearRegisteredPush } from "@/lib/firebase/messaging";
import { trackEvent } from "@/lib/track-event";
import { detectDialectFromTimezone, detectCountryFromTimezone, type RecommendedProduct, type ProductDepartment } from "@/lib/data";
import { getCurrencyForCountry } from "@/lib/currencies";
import { triggerSuccessHaptic, triggerSelectionHaptic, triggerImpactHaptic, ImpactStyle } from "@/lib/haptics";
import type { AccountTier } from "@/lib/account-tiers";

export type ColorTheme = "rose" | "lavender" | "ocean" | "mocha" | "pearl" | "midnight";

export const COLOR_THEMES: { id: ColorTheme; label: string; swatch: string }[] = [
  { id: "rose", label: "وردي", swatch: "oklch(0.72 0.085 45)" },
  { id: "lavender", label: "لافندر", swatch: "oklch(0.68 0.09 300)" },
  { id: "ocean", label: "محيط", swatch: "oklch(0.62 0.09 220)" },
  { id: "mocha", label: "موكا", swatch: "oklch(0.6 0.07 55)" },
  { id: "pearl", label: "لؤلؤي", swatch: "oklch(0.85 0.03 80)" },
  { id: "midnight", label: "منتصف الليل", swatch: "oklch(0.55 0.09 265)" },
];

// Bridges a pending referral code across the full page reload that
// signInWithRedirect causes on Capacitor (see signInWithGoogle /
// signInWithApple below). Shared by both providers — only one OAuth
// redirect can ever be in flight at a time, so one key is enough.
const OAUTH_REDIRECT_REFERRAL_KEY = "rawnak-oauth-redirect-referral";

// Bridges "the user asked to delete their account" across the full page
// reload that signInWithRedirect causes on Capacitor, for the Apple-only
// re-authenticate-then-revoke-then-delete flow — see deleteAccount() and
// completeOAuthRedirect() below. Apple requires a FRESH OAuth access token
// to revoke (see App Store Review Guideline 5.1.1(v)); Firebase never
// stores the token from the original sign-in, so we have no choice but to
// ask the user to re-authenticate with Apple immediately before deletion.
const OAUTH_REDIRECT_PENDING_DELETE_KEY = "rawnak-oauth-redirect-pending-delete";

/**
 * Shared by the Google/Apple popup (web) and redirect (Capacitor) flows —
 * reuses the exact same server-side profile-completion step email/password
 * signup uses (`/api/auth/complete-signup` is idempotent: first OAuth
 * sign-in creates `users/{uid}` + links any referral code, every later
 * sign-in just returns the existing doc). This is what keeps Google/Apple
 * users on the identical signup/profile-completion path as email/password
 * users.
 */
async function finishOAuthSignIn(
  user: FirebaseUser,
  referralCode: string | undefined,
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  isNewUser: boolean,
  method: "google" | "apple"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/complete-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ name: user.displayName || undefined, referralCode }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error || "فشل تسجيل الدخول" };

    set({
      ...resetUserDataState(),
      isAuthed: true,
      authChecked: true,
      hasOnboarded: !isNewUser, // Returning user skips onboarding forms directly to home
      view: isNewUser ? "onboarding" : "home",
      isGuest: false,
      authUid: user.uid,
      profile: {
        ...EMPTY_PROFILE,
        email: data.user.email || user.email || "",
        name: data.user.name || user.displayName || "",
        createdAt: Date.now(),
      },
    });
    // Only a genuinely new account, never a returning-user login —
    // finishOAuthSignIn is shared/idempotent for both, per the doc comment
    // above, so isNewUser (from Firebase's own additionalUserInfo) is the
    // only reliable signal here.
    if (isNewUser) trackEvent("sign_up", { method });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: firebaseAuthErrorMessage(err) };
  }
}

/**
 * App Store Review Guideline 5.1.1(v): "If your app offers Sign in with
 * Apple, you'll need to use the Sign in with Apple REST API to revoke
 * user tokens when you delete an account." Firebase's JS SDK wraps that
 * REST call as `revokeAccessToken(auth, accessToken)` — but it needs a
 * live Apple OAuth access token, which only exists for the few minutes
 * around a sign-in and which Firebase deliberately never persists. So
 * deleting an Apple-linked account means: re-authenticate with Apple one
 * more time (to mint a fresh token), revoke it, THEN delete. This is
 * Apple's own documented workaround (see "Handling account deletions and
 * revoking tokens for Sign in with Apple" on the Apple Developer forums)
 * — there is no way to revoke a token you were never given.
 */
async function revokeAppleTokenViaPopup(): Promise<void> {
  const cred = await signInWithPopup(firebaseAuth, appleProvider);
  const oauthCred = OAuthProvider.credentialFromResult(cred);
  if (oauthCred?.accessToken) {
    await revokeAccessToken(firebaseAuth, oauthCred.accessToken);
  }
  // No accessToken on the credential (can happen if Apple/Firebase omits
  // it) → nothing we can revoke. Per Apple's own guidance linked above,
  // we still proceed with deleting the account rather than blocking the
  // user's deletion request on something outside their control.
}

// Calls the server-side deletion route (see /api/account/delete) with the
// current user's Firebase ID token. Shared by deleteAccount() and the
// Apple-redirect continuation in completeOAuthRedirect().
async function callDeleteAccountApi(): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return { ok: false, error: "يجب تسجيل الدخول أولاً" };
    const idToken = await user.getIdToken();
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || "فشل حذف الحساب" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: firebaseAuthErrorMessage(err) };
  }
}

/* ============ Types ============ */
export type View =
  | "splash"
  | "auth"
  | "onboarding"
  | "home"
  | "chat"
  | "analysis"
  | "results"
  | "scanner"
  | "library"
  | "profile"
  | "products"
  | "achievements"
  | "compare"
  | "cabinet"
  | "planner"
  | "journey"
  | "timeline"
  | "academy"
  | "picks"
  | "articles"
  | "vip"
  | "about"
  | "invite"
  | "cabinet-scan"
  | "style"
  | "support";

export type SkinType = "oily" | "dry" | "combination" | "normal" | "sensitive";
export type SkinTone = "fair" | "light" | "medium" | "tan" | "deep";
export type SkinConcern =
  | "acne"
  | "aging"
  | "dryness"
  | "darkspots"
  | "darkcircles"
  | "pores"
  | "redness"
  | "dullness"
  | "sensitivity";
export type BeautyGoal =
  | "glow"
  | "antiaging"
  | "acnefree"
  | "hydration"
  | "evening"
  | "protection";

const SKIN_TYPE_AR_MAP: Record<string, SkinType> = {
  "دهنية": "oily",
  "جافة": "dry",
  "مختلطة": "combination",
  "عادية": "normal",
  "حساسة": "sensitive",
};

/**
 * Turns a skin-analysis result (see SkinData in
 * /api/skin-analysis/route.ts) into a profile update — this is what
 * actually closes the loop between "AI analyzed your skin" and "the rest
 * of the app (routine builder, recommendations) reflects that", instead
 * of the analysis living only in the history list. Call this after every
 * successful analysis (see skin-analysis.tsx).
 *
 * skinType is always overwritten — the analysis directly assesses it, so
 * it's the freshest source of truth available.
 *
 * concerns is a MERGE, not a replacement: metrics only cover 6 of the 9
 * SkinConcern values (dryness/acne/darkcircles/pores/dullness/darkspots —
 * see metricConcernMap below). Whatever the user set manually for the
 * other 3 (aging/redness/sensitivity, which no metric measures) is left
 * untouched; only the assessed ones are refreshed from this analysis.
 */
export function deriveProfileUpdateFromAnalysis(
  skinTypeAr: string,
  metrics: {
    hydration: number;
    acne: number;
    darkCircles: number;
    pores: number;
    texture: number;
    evenness: number;
  },
  existingConcerns: SkinConcern[]
): { skinType: SkinType | null; concerns: SkinConcern[] } {
  const skinType = SKIN_TYPE_AR_MAP[skinTypeAr.trim()] || null;

  // Every metric is 0-100, higher = healthier (see PRIMARY_PROMPT in
  // /api/skin-analysis/route.ts) — below this counts as an active concern.
  const THRESHOLD = 60;
  const metricConcernMap: Array<[keyof typeof metrics, SkinConcern]> = [
    ["hydration", "dryness"],
    ["acne", "acne"],
    ["darkCircles", "darkcircles"],
    ["pores", "pores"],
    ["texture", "dullness"],
    ["evenness", "darkspots"],
  ];
  const assessedConcerns = new Set<SkinConcern>(metricConcernMap.map(([, c]) => c));
  const activeFromAnalysis = metricConcernMap
    .filter(([key]) => (metrics[key] ?? 100) < THRESHOLD)
    .map(([, c]) => c);

  const untouched = existingConcerns.filter((c) => !assessedConcerns.has(c));
  const concerns = Array.from(new Set([...untouched, ...activeFromAnalysis]));

  return { skinType, concerns };
}

export type PersonalityMode = "professional" | "romantic";
// "msa" = Modern Standard Arabic (الفصحى) — the original, unconditional
// behavior before this feature existed. Kept as the default so anyone who
// never touches this setting sees exactly the same chat tone as before.
export type DialectId = "msa" | "khaleeji" | "masri" | "shami" | "iraqi" | "jazaeri";

export interface UserProfile {
  name: string;
  email: string;
  age: number | null;
  skinType: SkinType | null;
  skinTone: SkinTone | null;
  concerns: SkinConcern[];
  goals: BeautyGoal[];
  makeupLevel: "beginner" | "intermediate" | "advanced" | null;
  lifestyle: string[];
  avatar: string;
  profileImage?: string | null;
  accountTier?: AccountTier;
  followersCount?: number;
  followingCount?: number;
  followingIds?: string[];
  // Optional personal social handles shown on the profile — display only,
  // no verification/linking to real accounts, purely how the user wants
  // to present herself. null/"" both mean "not set".
  socialInstagram: string | null;
  socialTiktok: string | null;
  bio?: string | null;
  // Opt-out of the public "بحث بالاسم" directory (/api/social/search) —
  // defaults to true (discoverable) when unset. Purely a visibility
  // switch: turning it off doesn't affect existing followers or the
  // streak story they already see, only whether new people can find this
  // account by searching a name.
  socialDiscoverable?: boolean;
  personalityMode: PersonalityMode;
  // Chat dialect preference — purely a client-local, cosmetic setting sent
  // along with every /api/chat request (same non-synced pattern as
  // personalityMode: no server storage, no db/sync involvement).
  dialect: DialectId;
  country?: string; // e.g. "السعودية", "الأردن", "مصر", "الإمارات"
  currency?: string; // e.g. "SAR", "JOD", "EGP", "AED", "USD"
  // Share-card photo preference — client-local only (same non-synced
  // pattern as personalityMode/dialect). Privacy mode (false) is the
  // default; remembers the user's last explicit choice.
  shareCardIncludePhoto: boolean;
  remindersEnabled: boolean; // opt-in daily routine reminder (local notification, no server push needed)
  // Subscription state — written ONLY by the RevenueCat webhook server-side
  // (src/app/api/webhooks/revenuecat/route.ts) via db/sync's GET response.
  // Never set these from client code directly; they reflect billing truth.
  isPremium: boolean;
  subscriptionExpiresAt: number | null;
  subscriptionProductId: string | null;
  // Peer referral (growth loop) — written server-side only, same
  // server-truth pattern as the subscription fields above:
  // referralCode is generated once at signup (complete-signup route);
  // referralInvitesCount/referralRewardUnlockedAt are updated whenever
  // someone else signs up using this person's code (see
  // /api/auth/complete-signup). Never set these from client code directly.
  referralCode: string | null;
  referralInvitesCount: number;
  referralRewardUnlockedAt: number | null;
  // Repeatable VIP trial earned via referrals (+7 days per every 3
  // invites, stacking) — server-truth, written only by
  // /api/auth/complete-signup. Combine with isPremium via
  // computeVipAccess()/useHasVipAccess() — never check this alone.
  vipTrialExpiresAt: number | null;
  // Server-truth usage counter for the AI cabinet scan feature (1 free use,
  // then VIP-gated — see src/lib/features.ts). Written only by
  // /api/cabinet/scan and read back via /api/db/sync, same pattern as the
  // referral fields above.
  cabinetAiScanUsed: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

export interface SkinAnalysis {
  id: string;
  ts: number;
  imageData: string;
  overall: number;
  metrics: {
    hydration: number;
    acne: number;
    darkCircles: number;
    pores: number;
    texture: number;
    evenness: number;
  };
  skinType: string;
  summary: string;
  recommendations: string[];
  observations?: string[];
  possibleConcerns?: string[];
  confidence?: number;
  limitations?: string[];
  reviewStatus?: "agreed" | "partially_agreed" | "uncertain" | "review_unavailable";
}

export interface DailyCheckInLog {
  id: string;
  ts: number;
  dateStr: string;
  hydration: number; // 0-100%
  sensitivity: number; // 0-100% (0 = calm, 100 = highly sensitive)
  barrierScore?: number; // 0-100%
  notes?: string;
  symptoms?: string[];
}

// NOTE: previously seeded 10 days of fabricated hydration/sensitivity
// numbers — including a fake note in the user's own voice ("بشرتي مرتاحة
// وترطيبها متوازن جداً...") — into every new user's check-in history from
// their very first app open. Removed: real users start with an empty log
// and build real history via logDailyCheckIn(); the trends chart now shows
// an honest empty state until they do (see skin-metrics-trends-chart.tsx).

export interface ProductScan {
  id: string;
  ts: number;
  imageData: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  compatibility: number;
  benefits: string[];
  warnings: string[];
  usage: string;
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface BeforeAfter {
  id: string;
  ts: number;
  beforeImage: string;
  afterImage: string;
  label: string;
}

export interface CabinetProduct {
  id: string;
  name: string;
  brand: string;
  category: string; // skincare | makeup | fragrance
  subCategory: string; // غسول، مرطب، سيروم...
  openedAt: number | null; // timestamp when opened
  shelfLifeMonths: number; // PAO months
  rating: number; // 1-5
  notes: string;
  imageData?: string;
  addedAt: number;
  favorite: boolean;
  useCount: number;
  lastUsedAt: number | null;
  price?: string;
  purchaseUrl?: string;
  source?: "manual" | "imported" | "picks" | "ai-scan";
}

export interface WatchHistoryItem {
  videoId: string;
  ts: number;
}

export interface BeautyPlan {
  id: string;
  occasion: string;
  occasionLabel: string;
  date: number;
  steps: { phase: string; items: string[] }[];
  products: string[];
  duration: string;
  tips: string[];
  createdAt: number;
}

/** A coordinated outfit saved from Style Studio's look coordinator.
 * `items` holds RawnakPick ids by slot — resolved back to full products
 * from RAWNAK_PICKS wherever it's displayed, same static-fallback pattern
 * the picks/saved-items screens already use, so no new fetch is needed. */
export interface SavedLook {
  id: string;
  items: { top?: string; hijab?: string; jewelry?: string; accessory?: string };
  createdAt: number;
}

interface RoutineStep {
  id: string;
  name: string;
  time: "morning" | "evening";
  done: boolean;
}

interface AppState {
  /* navigation */
  view: View;
  viewHistory: View[];
  setView: (v: View) => void;
  goBack: () => boolean; // returns true if it navigated back, false if there's nowhere to go
  // Transient (not persisted) — set by a deep link so AuthScreen can open
  // straight into signup mode with a referral code pre-filled.
  pendingReferralCode: string | null;
  pendingAuthMode: "login" | "signup";
  setPendingReferral: (code: string | null) => void;

  /* auth */
  isAuthed: boolean;
  authChecked: boolean; // becomes true once we've verified the session with the server at least once
  isGuest: boolean; // true = local-only session, never synced to the server
  // Firebase uid of whichever account's data is currently loaded (null =
  // no account has ever loaded on this device, or the last one logged out
  // cleanly). Persisted (see partialize) specifically so it survives a
  // reload — see syncFirebaseUser's doc comment for why this exists.
  authUid: string | null;
  // From the verified ID token's custom claims (see syncFirebaseUser),
  // never from Firestore or anywhere else — matches the security model
  // already used by /admin and every admin API route. Deliberately NOT in
  // partialize/persisted: a stale cached role sitting in localStorage
  // could show admin UI to a since-demoted account (harmless for actual
  // access — every admin API route re-verifies server-side regardless —
  // but still the wrong thing to display), so this is always recomputed
  // fresh from the current Firebase session on every app load instead.
  role: "user" | "admin" | "super_admin" | null;
  hasOnboarded: boolean;
  signup: (email: string, password: string, name?: string, referralCode?: string) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  // Web: opens a Google popup and resolves once signed in. Capacitor: the
  // WebView navigates away to Google and back, so this resolves with
  // `pending: true` immediately — the actual result is picked up by
  // completeOAuthRedirect() on the next app load (see use-firebase-auth.ts).
  signInWithGoogle: (referralCode?: string) => Promise<{ ok: boolean; error?: string; pending?: boolean }>;
  // Same pattern as signInWithGoogle, using Sign in with Apple instead.
  signInWithApple: (referralCode?: string) => Promise<{ ok: boolean; error?: string; pending?: boolean }>;
  // Call once on app start to finish a Capacitor Google/Apple redirect, if
  // one is in progress. Resolves to null when there was no redirect to
  // complete. Handles both providers — only one of them can ever be
  // mid-redirect at a time, and getRedirectResult() doesn't care which.
  completeOAuthRedirect: () => Promise<{ ok: boolean; error?: string } | null>;
  // Permanently deletes the signed-in user's account (server-side data +
  // Firebase Auth record — see /api/account/delete). If the account was
  // created via Sign in with Apple, this first re-authenticates with
  // Apple and revokes that token, per App Store Review Guideline
  // 5.1.1(v) — see revokeAppleTokenViaPopup() above. On Capacitor,
  // `pending: true` means the re-auth redirected the whole webview;
  // completeOAuthRedirect() finishes the deletion after the reload.
  deleteAccount: () => Promise<{ ok: boolean; error?: string; pending?: boolean }>;
  loginAsGuest: () => void;
  logout: () => void;
  // Called from useFirebaseAuthListener's onAuthStateChanged — the single
  // place that reconciles the store with whatever Firebase itself reports
  // as the current user, independent of (and a safety net alongside)
  // login()/signup()/finishOAuthSignIn()'s own resets. See its
  // implementation for why this exists.
  syncFirebaseUser: (
    user: { uid: string; email: string | null; displayName: string | null } | null,
    role: "user" | "admin" | "super_admin" | null
  ) => void;
  completeOnboarding: () => void;

  /* profile */
  profile: UserProfile;
  updateProfile: (p: Partial<UserProfile>) => void;

  /* theme */
  theme: "light" | "dark";
  toggleTheme: () => void;
  setTheme: (t: "light" | "dark") => void;
  colorTheme: ColorTheme;
  setColorTheme: (c: ColorTheme) => void;

  /* chat */
  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;
  clearChat: () => void;

  /* analyses */
  analyses: SkinAnalysis[];
  addAnalysis: (a: SkinAnalysis) => void;
  // Backfills a single analysis's image by id — specifically for
  // useDbSync to restore the hosted image URL for analyses whose local
  // imageData was intentionally stripped before persisting to localStorage
  // (see partialize below; localStorage never carries full images, the
  // server-hosted URL is the durable copy).
  updateAnalysisImage: (id: string, imageData: string) => void;
  currentAnalysis: SkinAnalysis | null;
  setCurrentAnalysis: (a: SkinAnalysis | null) => void;

  /* scans */
  scans: ProductScan[];
  addScan: (s: ProductScan) => void;

  /* routine */
  routine: RoutineStep[];
  toggleRoutineStep: (id: string) => void;
  resetRoutineDay: () => void;
  lastRoutineReset: number;

  /* streaks & achievements & checkin logs */
  streak: number;
  lastCheckIn: number;
  checkInLogs: DailyCheckInLog[];
  checkIn: () => void;
  logDailyCheckIn: (log: {
    hydration: number;
    sensitivity: number;
    barrierScore?: number;
    notes?: string;
    symptoms?: string[];
  }) => void;
  achievements: Achievement[];
  unlockAchievement: (id: string) => void;
  // Transient (not persisted) — a small queue so the celebration overlay can
  // react the instant a NEW achievement unlocks, from anywhere in the app.
  pendingCelebrations: Achievement[];
  dismissCelebration: () => void;

  /* before/after */
  comparisons: BeforeAfter[];
  addComparison: (c: BeforeAfter) => void;

  /* saved products — AI recommendations aren't backed by a persistent
   * collection (see RecommendedProduct's doc comment in data.ts), so the
   * full snapshot is kept locally, not just an id. */
  savedProducts: RecommendedProduct[];
  toggleSaveProduct: (product: RecommendedProduct) => void;

  /* beauty cabinet */
  cabinet: CabinetProduct[];
  addCabinetProduct: (p: CabinetProduct) => void;
  updateCabinetProduct: (id: string, p: Partial<CabinetProduct>) => void;
  removeCabinetProduct: (id: string) => void;
  incrementProductUse: (id: string) => void;
  toggleCabinetFavorite: (id: string) => void;

  /* beauty planner */
  plans: BeautyPlan[];
  addPlan: (p: BeautyPlan) => void;
  removePlan: (id: string) => void;

  /* beauty academy */
  academyFavorites: string[];
  toggleAcademyFavorite: (id: string) => void;
  academyHistory: WatchHistoryItem[];
  addWatchHistory: (videoId: string) => void;

  /* rawnak picks — saved (added to cabinet already tracked via cabinet) */
  likedPicks: string[];
  toggleLikedPick: (id: string) => void;

  /* Style Studio — coordinated outfits saved for later (persisted), and
   * a one-shot handoff channel so a trend/palette card or a saved look
   * can open another screen pre-filtered/pre-loaded instead of dumping
   * the user on a generic unfiltered view. Both cleared by the screen
   * that consumes them, right after reading — never persisted, they're
   * navigation state, not user data. */
  savedLooks: SavedLook[];
  saveLook: (items: SavedLook["items"]) => void;
  removeLook: (id: string) => void;
  pendingPicksFilter: { department: ProductDepartment; category?: string } | null;
  setPendingPicksFilter: (f: { department: ProductDepartment; category?: string } | null) => void;
  pendingLookToLoad: SavedLook["items"] | null;
  setPendingLookToLoad: (items: SavedLook["items"] | null) => void;

  /* currency & country preference — auto-detected from device timezone,
   * same pattern as chat dialect (see detectCountryFromTimezone's doc
   * comment). No manual country/currency picker is shown to the user. */
  selectedCurrency: string;
  selectedCountry: string;
  countryAutoDetected: boolean;
  setSelectedCurrency: (currencyCode: string) => void;
  setSelectedCountry: (countryName: string) => void;
  ensureCountryDetected: () => void;
}

const DEFAULT_ROUTINE: RoutineStep[] = [
  { id: "am-cleanse", name: "غسول لطيف", time: "morning", done: false },
  { id: "am-vitc", name: "سيروم فيتامين سي", time: "morning", done: false },
  { id: "am-moist", name: "مرطب", time: "morning", done: false },
  { id: "am-spf", name: "واقي شمس SPF50", time: "morning", done: false },
  { id: "pm-cleanse", name: "غسول مسائي", time: "evening", done: false },
  { id: "pm-retinol", name: "ريتينول", time: "evening", done: false },
  { id: "pm-moist", name: "مرطب ليلي", time: "evening", done: false },
];

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: "first-analysis", title: "أول تحليل", desc: "أكملتِ أول تحليل لبشرتك", icon: "sparkles", unlocked: false },
  { id: "first-chat", title: "استشارة أولى", desc: "تحدثتِ مع خبيرة الجمال", icon: "message", unlocked: false },
  { id: "streak-3", title: "ثلاثة أيام", desc: "حافظتِ على روتينك 3 أيام", icon: "flame", unlocked: false },
  { id: "streak-7", title: "أسبوع كامل", desc: "7 أيام من الالتزام", icon: "crown", unlocked: false },
  { id: "scanner-pro", title: "متفحصة المنتجات", desc: "مسح أول منتج", icon: "scan", unlocked: false },
  { id: "ingredient-explorer", title: "مستكشفة المكونات", desc: "بحثتِ عن 5 مكونات", icon: "book", unlocked: false },
  { id: "glow-up", title: "تألق", desc: "أكملتِ 5 تحليلات", icon: "star", unlocked: false },
  { id: "before-after", title: "تتبع التقدم", desc: "حفظتِ مقارنة قبل وبعد", icon: "camera", unlocked: false },
  { id: "circle-of-glow", title: "دائرة التوهج", desc: "دعوتِ 3 صديقات لرَونق", icon: "gift", unlocked: false },
];

const EMPTY_PROFILE: UserProfile = {
  name: "",
  email: "",
  age: null,
  skinType: null,
  skinTone: null,
  concerns: [],
  goals: [],
  makeupLevel: null,
  lifestyle: [],
  personalityMode: "professional",
  dialect: "msa",
  shareCardIncludePhoto: false,
  remindersEnabled: false,
  isPremium: false,
  subscriptionExpiresAt: null,
  subscriptionProductId: null,
  referralCode: null,
  referralInvitesCount: 0,
  referralRewardUnlockedAt: null,
  vipTrialExpiresAt: null,
  cabinetAiScanUsed: 0,
  avatar: "",
  profileImage: null,
  accountTier: "standard",
  followersCount: 0,
  followingCount: 0,
  followingIds: [],
  socialInstagram: null,
  socialTiktok: null,
  createdAt: 0,
};

/**
 * ROOT-CAUSE FIX for cross-account data leakage: every field below is
 * user-scoped (persisted to localStorage under the single "rawnak-store"
 * key — see partialize further down — with NO per-uid namespacing) and
 * was previously left untouched by both logout() and every sign-in path.
 * Concretely, this meant: Account A signs in, analyses/cabinet/profile
 * populate; Account A signs out (only isAuthed/isGuest/view/chatMessages
 * were ever reset); Account B signs in on the same device and lands
 * directly in a store STILL full of Account A's data. useDbSync's
 * on-login sync is additive-only by design (it merges in whatever the
 * newly-authenticated account has on the server, which is correctly
 * scoped server-side — the bug was never server-side), so Account B's
 * real analyses/cabinet items got ADDED ON TOP of Account A's leftover
 * ones instead of replacing them, and the debounced auto-sync a few
 * seconds later then wrote that contaminated, merged mix back up to
 * Account B's own Firestore document — meaning this wasn't just a display
 * glitch, it could silently corrupt the next-signed-in account's actual
 * stored data too.
 *
 * This function is the single source of truth for "what does a
 * signed-out device look like" — called from BOTH logout() (the primary
 * fix) AND the start of every successful sign-in path (login/signup/
 * finishOAuthSignIn — defense in depth, so a device that already has
 * pre-fix contaminated data sitting in localStorage from BEFORE this fix
 * shipped still gets cleaned the next time anyone signs in on it, and so
 * any future sign-in method added later can't reintroduce this bug simply
 * by forgetting to call logout() first).
 *
 * Deliberately NOT reset: `theme` (light/dark is a device display
 * preference, not account data — fine to carry across accounts on the
 * same device, same as OS-level dark mode would be) and `view`/
 * `authChecked` (navigation/session-check flags, not user data, and are
 * set explicitly by each call site right after this runs anyway).
 */
export function clearStandaloneUserCaches(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("rawnak_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.warn("Failed clearing standalone user caches:", e);
  }
}

function resetUserDataState(): Partial<AppState> {
  clearStandaloneUserCaches();
  return {
    hasOnboarded: false,
    role: null,
    profile: EMPTY_PROFILE,
    colorTheme: "rose",
    chatMessages: [],
    analyses: [],
    currentAnalysis: null,
    scans: [],
    routine: DEFAULT_ROUTINE,
    lastRoutineReset: Date.now(),
    streak: 0,
    lastCheckIn: 0,
    achievements: DEFAULT_ACHIEVEMENTS,
    pendingCelebrations: [],
    comparisons: [],
    savedProducts: [],
    cabinet: [],
    plans: [],
    academyFavorites: [],
    academyHistory: [],
    likedPicks: [],
    savedLooks: [],
    viewHistory: [],
    pendingReferralCode: null,
    pendingAuthMode: "login",
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: "splash",
      viewHistory: [],
      setView: (v) =>
        set((s) => {
          if (v === s.view) return s; // true no-op — see unlockAchievement's comment for why not `{}`
          trackEvent("page_view", { view: v });
          return { view: v, viewHistory: [...s.viewHistory, s.view].slice(-30) };
        }),
      // Used by the Android hardware/gesture back button (see app-shell.tsx).
      // Returns true if it moved to a previous screen, false if there was
      // nowhere to go — in which case the caller should exit the app.
      goBack: () => {
        const { viewHistory } = get();
        if (viewHistory.length === 0) return false;
        const prev = viewHistory[viewHistory.length - 1];
        set({ view: prev, viewHistory: viewHistory.slice(0, -1) });
        return true;
      },

      pendingReferralCode: null,
      pendingAuthMode: "login",
      setPendingReferral: (code) =>
        set({ pendingReferralCode: code, pendingAuthMode: code ? "signup" : "login" }),

      isAuthed: false,
      authChecked: false,
      hasOnboarded: false,
      isGuest: false,
      authUid: null,
      role: null,

      signup: async (email, password, name, referralCode) => {
        try {
          const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
          if (name) await updateFirebaseProfile(cred.user, { displayName: name });

          const idToken = await cred.user.getIdToken();
          const res = await fetch("/api/auth/complete-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ name, referralCode }),
          });
          const data = await res.json();
          if (!res.ok) return { ok: false, error: data?.error || "فشل إنشاء الحساب" };

          set({
            ...resetUserDataState(),
            isAuthed: true,
            authChecked: true,
            isGuest: false,
            authUid: cred.user.uid,
            profile: {
              ...EMPTY_PROFILE,
              email: data.user.email,
              name: data.user.name || name || "",
              createdAt: Date.now(),
            },
          });
          trackEvent("sign_up", { method: "password" });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: firebaseAuthErrorMessage(err) };
        }
      },

      login: async (email, password) => {
        try {
          const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);

          set({
            ...resetUserDataState(),
            isAuthed: true,
            authChecked: true,
            hasOnboarded: true, // Registered user logging in — go directly to main app
            view: "home",
            isGuest: false,
            authUid: cred.user.uid,
            profile: {
              ...EMPTY_PROFILE,
              email: cred.user.email || "",
              name: cred.user.displayName || "",
              createdAt: Date.now(),
            },
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: firebaseAuthErrorMessage(err) };
        }
      },

      signInWithGoogle: async (referralCode) => {
        try {
          if (Capacitor.isNativePlatform()) {
            // Popups don't work inside the Capacitor WebView (and Google
            // actively blocks OAuth in generic embedded webviews), so on
            // native we redirect the whole webview to Google instead of
            // opening a popup — which reloads the app, wiping in-memory
            // state (including the transient, unpersisted
            // pendingReferralCode). Stash the referral code somewhere that
            // survives the reload so completeOAuthRedirect() can still
            // apply it.
            if (referralCode) localStorage.setItem(OAUTH_REDIRECT_REFERRAL_KEY, referralCode);
            else localStorage.removeItem(OAUTH_REDIRECT_REFERRAL_KEY);
            await signInWithRedirect(firebaseAuth, googleProvider);
            return { ok: true, pending: true };
          }
          const cred = await signInWithPopup(firebaseAuth, googleProvider);
          const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
          return await finishOAuthSignIn(cred.user, referralCode, set, isNewUser, "google");
        } catch (err) {
          return { ok: false, error: firebaseAuthErrorMessage(err) };
        }
      },

      signInWithApple: async (referralCode) => {
        try {
          // iOS: native ASAuthorizationAppleIDProvider sheet — required
          // for App Store Review Guideline 4.8 since Google sign-in is
          // also offered. See apple-native-signin.ts for the full
          // rationale and one-time setup this depends on.
          if (Capacitor.getPlatform() === "ios") {
            const { signInWithAppleNative } = await import("@/lib/firebase/apple-native-signin");
            const { credential } = await signInWithAppleNative();
            const isNewUser = getAdditionalUserInfo(credential)?.isNewUser ?? false;
            return await finishOAuthSignIn(credential.user, referralCode, set, isNewUser, "apple");
          }

          if (Capacitor.isNativePlatform()) {
            // Android: no native-provider requirement from Apple here —
            // same reasoning as signInWithGoogle above.
            if (referralCode) localStorage.setItem(OAUTH_REDIRECT_REFERRAL_KEY, referralCode);
            else localStorage.removeItem(OAUTH_REDIRECT_REFERRAL_KEY);
            await signInWithRedirect(firebaseAuth, appleProvider);
            return { ok: true, pending: true };
          }
          const cred = await signInWithPopup(firebaseAuth, appleProvider);
          const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
          return await finishOAuthSignIn(cred.user, referralCode, set, isNewUser, "apple");
        } catch (err) {
          return { ok: false, error: firebaseAuthErrorMessage(err) };
        }
      },

      completeOAuthRedirect: async () => {
        try {
          const result = await getRedirectResult(firebaseAuth);
          if (!result) return null; // normal load, not a return from Google/Apple

          // Deletion flow re-authenticated with Apple to get a fresh token
          // to revoke (see deleteAccount() below) — this redirect return is
          // that re-auth completing, NOT a normal sign-in, so finish the
          // deletion instead of finishOAuthSignIn().
          const pendingDelete = localStorage.getItem(OAUTH_REDIRECT_PENDING_DELETE_KEY);
          if (pendingDelete) {
            localStorage.removeItem(OAUTH_REDIRECT_PENDING_DELETE_KEY);
            try {
              const oauthCred = OAuthProvider.credentialFromResult(result);
              if (oauthCred?.accessToken) {
                await revokeAccessToken(firebaseAuth, oauthCred.accessToken);
              }
            } catch {
              // Don't block account deletion just because revocation
              // failed — same reasoning as revokeAppleTokenViaPopup().
            }
            const deleteResult = await callDeleteAccountApi();
            if (!deleteResult.ok) return deleteResult;
            clearRegisteredPush().catch(() => {});
            signOut(firebaseAuth).catch(() => {});
            set({ ...resetUserDataState(), isAuthed: false, isGuest: false, view: "auth", authUid: null });
            return { ok: true };
          }

          const storedReferral = localStorage.getItem(OAUTH_REDIRECT_REFERRAL_KEY);
          localStorage.removeItem(OAUTH_REDIRECT_REFERRAL_KEY);
          const additionalInfo = getAdditionalUserInfo(result);
          const method = additionalInfo?.providerId === "apple.com" ? "apple" : "google";
          return await finishOAuthSignIn(
            result.user,
            storedReferral || get().pendingReferralCode || undefined,
            set,
            additionalInfo?.isNewUser ?? false,
            method
          );
        } catch (err) {
          return { ok: false, error: firebaseAuthErrorMessage(err) };
        }
      },

      deleteAccount: async () => {
        try {
          const user = firebaseAuth.currentUser;
          if (!user) return { ok: false, error: "يجب تسجيل الدخول أولاً" };

          const isAppleUser = user.providerData.some((p) => p.providerId === "apple.com");

          if (isAppleUser) {
            if (Capacitor.getPlatform() === "ios") {
              // Native flow: re-run the Apple ID sheet to get a fresh
              // authorizationCode, then revoke it server-side (Apple's
              // REST API needs the private key, so this can't happen
              // client-side) — see apple-native-signin.ts and
              // /api/apple/revoke/route.ts.
              const { signInWithAppleNative, revokeNativeAppleToken } = await import(
                "@/lib/firebase/apple-native-signin"
              );
              const { authorizationCode } = await signInWithAppleNative();
              await revokeNativeAppleToken(authorizationCode);
            } else if (Capacitor.isNativePlatform()) {
              // Android: web-flow redirect reloads the whole webview (see
              // signInWithApple above) — stash intent so
              // completeOAuthRedirect() finishes the revoke-then-delete
              // after the reload.
              localStorage.setItem(OAUTH_REDIRECT_PENDING_DELETE_KEY, "1");
              await signInWithRedirect(firebaseAuth, appleProvider);
              return { ok: true, pending: true };
            } else {
              await revokeAppleTokenViaPopup();
            }
          }

          const result = await callDeleteAccountApi();
          if (!result.ok) return result;

          clearRegisteredPush().catch(() => {});
          signOut(firebaseAuth).catch(() => {});
          set({ ...resetUserDataState(), isAuthed: false, isGuest: false, view: "auth", authUid: null });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: firebaseAuthErrorMessage(err) };
        }
      },

      // Guest mode is intentionally local-only: no server account, no password,
      // nothing to sync. Data lives in this device's storage until the guest
      // creates a real account.
      loginAsGuest: () =>
        set((s) => ({
          isAuthed: true,
          authChecked: true,
          isGuest: true,
          profile: {
            ...s.profile,
            email: "",
            name: s.profile.name || "ضيفة",
            createdAt: s.profile.createdAt || Date.now(),
          },
        })),

      logout: () => {
        // Order matters: clearRegisteredPush() needs a valid Firebase ID
        // token to identify whose token to clear, so it MUST run before
        // signOut() invalidates the client's notion of "current user" —
        // reversing this order would make it silently fail every time
        // (401, swallowed by its own .catch()), never actually clearing
        // anything.
        clearRegisteredPush().catch(() => {});
        signOut(firebaseAuth).catch(() => {});
        // Full reset of every user-scoped field — see resetUserDataState's
        // doc comment for why this exists. isAuthed/isGuest/view are set
        // explicitly here rather than folded into the helper since they're
        // specific to THIS call site, not shared with the sign-in paths
        // that also call resetUserDataState().
        set({ ...resetUserDataState(), isAuthed: false, isGuest: false, view: "auth", authUid: null });
      },

      // Reconciles the store with whatever Firebase's own onAuthStateChanged
      // reports, independent of login()/signup()/finishOAuthSignIn(). This
      // exists because those functions alone are NOT a sufficient guard
      // against cross-account data leakage — onAuthStateChanged can fire
      // on its own, at any time, including:
      //  - App boot / page reload with an already-persisted Firebase
      //    session (no sign-in function runs at all).
      //  - Right after a native OAuth redirect, which reloads the whole
      //    app and wipes in-memory state (see completeOAuthRedirect) —
      //    onAuthStateChanged can fire before finishOAuthSignIn() finishes
      //    its own async work.
      //  - A race where onAuthStateChanged fires BEFORE login()'s own
      //    set() call resolves, not after.
      // Comparing the incoming Firebase uid against the PERSISTED authUid
      // (survives reloads, unlike a plain in-memory ref) is what makes
      // this correct regardless of ordering: if they differ, a different
      // account's data might still be sitting in the store/localStorage,
      // so this does the same full resetUserDataState() the explicit
      // sign-in functions do. If they match (or authUid is null — a
      // device that has never had anyone signed in, nothing to leak), this
      // is just Firebase confirming/refreshing the SAME session, so it
      // only tops up email/name and never touches analyses/cabinet/etc —
      // resetting on every routine token refresh would wipe out the
      // user's own in-session data, which would be a different, self-
      // inflicted version of the same bug this exists to prevent.
      syncFirebaseUser: (
        user: { uid: string; email: string | null; displayName: string | null } | null,
        role: "user" | "admin" | "super_admin" | null
      ) => {
        if (!user) {
          set({ isAuthed: false, authChecked: true, role: null });
          return;
        }
        const currentAuthUid = get().authUid;
        if (currentAuthUid && currentAuthUid !== user.uid) {
          set({
            ...resetUserDataState(),
            isAuthed: true,
            authChecked: true,
            isGuest: false,
            authUid: user.uid,
            role,
            profile: {
              ...EMPTY_PROFILE,
              email: user.email || "",
              name: user.displayName || "",
              createdAt: Date.now(),
            },
          });
          return;
        }
        set((s) => ({
          isAuthed: true,
          authChecked: true,
          isGuest: false,
          authUid: user.uid,
          role,
          profile: {
            ...s.profile,
            email: user.email || s.profile.email,
            name: user.displayName || s.profile.name,
          },
        }));
      },

      completeOnboarding: () =>
        set((s) => {
          const cur = s.profile.dialect
            ? s.profile
            : { ...s.profile, dialect: detectDialectFromTimezone() };

          // Same smart-default pattern as dialect above, for country/
          // currency — only applied once (countryAutoDetected guards
          // against ever overriding a later, explicit choice).
          if (s.countryAutoDetected) {
            return { hasOnboarded: true, view: "home", profile: cur };
          }
          const detectedCountry = detectCountryFromTimezone();
          const detectedCurrency = getCurrencyForCountry(detectedCountry);
          return {
            hasOnboarded: true,
            view: "home",
            profile: cur,
            countryAutoDetected: true,
            selectedCountry: detectedCountry,
            selectedCurrency: detectedCurrency.code,
          };
        }),

      profile: EMPTY_PROFILE,
      updateProfile: (p) =>
        set((s) => ({ profile: { ...s.profile, ...p } })),

      theme: "dark",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setTheme: (t) => set({ theme: t }),

      colorTheme: "rose",
      setColorTheme: (c) => set({ colorTheme: c }),

      chatMessages: [],
      addChatMessage: (m) =>
        set((s) => ({ chatMessages: [...s.chatMessages, m] })),
      clearChat: () => set({ chatMessages: [] }),

      analyses: [],
      addAnalysis: (a) =>
        set((s) => ({ analyses: [a, ...s.analyses].slice(0, 20) })),
      updateAnalysisImage: (id, imageData) =>
        set((s) => {
          const target = s.analyses.find((a) => a.id === id);
          if (!target || target.imageData === imageData) return s; // true no-op — see unlockAchievement's comment on why `s` not `{}`
          return { analyses: s.analyses.map((a) => (a.id === id ? { ...a, imageData } : a)) };
        }),
      currentAnalysis: null,
      setCurrentAnalysis: (a) => set({ currentAnalysis: a }),

      scans: [],
      addScan: (s) => set((st) => ({ scans: [s, ...st.scans].slice(0, 20) })),

      routine: DEFAULT_ROUTINE,
      toggleRoutineStep: (id) =>
        set((s) => {
          const targetStep = s.routine.find((r) => r.id === id);
          const willBeDone = targetStep ? !targetStep.done : false;

          const nextRoutine = s.routine.map((r) =>
            r.id === id ? { ...r, done: !r.done } : r
          );
          const wasAllDone = s.routine.length > 0 && s.routine.every((r) => r.done);
          const isAllDone = nextRoutine.length > 0 && nextRoutine.every((r) => r.done);

          if (isAllDone && !wasAllDone) {
            triggerSuccessHaptic();
          } else if (willBeDone) {
            triggerImpactHaptic(ImpactStyle.Medium);
          } else {
            triggerSelectionHaptic();
          }

          return { routine: nextRoutine };
        }),
      lastRoutineReset: Date.now(),
      resetRoutineDay: () =>
        set({
          routine: DEFAULT_ROUTINE.map((r) => ({ ...r, done: false })),
          lastRoutineReset: Date.now(),
        }),

      streak: 0,
      lastCheckIn: 0,
      checkInLogs: [],
      checkIn: () => {
        const now = Date.now();
        const last = get().lastCheckIn;
        const dayKey = (t: number) => new Date(t).toDateString();

        if (last !== 0 && dayKey(now) === dayKey(last)) return; // already counted today — no-op

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isConsecutiveDay = last !== 0 && dayKey(last) === dayKey(yesterday.getTime());

        triggerSuccessHaptic();

        set((s) => ({
          streak: isConsecutiveDay ? s.streak + 1 : 1,
          lastCheckIn: now,
        }));
      },
      logDailyCheckIn: (log) => {
        const now = Date.now();
        const d = new Date(now);
        const dateStr = "اليوم";

        const newEntry: DailyCheckInLog = {
          id: `chk-${now}`,
          ts: now,
          dateStr,
          hydration: log.hydration,
          sensitivity: log.sensitivity,
          barrierScore: log.barrierScore ?? Math.round((log.hydration + (100 - log.sensitivity)) / 2),
          notes: log.notes?.trim() || undefined,
          symptoms: log.symptoms || [],
        };

        get().checkIn();

        set((s) => {
          // Replace today's log if logged multiple times on the same date, or prepend
          const filtered = s.checkInLogs.filter((item) => {
            const itemDateKey = new Date(item.ts).toDateString();
            return itemDateKey !== d.toDateString();
          });
          return {
            checkInLogs: [newEntry, ...filtered].slice(0, 60),
          };
        });
      },
      achievements: DEFAULT_ACHIEVEMENTS,
      pendingCelebrations: [],
      unlockAchievement: (id) =>
        set((s) => {
          const target = s.achievements.find((a) => a.id === id);
          // Returning `s` itself (not `{}`) is deliberate: Zustand skips
          // notifying subscribers only when the updater returns the exact
          // same state reference. `{}` is a *new* object every time, which
          // Zustand still treats as a change and still notifies for — that
          // gap is what turned a stray render-body unlockAchievement() call
          // in results-screen.tsx into a genuine infinite render loop (the
          // "no-op" still notified, re-triggering the render that called
          // unlockAchievement() again). Returning `s` closes that gap.
          if (!target || target.unlocked) return s;
          const unlockedAt = Date.now();
          return {
            achievements: s.achievements.map((a) =>
              a.id === id ? { ...a, unlocked: true, unlockedAt } : a
            ),
            pendingCelebrations: [...s.pendingCelebrations, { ...target, unlocked: true, unlockedAt }],
          };
        }),
      dismissCelebration: () =>
        set((s) => ({ pendingCelebrations: s.pendingCelebrations.slice(1) })),

      comparisons: [],
      addComparison: (c) =>
        set((s) => ({ comparisons: [c, ...s.comparisons].slice(0, 12) })),

      savedProducts: [],
      toggleSaveProduct: (product) =>
        set((s) => ({
          savedProducts: s.savedProducts.some((p) => p.id === product.id)
            ? s.savedProducts.filter((p) => p.id !== product.id)
            : [product, ...s.savedProducts].slice(0, 60),
        })),

      cabinet: [],
      addCabinetProduct: (p) =>
        set((s) => ({ cabinet: [p, ...s.cabinet].slice(0, 60) })),
      updateCabinetProduct: (id, patch) =>
        set((s) => ({
          cabinet: s.cabinet.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        })),
      removeCabinetProduct: (id) =>
        set((s) => ({ cabinet: s.cabinet.filter((p) => p.id !== id) })),
      incrementProductUse: (id) =>
        set((s) => ({
          cabinet: s.cabinet.map((p) =>
            p.id === id
              ? { ...p, useCount: p.useCount + 1, lastUsedAt: Date.now() }
              : p
          ),
        })),
      toggleCabinetFavorite: (id) =>
        set((s) => ({
          cabinet: s.cabinet.map((p) =>
            p.id === id ? { ...p, favorite: !p.favorite } : p
          ),
        })),

      plans: [],
      addPlan: (p) => set((s) => ({ plans: [p, ...s.plans].slice(0, 30) })),
      removePlan: (id) =>
        set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),

      academyFavorites: [],
      toggleAcademyFavorite: (id) =>
        set((s) => ({
          academyFavorites: s.academyFavorites.includes(id)
            ? s.academyFavorites.filter((v) => v !== id)
            : [...s.academyFavorites, id],
        })),
      academyHistory: [],
      addWatchHistory: (videoId) =>
        set((s) => ({
          academyHistory: [
            { videoId, ts: Date.now() },
            ...s.academyHistory.filter((h) => h.videoId !== videoId),
          ].slice(0, 30),
        })),

      likedPicks: [],
      toggleLikedPick: (id) => {
        const wasLiked = get().likedPicks.includes(id);
        set((s) => ({
          likedPicks: wasLiked
            ? s.likedPicks.filter((p) => p !== id)
            : [...s.likedPicks, id],
        }));
        // Fire-and-forget demand signal for the automatic "الأكثر طلبًا"
        // badge (see engage/route.ts) — plain Firestore counter, no AI,
        // never blocks or fails the like action itself.
        fetch(`/api/picks/${id}/engage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: wasLiked ? "unlike" : "like" }),
        }).catch(() => {});
      },

      savedLooks: [],
      saveLook: (items) =>
        set((s) => ({
          savedLooks: [
            { id: `look-${Date.now()}`, items, createdAt: Date.now() },
            ...s.savedLooks,
          ].slice(0, 50),
        })),
      removeLook: (id) =>
        set((s) => ({ savedLooks: s.savedLooks.filter((l) => l.id !== id) })),
      pendingPicksFilter: null,
      setPendingPicksFilter: (f) => set({ pendingPicksFilter: f }),
      pendingLookToLoad: null,
      setPendingLookToLoad: (items) => set({ pendingLookToLoad: items }),

      selectedCurrency: "SAR",
      selectedCountry: "السعودية",
      countryAutoDetected: false,
      setSelectedCurrency: (currencyCode) => set({ selectedCurrency: currencyCode }),
      setSelectedCountry: (countryName) => {
        const cur = getCurrencyForCountry(countryName);
        set({ selectedCountry: countryName, selectedCurrency: cur.code, countryAutoDetected: true });
      },
      ensureCountryDetected: () =>
        set((s) => {
          // Covers accounts that onboarded before country auto-detection
          // existed (completeOnboarding() only runs once, at onboarding
          // time) — called from AppShell's mount effect so returning users
          // get the same smart default new users get, exactly once.
          if (s.countryAutoDetected) return {};
          const detectedCountry = detectCountryFromTimezone();
          const detectedCurrency = getCurrencyForCountry(detectedCountry);
          return {
            countryAutoDetected: true,
            selectedCountry: detectedCountry,
            selectedCurrency: detectedCurrency.code,
          };
        }),
    }),
    {
      name: "rawnak-store",
      storage: createJSONStorage(() => localStorage),
      // Bumped once, to run the migration below exactly once for anyone who
      // already has bloated pre-fix data sitting in localStorage (see notes
      // on `analyses` in partialize below).
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as { analyses?: SkinAnalysis[] } | undefined;
        if (version < 1 && state?.analyses?.length) {
          state.analyses = state.analyses.map((a) => ({ ...a, imageData: "" }));
        }
        return state;
      },
      partialize: (s) => ({
        isAuthed: s.isAuthed,
        authUid: s.authUid,
        hasOnboarded: s.hasOnboarded,
        profile: s.profile,
        theme: s.theme,
        colorTheme: s.colorTheme,
        chatMessages: s.chatMessages,
        // imageData stripped before writing to localStorage — analyses are
        // already durably stored server-side (Firebase Storage + Firestore,
        // see /api/db/sync), so this loses nothing across sessions once
        // useDbSync's next fetch repopulates imageUrl. Full images (often
        // several hundred KB to multiple MB each as base64, uncapped —
        // capture() in use-camera.ts does no downscaling) sitting in
        // localStorage were the root cause of a P0 freeze/ANR: Zustand's
        // persist middleware re-serializes and re-writes this ENTIRE
        // object, synchronously, on every single store update anywhere in
        // the app — not just when analyses themselves change. Combined
        // with a render-body bug that was calling set() in a tight loop
        // (see results-screen.tsx), each loop iteration did a multi-MB
        // synchronous localStorage write, which is what actually produced
        // the ANR. That loop is fixed, but this stays regardless — it was
        // never correct for multi-MB blobs to be replicated into
        // localStorage on every unrelated state change to begin with.
        //
        // NOTE: `scans`, `cabinet`, and `comparisons` below still carry
        // full base64 images and are NOT currently backed by server-side
        // storage the way analyses are (uploading theirs would be a
        // feature addition, out of scope for this fix) — they're lower
        // risk in practice (typically far fewer items than analyses over
        // time) but carry the same latent risk and are worth the same
        // treatment in a dedicated follow-up.
        analyses: s.analyses.map((a) => ({ ...a, imageData: "" })),
        scans: s.scans,
        routine: s.routine,
        lastRoutineReset: s.lastRoutineReset,
        streak: s.streak,
        lastCheckIn: s.lastCheckIn,
        checkInLogs: s.checkInLogs,
        achievements: s.achievements,
        comparisons: s.comparisons,
        savedProducts: s.savedProducts,
        cabinet: s.cabinet,
        plans: s.plans,
        academyFavorites: s.academyFavorites,
        academyHistory: s.academyHistory,
        likedPicks: s.likedPicks,
        savedLooks: s.savedLooks,
        selectedCurrency: s.selectedCurrency,
        selectedCountry: s.selectedCountry,
        countryAutoDetected: s.countryAutoDetected,
      }),
    }
  )
);
