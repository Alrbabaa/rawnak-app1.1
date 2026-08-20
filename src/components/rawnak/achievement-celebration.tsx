"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ACHIEVEMENT_ICONS } from "@/lib/data";
import { createNotification } from "@/hooks/use-notification-center";

const AUTO_DISMISS_MS = 4000;

// A handful of fixed offsets for the little sparkle burst — deterministic
// (no Math.random per render) so the animation doesn't jitter differently
// each time.
const SPARKLE_OFFSETS = [
  { x: -46, y: -18, delay: 0 },
  { x: 40, y: -30, delay: 0.05 },
  { x: -30, y: 32, delay: 0.1 },
  { x: 48, y: 22, delay: 0.08 },
  { x: 0, y: -46, delay: 0.03 },
  { x: 4, y: 44, delay: 0.12 },
];

/**
 * Mounted once in app-shell.tsx. Previously unlockAchievement() only ever
 * silently flipped a flag in the store — someone could earn a badge and
 * never find out unless they happened to visit the achievements screen
 * later. This surfaces the moment itself, wherever it happens.
 */
export function AchievementCelebration() {
  const pending = useAppStore((s) => s.pendingCelebrations);
  const dismiss = useAppStore((s) => s.dismissCelebration);
  const current = pending[0];

  useEffect(() => {
    if (!current) return;
    createNotification({
      type: "achievement",
      title: `إنجاز جديد: ${current.title} ✦`,
      body: current.desc,
    });
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [current, dismiss]);

  const Icon = current ? ACHIEVEMENT_ICONS[current.icon] || Trophy : Trophy;

  return (
    <AnimatePresence>
      {current && (
        <motion.button
          key={current.id}
          onClick={dismiss}
          aria-label="إغلاق إشعار الإنجاز"
          initial={{ opacity: 0, y: -24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 340, damping: 24 }}
          className="fixed left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,380px)] text-right"
          style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <div className="relative overflow-hidden rounded-2xl rawnak-rosegold-gradient p-4 shadow-2xl flex items-center gap-3">
            {/* Sparkle burst around the badge */}
            <div className="relative w-12 h-12 shrink-0 grid place-items-center">
              {SPARKLE_OFFSETS.map((s, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute w-1.5 h-1.5 rounded-full bg-white"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 0.9, delay: s.delay, ease: "easeOut" }}
                />
              ))}
              <motion.div
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
                className="w-12 h-12 rounded-full bg-black/15 grid place-items-center"
              >
                <Icon className="w-6 h-6 text-black" />
              </motion.div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-black/70">إنجاز جديد ✦</p>
              <p className="font-extrabold text-black truncate">{current.title}</p>
              <p className="text-xs text-black/70 truncate">{current.desc}</p>
            </div>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
