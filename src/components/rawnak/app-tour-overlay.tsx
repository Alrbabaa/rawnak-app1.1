"use client";

/**
 * A one-time, skippable feature tour shown to a user right after she
 * finishes onboarding — separate from `hasOnboarded` (which just means
 * "filled in the skin-profile form"). This is purely "does she know what's
 * in the app", tracked by its own local flag so it never re-triggers once
 * dismissed, whether skipped or completed.
 *
 * Local-only by design (not synced to Firestore/profile): a one-time
 * product tour is a "have I seen this screen before" concern, not account
 * data — the same class of thing as WelcomeBackOverlay's sessionStorage
 * flag, just persistent across sessions instead of per-session.
 */

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ScanFace,
  GraduationCap,
  FlaskConical,
  CalendarHeart,
  Trophy,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";
import { useAppStore, type View } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { triggerSelectionHaptic } from "@/lib/haptics";

const TOUR_SEEN_KEY = "rawnak_app_tour_seen_v1";

type TourStep = {
  icon: ElementType;
  title: string;
  desc: string;
  view?: View;
  cta?: string;
};

const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: "أهلًا بكِ في رَونق 🌸",
    desc: "رفيقتكِ اليومية للعناية بالبشرة والجمال — تحليل ذكي، محتوى تعليمي موثوق، ومتابعة لروتينكِ كله من مكان واحد. جولة سريعة قبل ما نبدأ؟",
  },
  {
    icon: ScanFace,
    title: "حللي بشرتك بذكاء",
    desc: "التقطي صورة واحصلي على تحليل فوري لحالة بشرتك مع توصيات مخصصة لكِ — ونتابع تطورها معكِ مع الوقت.",
    view: "analysis",
    cta: "جربي التحليل",
  },
  {
    icon: GraduationCap,
    title: "أكاديمية رَونق",
    desc: "دروس فيديو تعليمية حقيقية من صانعات محتوى موثوقات على يوتيوب، منظّمة بتصنيفات واختبارات ونقاط خبرة لتتابعي تقدمكِ في التعلّم.",
    view: "academy",
    cta: "استكشفي الأكاديمية",
  },
  {
    icon: FlaskConical,
    title: "خزانة منتجاتك",
    desc: "احفظي منتجاتكِ، تابعي تواريخ الانتهاء، وقارني بين المنتجات لتختاري الأنسب لبشرتكِ.",
    view: "cabinet",
    cta: "افتحي الخزانة",
  },
  {
    icon: CalendarHeart,
    title: "رحلتكِ وروتينكِ",
    desc: "خطّطي روتينكِ اليومي، تابعي الإنجاز يومًا بيوم، وفعّلي التذكيرات إن أردتِ نبضة لطيفة تذكّركِ بالعناية بنفسكِ.",
    view: "journey",
    cta: "ابدئي روتينكِ",
  },
  {
    icon: Trophy,
    title: "ملفكِ ومكافآتكِ",
    desc: "تابعي مستواكِ، شاراتكِ، وترتيبكِ في الأكاديمية من ملفكِ الشخصي في أي وقت.",
    view: "profile",
    cta: "لملفي الشخصي",
  },
];

export function AppTourOverlay() {
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const setView = useAppStore((s) => s.setView);

  const [show, setShow] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !hasOnboarded) return;
    try {
      if (localStorage.getItem(TOUR_SEEN_KEY)) return;
    } catch {
      return;
    }

    // Give WelcomeBackOverlay's own ~2s auto-dismiss window room to finish
    // first if it's also about to show this session, so the two never
    // stack on top of each other.
    const sawWelcomeBackThisSession =
      typeof window !== "undefined" && sessionStorage.getItem("rawnak_welcome_back_seen");
    const delay = sawWelcomeBackThisSession ? 300 : 2300;

    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [hasOnboarded]);

  const markSeen = () => {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "true");
    } catch {}
    setShow(false);
  };

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const Icon = step?.icon;

  if (!show || !step) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-md px-4 pb-6 sm:pb-4"
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm rounded-3xl border border-border/50 bg-card shadow-2xl overflow-hidden"
        >
          {/* Skip — always available, top corner, never hidden behind steps */}
          <button
            onClick={markSeen}
            className="absolute top-3 left-3 z-10 flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground bg-muted/70 hover:bg-muted px-2.5 py-1.5 rounded-full transition-colors"
            aria-label="تخطي الجولة التعريفية"
          >
            <X className="w-3 h-3" />
            تخطي
          </button>

          <div className="p-6 pt-14 flex flex-col items-center text-center">
            <motion.div
              key={stepIndex}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="w-16 h-16 rounded-2xl rawnak-gradient flex items-center justify-center shadow-lg mb-4"
            >
              <Icon className="w-8 h-8 text-white" />
            </motion.div>

            <motion.div
              key={`text-${stepIndex}`}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.3 }}
            >
              <h3 className="text-lg font-black text-foreground mb-2">{step.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">{step.desc}</p>
            </motion.div>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mt-5 mb-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === stepIndex ? "w-5 bg-primary" : "w-1.5 bg-muted"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="p-4 pt-1 flex flex-col gap-2 border-t border-border/40 bg-muted/20">
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button
                  variant="outline"
                  className="rounded-xl h-11 px-4"
                  onClick={() => {
                    triggerSelectionHaptic();
                    setStepIndex((i) => Math.max(0, i - 1));
                  }}
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              <Button
                className="flex-1 rawnak-gradient-btn font-extrabold text-xs h-11 rounded-xl gap-2"
                onClick={() => {
                  triggerSelectionHaptic();
                  if (isLast) {
                    markSeen();
                  } else {
                    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
                  }
                }}
              >
                <span>{isLast ? "ابدئي الاستكشاف ✨" : "التالي"}</span>
                {!isLast && <ArrowLeft className="w-4 h-4" />}
              </Button>
            </div>

            {step.view && step.cta && (
              <button
                className="text-[11px] font-bold text-primary hover:underline py-1"
                onClick={() => {
                  markSeen();
                  setView(step.view as View);
                }}
              >
                {step.cta} الآن مباشرة ←
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
