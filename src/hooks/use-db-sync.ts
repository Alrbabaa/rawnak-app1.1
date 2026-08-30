"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { restoreRemoteGamificationData } from "@/lib/firebase/gamification-service";

/**
 * Syncs the user's data to Firestore (via the authed API routes in
 * /api/db/user and /api/db/sync, which use the Firebase Admin SDK).
 * - On login/onboarding complete: loads any persisted data from the server.
 * - Debounced auto-sync on changes to analyses, cabinet, academyFavorites, achievements.
 * - Offline-first: localStorage stays the source of truth for instant UX;
 *   Firestore is the durable production backup + enables cross-device.
 */
export function useDbSync() {
  const isAuthed = useAppStore((s) => s.isAuthed);
  const isGuest = useAppStore((s) => s.isGuest);
  const authUid = useAppStore((s) => s.authUid);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const profile = useAppStore((s) => s.profile);
  const analyses = useAppStore((s) => s.analyses);
  const cabinet = useAppStore((s) => s.cabinet);
  const academyFavorites = useAppStore((s) => s.academyFavorites);
  const achievements = useAppStore((s) => s.achievements);
  const plans = useAppStore((s) => s.plans);
  const chatMessages = useAppStore((s) => s.chatMessages);
  const streak = useAppStore((s) => s.streak);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const addAnalysis = useAppStore((s) => s.addAnalysis);
  const updateAnalysisImage = useAppStore((s) => s.updateAnalysisImage);
  const addCabinetProduct = useAppStore((s) => s.addCabinetProduct);
  const toggleAcademyFavorite = useAppStore((s) => s.toggleAcademyFavorite);
  const unlockAchievement = useAppStore((s) => s.unlockAchievement);
  const addPlan = useAppStore((s) => s.addPlan);
  const addChatMessage = useAppStore((s) => s.addChatMessage);

  const loadedRef = useRef(false);
  const email = profile.email;

  // The hook stays mounted while accounts can change on the same device.
  // Reset both the load guard and the entitlement-resolution marker for
  // every identity transition so User B can never inherit User A's state.
  useEffect(() => {
    loadedRef.current = false;
    useAppStore.setState({ subscriptionResolvedUid: null });
  }, [authUid]);

  // Load persisted data once when authed
  useEffect(() => {
    if (!isAuthed || isGuest || !email || loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        // Update profile — identified by the Firebase ID token, not this email
        await authedFetch("/api/db/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: profile.name, profile }),
        });

        // Load persisted data — same, token-identified
        const res = await authedFetch("/api/db/sync");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.user) return;

        // Merge profile from server (if client profile is incomplete)
        const serverProfile = data.user;
        // name/avatar: restore from server when the local value is empty —
        // this branch previously didn't exist at all (name/avatar were
        // fetched from the server in this same response but never applied
        // client-side). That was always a latent gap; it only became
        // consequential once logout()/login() started correctly resetting
        // the local profile to empty on every sign-in (see
        // resetUserDataState() in store.ts) instead of leaking whatever the
        // previous account's session had left behind — without this, a
        // returning user would see a blank name/avatar until they manually
        // re-entered it, every single time they signed in.
        if (
          (!profile.name && serverProfile.name) ||
          (!profile.avatar && serverProfile.avatar)
        ) {
          updateProfile({
            name: profile.name || serverProfile.name || "",
            avatar: profile.avatar || serverProfile.avatar || "",
          });
        }
        if (
          serverProfile.skinType ||
          serverProfile.skinTone ||
          serverProfile.age ||
          serverProfile.hasOnboarded
        ) {
          updateProfile({
            skinType: (profile.skinType || serverProfile.skinType) as never,
            skinTone: (profile.skinTone || serverProfile.skinTone) as never,
            age: profile.age ?? serverProfile.age ?? null,
            concerns: profile.concerns?.length ? profile.concerns : (serverProfile.concerns || []),
            goals: profile.goals?.length ? profile.goals : (serverProfile.goals || []),
            makeupLevel: (profile.makeupLevel || serverProfile.makeupLevel) as never,
            lifestyle: profile.lifestyle?.length ? profile.lifestyle : (serverProfile.lifestyle || []),
          });
          if (serverProfile.hasOnboarded || serverProfile.skinType || serverProfile.age) {
            useAppStore.setState({ hasOnboarded: true });
          }
        }
        if (
          (!profile.socialInstagram && serverProfile.socialInstagram) ||
          (!profile.socialTiktok && serverProfile.socialTiktok)
        ) {
          updateProfile({
            socialInstagram: serverProfile.socialInstagram ?? profile.socialInstagram,
            socialTiktok: serverProfile.socialTiktok ?? profile.socialTiktok,
          });
        }
        // socialDiscoverable is a settings toggle, not user-authored
        // content — always take the server's value like accountTier
        // below, rather than only filling in when empty.
        if (typeof serverProfile.socialDiscoverable === "boolean") {
          updateProfile({ socialDiscoverable: serverProfile.socialDiscoverable });
        }
        if (!profile.bio && serverProfile.bio) {
          updateProfile({ bio: serverProfile.bio });
        }

        // Subscription state is billing truth, written only by the
        // RevenueCat webhook server-side — always take the server's value,
        // unlike the fields above which are locally-editable-until-synced.
        updateProfile({
          isPremium: !!serverProfile.isPremium,
          subscriptionExpiresAt: serverProfile.subscriptionExpiresAt ?? null,
          subscriptionProductId: serverProfile.subscriptionProductId ?? null,
        });

        // Referral VIP trial — same always-trust-server rule (written only
        // by /api/auth/complete-signup).
        updateProfile({
          vipTrialExpiresAt: serverProfile.vipTrialExpiresAt ?? null,
        });
        useAppStore.setState({ subscriptionResolvedUid: authUid });

        // Account tier badge (standard/active/featured/vip/influencer/
        // business) — same always-trust-server rule: it's only ever
        // written by an admin via /api/admin/users/[id]/tier, never by the
        // user's own self-service profile save, so the server value is
        // always authoritative here.
        updateProfile({
          accountTier: (serverProfile.accountTier ?? "standard") as never,
        });

        // Followers/following counts — always incremented server-side by
        // /api/social/follow and /api/social/unfollow (never by the client
        // directly), so trust the server the same way as accountTier
        // above. Streak is likewise server-authoritative for the "Streak
        // Story" shown to followers on the public profile (see
        // /api/social/profile/[uid]) — restoring it here just keeps this
        // device's own display in sync with what she already had.
        updateProfile({
          followersCount: serverProfile.followersCount ?? 0,
          followingCount: serverProfile.followingCount ?? 0,
        });
        if (typeof serverProfile.streak === "number" && serverProfile.streak > useAppStore.getState().streak) {
          useAppStore.setState({ streak: serverProfile.streak });
        }

        // Peer referral state — same server-truth pattern (written only by
        // /api/auth/complete-signup and /api/db/sync's own backfill).
        updateProfile({
          referralCode: serverProfile.referralCode ?? null,
          referralInvitesCount: serverProfile.referralInvitesCount ?? 0,
          referralRewardUnlockedAt: serverProfile.referralRewardUnlockedAt ?? null,
          cabinetAiScanUsed: serverProfile.cabinetAiScanUsed ?? 0,
        });
        if (serverProfile.referralRewardUnlockedAt) {
          unlockAchievement("circle-of-glow");
        }

        // Merge analyses: add ones not seen locally at all, and backfill
        // the image for ones that ARE known locally but have no image —
        // this is the normal case right after a fresh app load, since
        // imageData is deliberately stripped before writing to localStorage
        // (see partialize in store.ts) and only lives in memory for the
        // current session plus here, in the server's hosted copy.
        if (data.analyses && data.analyses.length > 0) {
          const localById = new Map(analyses.map((a) => [a.id, a]));
          for (const a of data.analyses) {
            const local = localById.get(a.id);
            if (!local) {
              addAnalysis(a);
            } else if (!local.imageData && a.imageData) {
              updateAnalysisImage(a.id, a.imageData);
            }
          }
        }

        // Merge cabinet (only add ones not already local by name)
        if (data.cabinet && data.cabinet.length > 0) {
          const localNames = new Set(cabinet.map((c) => c.name));
          for (const p of data.cabinet) {
            if (!localNames.has(p.name)) {
              addCabinetProduct(p);
            }
          }
        }

        // Merge academy favorites
        if (data.academyFavorites) {
          for (const vid of data.academyFavorites) {
            if (!academyFavorites.includes(vid)) {
              toggleAcademyFavorite(vid);
            }
          }
        }

        // Merge achievements
        if (data.achievements) {
          for (const aid of data.achievements) {
            unlockAchievement(aid);
          }
        }

        // Merge plans (only add ones not already in local, same pattern as analyses)
        if (data.plans && data.plans.length > 0) {
          const localIds = new Set(plans.map((p) => p.id));
          for (const p of data.plans) {
            if (!localIds.has(p.id)) {
              addPlan(p);
            }
          }
        }

        // Chat history: only load from the server if this device's local
        // history is empty (fresh install / new device) — never silently
        // overwrite an in-progress local conversation. If both are
        // non-empty, the local one wins and the debounced sync below will
        // push it up, overwriting the server copy — a deliberate
        // last-write-wins choice, same simplicity used elsewhere in this
        // project rather than building real conflict resolution for a
        // single-document chat log.
        if (chatMessages.length === 0 && data.chatMessages && data.chatMessages.length > 0) {
          for (const m of data.chatMessages) {
            addChatMessage(m);
          }
        }

        // Academy XP/level/badges/completed-lessons — same cross-device
        // restore treatment as the profile data above, instead of staying
        // device-local only (see restoreRemoteGamificationData for the
        // merge rules).
        await restoreRemoteGamificationData();
      } catch {
        // Silent — offline-first, will sync later
      }
    })();
  }, [isAuthed, isGuest, email, authUid]);

  // Debounced auto-sync on data changes
  useEffect(() => {
    if (!isAuthed || isGuest || !email || !hasOnboarded) return;
    const t = setTimeout(() => {
      const unlocked = achievements.filter((a) => a.unlocked).map((a) => a.id);
      authedFetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyses: analyses.map((a) => ({
            id: a.id,
            overall: a.overall,
            metrics: a.metrics,
            skinType: a.skinType,
            summary: a.summary,
            recommendations: a.recommendations,
            imageData: a.imageData,
            ts: a.ts,
          })),
          cabinet: cabinet.map((p) => ({
            name: p.name,
            brand: p.brand,
            category: p.category,
            subCategory: p.subCategory,
            openedAt: p.openedAt,
            shelfLifeMonths: p.shelfLifeMonths,
            rating: p.rating,
            notes: p.notes,
            favorite: p.favorite,
            useCount: p.useCount,
            lastUsedAt: p.lastUsedAt,
            price: p.price,
            purchaseUrl: p.purchaseUrl,
            source: p.source,
          })),
          academyFavorites,
          achievements: unlocked,
          plans: plans.map((p) => ({
            occasion: p.occasion,
            occasionLabel: p.occasionLabel,
            date: p.date,
            steps: p.steps,
            products: p.products,
            duration: p.duration,
            tips: p.tips,
            createdAt: p.createdAt,
          })),
          chatMessages: chatMessages.map((m) => ({ id: m.id, role: m.role, content: m.content, ts: m.ts })),
          streak,
        }),
      }).catch(() => {
        // Silent — will retry on next change
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [
    isAuthed,
    email,
    hasOnboarded,
    analyses,
    cabinet,
    academyFavorites,
    achievements,
    plans,
    chatMessages,
    streak,
  ]);
}
