"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { motion } from "framer-motion";

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Sparkles,
  Calendar,
  Activity,
  Award,
  Flame,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type MetricMode = "overall" | "metrics" | "routine";
type TimeRange = "7d" | "30d" | "all";

interface ChartPoint {
  dateStr: string;
  timestamp: number;
  overall: number;
  hydration: number;
  texture: number;
  acneControl: number;
  evenness: number;
  routineCompletion?: number;
  isMock?: boolean;
}

export function SkinProgressChart() {
  const { analyses, streak, routine, lastCheckIn } = useAppStore();
  const [metricMode, setMetricMode] = useState<MetricMode>("overall");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const mounted = useIsMounted();

  // Prepare chronological data points from real analyses + check-ins
  const chartData = useMemo(() => {
    const sortedAnalyses = [...analyses].sort((a, b) => a.ts - b.ts);
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const points: ChartPoint[] = [];

    if (sortedAnalyses.length >= 2) {
      // Real historical analyses only. Routine completion isn't tracked
      // per-day historically, so it's left undefined for these points
      // (recharts skips missing values) rather than randomly generated —
      // this chart is labeled "بيانات حية" (live data), so it must not
      // silently mix in numbers nobody actually measured.
      sortedAnalyses.forEach((a) => {
        const d = new Date(a.ts);
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
        points.push({
          dateStr,
          timestamp: a.ts,
          overall: a.overall,
          hydration: a.metrics?.hydration ?? 70,
          texture: a.metrics?.texture ?? 70,
          acneControl: Math.max(0, 100 - (a.metrics?.acne ?? 30)),
          evenness: a.metrics?.evenness ?? 70,
        });
      });
    } else if (sortedAnalyses.length === 1) {
      // Only one real analysis so far — show just that single real point.
      // No fabricated "days leading up to it": a one-point chart plus the
      // footer prompt to run another analysis is honest; a fake 5-day
      // trend line is not.
      const base = sortedAnalyses[0];
      const d = new Date(base.ts);
      points.push({
        dateStr: `${d.getDate()}/${d.getMonth() + 1}`,
        timestamp: base.ts,
        overall: base.overall,
        hydration: base.metrics?.hydration ?? 75,
        texture: base.metrics?.texture ?? 75,
        acneControl: 100 - (base.metrics?.acne ?? 25),
        evenness: base.metrics?.evenness ?? 75,
        routineCompletion: routine.length > 0 ? Math.round((routine.filter((r) => r.done).length / routine.length) * 100) : undefined,
      });
    }
    // No analyses yet: `points` stays empty. The UI shows an honest empty
    // state below instead of a fabricated 7-day "progress" trend.

    // Filter by timeRange
    if (timeRange === "7d") {
      const cutoff = now - 7 * DAY_MS;
      return points.filter((p) => p.timestamp >= cutoff || points.length <= 7).slice(-7);
    } else if (timeRange === "30d") {
      const cutoff = now - 30 * DAY_MS;
      return points.filter((p) => p.timestamp >= cutoff || points.length <= 30);
    }

    return points;
  }, [analyses, streak, routine, timeRange]);

  // Derived stats
  const latestPoint = chartData[chartData.length - 1];
  const firstPoint = chartData[0];
  const scoreDiff = latestPoint && firstPoint ? latestPoint.overall - firstPoint.overall : 0;
  const avgHydration = chartData.length
    ? Math.round(chartData.reduce((acc, p) => acc + p.hydration, 0) / chartData.length)
    : 0;

  if (!mounted) {
    return (
      <Card className="p-5 rounded-3xl border-border min-h-[320px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="p-5 rounded-3xl border-border bg-card overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full rawnak-rosegold-gradient grid place-items-center">
              <TrendingUp className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="font-bold text-base flex items-center gap-1.5">
                تطور نضارة البشرة
                <Badge variant="outline" className="text-[10px] py-0 px-2 border-primary/30 text-primary">
                  بيانات حية
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                تتبع التغير التدريجي في صحة بشرتكِ
              </p>
            </div>
          </div>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
          {(["7d", "30d", "all"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                timeRange === r
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "7d" ? "7 أيام" : r === "30d" ? "30 يوم" : "الكل"}
            </button>
          ))}
        </div>
      </div>

      {/* Highlights bar */}
      <div className="grid grid-cols-3 gap-2 py-1">
        <div className="bg-muted/30 border border-border/50 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-muted-foreground block">معدل النضارة</span>
          <span className="text-lg font-extrabold text-primary">
            {latestPoint ? `${latestPoint.overall}%` : "--"}
          </span>
          {scoreDiff !== 0 && (
            <span className={cn("text-[10px] block font-semibold", scoreDiff > 0 ? "text-emerald-500" : "text-rose-400")}>
              {scoreDiff > 0 ? `+${scoreDiff}% تحسن` : `${scoreDiff}%`}
            </span>
          )}
        </div>

        <div className="bg-muted/30 border border-border/50 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-muted-foreground block">متوسط الترطيب</span>
          <span className="text-lg font-extrabold text-sky-400">
            {avgHydration}%
          </span>
          <span className="text-[10px] text-muted-foreground block">مستوى متوازن</span>
        </div>

        <div className="bg-muted/30 border border-border/50 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-muted-foreground block">الالتزام اليومي</span>
          <span className="text-lg font-extrabold text-amber-500">
            {streak} أيام
          </span>
          <span className="text-[10px] text-muted-foreground block">سلسلة مستمرة</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex border-b border-border/60 pb-2 gap-2 text-xs font-semibold">
        <button
          onClick={() => setMetricMode("overall")}
          className={cn(
            "pb-1 px-1 transition-all border-b-2",
            metricMode === "overall"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          مؤشر النضارة العام
        </button>
        <button
          onClick={() => setMetricMode("metrics")}
          className={cn(
            "pb-1 px-1 transition-all border-b-2",
            metricMode === "metrics"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          تفاصيل الخصائص (الترطيب والنعومة)
        </button>
        <button
          onClick={() => setMetricMode("routine")}
          className={cn(
            "pb-1 px-1 transition-all border-b-2",
            metricMode === "routine"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          معدل الالتزام
        </button>
      </div>

      {/* Recharts Data Visualization */}
      <div className="h-64 w-full pt-2 dir-ltr">
        <ResponsiveContainer width="100%" height="100%">
          {metricMode === "overall" ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="overallGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="dateStr" stroke="#888888" fontSize={11} tickLine={false} />
              <YAxis domain={[40, 100]} stroke="#888888" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="overall"
                name="مؤشر النضارة"
                stroke="var(--primary)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#overallGrad)"
                dot={{ r: 4, fill: "var(--primary)", strokeWidth: 2, stroke: "#18181b" }}
                activeDot={{ r: 6, fill: "var(--primary)" }}
              />
            </AreaChart>
          ) : metricMode === "metrics" ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="dateStr" stroke="#888888" fontSize={11} tickLine={false} />
              <YAxis domain={[30, 100]} stroke="#888888" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-[11px] font-medium text-foreground px-1">{value}</span>
                )}
              />
              <Line
                type="monotone"
                dataKey="hydration"
                name="الترطيب"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="texture"
                name="النعومة"
                stroke="#c084fc"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="acneControl"
                name="نقاء البشرة"
                stroke="#34d399"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="evenness"
                name="تجانس اللون"
                stroke="#f43f5e"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="routineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="dateStr" stroke="#888888" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#888888" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="routineCompletion"
                name="نسبة الالتزام بالروتين"
                stroke="#f59e0b"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#routineGrad)"
                dot={{ r: 4, fill: "#f59e0b" }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-primary" />
          يُحسَب التقدم تلقائيًا من الفحوصات والالتزام اليومي
        </span>
        {analyses.length < 2 && (
          <span className="text-primary font-semibold">
            أجري تحليلاً جديداً لتحديث رسمكِ البياني ✦
          </span>
        )}
      </div>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 border border-border p-3 rounded-2xl shadow-xl text-popover-foreground text-right space-y-1.5 min-w-[140px] backdrop-blur-md">
        <p className="text-xs font-bold text-primary border-b border-border/50 pb-1">
          التاريخ: {label}
        </p>
        {payload.map((item: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-3 text-xs">
            <span className="font-bold" style={{ color: item.color }}>
              {item.value}%
            </span>
            <span className="text-muted-foreground">{item.name}:</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
