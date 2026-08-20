"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

export function SplashScreen() {
  const setView = useAppStore((s) => s.setView);
  const isAuthed = useAppStore((s) => s.isAuthed);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);

  useEffect(() => {
    const t = setTimeout(() => {
      if (isAuthed && hasOnboarded) setView("home");
      else setView("auth");
    }, 2600);
    return () => clearTimeout(t);
  }, [isAuthed, hasOnboarded, setView]);

  return (
    <div className="fixed inset-0 overflow-hidden flex items-center justify-center bg-background">
      {/* Decorative gradient blobs */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.6 }}
        transition={{ duration: 1.4 }}
        className="absolute -top-20 -right-20 w-80 h-80 rounded-full rawnak-gradient blur-3xl"
      />
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.5 }}
        transition={{ duration: 1.4, delay: 0.2 }}
        className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-3xl"
        style={{ background: "oklch(0.78 0.09 70 / 0.5)" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="float-anim"
        >
          {/* Official Rawnak brand logo */}
          <motion.img
            src="/rawnak-logo.jpg"
            alt="رَونق"
            width={120}
            height={120}
            className="w-[120px] h-[120px] rounded-3xl object-cover rawnak-glow"
            initial={{ filter: "blur(8px)" }}
            animate={{ filter: "blur(0px)" }}
            transition={{ duration: 1 }}
          />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <h1 className="text-5xl font-extrabold rawnak-gold-text mb-3">
            رَونق
          </h1>
          <p className="text-base text-muted-foreground max-w-xs">
            خبيرة الجمال والعناية بالبشرة الشخصية بالذكاء الاصطناعي
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex gap-1.5 mt-4"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="typing-dot w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-10 flex flex-col items-center gap-2"
      >
        <p className="text-xs text-muted-foreground">
          ✦ جمالكِ يستحق الأفضل ✦
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <img
            src="/artistic-minds-logo.png"
            alt="Artistic Minds"
            className="w-5 h-5 rounded object-cover"
          />
          <span className="text-[10px] text-muted-foreground/70">
            منتج من Artistic Minds
          </span>
        </div>
      </motion.div>
    </div>
  );
}
