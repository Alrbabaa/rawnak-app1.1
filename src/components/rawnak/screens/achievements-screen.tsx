"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { ACHIEVEMENT_ICONS } from "@/lib/data";
import { Trophy, Flame, Sparkles, ScanLine, ChevronLeft, Lock } from "lucide-react";

export function AchievementsScreen() {
  const { achievements, setView, goBack, streak, analyses, scans } = useAppStore();

  const unlocked = achievements.filter((a) => a.unlocked);

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
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
          className="inline-flex w-16 h-16 rounded-2xl rawnak-rose-gradient items-center justify-center mb-3"
        >
          <Trophy className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-2xl font-extrabold">إنجازاتكِ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {unlocked.length} من {achievements.length} إنجاز مفتوح
        </p>
      </div>

      {/* Progress bar */}
      <Card className="p-4 rounded-2xl border-border">
        <div className="flex justify-between text-xs mb-2">
          <span className="font-bold">تقدّمكِ الكلّي</span>
          <span className="text-primary font-bold">
            {Math.round((unlocked.length / achievements.length) * 100)}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(unlocked.length / achievements.length) * 100}%` }}
            transition={{ duration: 1 }}
            className="h-full rawnak-rose-gradient rounded-full"
          />
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={<Flame className="w-5 h-5 text-orange-500" />} value={streak} label="تتابع" />
        <StatCard icon={<Sparkles className="w-5 h-5 text-primary" />} value={analyses.length} label="تحليل" />
        <StatCard icon={<ScanLine className="w-5 h-5 text-amber-500" />} value={scans.length} label="فحص" />
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-2 gap-3">
        {achievements.map((a, i) => {
          const Icon = ACHIEVEMENT_ICONS[a.icon] || Trophy;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className={`p-4 rounded-2xl text-center h-full relative overflow-hidden ${
                  a.unlocked ? "border-primary/40 rawnak-shadow" : "border-border opacity-60"
                }`}
              >
                {a.unlocked && (
                  <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full rawnak-gradient blur-xl opacity-40" />
                )}
                <div className="relative z-10">
                  <div
                    className={`w-14 h-14 mx-auto rounded-2xl grid place-items-center mb-2 ${
                      a.unlocked ? "rawnak-rose-gradient" : "bg-muted"
                    }`}
                  >
                    {a.unlocked ? (
                      <Icon className="w-7 h-7 text-white" />
                    ) : (
                      <Lock className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="font-bold text-sm mb-0.5">{a.title}</h3>
                  <p className="text-[11px] text-muted-foreground leading-snug">{a.desc}</p>
                  {a.unlocked && a.unlockedAt && (
                    <p className="text-[10px] text-primary mt-1.5 font-semibold">
                      ✦ {new Date(a.unlockedAt).toLocaleDateString("ar", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground pt-2">
        واصلي رعايتكِ لبشرتكِ لفتح المزيد من الإنجازات ✦
      </p>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <Card className="p-3 rounded-2xl border-border text-center">
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className="text-xl font-extrabold leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </Card>
  );
}
