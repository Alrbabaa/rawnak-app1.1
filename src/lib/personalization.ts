/**
 * Rawnak Personalization Context — the single, shared shape every
 * personalized AI feature (Rawnak Today, Occasion Planner, Weather Tips,
 * Recommendations, and any future feature) sends to the server.
 *
 * Design intent (Rawnak 2.0):
 *   - ONE reusable builder instead of each screen hand-assembling its own
 *     slice of `profile`/`cabinet`/`routine` fields in a slightly
 *     different shape every time.
 *   - Every section is OPTIONAL — a field is included only when it
 *     actually exists on the user (no fabricated defaults), so the server
 *     formatter (src/lib/ai/personalization-context.ts) can build a
 *     prompt that only mentions real context.
 *   - This is a plain data shape (no React), so both client screens and
 *     (via the same TypeScript types) the server routes agree on it.
 */

import type { AppState } from "@/lib/store";
import { computeVipAccess } from "@/lib/vip-access";
import type { WeatherNow } from "@/hooks/use-real-weather";

export interface PersonalizationContext {
  profile: {
    age: number | null;
    skinType: string | null;
    skinTone: string | null;
    concerns: string[];
    goals: string[];
    makeupLevel: string | null;
    lifestyle: string[];
  };
  latestAnalysis: {
    ts: number;
    overall: number;
    skinType: string;
    metrics: Record<string, number>;
    summary: string;
  } | null;
  cabinet: {
    total: number;
    // Capped, most-relevant-first (favorites, then most recently used) —
    // never the full raw cabinet dump into the prompt.
    products: { name: string; category: string; favorite: boolean }[];
  } | null;
  routine: {
    morningPending: string[];
    eveningPending: string[];
    streak: number;
  } | null;
  upcomingOccasion: {
    occasion: string;
    occasionLabel: string;
    daysUntil?: number;
  } | null;
  weather: { tempC: number; label: string } | null;
  vip: {
    isVip: boolean;
    onTrial: boolean;
  };
  history: {
    // Real, lightweight signals only — never fabricated engagement data.
    recentlyWatchedCount: number;
    hasPastPlans: boolean;
  };
}

const SKIN_TYPE_AR: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

/** Builds the shared context from live app state. Everything is optional
 * and only populated when the user actually has that data — no invented
 * values, ever (see rule 13 of the Rawnak 2.0 spec). */
export function buildPersonalizationContext(
  state: Pick<
    AppState,
    "profile" | "analyses" | "cabinet" | "routine" | "streak" | "plans" | "academyHistory"
  >,
  extras?: { weather?: WeatherNow | null }
): PersonalizationContext {
  const { profile, analyses, cabinet, routine, streak, plans, academyHistory } = state;

  const latest = analyses?.[0] ?? null;

  const sortedCabinet = [...(cabinet || [])].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return (b.lastUsedAt || b.addedAt) - (a.lastUsedAt || a.addedAt);
  });

  const now = Date.now();
  const upcomingPlan = [...(plans || [])]
    .filter((p) => p.date >= now - 24 * 60 * 60 * 1000)
    .sort((a, b) => a.date - b.date)[0];

  return {
    profile: {
      age: profile.age ?? null,
      skinType: profile.skinType ? SKIN_TYPE_AR[profile.skinType] || profile.skinType : null,
      skinTone: profile.skinTone,
      concerns: profile.concerns || [],
      goals: profile.goals || [],
      makeupLevel: profile.makeupLevel,
      lifestyle: profile.lifestyle || [],
    },
    latestAnalysis: latest
      ? {
          ts: latest.ts,
          overall: latest.overall,
          skinType: latest.skinType,
          metrics: latest.metrics as unknown as Record<string, number>,
          summary: latest.summary,
        }
      : null,
    cabinet:
      sortedCabinet.length > 0
        ? {
            total: sortedCabinet.length,
            products: sortedCabinet.slice(0, 12).map((p) => ({
              name: p.name,
              category: p.subCategory || p.category,
              favorite: p.favorite,
            })),
          }
        : null,
    routine:
      routine && routine.length > 0
        ? {
            morningPending: routine.filter((r) => r.time === "morning" && !r.done).map((r) => r.name),
            eveningPending: routine.filter((r) => r.time === "evening" && !r.done).map((r) => r.name),
            streak: streak || 0,
          }
        : null,
    upcomingOccasion: upcomingPlan
      ? {
          occasion: upcomingPlan.occasion,
          occasionLabel: upcomingPlan.occasionLabel,
          daysUntil: Math.max(0, Math.round((upcomingPlan.date - now) / (24 * 60 * 60 * 1000))),
        }
      : null,
    weather: extras?.weather ? { tempC: extras.weather.tempC, label: extras.weather.label } : null,
    vip: {
      isVip: computeVipAccess(profile.isPremium, profile.subscriptionExpiresAt, profile.vipTrialExpiresAt),
      onTrial: !profile.isPremium && !!profile.vipTrialExpiresAt && profile.vipTrialExpiresAt > now,
    },
    history: {
      recentlyWatchedCount: (academyHistory || []).length,
      hasPastPlans: (plans || []).length > 0,
    },
  };
}
