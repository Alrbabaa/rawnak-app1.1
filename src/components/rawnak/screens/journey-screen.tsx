"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { DAILY_TIPS } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sun,
  Moon,
  Check,
  Flame,
  Sparkles,
  Droplets,
  Quote,
  Heart,
  Bell,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoutineCompletionCelebration } from "@/components/rawnak/confetti-celebration";
import { SkinMetricsTrendsChart } from "@/components/rawnak/skin-metrics-trends-chart";

const HABIT_REMINDERS = [
  { icon: Droplets, label: "اشربي كوب ماء", color: "text-sky-400" },
  { icon: Sparkles, label: "5 دقائق تدليك وجه", color: "text-rose-400" },
  { icon: Moon, label: "جهّزي لنوم مبكر", color: "text-violet-400" },
  { icon: Heart, label: "تنفّسي بعمق دقيقتين", color: "text-pink-400" },
];

export function JourneyScreen() {
  const { routine, toggleRoutineStep, streak, checkIn, unlockAchievement, setView } =
    useAppStore();
  const [tip] = useState(() => DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length]);

  const morning = routine.filter((r) => r.time === "morning");
  const evening = routine.filter((r) => r.time === "evening");
  const doneCount = routine.filter((r) => r.done).length;
  const progress = Math.round((doneCount / routine.length) * 100);

  useEffect(() => {
    if (progress === 100) {
      checkIn();
      unlockAchievement("streak-3");
    }
  }, [progress, checkIn, unlockAchievement]);

  const greeting =
    new Date().getHours() < 12
      ? { label: "صباح الجمال", icon: Sun }
      : { label: "مساء الأناقة", icon: Moon };

  const GreetingIcon = greeting.icon;

  return (
    <div className="py-3 space-y-5">
      {/* Hero greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl rawnak-gradient p-5 rawnak-shadow"
      >
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-[oklch(0.72_0.085_45/0.3)] blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GreetingIcon className="w-5 h-5 text-primary" />
              <p className="text-sm text-muted-foreground">{greeting.label}</p>
            </div>
            <h1 className="text-2xl font-extrabold">رحلة جمالكِ اليوم</h1>
            <p className="text-xs text-muted-foreground mt-1">
              كل خطوة تقربكِ من إشراقكِ ✦
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full rawnak-rosegold-gradient grid place-items-center mb-1">
              <Flame className="w-7 h-7 text-black" />
            </div>
            <p className="text-lg font-extrabold leading-none">{streak}</p>
            <p className="text-[10px] text-muted-foreground">يوم متتالي</p>
          </div>
        </div>
        <div className="relative z-10 mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">إنجاز اليوم</span>
            <span className="font-bold text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2.5" />
        </div>
      </motion.div>

      {/* Confetti & Ripple Celebration */}
      <RoutineCompletionCelebration show={progress === 100} />

      {/* Daily tip */}
      <Card className="p-4 rounded-2xl border-border relative overflow-hidden">
        <Quote className="absolute top-2 left-2 w-8 h-8 text-primary/10" />
        <div className="relative z-10">
          <Badge className="mb-1.5 bg-primary/10 text-primary hover:bg-primary/15">
            نصيحة اليوم
          </Badge>
          <p className="text-sm font-medium leading-relaxed">{tip}</p>
        </div>
      </Card>

      {/* Morning routine */}
      <RoutineSection
        title="الروتين الصباحي"
        icon={<Sun className="w-4 h-4 text-amber-400" />}
        steps={morning}
        onToggle={toggleRoutineStep}
      />

      {/* Evening routine */}
      <RoutineSection
        title="الروتين المسائي"
        icon={<Moon className="w-4 h-4 text-violet-400" />}
        steps={evening}
        onToggle={toggleRoutineStep}
      />

      {/* Skin Health Trends Recharts Chart */}
      <SkinMetricsTrendsChart />

      {/* Habit reminders */}
      <div>
        <h3 className="font-bold mb-2 px-1 flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-primary" />
          تذكيرات اليوم
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {HABIT_REMINDERS.map((h, i) => {
            const Icon = h.icon;
            return (
              <Card key={i} className="p-3 rounded-2xl border-border flex items-center gap-2.5">
                <Icon className={cn("w-5 h-5 shrink-0", h.color)} />
                <span className="text-xs font-semibold">{h.label}</span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Motivation */}
      {progress === 100 ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-3xl p-5 rawnak-rosegold-gradient text-center text-black"
        >
          <Trophy className="w-10 h-10 mx-auto mb-2" />
          <p className="font-extrabold text-lg">أكملتِ روتينكِ اليومي! ✦</p>
          <p className="text-sm opacity-80 mt-1">
            بشرتكِ تشكركِ. الاستمرار سرّ الإشراق.
          </p>
        </motion.div>
      ) : (
        <Card className="p-4 rounded-2xl border-border text-center">
          <p className="text-sm text-muted-foreground">
            ✦ كل خطوة صغيرة تبني إشراقة تدوم · {doneCount}/{routine.length} مكتملة ✦
          </p>
        </Card>
      )}

      <button
        onClick={() => setView("achievements")}
        className="w-full text-center text-xs text-primary font-semibold"
      >
        شوفي إنجازاتكِ →
      </button>
    </div>
  );
}

function RoutineSection({
  title,
  icon,
  steps,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  steps: { id: string; name: string; done: boolean }[];
  onToggle: (id: string) => void;
}) {
  const done = steps.filter((s) => s.done).length;
  return (
    <Card className="p-4 rounded-2xl border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-1.5">
          {icon}
          {title}
        </h3>
        <Badge variant="secondary" className="rounded-full text-[10px]">
          {done}/{steps.length}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {steps.map((s) => (
          <motion.button
            key={s.id}
            onClick={() => onToggle(s.id)}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-right relative overflow-hidden",
              s.done ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
            )}
          >
            <div className="relative shrink-0">
              <span
                className={cn(
                  "w-5 h-5 rounded-full border-2 grid place-items-center transition-colors relative z-10",
                  s.done ? "bg-primary border-primary text-primary-foreground shadow-xs" : "border-border"
                )}
              >
                {s.done && (
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
                  </motion.div>
                )}
              </span>

              {/* Checkmark ripple effect */}
              {s.done && (
                <motion.span
                  initial={{ scale: 0.5, opacity: 0.8 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border-2 border-primary bg-primary/20 pointer-events-none"
                />
              )}
            </div>

            <span
              className={cn(
                "text-sm transition-all",
                s.done ? "text-muted-foreground line-through" : "font-medium"
              )}
            >
              {s.name}
            </span>
          </motion.button>
        ))}
      </div>
    </Card>
  );
}
