"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Fixed IDs so re-scheduling (e.g. app restart) replaces the same two
// notifications instead of piling up duplicates.
const MORNING_ID = 1001;
const EVENING_ID = 1002;

/**
 * Opt-in daily reminders — "رَونق تفتقدكِ", not "come back now". Purely
 * local (@capacitor/local-notifications): scheduled on-device, fires even
 * if the app is fully closed, and needs zero server/Firebase/APNs
 * infrastructure. That's the tradeoff: reliable and simple, but the copy
 * can't reflect real-time state (e.g. "you already did your routine") since
 * nothing runs server-side to check that.
 *
 * No-op on web/PWA (the plugin's calls simply resolve to nothing there).
 */
export function useRoutineReminders(enabled: boolean) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      if (!enabled) {
        await LocalNotifications.cancel({ notifications: [{ id: MORNING_ID }, { id: EVENING_ID }] }).catch(
          () => {}
        );
        return;
      }

      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return; // she said no — respect it, don't schedule
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: MORNING_ID,
            title: "صباح الإشراق ✦",
            body: "رَونق بانتظاركِ — وقت روتينكِ الصباحي",
            schedule: { on: { hour: 9, minute: 0 }, allowWhileIdle: true },
          },
          {
            id: EVENING_ID,
            title: "مساء العناية ✦",
            body: "لا تنسي روتينكِ المسائي الليلة، بشرتكِ تستحق",
            schedule: { on: { hour: 21, minute: 0 }, allowWhileIdle: true },
          },
        ],
      });
    })();
  }, [enabled]);
}
