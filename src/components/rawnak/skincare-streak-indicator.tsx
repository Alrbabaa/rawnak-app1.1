"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Sparkles, CheckCircle2, Trophy, ChevronLeft, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface SkincareStreakIndicatorProps {
  justCompleted?: boolean;
}

const WEEKDAYS = [
  { label: "الأحد", dayNum: 0 },
  { label: "الإثنين", dayNum: 1 },
  { label: "الثلاثاء", dayNum: 2 },
  { label: "الأربعاء", dayNum: 3 },
  { label: "الخميس", dayNum: 4 },
  { label: "الجمعة", dayNum: 5 },
  { label: "السبت", dayNum: 6 },
];

export function SkincareStreakIndicator({ justCompleted }: SkincareStreakIndicatorProps) {
  const { streak, routine, toggleRoutineStep, setView, checkIn, unlockAchievement } = useAppStore();

  const doneCount = routine.filter((r) => r.done).length;
  const totalCount = routine.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const isGoalAchieved = progress === 100;

  // SVG Progress Ring calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const todayIndex = new Date().getDay(); // 0 = Sun, 6 = Sat

  // Generate 7-day visual dots relative to current streak & goal
  const weeklyStatus = useMemo(() => {
    return WEEKDAYS.map((wd) => {
      const isToday = wd.dayNum === todayIndex;
      const isPast = wd.dayNum < todayIndex;
      // If today is completed or streak covers past days
      let isCompleted = false;
      if (isToday) {
        isCompleted = isGoalAchieved;
      } else if (isPast) {
        // Estimate based on current streak count
        const daysAgo = todayIndex - wd.dayNum;
        isCompleted = streak >= daysAgo;
      }
      return { ...wd, isToday, isCompleted };
    });
  }, [todayIndex, isGoalAchieved, streak]);

  return (
    <Card className="p-5 rounded-3xl border-primary/20 bg-card relative overflow-hidden shadow-xs">
      {/* Soft background ambient glow */}
      <div
        className={cn(
          "absolute top-0 left-0 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-all duration-700",
          isGoalAchieved ? "bg-amber-500/25 dark:bg-amber-500/15" : "bg-primary/10"
        )}
      />

      <div className="relative z-10 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "p-2 rounded-2xl transition-all duration-500 shadow-2xs",
                isGoalAchieved
                  ? "bg-amber-500 text-black shadow-amber-500/30 shadow-md animate-pulse"
                  : "rawnak-rosegold-gradient text-black"
              )}
            >
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base text-foreground">سلسلة الالتزام</h3>
                {isGoalAchieved && (
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-extrabold">
                    هدف اليوم مكتمل! ✦
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isGoalAchieved
                  ? "حافظتي على توهجكِ وسلسلتكِ لليوم!"
                  : `متبقي ${totalCount - doneCount} خطوات لإتمام روتين اليوم`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setView("achievements")}
            className="text-xs text-primary font-bold flex items-center gap-0.5 hover:underline"
          >
            الإنجازات
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Core Ring & Big Streak Counter Layout */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-muted/50 border border-border/70">
          {/* Animated SVG Progress Ring */}
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
              {/* Background Track Circle */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                className="stroke-muted/80"
                strokeWidth="7"
                fill="transparent"
              />
              {/* Animated Progress Circle */}
              <motion.circle
                cx="48"
                cy="48"
                r={radius}
                stroke="url(#streakGradient)"
                strokeWidth="7"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
              <defs>
                <linearGradient id="streakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="oklch(0.72 0.12 50)" />
                  <stop offset="100%" stopColor="oklch(0.82 0.15 75)" />
                </linearGradient>
              </defs>
            </svg>

            {/* Center Content inside Ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
              {isGoalAchieved ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 15 }}
                  className="flex flex-col items-center"
                >
                  <Sparkles className="w-5 h-5 text-amber-500 mb-0.5" />
                  <span className="text-xs font-black text-foreground leading-none">100%</span>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-base font-black text-foreground leading-none">
                    {progress}%
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                    إنجاز اليوم
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Big Streak Metric & Action */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-foreground rawnak-gold-text">
                {streak}
              </span>
              <span className="text-sm font-bold text-muted-foreground">أيام متتالية 🔥</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {streak >= 7
                ? "إنجاز مبهر! أنتِ تستمرّين بانتظام يتوّج بشرتكِ بالصحة والنضارة."
                : "الاستمرار اليومي هو السر الحقيقي لبشرة متوهجة ناعمة."}
            </p>

            {/* Quick action button if not complete */}
            {!isGoalAchieved ? (
              <button
                onClick={() => {
                  const nextUnchecked = routine.find((r) => !r.done);
                  if (nextUnchecked) toggleRoutineStep(nextUnchecked.id);
                }}
                className="w-full py-1.5 px-3 rounded-xl rawnak-rosegold-gradient text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:opacity-95 transition-opacity"
              >
                <Zap className="w-3.5 h-3.5" />
                إنجاز خطوة في الروتين
              </button>
            ) : (
              <button
                onClick={() => {
                  checkIn();
                  unlockAchievement("streak-3");
                  if (streak + 1 >= 7) unlockAchievement("streak-7");
                  setView("achievements");
                }}
                className="w-full py-1.5 px-3 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                عرض شارات السلسلة
              </button>
            )}
          </div>
        </div>

        {/* Weekly Days Row */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-1">
            <span>التزام هذا الأسبوع</span>
            <span>{weeklyStatus.filter((w) => w.isCompleted).length} / 7 أيام</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {weeklyStatus.map((day) => (
              <div
                key={day.label}
                className={cn(
                  "flex flex-col items-center py-2 px-1 rounded-2xl border transition-all text-center",
                  day.isToday
                    ? "border-primary bg-primary/10 shadow-2xs"
                    : "border-border/60 bg-muted/30"
                )}
              >
                <span className="text-[10px] text-muted-foreground font-medium mb-1 whitespace-nowrap">
                  {day.label}
                </span>

                <div
                  className={cn(
                    "w-6 h-6 rounded-full grid place-items-center text-xs transition-transform",
                    day.isCompleted
                      ? "bg-amber-500 text-black font-bold shadow-2xs scale-105"
                      : day.isToday
                      ? "border border-dashed border-primary text-primary"
                      : "bg-muted text-muted-foreground/40"
                  )}
                >
                  {day.isCompleted ? (
                    <Flame className="w-3.5 h-3.5" />
                  ) : day.isToday ? (
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  ) : (
                    "•"
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goal Achieved Celebration Banner */}
        <AnimatePresence>
          {(isGoalAchieved || justCompleted) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3.5 rounded-2xl rawnak-rosegold-gradient text-black flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-xs font-extrabold">تم تحقيق هدف اليوم بنجاح! ✦</p>
                    <p className="text-[11px] opacity-90">حافظتِ على سلسلة {streak} يوم متتالي من العناية.</p>
                  </div>
                </div>
                <Sparkles className="w-5 h-5 shrink-0 animate-bounce" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
