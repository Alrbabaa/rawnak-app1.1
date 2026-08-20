"use client";

import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Users,
  ScanFace,
  Sparkles,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AnalyticsData,
  eventLabel,
  formatShortDate,
  formatDate,
  RecentActivity,
} from "@/components/admin/admin-types";

interface OverviewPanelProps {
  email: string;
}

const STAT_CARDS = [
  {
    key: "totalUsers" as const,
    label: "إجمالي المستخدمون",
    icon: Users,
    accent: "rawnak-rosegold-gradient",
  },
  {
    key: "activeToday" as const,
    label: "نشط اليوم",
    icon: Activity,
    accent: "rawnak-rose-gradient",
  },
  {
    key: "totalAnalyses" as const,
    label: "تحليلات البشرة",
    icon: ScanFace,
    accent: "rawnak-gradient",
  },
  {
    key: "totalPicks" as const,
    label: "منتجات الخزانة",
    icon: Sparkles,
    accent: "rawnak-rosegold-gradient",
  },
];

export function OverviewPanel({ email }: OverviewPanelProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await authedFetch("/api/admin/analytics");
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || "تعذّر تحميل البيانات");
        }
        const json = (await res.json()) as AnalyticsData;
        if (active) setData(json);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "خطأ");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="glass-card rounded-2xl">
        <CardContent className="py-10 text-center text-muted-foreground">
          {error || "لا توجد بيانات"}
        </CardContent>
      </Card>
    );
  }

  const maxNew = Math.max(1, ...data.charts.dailyNewUsers.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold rawnak-gold-text">نظرة عامة</h2>
        <p className="text-sm text-muted-foreground mt-1">
          ملخّص سريع لأداء منصة رَونق
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STAT_CARDS.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-card rounded-2xl overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl sm:text-3xl font-bold rawnak-gold-text">
                        {data.metrics[stat.key].toLocaleString("ar-EG")}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        stat.accent
                      )}
                    >
                      <Icon className="w-5 h-5 text-black" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent activities */}
        <Card className="glass-card rounded-2xl lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-primary" />
              آخر النشاطات
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-96 overflow-y-auto pretty-scroll space-y-2">
              {data.recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  لا توجد نشاطات بعد
                </p>
              ) : (
                data.recentActivities.map((a: RecentActivity) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg rawnak-gradient flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold">
                          {(a.email || "U").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {eventLabel(a.event)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate" dir="ltr">
                          {a.email || "—"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Daily new users mini bar chart */}
        <Card className="glass-card rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" />
              المستخدمون الجدد (٧ أيام)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between gap-2 h-44">
              {data.charts.dailyNewUsers.map((d, i) => {
                const h = Math.max(4, (d.count / maxNew) * 100);
                return (
                  <motion.div
                    key={d.date}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    className="flex-1 flex flex-col items-center gap-1.5 group"
                  >
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {d.count > 0 ? d.count : ""}
                    </span>
                    <div className="w-full rawnak-rosegold-gradient rounded-t-md min-h-[4px] group-hover:opacity-90 transition-opacity" />
                    <span className="text-[9px] text-muted-foreground/70">
                      {formatShortDate(d.date)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active users count row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "نشط اليوم", value: data.metrics.activeToday },
          { label: "نشط هذا الأسبوع", value: data.metrics.activeWeek },
          { label: "نشط هذا الشهر", value: data.metrics.activeMonth },
        ].map((m) => (
          <Card key={m.label} className="glass-card rounded-2xl">
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold rawnak-gold-text">
                {m.value.toLocaleString("ar-EG")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
