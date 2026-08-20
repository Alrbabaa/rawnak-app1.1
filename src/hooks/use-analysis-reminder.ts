"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Distinct from MORNING_ID(1001)/EVENING_ID(1002) in use-routine-reminders.ts
// and STREAK_GUARD_ID(1003) in use-streak-guard.ts.
const ANALYSIS_REMINDER_ID = 1004;
const REMINDER_AFTER_DAYS = 14;
const REMINDER_HOUR = 11;
const REMINDER_MINUTE = 0;

/**
 * "Come see your progress" nudge, timed off the user's own last analysis
 * rather than a fixed daily schedule — the whole point is that it reads as
 * earned insight ("it's been a couple weeks, see how far you've come"),
 * not a generic re-engagement ping. This is what actually brings someone
 * back to the app's core differentiator (AI skin analysis, see
 * deriveProfileUpdateFromAnalysis in store.ts for why every fresh analysis
 * matters beyond that one session) instead of just the routine checklist.
 *
 * One-shot, scheduled REMINDER_AFTER_DAYS after `lastAnalysisTs` — fires
 * once, doesn't repeat, and gets silently rescheduled (same notification
 * id, so no duplicates) the moment a new analysis comes in, since that
 * resets the clock. No analysis yet → nothing scheduled; the home page
 * teaser already covers first-time prompting.
 *
 * No-op on web/PWA, same as the other two reminder hooks.
 */
export function useAnalysisReminder(enabled: boolean, lastAnalysisTs: number | null) {
  const armedForRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      if (!enabled || !lastAnalysisTs) {
        await LocalNotifications.cancel({ notifications: [{ id: ANALYSIS_REMINDER_ID }] }).catch(() => {});
        armedForRef.current = null;
        return;
      }

      if (armedForRef.current === lastAnalysisTs) return; // already scheduled off this analysis

      const target = new Date(lastAnalysisTs + REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);
      target.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);

      if (target.getTime() <= Date.now()) {
        // Already more than REMINDER_AFTER_DAYS since the last analysis —
        // nothing to schedule (would fire immediately/in the past); the
        // streak guard and routine reminders already keep her engaged
        // day-to-day regardless.
        armedForRef.current = lastAnalysisTs;
        return;
      }

      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return; // she said no — respect it
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: ANALYSIS_REMINDER_ID,
            title: "شو أخبار بشرتكِ؟ ✦",
            body: "مرّ أسبوعان — حلّلي بشرتكِ الآن وشوفي تقدّمكِ منذ آخر مرة",
            schedule: { at: target, allowWhileIdle: true },
          },
        ],
      }).catch(() => {});
      armedForRef.current = lastAnalysisTs;
    })();
  }, [enabled, lastAnalysisTs]);
}
