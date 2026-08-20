import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit, where, getCountFromServer, Timestamp } from "firebase/firestore";
import { firebaseApp, firebaseAuth } from "./client";

export interface BadgeItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlockedAt: number;
}

export interface UserGamificationData {
  xp: number;
  level: number;
  levelTitle: string;
  completedLessons: string[];
  completedQuizzes: string[];
  badges: BadgeItem[];
  notesCount: number;
  updatedAt: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  levelTitle: string;
  badgesCount: number;
  completedCount: number;
  isCurrentUser: boolean;
  countryFlag?: string;
  rank?: number;
  accountTier?: string;
}

export const LEVEL_THRESHOLDS = [
  { level: 1, title: "مبتدئة العناية", minXp: 0, icon: "🌱" },
  { level: 2, title: "شغوفة الأكاديمية", minXp: 150, icon: "✨" },
  { level: 3, title: "خبيرة المكونات", minXp: 350, icon: "🔬" },
  { level: 4, title: "ملكة العناية بالبشرة", minXp: 700, icon: "👑" },
  { level: 5, title: "أيقونة رَونق المعتمدة", minXp: 1200, icon: "🏆" },
];

export const ALL_BADGES: { id: string; title: string; desc: string; icon: string }[] = [
  { id: "first_lesson", title: "طالبة متميزة 🎓", desc: "أكملتِ أول درس تعليمي في الأكاديمية", icon: "🎓" },
  { id: "perfect_quiz", title: "عبقرية الاختبارات 🧠", desc: "حققتِ نتيجة كاملة 100% في اختبار الدرس", icon: "🧠" },
  { id: "quiz_master", title: "حافظة المعرفة 📚", desc: "أكملتِ 3 اختبارات تقييمية بنجاح", icon: "📚" },
  { id: "notes_star", title: "مدونة الفوائد 📝", desc: "سجلتِ ملاحظاتكِ الخاصة في الأكاديمية", icon: "📝" },
  { id: "xp_500", title: "نجمة الأكاديمية 🌟", desc: "وصلتِ إلى 500+ نقطة خبرة (XP)", icon: "🌟" },
  { id: "top_rank", title: "سفيرة رَونق 👑", desc: "بلغتِ أعلى المستويات القيادية في رَونق", icon: "👑" },
];

const LOCAL_STORAGE_KEY = "rawnak_academy_gamification_v1";

export function calculateLevel(xp: number): { level: number; levelTitle: string; icon: string; nextXp: number } {
  let current = LEVEL_THRESHOLDS[0];
  let nextXp = LEVEL_THRESHOLDS[1].minXp;

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i].minXp) {
      current = LEVEL_THRESHOLDS[i];
      nextXp = LEVEL_THRESHOLDS[i + 1] ? LEVEL_THRESHOLDS[i + 1].minXp : LEVEL_THRESHOLDS[i].minXp + 500;
    }
  }

  return {
    level: current.level,
    levelTitle: current.title,
    icon: current.icon,
    nextXp,
  };
}

export function getLocalGamificationData(): UserGamificationData {
  if (typeof window === "undefined") {
    return {
      xp: 0,
      level: 1,
      levelTitle: "مبتدئة العناية",
      completedLessons: [],
      completedQuizzes: [],
      badges: [],
      notesCount: 0,
      updatedAt: Date.now(),
    };
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      // Return default initial data
      const initData: UserGamificationData = {
        xp: 100, // Welcome gift 100 XP
        level: 1,
        levelTitle: "مبتدئة العناية",
        completedLessons: [],
        completedQuizzes: [],
        badges: [],
        notesCount: 0,
        updatedAt: Date.now(),
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initData));
      return initData;
    }

    const parsed = JSON.parse(raw);
    const { level, levelTitle } = calculateLevel(parsed.xp || 0);

    return {
      xp: parsed.xp || 0,
      level,
      levelTitle,
      completedLessons: parsed.completedLessons || [],
      completedQuizzes: parsed.completedQuizzes || [],
      badges: parsed.badges || [],
      notesCount: parsed.notesCount || 0,
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return {
      xp: 100,
      level: 1,
      levelTitle: "مبتدئة العناية",
      completedLessons: [],
      completedQuizzes: [],
      badges: [],
      notesCount: 0,
      updatedAt: Date.now(),
    };
  }
}

export const GAMIFICATION_UPDATED_EVENT = "rawnak:academy-gamification-updated";

export function saveLocalGamificationData(data: UserGamificationData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    // Components that cache this in local component state (rather than
    // re-reading it on every render) need a signal to refresh — otherwise
    // an async restore from Firestore (see restoreRemoteGamificationData)
    // can silently update localStorage while an already-mounted screen
    // keeps showing whatever it read at mount time.
    window.dispatchEvent(new CustomEvent(GAMIFICATION_UPDATED_EVENT, { detail: data }));
  } catch (e) {
    console.warn("Failed saving gamification data locally:", e);
  }
}

/**
 * Awards XP and checks for newly unlocked badges.
 * Automatically updates LocalStorage and Firestore leaderboard.
 */
export async function awardAcademyXp(
  amount: number,
  reason: string,
  meta?: {
    videoId?: string;
    type?: "lesson" | "quiz" | "perfect_quiz" | "notes";
    userName?: string;
    userAvatar?: string;
  }
): Promise<{ data: UserGamificationData; newBadges: BadgeItem[]; leveledUp: boolean }> {
  const current = getLocalGamificationData();
  const oldLevel = current.level;
  const newXp = current.xp + amount;

  const completedLessons = [...current.completedLessons];
  const completedQuizzes = [...current.completedQuizzes];
  let notesCount = current.notesCount;

  if (meta?.type === "lesson" && meta.videoId && !completedLessons.includes(meta.videoId)) {
    completedLessons.push(meta.videoId);
  }

  if ((meta?.type === "quiz" || meta?.type === "perfect_quiz") && meta.videoId && !completedQuizzes.includes(meta.videoId)) {
    completedQuizzes.push(meta.videoId);
  }

  if (meta?.type === "notes") {
    notesCount += 1;
  }

  const { level, levelTitle } = calculateLevel(newXp);
  const leveledUp = level > oldLevel;

  // Check Badge conditions
  const newBadges: BadgeItem[] = [];
  const existingBadgeIds = current.badges.map((b) => b.id);

  const checkBadge = (id: string, condition: boolean) => {
    if (condition && !existingBadgeIds.includes(id)) {
      const bDef = ALL_BADGES.find((b) => b.id === id);
      if (bDef) {
        const badgeItem: BadgeItem = {
          ...bDef,
          unlockedAt: Date.now(),
        };
        newBadges.push(badgeItem);
      }
    }
  };

  checkBadge("first_lesson", completedLessons.length >= 1);
  checkBadge("perfect_quiz", meta?.type === "perfect_quiz");
  checkBadge("quiz_master", completedQuizzes.length >= 3);
  checkBadge("notes_star", notesCount >= 1);
  checkBadge("xp_500", newXp >= 500);
  checkBadge("top_rank", level >= 5);

  const updatedData: UserGamificationData = {
    xp: newXp,
    level,
    levelTitle,
    completedLessons,
    completedQuizzes,
    badges: [...current.badges, ...newBadges],
    notesCount,
    updatedAt: Date.now(),
  };

  saveLocalGamificationData(updatedData);

  // Sync to Firestore — same doc backs both the public leaderboard entry
  // and this user's own durable copy of their progress, so it doubles as
  // the cross-device backup (see restoreRemoteGamificationData below). Only
  // signed-in, non-guest users get a durable doc; guests stay device-local
  // by design, same as the rest of the app's offline-first data.
  try {
    const user = firebaseAuth.currentUser;
    if (user) {
      const db = getFirestore(firebaseApp);
      const name = meta?.userName || (user.displayName ? user.displayName : "جميلة رَونق 🌸");
      const avatar = meta?.userAvatar || "🌸";

      await setDoc(
        doc(db, "academy_leaderboard", user.uid),
        {
          uid: user.uid,
          name,
          avatar,
          xp: updatedData.xp,
          level: updatedData.level,
          levelTitle: updatedData.levelTitle,
          badgesCount: updatedData.badges.length,
          completedCount: updatedData.completedLessons.length + updatedData.completedQuizzes.length,
          // Full state, not just counts — needed to actually restore
          // progress on a new device (see restoreRemoteGamificationData).
          completedLessons: updatedData.completedLessons,
          completedQuizzes: updatedData.completedQuizzes,
          badges: updatedData.badges,
          notesCount: updatedData.notesCount,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn("[Firestore Leaderboard] Sync notice (local copy active):", err);
  }

  return {
    data: updatedData,
    newBadges,
    leveledUp,
  };
}

/**
 * Restores academy progress (XP, level, completed lessons/quizzes, badges,
 * notes count) from this signed-in user's Firestore copy and merges it into
 * the local copy — mirrors the same offline-first pattern used for the rest
 * of the app in use-db-sync.ts (localStorage is the instant-UX source of
 * truth; Firestore is the durable, cross-device backup). Without this, a
 * user who switches devices or reinstalls sees their XP/level reset to zero
 * even though their profile data carries over, and re-triggers the
 * new-account welcome gift as if they were new — this fixes both.
 *
 * Merge is additive/max-based, never a blind overwrite: local completions
 * earned offline in this session are kept, remote completions from other
 * devices are added in, and XP takes whichever value is higher rather than
 * whichever was written most recently — so no real progress is ever lost
 * in either direction.
 */
export async function restoreRemoteGamificationData(): Promise<UserGamificationData> {
  const local = getLocalGamificationData();
  const user = firebaseAuth.currentUser;
  if (!user) return local;

  try {
    const db = getFirestore(firebaseApp);
    const snap = await getDoc(doc(db, "academy_leaderboard", user.uid));
    if (!snap.exists()) return local;

    const remote = snap.data() as Record<string, any>;
    const mergedCompletedLessons = Array.from(
      new Set([...(local.completedLessons || []), ...((remote.completedLessons as string[]) || [])])
    );
    const mergedCompletedQuizzes = Array.from(
      new Set([...(local.completedQuizzes || []), ...((remote.completedQuizzes as string[]) || [])])
    );
    const badgeMap = new Map<string, BadgeItem>();
    for (const b of local.badges || []) badgeMap.set(b.id, b);
    for (const b of (remote.badges as BadgeItem[]) || []) {
      if (!badgeMap.has(b.id)) badgeMap.set(b.id, b);
    }

    const mergedXp = Math.max(local.xp, (remote.xp as number) || 0);
    const { level, levelTitle } = calculateLevel(mergedXp);

    const merged: UserGamificationData = {
      xp: mergedXp,
      level,
      levelTitle,
      completedLessons: mergedCompletedLessons,
      completedQuizzes: mergedCompletedQuizzes,
      badges: Array.from(badgeMap.values()),
      notesCount: Math.max(local.notesCount, (remote.notesCount as number) || 0),
      updatedAt: Date.now(),
    };

    saveLocalGamificationData(merged);
    return merged;
  } catch (err) {
    console.warn("[Firestore] Could not restore academy progress, using local copy:", err);
    return local;
  }
}

// NOTE: previously this leaderboard merged real Firestore entries with a
// hardcoded list of fabricated "peer" accounts (made-up names, XP, and
// badge counts) so every real user's rank was partly computed against fake
// competitors. Removed — the leaderboard is now built entirely from real
// `academy_leaderboard` Firestore entries plus the current user.

/**
 * Fetches the community leaderboard, combining Firestore data and peer seeds.
 */
export async function getAcademyLeaderboard(currentUserName?: string, currentUserTier?: string): Promise<{ entries: LeaderboardEntry[]; userRank: number }> {
  const localData = getLocalGamificationData();
  const userName = currentUserName || "أنتِ (جميلة رَونق)";

  const currentUserEntry: LeaderboardEntry = {
    id: "current_user",
    name: `${userName} (أنتِ) ✨`,
    avatar: "🌸",
    xp: localData.xp,
    levelTitle: localData.levelTitle,
    badgesCount: localData.badges.length,
    completedCount: localData.completedLessons.length + localData.completedQuizzes.length,
    isCurrentUser: true,
    countryFlag: "👑",
    accountTier: currentUserTier || "standard",
  };

  const list: LeaderboardEntry[] = [];

  try {
    const db = getFirestore(firebaseApp);
    const q = query(collection(db, "academy_leaderboard"), orderBy("xp", "desc"), limit(25));
    const snap = await getDocs(q);

    snap.forEach((d) => {
      const data = d.data() as Record<string, any>;
      const user = firebaseAuth.currentUser;
      const isMe = d.id === "guest_user_local" || (user && d.id === user.uid);

      if (!isMe) {
        list.push({
          id: d.id,
          name: data.name || "عضوة بالأكاديمية",
          avatar: data.avatar || "✨",
          xp: data.xp || 0,
          levelTitle: data.levelTitle || "مبتدئة العناية",
          badgesCount: data.badgesCount || 0,
          completedCount: data.completedCount || 0,
          isCurrentUser: false,
        });
      }
    });
  } catch (err) {
    console.warn("[Firestore] Loading leaderboard from cached peers:", err);
  }

  // Always include current user
  list.push(currentUserEntry);

  // Sort descending by XP
  list.sort((a, b) => b.xp - a.xp);

  // Assign numeric ranks — meaningful only within this fetched top-25 slice.
  list.forEach((item, index) => {
    item.rank = index + 1;
  });

  // "ترتيبكِ الحاضر" needs to be the user's true global rank, not just her
  // position within the top-25 sample above (which would badly understate
  // her real rank, e.g. showing #26 for someone who's actually #340). We
  // get this with a server-side count of how many users outrank her by XP
  // — cheap (one aggregation query, no document reads) and accurate
  // regardless of how many users the leaderboard has.
  let userRank = list.find((i) => i.isCurrentUser)?.rank || 1;
  try {
    const db = getFirestore(firebaseApp);
    const higherXpQuery = query(collection(db, "academy_leaderboard"), where("xp", ">", localData.xp));
    const countSnap = await getCountFromServer(higherXpQuery);
    userRank = countSnap.data().count + 1;
  } catch (err) {
    console.warn("[Firestore] Could not compute true global rank, using top-25 estimate:", err);
  }

  return {
    entries: list,
    userRank,
  };
}
