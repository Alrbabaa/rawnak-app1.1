"use client";

import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  ScanFace,
  Sparkles,
  Video,
  Newspaper,
  Loader2,
  TrendingUp,
  BarChart3,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  AnalyticsData,
  eventLabel,
  formatShortDate,
  formatDate,
  RecentActivity,
} from "@/components/admin/admin-types";

interface AnalyticsPanelProps {
  email: string;
}

const METRIC_CARDS = [
  { key: "totalUsers" as const, label: "إجمالي المستخدمين", icon: Users },
  { key: "activeToday" as const, label: "نشط اليوم", icon: Activity },
  { key: "activeWeek" as const, label: "نشط الأسبوع", icon: TrendingUp },
  { key: "activeMonth" as const, label: "نشط الشهر", icon: Activity },
  { key: "totalAnalyses" as const, label: "تحليلات البشرة", icon: ScanFace },
  { key: "totalCabinet" as const, label: "منتجات الخزانة", icon: Package },
  { key: "totalPicks" as const, label: "اختيارات رَونق", icon: Sparkles },
  { key: "totalVideos" as const, label: "فيديوهات الأكاديمية", icon: Video },
  { key: "totalArticles" as const, label: "المقالات", icon: Newspaper },
];

export function AnalyticsPanel({ email }: AnalyticsPanelProps) {
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
          throw new Error(j?.error || "تعذّر التحميل");
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
  const maxEvents = Math.max(1, ...data.charts.topEvents.map((e) => e.count));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold rawnak-gold-text">التحليلات</h2>
        <p className="text-sm text-muted-foreground mt-1">
          إحصائيات شاملة عن الاستخدام والمحتوى
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {METRIC_CARDS.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="glass-card rounded-2xl">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-2xl font-bold rawnak-gold-text">
                      {data.metrics[m.key].toLocaleString("ar-EG")}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl rawnak-gradient flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily new users */}
        <Card className="glass-card rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" />
              مستخدمون جدد (آخر ٧ أيام)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between gap-2 h-52">
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

        {/* Top events */}
        <Card className="glass-card rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              أكثر الميزات استخدامًا
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.charts.topEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                لا توجد بيانات بعد
              </p>
            ) : (
              <div className="space-y-3">
                {data.charts.topEvents.map((e, i) => {
                  const w = Math.max(6, (e.count / maxEvents) * 100);
                  return (
                    <motion.div
                      key={e.event}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{eventLabel(e.event)}</span>
                        <span className="text-muted-foreground">{e.count}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-accent/40 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${w}%` }}
                          transition={{ delay: i * 0.05, duration: 0.5 }}
                          className={cn(
                            "h-full rounded-full",
                            i === 0
                              ? "rawnak-rosegold-gradient"
                              : "rawnak-gradient"
                          )}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activities table */}
      <Card className="glass-card rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            آخر النشاطات (آخر ٢٠)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-96 overflow-y-auto pretty-scroll">
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                لا توجد نشاطات بعد
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-right">الحدث</TableHead>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">الوقت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentActivities.map((a: RecentActivity) => (
                    <TableRow key={a.id} className="border-border/40">
                      <TableCell>
                        <Badge variant="secondary" className="rounded-md">
                          {eventLabel(a.event)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs" dir="ltr">
                        {a.email}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {formatDate(a.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
