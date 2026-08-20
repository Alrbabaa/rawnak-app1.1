import { getFirestore, doc, setDoc, getDoc, collection, getDocs, Timestamp } from "firebase/firestore";
import { firebaseApp, firebaseAuth } from "./client";
import { type AccountTier, getAccountTierMeta } from "@/lib/account-tiers";

export interface CommunityUser {
  id: string;
  name: string;
  email?: string;
  avatar: string;
  profileImage?: string | null;
  accountTier: AccountTier;
  bio: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  xp: number;
  levelTitle: string;
  countryFlag: string;
  verified: boolean;
  role?: string;
}

// NOTE: there is currently no real backend for a social follow-graph (no
// Firestore collection of real user-to-user follows, no directory of real
// public profiles to explore). Previously this list was filled with
// fabricated influencer/business profiles with made-up follower counts and
// XP, displayed as if they were real accounts — that was misleading and has
// been removed. getCommunityUsers() now returns real data only (i.e. none,
// until a real follow system is built). See followers-modal.tsx for the
// empty-state UI that now covers this honestly instead of showing fake
// people.
//
// UPDATE: the real follow system referenced above now exists, but lives
// entirely server-side under /api/social/* (search, follow, unfollow,
// profile/[uid], following, followers) — Admin SDK only, consistent with
// this app's "everything through our own API routes" architecture (see
// firestore.rules header). followers-modal.tsx and public-profile-modal.tsx
// call those routes directly via authedFetch and no longer use anything
// below this line for the follow/search feature.
//
// Everything below (getCommunityUsers, toggleFollowUserInList, the
// admin-tier-override helpers) remains ONLY because admin-tier-modal.tsx
// still imports getCommunityUsers/saveAdminTierOverride — that modal has
// its own separate, still-unfixed gap (PEER_COMMUNITY_USERS is empty, so
// it currently lists nobody) and a real replacement already exists at
// /api/admin/users + /api/admin/users/[id]/tier; pointing the admin modal
// at those is a good follow-up but is out of scope here.
const PEER_COMMUNITY_USERS: CommunityUser[] = [];

function getFollowKey(): string {
  const uid = firebaseAuth.currentUser?.uid;
  return uid ? `rawnak_followed_user_ids_v1_${uid}` : "rawnak_followed_user_ids_v1_guest";
}

function getAdminTierKey(): string {
  const uid = firebaseAuth.currentUser?.uid;
  return uid ? `rawnak_admin_user_tier_overrides_v1_${uid}` : "rawnak_admin_user_tier_overrides_v1_guest";
}

export function getFollowedUserIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getFollowKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFollowedUserIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getFollowKey(), JSON.stringify(ids));
  } catch (e) {
    console.warn("Failed saving follow list:", e);
  }
}

export function getAdminTierOverrides(): Record<string, AccountTier> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(getAdminTierKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAdminTierOverride(userId: string, tier: AccountTier): void {
  if (typeof window === "undefined") return;
  try {
    const current = getAdminTierOverrides();
    current[userId] = tier;
    localStorage.setItem(getAdminTierKey(), JSON.stringify(current));

    // Also attempt Firestore persistent update if online
    try {
      const db = getFirestore(firebaseApp);
      setDoc(doc(db, "community_user_tiers", userId), {
        userId,
        accountTier: tier,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch {}
  } catch (e) {
    console.warn("Failed saving admin tier override:", e);
  }
}

export async function getCommunityUsers(): Promise<CommunityUser[]> {
  const followed = getFollowedUserIds();
  const tierOverrides = getAdminTierOverrides();

  return PEER_COMMUNITY_USERS.map((user) => {
    const isFollowing = followed.includes(user.id);
    const tier = tierOverrides[user.id] || user.accountTier;
    const tierMeta = getAccountTierMeta(tier);

    return {
      ...user,
      accountTier: tier,
      isFollowing,
      verified: tierMeta.verifiedMark,
      followersCount: user.followersCount + (isFollowing ? 1 : 0),
    };
  });
}

export function toggleFollowUserInList(userId: string): { followed: boolean; updatedList: CommunityUser[] } {
  let followedIds = getFollowedUserIds();
  let isNowFollowing = false;

  if (followedIds.includes(userId)) {
    followedIds = followedIds.filter((id) => id !== userId);
    isNowFollowing = false;
  } else {
    followedIds.push(userId);
    isNowFollowing = true;
  }

  saveFollowedUserIds(followedIds);

  const tierOverrides = getAdminTierOverrides();
  const updatedList = PEER_COMMUNITY_USERS.map((user) => {
    const isFollowing = followedIds.includes(user.id);
    const tier = tierOverrides[user.id] || user.accountTier;
    const tierMeta = getAccountTierMeta(tier);

    return {
      ...user,
      accountTier: tier,
      isFollowing,
      verified: tierMeta.verifiedMark,
      followersCount: user.followersCount + (isFollowing ? 1 : 0),
    };
  });

  return {
    followed: isNowFollowing,
    updatedList,
  };
}
