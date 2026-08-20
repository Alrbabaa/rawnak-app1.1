"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Separate ID from MORNING_ID(1001)/EVENING_ID(1002) in
// use-routine-reminders.ts — this is a distinct, state-aware notification,
// not a third fixed-schedule reminder.
const STREAK_GUARD_ID = 1003;
const REMINDER_HOUR = 21;
const REMINDER_MINUTE = 30;

/**
 * "Your streak is about to end" nudge — a single well-timed loss-aversion
 * reminder tends to bring people back far more reliably than a generic
 * daily ping, which is why this is worth its own hook rather than folding
 * into use-routine-reminders.ts's fixed schedule.
 *
 * The key difference from that hook: this one is state-aware. It's a
 * one-shot (schedule.at a specific Date, not a repeating daily schedule)
 * that gets silently cancelled the moment today's routine is actually
 * complete, and freshly re-armed each day it isn't — a repeating schedule
 * can only be fully on or off, it can't be "relevant today but not
 * tomorrow" without something evaluating it fresh, which is what this
 * effect does every time progress/streak/enabled change.
 *
 * No-op on web/PWA, same as use-routine-reminders.ts.
 */
export function useStreakGuard(enabled: boolean, progress: number, streak: number) {
  // Tracks which calendar day we've already scheduled (or deliberately
  // skipped) for, so re-renders within the same day don't keep re-issuing
  // native scheduling calls.
  const armedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const todayKey = new Date().toDateString();

    (async () => {
      if (!enabled || progress === 100) {
        // Reminders are off, or she's already done for today — nothing to
        // protect right now.
        await LocalNotifications.cancel({ notifications: [{ id: STREAK_GUARD_ID }] }).catch(() => {});
        armedForRef.current = null;
        return;
      }

      if (armedForRef.current === todayKey) return; // already handled today

      const target = new Date();
      target.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
      if (target.getTime() <= Date.now()) {
        // Past tonight's reminder time already — nothing to schedule until
        // tomorrow re-evaluates this.
        armedForRef.current = todayKey;
        return;
      }

      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return; // she said no — respect it
      }

      const body =
        streak > 0
          ? `سلسلتكِ ${streak} ${streak === 1 ? "يوم" : "أيام"} على وشك الانتهاء — روتين الليلة يحفظها ✦`
          : "خصصي دقيقتين لروتينكِ الليلة وابدئي سلسلة توهجكِ ✦";

      await LocalNotifications.schedule({
        notifications: [
          {
            id: STREAK_GUARD_ID,
            title: "لا تفوّتي الليلة ✦",
            body,
            schedule: { at: target, allowWhileIdle: true },
          },
        ],
      }).catch(() => {});
      armedForRef.current = todayKey;
    })();
  }, [enabled, progress, streak]);
}
