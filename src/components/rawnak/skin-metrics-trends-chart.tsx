"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Droplets,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Activity,
  Plus,
  CheckCircle2,
  Calendar,
  HeartHandshake,
  AlertCircle,
  Info,
  Sliders,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore, DailyCheckInLog } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

type ChartViewMode = "combined" | "barrier" | "hydration";
type TimeFilter = "7d" | "14d" | "30d";

const SYMPTOM_TAGS = [
  "جفاف",
  "احمرار طفيف",
  "حكة أو وخز",
  "شد في البشرة",
  "قشور ناعمة",
  "تهيج بعد الغسول",
  "توهج ونضارة ✦",
];

export function SkinMetricsTrendsChart() {
  const { checkInLogs, logDailyCheckIn } = useAppStore();
  const mounted = useIsMounted();

  const [viewMode, setViewMode] = useState<ChartViewMode>("combined");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("14d");
  const [showCheckInForm, setShowCheckInForm] = useState(false);

  // Check-In Form State
  const [hydrationInput, setHydrationInput] = useState<number>(80);
  const [sensitivityInput, setSensitivityInput] = useState<number>(25);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notesInput, setNotesInput] = useState<string>("");

  // Process & Sort Chart Data chronologically
  const chartData = useMemo(() => {
    const rawLogs = [...checkInLogs].sort((a, b) => a.ts - b.ts);
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    let filtered = rawLogs;
    if (timeFilter === "7d") {
      const cutoff = now - 7 * DAY_MS;
      filtered = rawLogs.filter((l) => l.ts >= cutoff || rawLogs.length <= 7).slice(-7);
    } else if (timeFilter === "14d") {
      const cutoff = now - 14 * DAY_MS;
      filtered = rawLogs.filter((l) => l.ts >= cutoff || rawLogs.length <= 14).slice(-14);
    } else if (timeFilter === "30d") {
      const cutoff = now - 30 * DAY_MS;
      filtered = rawLogs.filter((l) => l.ts >= cutoff || rawLogs.length <= 30).slice(-30);
    }

    return filtered.map((log) => {
      const dateObj = new Date(log.ts);
      const isToday = new Date().toDateString() === dateObj.toDateString();
      const dateLabel = isToday ? "اليوم" : `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

      const barrierScore =
        log.barrierScore ?? Math.min(100, Math.max(10, Math.round((log.hydration + (100 - log.sensitivity)) / 2)));

      return {
        dateStr: dateLabel,
        ts: log.ts,
        hydration: log.hydration,
        sensitivity: log.sensitivity,
        barrierScore,
        notes: log.notes,
        symptoms: log.symptoms,
      };
    });
  }, [checkInLogs, timeFilter]);

  // Derived Stats
  const latestLog = chartData[chartData.length - 1];
  const firstLog = chartData[0];

  const avgHydration = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.round(chartData.reduce((acc, curr) => acc + curr.hydration, 0) / chartData.length);
  }, [chartData]);

  const avgSensitivity = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.round(chartData.reduce((acc, curr) => acc + curr.sensitivity, 0) / chartData.length);
  }, [chartData]);

  const avgBarrier = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.round(chartData.reduce((acc, curr) => acc + curr.barrierScore, 0) / chartData.length);
  }, [chartData]);

  const hydrationDelta = latestLog && firstLog ? latestLog.hydration - firstLog.hydration : 0;
  const sensitivityDelta = latestLog && firstLog ? latestLog.sensitivity - firstLog.sensitivity : 0;

  const toggleSymptom = (tag: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSaveCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    logDailyCheckIn({
      hydration: hydrationInput,
      sensitivity: sensitivityInput,
      symptoms: selectedSymptoms,
      notes: notesInput,
    });

    toast.success("تم تسجيل مؤشرات صحة بشرتكِ اليوم بنجاح! ✦");
    setShowCheckInForm(false);
    setNotesInput("");
  };

  if (!mounted) {
    return (
      <Card className="p-6 rounded-3xl border-border min-h-[340px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="p-5 rounded-3xl border-border bg-card overflow-hidden space-y-4 shadow-sm" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-500 grid place-items-center shrink-0">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-foreground flex items-center gap-1.5">
                مؤشرات الترطيب والتحسّس
                <Badge variant="secondary" className="text-[10px] py-0 px-2 rounded-full bg-primary/10 text-primary">
                  Recharts
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                تتبع يومي دقيق لتغيرات الترطيب وتهيج البشرة
              </p>
            </div>
          </div>
        </div>

        {/* Action button & Time filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
            {(["7d", "14d", "30d"] as TimeFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTimeFilter(f)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                  timeFilter === f
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "7d" ? "7 أيام" : f === "14d" ? "14 يوم" : "30 يوم"}
              </button>
            ))}
          </div>

          <Button
            onClick={() => setShowCheckInForm(!showCheckInForm)}
            size="sm"
            className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 rawnak-rose-gradient text-white shadow-2xs interactive-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تسجيل اليوم</span>
          </Button>
        </div>
      </div>

      {/* Check-In Logging Drawer / Expandable Form */}
      <AnimatePresence>
        {showCheckInForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSaveCheckIn} className="bg-muted/30 border border-primary/20 rounded-2xl p-4 space-y-4 my-1">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-primary" />
                  تسجيل حالة البشرة اليومية
                </span>
                <button
                  type="button"
                  onClick={() => setShowCheckInForm(false)}
                  className="p-1 rounded-full hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Hydration Slider */}
                <div className="space-y-1.5 bg-card p-3 rounded-xl border border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-foreground flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      مستوى الترطيب
                    </span>
                    <span className="font-black text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-full text-[11px]">
                      {hydrationInput}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={hydrationInput}
                    onChange={(e) => setHydrationInput(Number(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer h-2 bg-muted rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>جافة مشدودة</span>
                    <span>متوازنة</span>
                    <span>ممتلئة بالرطوبة 💧</span>
                  </div>
                </div>

                {/* Sensitivity Slider */}
                <div className="space-y-1.5 bg-card p-3 rounded-xl border border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-foreground flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      مستوى التحسّس والتهيج
                    </span>
                    <span className="font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full text-[11px]">
                      {sensitivityInput}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={sensitivityInput}
                    onChange={(e) => setSensitivityInput(Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer h-2 bg-muted rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>هادئة تماماً</span>
                    <span>تحسّس خفيف</span>
                    <span>متهجة/حمراء ⚠️</span>
                  </div>
                </div>
              </div>

              {/* Quick Symptom Tags */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-foreground block">
                  أعراض أو ملاحظات سريعة ظهرت اليوم
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SYMPTOM_TAGS.map((tag) => {
                    const isSelected = selectedSymptoms.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleSymptom(tag)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                            : "bg-card border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note input */}
              <div className="space-y-1">
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="ملاحظة خاصة (مثال: جربت سيروم جديد، طقس حار، شربت 2 لتر ماء)..."
                  className="w-full text-xs p-2.5 rounded-xl bg-card border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/60"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-xl h-8 px-4 text-xs font-extrabold rawnak-rose-gradient text-white gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  حفظ المؤشرات وتسجيل اليوم ✦
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Summary Highlights Bar */}
      <div className="grid grid-cols-3 gap-2 py-0.5">
        <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-muted-foreground block font-medium">متوسط الترطيب</span>
          <span className="text-lg font-black text-sky-500">
            {avgHydration}%
          </span>
          {hydrationDelta !== 0 && (
            <span className={cn("text-[10px] block font-bold", hydrationDelta > 0 ? "text-emerald-500" : "text-rose-400")}>
              {hydrationDelta > 0 ? `+${hydrationDelta}% ارتفاء` : `${hydrationDelta}%`}
            </span>
          )}
        </div>

        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-muted-foreground block font-medium">مستوى التحسس</span>
          <span className="text-lg font-black text-rose-500">
            {avgSensitivity}%
          </span>
          {sensitivityDelta !== 0 && (
            <span className={cn("text-[10px] block font-bold", sensitivityDelta < 0 ? "text-emerald-500" : "text-amber-500")}>
              {sensitivityDelta < 0 ? `${sensitivityDelta}% انخفاض (أفضل)` : `+${sensitivityDelta}%`}
            </span>
          )}
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-2.5 text-center">
          <span className="text-[10px] text-muted-foreground block font-medium">مؤشر حاجز البشرة</span>
          <span className="text-lg font-black text-emerald-500">
            {avgBarrier}%
          </span>
          <span className="text-[10px] text-emerald-600 block font-bold">
            {avgBarrier >= 75 ? "حاجز متين ✦" : "يحتاج ترطيب"}
          </span>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex border-b border-border/60 pb-2 gap-2 text-xs font-semibold overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setViewMode("combined")}
          className={cn(
            "pb-1 px-1.5 transition-all border-b-2 shrink-0 flex items-center gap-1",
            viewMode === "combined"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="w-3.5 h-3.5" />
          الترطيب والتحسّس معًا
        </button>
        <button
          type="button"
          onClick={() => setViewMode("barrier")}
          className={cn(
            "pb-1 px-1.5 transition-all border-b-2 shrink-0 flex items-center gap-1",
            viewMode === "barrier"
              ? "border-emerald-500 text-emerald-500 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          مؤشر صحة حاجز البشرة
        </button>
        <button
          type="button"
          onClick={() => setViewMode("hydration")}
          className={cn(
            "pb-1 px-1.5 transition-all border-b-2 shrink-0 flex items-center gap-1",
            viewMode === "hydration"
              ? "border-sky-500 text-sky-500 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Droplets className="w-3.5 h-3.5" />
          تطور الترطيب فقط
        </button>
      </div>

      {/* Recharts Data Visualization Canvas */}
      {chartData.length === 0 ? (
        <div className="h-64 w-full flex flex-col items-center justify-center gap-2 text-center px-6">
          <Droplets className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            لا يوجد تسجيلات يومية بعد — سجّلي أول تحديث لحالة بشرتكِ لبدء تتبع التطور
          </p>
        </div>
      ) : (
      <div className="h-64 w-full pt-2 dir-ltr">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "combined" ? (
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hydGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="dateStr" stroke="#888888" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#888888" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomSkinMetricsTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-[11px] font-bold text-foreground px-1">{value}</span>
                )}
              />
              <ReferenceLine y={30} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: "حد التحسس", fill: "#f43f5e", fontSize: 10, position: "insideBottomRight" }} />
              <Area
                type="monotone"
                dataKey="hydration"
                name="مستوى الترطيب (%)"
                stroke="#38bdf8"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#hydGrad)"
                dot={{ r: 4, fill: "#38bdf8", strokeWidth: 2, stroke: "#18181b" }}
                activeDot={{ r: 6, fill: "#0284c7" }}
              />
              <Line
                type="monotone"
                dataKey="sensitivity"
                name="مستوى التحسس والتهيج (%)"
                stroke="#f43f5e"
                strokeWidth={2.5}
                strokeDasharray="4 2"
                dot={{ r: 4, fill: "#f43f5e", strokeWidth: 2, stroke: "#18181b" }}
                activeDot={{ r: 6, fill: "#e11d48" }}
              />
            </ComposedChart>
          ) : viewMode === "barrier" ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="barrierGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="dateStr" stroke="#888888" fontSize={11} tickLine={false} />
              <YAxis domain={[30, 100]} stroke="#888888" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomSkinMetricsTooltip />} />
              <ReferenceLine y={70} stroke="#10b981" strokeDasharray="3 3" label={{ value: "حاجز متين ممتاز", fill: "#10b981", fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="barrierScore"
                name="مؤشر صحة الحاجز الجلدي"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#barrierGrad)"
                dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#18181b" }}
              />
            </AreaChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hydOnlyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="dateStr" stroke="#888888" fontSize={11} tickLine={false} />
              <YAxis domain={[20, 100]} stroke="#888888" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomSkinMetricsTooltip />} />
              <Area
                type="monotone"
                dataKey="hydration"
                name="نسبة الترطيب"
                stroke="#0284c7"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#hydOnlyGrad)"
                dot={{ r: 4, fill: "#0284c7" }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      )}

      {/* AI Skincare Dynamic Correlation Insight */}
      <div className="bg-primary/5 rounded-2xl p-3 border border-primary/20 flex items-start gap-2 text-xs">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-foreground">
            استنتاج الخبيرة من رسوماتكِ البيانية:
          </p>
          <p className="text-muted-foreground leading-relaxed text-[11px]">
            {avgHydration >= 75 && avgSensitivity <= 35
              ? "يُظهر رسمكِ البياني علاقة عكسية صحية جدًا: كلما زادت نسبة الترطيب ينخفض التحسس وتهدأ البشرة تمامًا. واصلي المرطب وركّزي على السيروم المهدئ!"
              : avgSensitivity > 40
              ? "تنبيه: مستوى التحسّس يرتفع عند نقص الترطيب. ننصحكِ بتخفيف المقشرات وتطبيق مرطب يحوي الهيالورونيك والسيراميد فوراً."
              : "التزامكِ اليومي يسهم في استقرار الترطيب وحماية حاجز بشرتكِ الطبيعي ✦"}
          </p>
        </div>
      </div>
    </Card>
  );
}

function CustomSkinMetricsTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload;
    return (
      <div className="bg-popover/95 border border-border p-3 rounded-2xl shadow-xl text-popover-foreground text-right space-y-2 min-w-[170px] backdrop-blur-md dir-rtl">
        <div className="flex items-center justify-between border-b border-border/50 pb-1">
          <span className="text-xs font-black text-primary">
            التاريخ: {label}
          </span>
          <span className="text-[10px] text-muted-foreground">مؤشرات رَونق</span>
        </div>

        <div className="space-y-1">
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3 text-xs">
              <span className="font-black" style={{ color: item.color }}>
                {item.value}%
              </span>
              <span className="text-muted-foreground font-medium">{item.name}:</span>
            </div>
          ))}
        </div>

        {dataPoint?.symptoms && dataPoint.symptoms.length > 0 && (
          <div className="pt-1 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground block mb-0.5">الأعراض المسجلة:</span>
            <div className="flex flex-wrap gap-1">
              {dataPoint.symptoms.map((s: string, idx: number) => (
                <span key={idx} className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {dataPoint?.notes && (
          <div className="text-[10px] italic text-muted-foreground/90 bg-muted/40 p-1.5 rounded-lg border border-border/40">
            "{dataPoint.notes}"
          </div>
        )}
      </div>
    );
  }
  return null;
}
