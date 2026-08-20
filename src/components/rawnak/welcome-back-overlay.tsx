"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowLeft, Heart, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function WelcomeBackOverlay() {
  const isAuthed = useAppStore((s) => s.isAuthed);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const isGuest = useAppStore((s) => s.isGuest);
  const profile = useAppStore((s) => s.profile);
  
  const [show, setShow] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const hasSeen = sessionStorage.getItem("rawnak_welcome_back_seen");
      return !hasSeen;
    }
    return false;
  });

  const isEligible = isAuthed && hasOnboarded && !isGuest;

  useEffect(() => {
    if (isEligible && show) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("rawnak_welcome_back_seen", "true");
      }

      // Auto dismiss after 2 seconds
      const timer = setTimeout(() => {
        setShow(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isEligible, show]);

  if (!isEligible || !show) return null;

  const displayName = profile.name && profile.name !== "أنثى أنيقة" && profile.name !== "ضيفة"
    ? profile.name
    : "";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl px-6 text-center select-none"
        >
          {/* Decorative ambient background glows */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 0.4 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute top-1/4 -right-16 w-72 h-72 rounded-full rawnak-gradient blur-3xl pointer-events-none"
          />
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.3 }}
            transition={{ duration: 1.2, delay: 0.2 }}
            className="absolute bottom-1/4 -left-16 w-72 h-72 rounded-full blur-3xl pointer-events-none"
            style={{ background: "oklch(0.8 0.1 65 / 0.4)" }}
          />

          <div className="relative z-10 max-w-sm w-full flex flex-col items-center">
            {/* Animated Brand Logo */}
            <motion.div
              initial={{ scale: 0.8, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-6"
            >
              <div className="relative">
                <img
                  src="/rawnak-logo.jpg"
                  alt="رَونق"
                  className="w-24 h-24 rounded-3xl object-cover shadow-xl border-2 border-primary/20 rawnak-glow"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                  className="absolute -bottom-2 -left-2 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md"
                >
                  <Sparkles className="w-4 h-4 fill-primary-foreground" />
                </motion.div>
              </div>
            </motion.div>

            {/* Welcome Greeting */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-2 mb-6"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs mb-1">
                <Heart className="w-3.5 h-3.5 fill-primary text-primary" />
                <span>عوْدَة مَيْمُونَة ✨</span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-foreground">
                {displayName ? `أهلاً بكِ مجدداً، ${displayName} 💕` : "أهلاً بكِ مجدداً في رَونق 💕"}
              </h2>

              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                يسعدنا انضمامكِ اليوم.. روتين عنايتكِ اليومي ومنتجاتكِ بانتظاركِ بالكامل.
              </p>
            </motion.div>

            {/* Smooth Progress / Quick entry indicator */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full space-y-3"
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1">
                <span className="flex items-center gap-1 text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" /> تم جهوزية بيئة العناية
                </span>
                <span>توجيه تلقائي...</span>
              </div>

              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.6, ease: "easeInOut" }}
                  className="h-full rawnak-gradient rounded-full"
                />
              </div>

              <Button
                onClick={() => setShow(false)}
                className="w-full mt-2 rawnak-gradient-btn font-extrabold text-xs h-11 rounded-2xl shadow-md gap-2"
              >
                <span>الدخول مباشرة للرئيسية</span>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
