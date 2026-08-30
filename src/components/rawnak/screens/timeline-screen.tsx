"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronLeft,
  Camera,
  Calendar,
  Award,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalysisThumbnail } from "@/components/rawnak/analysis-thumbnail";

export function TimelineScreen() {
  const { analyses, comparisons, streak, routine, setView, goBack } = useAppStore();

  const sortedAnalyses = [...analyses].sort((a, b) => a.ts - b.ts);
  const first = sortedAnalyses[0];
  const latest = sortedAnalyses[sortedAnalyses.length - 1];
  const trend = first && latest ? latest.overall - first.overall : 0;

  // Consistency: routine done over recent analyses count as proxy
  const consistency = Math.min(100, Math.round((streak / 30) * 100));

  return (
    <div className="py-3 space-y-4">
      <button
        onClick={() => { if (!goBack()) setView("home"); }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
        رجوع
      </button>

      <div className="text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rosegold-gradient items-center justify-center mb-3">
          <History className="w-7 h-7 text-black" />
        </div>
        <h1 className="text-2xl font-extrabold">رحلة بشرتكِ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          تتبّعي تطوّر بشرتكِ عبر الزمن
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="p-3 rounded-2xl border-border text-center">
          <Sparkles className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-extrabold leading-none">{analyses.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">تحليل</p>
        </Card>
        <Card className="p-3 rounded-2xl border-border text-center">
          <Camera className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-extrabold leading-none">{comparisons.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">مقارنة</p>
        </Card>
        <Card className="p-3 rounded-2xl border-border text-center">
          <Flame className="w-5 h-5 mx-auto text-orange-400 mb-1" />
          <p className="text-xl font-extrabold leading-none">{streak}</p>
          <p className="text-[10px] text-muted-foreground mt-1">يوم متتالي</p>
        </Card>
      </div>

      {/* Overall trend */}
      {first && latest && (
        <Card className="p-5 rounded-2xl border-border">
          <h3 className="font-bold mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-primary" />
            تطوّر النتيجة العامة
          </h3>
          <div className="flex items-end justify-between mb-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">البداية</p>
              <p className="text-2xl font-extrabold">{first.overall}</p>
            </div>
            <div className="flex-1 mx-3 relative h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "absolute inset-y-0 right-0 rounded-full",
                  trend >= 0 ? "bg-emerald-400" : "bg-rose-400"
                )}
                style={{ width: `${Math.min(100, Math.abs(trend) * 3)}%` }}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">الأخير</p>
              <p className="text-2xl font-extrabold rawnak-gold-text">{latest.overall}</p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold",
              trend > 0
                ? "bg-emerald-500/10 text-emerald-400"
                : trend < 0
                ? "bg-rose-500/10 text-rose-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            {trend > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : trend < 0 ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Award className="w-4 h-4" />
            )}
            {trend > 0
              ? `تحسّن ${trend} نقطة ✦`
              : trend < 0
              ? `انخفاض ${Math.abs(trend)} نقطة`
              : "ثبات"}
          </div>
        </Card>
      )}

      {/* Consistency meter */}
      <Card className="p-4 rounded-2xl border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            الالتزام بالروتين
          </h3>
          <span className="text-sm font-bold text-primary">{consistency}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${consistency}%` }}
            transition={{ duration: 1 }}
            className="h-full rawnak-rosegold-gradient rounded-full"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {consistency >= 75
            ? "التزام رائع! بشرتكِ تشكركِ ✦"
            : consistency >= 40
            ? "أحسنتِ، استمري على هذا النهج"
            : "ابدئي روتينكِ اليومي لتحسّن أسرع"}
        </p>
      </Card>

      {/* Timeline of analyses */}
      <div>
        <h3 className="font-bold mb-2 px-1">سجلّ التحليلات</h3>
        {sortedAnalyses.length === 0 ? (
          <Card className="p-8 rounded-2xl border-border text-center">
            <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-bold mb-1">لا تحليلات بعد</p>
            <p className="text-sm text-muted-foreground mb-3">
              ابدئي أول تحليل لبشرتكِ لتتبّع رحلتكِ
            </p>
            <Button onClick={() => setView("analysis")} className="rawnak-rosegold-gradient text-black rounded-xl">
              ابدئي تحليلًا
            </Button>
          </Card>
        ) : (
          <div className="relative pr-4">
            {/* vertical line */}
            <div className="absolute right-1.5 top-2 bottom-2 w-0.5 bg-border" />
            <div className="space-y-3">
              {[...sortedAnalyses].reverse().map((a, i, arr) => {
                const prev = arr[i + 1];
                const diff = prev ? a.overall - prev.overall : 0;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative"
                  >
                    <span className="absolute -right-3.5 top-3 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />
                    <Card className="p-3 rounded-2xl border-border mr-2">
                      <div className="flex items-start gap-3">
                        <AnalysisThumbnail
                          src={a.imageData}
                          className="w-14 h-14 rounded-xl object-cover border border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              {new Date(a.ts).toLocaleDateString("ar", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xl font-extrabold rawnak-gold-text">
                                {a.overall}
                              </span>
                              {diff !== 0 && (
                                <span
                                  className={cn(
                                    "text-[10px] font-bold flex items-center",
                                    diff > 0 ? "text-emerald-400" : "text-rose-400"
                                  )}
                                >
                                  {diff > 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3" />
                                  )}
                                  {Math.abs(diff)}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-semibold mt-0.5">{a.skinType}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {a.summary}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Before/after quick link */}
      {comparisons.length > 0 && (
        <Button
          onClick={() => setView("compare")}
          variant="outline"
          className="w-full rounded-2xl h-12"
        >
          <Camera className="w-4 h-4 ml-1.5" />
          شوفي مقارنات قبل وبعد
        </Button>
      )}
    </div>
  );
}
