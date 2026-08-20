"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/firebase/authed-fetch";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/**
 * Real, DB-backed notification center. Fetches on mount and whenever
 * `refreshKey` changes (bump it after an action that might create a new
 * notification, e.g. an achievement unlock).
 */
export function useNotificationCenter(enabled: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await authedFetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      // Silent — this is a nice-to-have panel, not a critical flow.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await authedFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markRead: true }),
      });
    } catch {
      // Optimistic update already applied — a failed markRead just means
      // it'll show as unread again next fetch, not a broken state.
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, loading, unreadCount, reload: load, markAllRead };
}

/** Fire-and-forget: create a notification for the current session's user.
 * Never throws — a failed notification write shouldn't break whatever
 * triggered it (an achievement unlock, etc.). */
export async function createNotification(input: { type: string; title: string; body?: string }) {
  try {
    await authedFetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // ignore
  }
}
