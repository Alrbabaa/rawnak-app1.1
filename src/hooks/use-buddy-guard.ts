"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { todayKeyUTC, type BuddyStatus } from "@/lib/buddy";

// Distinct from MORNING_ID(1001)/EVENING_ID(1002)/STREAK_GUARD_ID(1003)/
// ANALYSIS_REMINDER_ID(1004) — see use-streak-guard.ts for why each nudge
// gets its own fixed id instead of sharing one.
const BUDDY_NUDGE_ID = 1005;
const NUDGE_HOUR = 20;
const NUDGE_MINUTE = 0;

/**
 * Two responsibilities, both scoped to "صديقة التوهج":
 *
 * 1. The moment her own routine hits 100% today, tell the server once
 *    (POST /api/buddy/checkin) — this is the only reason a completion
 *    date needs to exist server-side at all; see that route's own
 *    comment. A ref-guarded "once per calendar day" the same shape as
 *    every other reminder hook here prevents refiring on every re-render.
 *
 * 2. If she has an active buddy pairing, check once whether the buddy has
 *    done HER routine today, and — if not, and it's evening — schedule a
 *    single local notification nudging her to check in on her buddy. Only
 *    a boolean ever leaves the server for this (see src/lib/buddy.ts);
 *    this hook never learns anything else about the buddy.
 *
 * Web/PWA: step 1 still runs (it's a plain fetch, not a native call);
 * step 2's local notification is skipped, same as every other reminder
 * hook in this app.
 */
export function useBuddyGuard(enabled: boolean, progress: number, isAuthed: boolean) {
  const checkinArmedForRef = useRef<string | null>(null);
  const nudgeArmedForRef = useRef<string | null>(null);

  // 1. Server-side daily checkin, independent of native/web.
  useEffect(() => {
    if (!isAuthed || progress !== 100) return;
    const todayKey = todayKeyUTC();
    if (checkinArmedForRef.current === todayKey) return;
    checkinArmedForRef.current = todayKey;
    authedFetch("/api/buddy/checkin", { method: "POST" }).catch(() => {
      // Best-effort — if this fails, the local streak (the real source of
      // truth for her own experience) is completely unaffected, and it'll
      // just retry the next time progress recomputes to 100.
      checkinArmedForRef.current = null;
    });
  }, [isAuthed, progress]);

  // 2. Evening buddy-nudge, native only.
  useEffect(() => {
    if (!enabled || !isAuthed || !Capacitor.isNativePlatform()) return;

    const todayKey = todayKeyUTC();
    if (nudgeArmedForRef.current === todayKey) return;

    (async () => {
      let data: BuddyStatus;
      try {
        const res = await authedFetch("/api/buddy/status");
        if (!res.ok) return;
        data = await res.json();
      } catch {
        return;
      }

      if (!data.hasBuddy || !data.pairPredatesToday || data.buddyDoneToday) {
        await LocalNotifications.cancel({ notifications: [{ id: BUDDY_NUDGE_ID }] }).catch(() => {});
        nudgeArmedForRef.current = todayKey;
        return;
      }

      const target = new Date();
      target.setHours(NUDGE_HOUR, NUDGE_MINUTE, 0, 0);
      if (target.getTime() <= Date.now()) {
        nudgeArmedForRef.current = todayKey;
        return;
      }

      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: BUDDY_NUDGE_ID,
            title: "صديقة التوهج ✦",
            body: `${data.buddyName} ما سوّت روتينها اليوم بعد — ذكّريها ✦`,
            schedule: { at: target, allowWhileIdle: true },
          },
        ],
      }).catch(() => {});
      nudgeArmedForRef.current = todayKey;
    })();
  }, [enabled, isAuthed, progress]);
}
