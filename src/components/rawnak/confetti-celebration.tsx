"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Award, CheckCircle2 } from "lucide-react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  shape: "circle" | "square" | "sparkle";
}

const COLORS = [
  "#f43f5e", // Rose
  "#fbbf24", // Amber Gold
  "#34d399", // Emerald
  "#c084fc", // Lavender
  "#38bdf8", // Sky Blue
  "#e11d48", // Crimson
  "#f59e0b", // Warm Amber
];

export function RoutineCompletionCelebration({
  show,
  onComplete,
}: {
  show: boolean;
  onComplete?: () => void;
}) {
  const particles = useMemo(() => {
    if (!show) return [];
    return Array.from({ length: 32 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 320,
      y: -40 - Math.random() * 180,
      size: Math.random() * 8 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      shape: (i % 3 === 0 ? "sparkle" : i % 2 === 0 ? "circle" : "square") as "sparkle" | "circle" | "square",
    }));
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <div className="relative w-full overflow-visible pointer-events-none z-30 my-2">
          {/* Concentric Ripple Rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute w-32 h-32 rounded-full border-2 border-primary/60 bg-primary/10"
            />
            <motion.div
              initial={{ scale: 0.2, opacity: 0.7 }}
              animate={{ scale: 3.0, opacity: 0 }}
              transition={{ duration: 1.6, ease: "easeOut", delay: 0.15 }}
              className="absolute w-32 h-32 rounded-full border-2 border-amber-400/50 bg-amber-400/10"
            />
            <motion.div
              initial={{ scale: 0.2, opacity: 0.5 }}
              animate={{ scale: 3.8, opacity: 0 }}
              transition={{ duration: 2.0, ease: "easeOut", delay: 0.3 }}
              className="absolute w-32 h-32 rounded-full border-2 border-rose-400/40"
            />
          </div>

          {/* Confetti Explosion Burst */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                  scale: 0.3,
                  rotate: 0,
                }}
                animate={{
                  x: p.x,
                  y: p.y,
                  opacity: [1, 1, 0],
                  scale: [0.3, 1.2, 0.8],
                  rotate: p.rotation + 360,
                }}
                transition={{
                  duration: 1.8 + Math.random() * 0.6,
                  ease: [0.25, 1, 0.5, 1],
                }}
                className="absolute"
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.shape !== "sparkle" ? p.color : "transparent",
                  borderRadius: p.shape === "circle" ? "50%" : p.shape === "square" ? "3px" : "0",
                }}
              >
                {p.shape === "sparkle" && (
                  <Sparkles className="w-4 h-4" style={{ color: p.color }} />
                )}
              </motion.div>
            ))}
          </div>

          {/* Animated Celebrating Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-primary/20 via-amber-500/20 to-primary/20 border border-primary/40 text-center shadow-lg relative overflow-hidden backdrop-blur-sm pointer-events-auto"
          >
            {/* Shimmer overlay line */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              className="absolute inset-0 w-1/2"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              }}
            />
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-md animate-bounce">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-right">
                <h4 className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                  إنجاز مكتمل! روتين اليوم 100%
                  <Sparkles className="w-4 h-4 text-amber-500 inline" />
                </h4>
                <p className="text-xs text-muted-foreground">
                  أنتِ رائعة! حافظتِ على صحة ونضارة بشرتكِ اليوم ✦
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
