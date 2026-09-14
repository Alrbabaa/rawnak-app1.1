"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Droplets, CloudSun, CalendarHeart, RefreshCw, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useAppStore } from "@/lib/store";
import { buildPersonalizationContext } from "@/lib/personalization";
import { isQuotaExceeded, describeQuotaError } from "@/lib/quota-error";
import type { WeatherNow } from "@/hooks/use-real-weather";
import { cn } from "@/lib/utils";

interface TodayResult {
  greeting: string;
  headline: string;
  priorityAction: { title: string; reason: string } | null;
  cabinetTip: string;
  routineNote: string;
  weatherNote: string;
  occasionNote: string;
}

const CACHE_KEY = "rawnak_today_cache_v1";

interface CachedToday {
  dateStr: string;
  data: TodayResult;
}

/**
 * "Rawnak Today" — the personalized daily brief (Rawnak 2.0, section 2).
 * Pulls together whatever real context the user actually has (profile,
 * latest analysis, cabinet, routine, an upcoming occasion, today's real
 * weather) via the shared personalization context builder and asks the
 * AI for the single most useful thing to focus on today.
 *
 * Cached per-day in localStorage so opening the home screen repeatedly
 * doesn't re-spend her daily AI quota — refreshes automatically once the
 * calendar day changes, or on demand via the refresh button.
 */
export function RawnakTodayCard({ weather }: { weather: WeatherNow | null }) {
  const { profile, analyses, cabinet, routine, streak, plans, academyHistory, isAuthed, isGuest, setView } =
    useAppStore();

  const todayStr = new Date().toDateString();

  const [data, setData] = useState<TodayResult | null>(() => {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const cached: CachedToday = JSON.parse(cachedStr);
        if (cached.dateStr === todayStr) return cached.data;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(() => isAuthed && !isGuest && data === null);
  const [error, setError] = useState(false);
  const [quotaMsg, setQuotaMsg] = useState<{ text: string; canUpgrade: boolean } | null>(null);

  useEffect(() => {
    if (!isAuthed || isGuest || data) return;
    let cancelled = false;
    (async () => {
      try {
        const context = buildPersonalizationContext(
          { profile, analyses, cabinet, routine, streak, plans, academyHistory },
          { weather }
        );
        const res = await authedFetch("/api/today", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          if (isQuotaExceeded(json)) {
            setQuotaMsg({ text: describeQuotaError(json), canUpgrade: !!json.upgradeRequired });
            return;
          }
          throw new Error(json.error || "خطأ");
        }
        setData(json);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ dateStr: todayStr, data: json } as CachedToday));
        } catch {}
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when auth state changes or we don't yet have today's
    // data — we intentionally don't want to re-fetch on every
    // profile/cabinet edit made elsewhere in the app.
  }, [isAuthed, isGuest, data]);

  const refresh = async () => {
    setLoading(true);
    try {
      const context = buildPersonalizationContext(
        { profile, analyses, cabinet, routine, streak, plans, academyHistory },
        { weather }
      );
      const res = await authedFetch("/api/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (isQuotaExceeded(json)) {
          setError(false);
          setQuotaMsg({ text: describeQuotaError(json), canUpgrade: !!json.upgradeRequired });
          return;
        }
        throw new Error(json.error || "خطأ");
      }
      setError(false);
      setQuotaMsg(null);
      setData(json);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ dateStr: todayStr, data: json } as CachedToday));
      } catch {}
    } catch {
      setError(true);
      setQuotaMsg(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthed || isGuest) return null;
  if (error && !data && !quotaMsg) return null; // fail quiet — the hero header above already greets her

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4 rounded-3xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-extrabold">رَونق اليوم</span>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="w-7 h-7 grid place-items-center rounded-full hover:bg-primary/10 text-muted-foreground disabled:opacity-50"
            aria-label="تحديث"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {loading && !data ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            رَونق تُجهّز ملخص يومكِ...
          </div>
        ) : quotaMsg ? (
          <div className="space-y-2 py-1">
            <p className="text-xs text-muted-foreground leading-relaxed">{quotaMsg.text}</p>
            {quotaMsg.canUpgrade && (
              <button
                onClick={() => setView("vip")}
                className="text-xs font-bold text-primary underline underline-offset-2"
              >
                عضوية VIP
              </button>
            )}
          </div>
        ) : data ? (
          <div className="space-y-2.5">
            <p className="text-sm font-bold leading-snug">{data.headline}</p>

            {data.priorityAction && (
              <div className="rounded-2xl bg-background/70 border border-border/60 p-3 space-y-1">
                <p className="text-xs font-extrabold text-primary">{data.priorityAction.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{data.priorityAction.reason}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {data.routineNote && (
                <div className="flex items-start gap-1.5 text-[11px] text-foreground/90">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{data.routineNote}</span>
                </div>
              )}
              {data.cabinetTip && (
                <div className="flex items-start gap-1.5 text-[11px] text-foreground/90">
                  <Droplets className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{data.cabinetTip}</span>
                </div>
              )}
              {data.weatherNote && (
                <div className="flex items-start gap-1.5 text-[11px] text-foreground/90">
                  <CloudSun className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{data.weatherNote}</span>
                </div>
              )}
              {data.occasionNote && (
                <div className="flex items-start gap-1.5 text-[11px] text-foreground/90">
                  <CalendarHeart className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{data.occasionNote}</span>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}
