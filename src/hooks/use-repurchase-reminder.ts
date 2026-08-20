"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { monthsBetween } from "@/lib/data";
import type { CabinetProduct } from "@/lib/store";

// Distinct from MORNING_ID(1001)/EVENING_ID(1002)/STREAK_GUARD_ID(1003)/
// ANALYSIS_REMINDER_ID(1004).
const REPURCHASE_ID = 1005;
const NUDGE_WHEN_DAYS_LEFT = 10;
const REMINDER_HOUR = 12;
const REMINDER_MINUTE = 0;

/**
 * "This is about to run out — repurchase it" nudge for the cabinet product
 * closest to the end of its shelf life (see monthsBetween in data.ts). Two
 * things this buys at once: a genuine reason to reopen the app (loss
 * aversion — don't run out), and a purchase-intent moment that lands on a
 * partner link when the product has one (source: "picks", see
 * CabinetProduct.purchaseUrl) — the same commission opportunity as any
 * other partner click, just triggered by an actual need instead of
 * browsing.
 *
 * Only ever nudges about ONE product at a time (whichever is soonest) —
 * "3 things are expiring" is overwhelming and dilutes urgency; the person
 * can see the rest grouped in the cabinet screen itself once she opens it.
 *
 * One-shot per product per shelf-life cycle, id-deduped so re-evaluating
 * (app reopen, cabinet edit) doesn't pile up duplicate notifications —
 * re-arms automatically once she marks a replacement as newly opened
 * (that resets openedAt, so monthsBetween starts counting fresh).
 *
 * No-op on web/PWA, same as the other reminder hooks.
 */
export function useRepurchaseReminder(enabled: boolean, cabinet: CabinetProduct[]) {
  const armedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      // Soonest-to-expire product currently inside the nudge window —
      // already-expired ones are the cabinet screen's job to surface
      // (badge/section), not a fresh notification for something overdue.
      const candidates = cabinet
        .map((p) => ({ p, daysLeft: monthsBetween(p.openedAt, p.shelfLifeMonths) }))
        .filter((c): c is { p: CabinetProduct; daysLeft: number } => c.daysLeft !== null)
        .filter((c) => c.daysLeft >= 0 && c.daysLeft <= NUDGE_WHEN_DAYS_LEFT)
        .sort((a, b) => a.daysLeft - b.daysLeft);

      const target = candidates[0];
      const armKey = target ? `${target.p.id}:${target.p.openedAt}` : null;

      if (!enabled || !target) {
        await LocalNotifications.cancel({ notifications: [{ id: REPURCHASE_ID }] }).catch(() => {});
        armedForRef.current = null;
        return;
      }

      if (armedForRef.current === armKey) return; // already scheduled for this product+opening

      const notifyAt = new Date();
      notifyAt.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
      if (notifyAt.getTime() <= Date.now()) {
        notifyAt.setDate(notifyAt.getDate() + 1);
      }

      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return; // she said no — respect it
      }

      const body =
        target.daysLeft === 0
          ? `${target.p.name} على وشك الانتهاء اليوم — الوقت المناسب لإعادة شرائه`
          : `${target.p.name} راح ينتهي خلال ${target.daysLeft} ${target.daysLeft === 1 ? "يوم" : "أيام"} — أعيدي شرائه قبل ما يخلص`;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: REPURCHASE_ID,
            title: "وقت تجديد خزانتكِ ✦",
            body,
            schedule: { at: notifyAt, allowWhileIdle: true },
            extra: target.p.purchaseUrl ? { purchaseUrl: target.p.purchaseUrl } : undefined,
          },
        ],
      }).catch(() => {});
      armedForRef.current = armKey;
    })();
  }, [enabled, cabinet]);
}
