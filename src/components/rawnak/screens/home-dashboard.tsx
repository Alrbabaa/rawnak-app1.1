"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useRealWeather } from "@/hooks/use-real-weather";
import { getRawnakMessage } from "@/lib/rawnak-voice";
import { pickDiscoveryCards } from "@/lib/discovery-cards";
import {
  CONCERN_LABEL,
  DAILY_TIPS,
  RAWNAK_PICKS,
  PRODUCT_DEPARTMENTS,
  type RawnakPick,
} from "@/lib/data";
import { formatConvertedPrice, getCountryCodeForCountryName } from "@/lib/currencies";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircleHeart,
  Camera,
  BookOpen,
  Sun,
  Moon,
  Check,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Images,
  Flame,
  ChevronLeft,
  Droplets,
  Wind,
  Quote,
  CalendarHeart,
  GraduationCap,
  Crown,
  ShoppingBag,
  Star,
  Heart,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SkinProgressChart } from "@/components/rawnak/skin-progress-chart";
import { SkinMetricsTrendsChart } from "@/components/rawnak/skin-metrics-trends-chart";
import { triggerSuccessHaptic } from "@/lib/haptics";
import { RoutineCompletionCelebration } from "@/components/rawnak/confetti-celebration";
import { SkincareStreakIndicator } from "@/components/rawnak/skincare-streak-indicator";
import { PartnerDiscountCardsSection } from "@/components/rawnak/partner-discount-cards";
import { useHasVipAccess } from "@/hooks/use-vip-access";

export function HomeDashboard() {
  const {
    profile,
    routine,
    toggleRoutineStep,
    analyses,
    scans,
    chatMessages,
    streak,
    setView,
    checkIn,
    unlockAchievement,
    likedPicks,
    toggleLikedPick,
    selectedCurrency,
    selectedCountry,
  } = useAppStore();
  const hasVipAccess = useHasVipAccess();
  const [tipIndex] = useState(() => new Date().getDate() % DAILY_TIPS.length);
  const { status: weatherStatus, weather } = useRealWeather();
  // One-time coachmark on the first-analysis CTA — no new dependency, just
  // a plain localStorage flag (matches the pattern already used for other
  // client-only prefs in this codebase). Dismissed permanently the moment
  // she's seen it once, or the instant she has an analysis (the CTA itself
  // is gone by then, so there's nothing left to point at).
  const [showCtaHint, setShowCtaHint] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("rawnak_seen_home_cta_hint")) return;
    void Promise.resolve().then(() => setShowCtaHint(true));
  }, []);
  const dismissCtaHint = () => {
    setShowCtaHint(false);
    try {
      localStorage.setItem("rawnak_seen_home_cta_hint", "1");
    } catch {}
  };

  const [homePicks, setHomePicks] = useState<RawnakPick[]>(RAWNAK_PICKS);
  const countryCode = useMemo(() => getCountryCodeForCountryName(selectedCountry), [selectedCountry]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/picks?country=${encodeURIComponent(countryCode)}`);
        const data = await res.json();
        if (active && res.ok && data.picks && data.picks.length > 0) {
          setHomePicks(data.picks);
        }
      } catch {
        // fallback
      }
    })();
    return () => {
      active = false;
    };
  }, [countryCode]);

  const morningSteps = routine.filter((r) => r.time === "morning");
  const eveningSteps = routine.filter((r) => r.time === "evening");
  const doneCount = routine.filter((r) => r.done).length;
  const progress = Math.round((doneCount / routine.length) * 100);

  // Purely visual "routine complete" flourish — fires once on the exact
  // moment progress transitions to 100% (not on every render while it's
  // already 100%, e.g. navigating back to this screen later). Deliberately
  // independent of checkIn()/streak logic below, which is untouched.
  const [justCompleted, setJustCompleted] = useState(false);
  const wasCompleteRef = useRef(progress === 100);
  useEffect(() => {
    const isComplete = progress === 100;
    if (isComplete && !wasCompleteRef.current) {
      setJustCompleted(true);
      triggerSuccessHaptic();
      const t = setTimeout(() => setJustCompleted(false), 3200);
      wasCompleteRef.current = true;
      return () => clearTimeout(t);
    }
    wasCompleteRef.current = isComplete;
  }, [progress]);

  const recentAnalysis = analyses[0];
  const previousAnalysis = analyses[1];
  const analysisDelta =
    recentAnalysis && previousAnalysis ? recentAnalysis.overall - previousAnalysis.overall : null;

  // Rawnak's proactive line — one message, weather/streak-aware, not spam.
  const rawnakMessage = useMemo(
    () => getRawnakMessage({ streak, weather: weatherStatus === "ready" ? weather : null }),
    [streak, weather, weatherStatus]
  );

  const discoveryCards = useMemo(
    () => pickDiscoveryCards({ analyses: analyses.length, scans: scans.length, chatMessages: chatMessages.length }),
    [analyses.length, scans.length, chatMessages.length]
  );

  // These 6 used to duplicate half the bottom nav (chat/academy/picks each
  // already have their own tab there — see bottom-nav.tsx, especially now
  // that "المنتجات" got its own tab instead of living under academy). This
  // grid now only surfaces things that are NOT one tap away already:
  // analysis, articles, and the planner (none are in the bottom nav), plus
  // three more that were previously buried — comparing before/after,
  // inviting a friend (the referral Plus trial), and achievements.
  const quickActions = [
    { icon: Camera, label: "تحليل البشرة", view: "analysis" as const },
    { icon: BookOpen, label: "مقالات الجمال", view: "articles" as const },
    { icon: CalendarHeart, label: "مخطط المناسبات", view: "planner" as const },
    { icon: Images, label: "قبل/بعد", view: "compare" as const },
    { icon: Heart, label: "ادعي صديقة", view: "invite" as const },
    { icon: Star, label: "إنجازاتي", view: "achievements" as const },
  ];

  return (
    <div className="space-y-5 py-3">
      {/* Hero greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl rawnak-gradient p-5 rawnak-shadow"
      >
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-foreground/80">
              {profile.name ? `أهلًا ${profile.name} ♡` : "أهلًا بكِ مجدداً ♡"}
            </p>
            <div className="flex items-center gap-2">
              {hasVipAccess ? (
                <Badge className="rawnak-rosegold-gradient text-black font-extrabold text-[10px] px-2.5 py-0.5 border-none shadow-xs">
                  <Crown className="w-3 h-3 ml-1" />
                  عضوية VIP
                </Badge>
              ) : (
                <button
                  onClick={() => setView("vip")}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 bg-white/30 dark:bg-black/20 px-2.5 py-0.5 rounded-full"
                >
                  <Crown className="w-3 h-3 text-amber-500" />
                  انضمي لـ VIP
                </button>
              )}
            </div>
          </div>

          <h1 className="text-xl font-extrabold leading-snug rawnak-gold-text">
            {rawnakMessage}
          </h1>

          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/40 dark:bg-black/30 backdrop-blur-xs rounded-full px-3 py-1.5 shadow-2xs">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-foreground">{streak} يوم متتالي</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/40 dark:bg-black/30 backdrop-blur-xs rounded-full px-3 py-1.5 shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-foreground">{progress}% إنجاز اليوم</span>
            </div>
            {weatherStatus === "ready" && weather && (
              <div className="flex items-center gap-1 bg-white/40 dark:bg-black/30 backdrop-blur-xs rounded-full px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs">
                <span>{weather.emoji}</span>
                <span>{weather.tempC}°م</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* First-run primary CTA — a brand-new user with zero analyses has no
          way to know which of the 6 quick actions below matters most, so
          this single unmissable card replaces guessing with one obvious
          next step. Disappears for good the moment she has one analysis;
          the quick-actions grid and discovery cards below are exactly as
          discoverable as before for everything after that first step. */}
      {analyses.length === 0 && (
        <div className="relative">
          {showCtaHint && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-3 right-4 z-20 flex items-center gap-1.5 bg-foreground text-background text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg"
            >
              👋 ابدئي هنا
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissCtaHint();
                }}
                className="opacity-70 hover:opacity-100"
                aria-label="إغلاق"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              dismissCtaHint();
              setView("analysis");
            }}
            className="w-full text-right relative overflow-hidden rounded-3xl rawnak-rosegold-gradient p-5 rawnak-shadow group active:scale-[0.99] transition-transform"
          >
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/25 blur-2xl" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 shrink-0 rounded-2xl bg-black/10 grid place-items-center">
                <Camera className="w-7 h-7 text-black" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-extrabold text-black/60 mb-0.5">ابدئي من هنا ✦</p>
                <h2 className="text-base font-extrabold text-black leading-snug">
                  حللي بشرتكِ الآن — صورة واحدة وتحصلين على تقييم وروتين مخصص فورًا
                </h2>
              </div>
              <ChevronLeft className="w-5 h-5 text-black/70 shrink-0 group-active:-translate-x-1 transition-transform" />
            </div>
          </motion.button>
        </div>
      )}

      {/* Quick actions — a fast-access grid for someone who already knows
          the app. A brand-new user has nothing to be "quick" about yet, so
          this stays hidden until her first analysis; the CTA above plus
          the discovery cards below (which already cover chat, cabinet,
          academy, and planner) are what guide her until then. */}
      {analyses.length > 0 && (
      <div className="grid grid-cols-3 gap-2.5">
        {quickActions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setView(a.view)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-14 h-14 rounded-2xl grid place-items-center glass-card rawnak-glow group-active:scale-95 transition-transform">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <span className="text-[11px] font-semibold text-center leading-tight">
                {a.label}
              </span>
            </motion.button>
          );
        })}
      </div>
      )}

      {/* Today's routine zone — streak indicator sits directly beside the
          checklist it's about, instead of being separated by Discovery/
          Products/Partner sections further up the page (previously the
          streak ring, the "continue journey" banner, and this checklist
          were three separate touchpoints for the same "did today's
          routine happen" question, scattered across the whole page). */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
      >
        <SkincareStreakIndicator justCompleted={justCompleted} />
      </motion.div>

      {/* Daily routine tracker */}
      <motion.div
        animate={
          justCompleted
            ? { boxShadow: ["0 0 0 0 oklch(0.72 0.085 45 / 0)", "0 0 0 6px oklch(0.72 0.085 45 / 0.25)", "0 0 0 0 oklch(0.72 0.085 45 / 0)"] }
            : {}
        }
        transition={{ duration: 1.4, ease: "easeOut" }}
        className="rounded-3xl"
      >
      <Card className="p-5 rounded-3xl border-border overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            روتين اليوم
          </h2>
          <button
            onClick={() => {
              if (progress === 100) {
                checkIn();
                unlockAchievement("streak-3");
                if (streak + 1 >= 7) unlockAchievement("streak-7");
              }
              setView("profile");
            }}
            className="text-xs text-primary font-semibold flex items-center gap-0.5"
          >
            التفاصيل
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Celebrating Confetti & Ripple Banner */}
        <RoutineCompletionCelebration show={justCompleted || (doneCount > 0 && doneCount === routine.length)} />

        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">تقدّم اليوم</span>
            <span className="font-bold">{doneCount}/{routine.length}</span>
          </div>
          <div className="relative overflow-hidden rounded-full">
            <Progress value={progress} className="h-2.5" />
            {justCompleted && (
              <motion.div
                aria-hidden
                initial={{ x: "-120%" }}
                animate={{ x: "120%" }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(75deg, transparent 35%, oklch(1 0 0 / 0.7) 50%, transparent 65%)",
                }}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <RoutineSection
            title="صباحي"
            icon={<Sun className="w-4 h-4 text-amber-500" />}
            steps={morningSteps}
            onToggle={toggleRoutineStep}
          />
          <RoutineSection
            title="مسائي"
            icon={<Moon className="w-4 h-4 text-indigo-400" />}
            steps={eveningSteps}
            onToggle={toggleRoutineStep}
          />
        </div>
      </Card>
      </motion.div>

      {/* Two columns: recent analysis + weather */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView(recentAnalysis ? "results" : "analysis")}
          className="text-right"
        >
          <Card className="p-4 rounded-2xl border-border h-full hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full rawnak-rose-gradient grid place-items-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold">آخر تحليل</span>
            </div>
            {recentAnalysis ? (
              <>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-extrabold rawnak-gold-text">
                    {recentAnalysis.overall}
                    <span className="text-base text-muted-foreground">/100</span>
                  </p>
                  {analysisDelta !== null && analysisDelta !== 0 && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full",
                        analysisDelta > 0
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      )}
                    >
                      {analysisDelta > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {Math.abs(analysisDelta)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {recentAnalysis.skinType}
                </p>
                {analyses.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setView("compare");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary mt-2 hover:underline"
                  >
                    <Images className="w-3 h-3" />
                    شوفي الفرق قبل/بعد
                  </span>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                لم تحدّدي بعد. ابدئي تحليل بشرتك الآن ✦
              </p>
            )}
          </Card>
        </button>

        <button onClick={() => setView("library")} className="text-right">
          <Card className="p-4 rounded-2xl border-border h-full hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full rawnak-gradient grid place-items-center">
                <Droplets className="w-4 h-4 text-foreground" />
              </div>
              <span className="text-sm font-bold">حالة الجو</span>
            </div>
            {weatherStatus === "ready" && weather ? (
              <p className="text-sm font-semibold text-foreground">
                {weather.label} {weather.emoji} · {weather.tempC}°
              </p>
            ) : weatherStatus === "loading" ? (
              <p className="text-sm font-semibold text-muted-foreground">جارٍ التحديد...</p>
            ) : weatherStatus === "denied" ? (
              <p className="text-sm font-semibold text-muted-foreground">فعّلي الموقع لعرض الطقس</p>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">اختاري طقسكِ يدويًا</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              نصائح حسب الطقس
            </p>
          </Card>
        </button>
      </div>

      {/* Skin Progress Trends Recharts Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-4"
      >
        <SkinMetricsTrendsChart />
        <SkinProgressChart />
      </motion.div>

      {/* Profile summary */}
      {profile.skinType && (
        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">ملف بشرتكِ</span>
            <button
              onClick={() => setView("profile")}
              className="text-xs text-primary font-semibold"
            >
              تعديل
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="rounded-full">
              {profile.skinType === "oily" ? "دهنية" : profile.skinType === "dry" ? "جافة" : profile.skinType === "combination" ? "مختلطة" : profile.skinType === "sensitive" ? "حساسة" : "عادية"}
            </Badge>
            {profile.concerns?.slice(0, 3).map((c) => (
              <Badge key={c} variant="outline" className="rounded-full">
                {CONCERN_LABEL[c] || c}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Discovery Section — Guides users smoothly to explore Cabinet, Academy, AI Beauty Expert, etc. */}
      {discoveryCards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              استكشفي مميزات رَونق
            </h2>
            <span className="text-xs text-muted-foreground font-medium">دليل الجمال الذكي</span>
          </div>

          <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-1.5 -mx-4 px-4">
            {discoveryCards.map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => setView(c.view)}
                  className="shrink-0 w-64 text-right group"
                >
                  <Card className="p-4 rounded-3xl border-primary/20 bg-card hover:border-primary/40 transition-all shadow-xs h-full flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-24 h-24 rawnak-rosegold-gradient opacity-10 rounded-full blur-xl pointer-events-none group-hover:opacity-25 transition-opacity" />

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {c.badge}
                        </span>
                        <div className="w-8 h-8 rounded-xl rawnak-rosegold-gradient grid place-items-center shadow-2xs group-hover:scale-105 transition-transform">
                          <Icon className="w-4 h-4 text-black" />
                        </div>
                      </div>

                      <h3 className="text-xs font-extrabold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
                        {c.title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                        {c.subtitle}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-bold text-primary">
                      <span>{c.actionText}</span>
                      <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </Card>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dedicated products section — its own clearly-labeled zone (not a
          throwaway teaser) with the department index up top so she can see
          the full breadth of رَونق's catalog (beauty & smart devices,
          makeup, fragrance, fashion, accessories) at a glance, then a
          sample of picks below. Full filtering still lives on the picks
          screen (setView("picks")) — this stays a preview, not a second
          catalog. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-extrabold flex items-center gap-1.5 text-foreground">
            <ShoppingBag className="w-4.5 h-4.5 text-primary" />
            المنتجات
          </h2>
          <button
            onClick={() => setView("picks")}
            className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5 shrink-0"
          >
            تصفّحي الكل
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {PRODUCT_DEPARTMENTS.map((d) => (
            <button
              key={d.id}
              onClick={() => setView("picks")}
              className="shrink-0 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary/40 transition-colors"
            >
              <span>{d.emoji}</span>
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {homePicks.slice(0, 6).map((pick, i) => {
            const liked = likedPicks.includes(pick.id);
            return (
              <motion.div
                key={pick.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="shrink-0 w-36"
              >
                <Card
                  onClick={() => setView("picks")}
                  className="p-3 rounded-2xl border-border hover:border-primary/40 transition-all cursor-pointer h-full"
                >
                  <div className="w-full aspect-square rounded-xl rawnak-gradient grid place-items-center text-3xl overflow-hidden relative">
                    {pick.photoUrl ? (
                      <img src={pick.photoUrl} alt={pick.name} className="w-full h-full object-cover" />
                    ) : (
                      pick.emoji
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikedPick(pick.id);
                      }}
                      className="absolute top-1 left-1 w-6 h-6 grid place-items-center rounded-full bg-background/80 backdrop-blur-sm"
                    >
                      <Heart className={cn("w-3.5 h-3.5", liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground")} />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-2">{pick.brand}</p>
                  <h4 className="font-bold text-xs leading-tight line-clamp-1">{pick.name}</h4>
                  <span className="text-xs font-extrabold rawnak-gold-text block mt-1">
                    {formatConvertedPrice(pick.price, selectedCurrency)}
                  </span>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Partner Discount Cards & Featured Plus Partner Showcase */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
      >
        <PartnerDiscountCardsSection />
      </motion.div>

      {/* Daily tip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-3xl bg-card border border-border p-5"
      >
        <Quote className="absolute top-3 left-3 w-10 h-10 text-primary/10" />
        <div className="relative z-10">
          <Badge className="mb-2 bg-primary/10 text-primary hover:bg-primary/15">
            نصيحة اليوم
          </Badge>
          <p className="text-base font-medium leading-relaxed text-foreground">
            {DAILY_TIPS[tipIndex]}
          </p>
        </div>
      </motion.div>

      {/* Premium entry point — a single elegant nudge, not a paywall */}
      {!hasVipAccess && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => setView("vip")}
          className="w-full text-right"
        >
          <Card className="relative overflow-hidden p-4 rounded-2xl border-primary/20 rawnak-rosegold-gradient flex items-center gap-3">
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
            <div className="relative z-10 w-10 h-10 rounded-full bg-black/10 grid place-items-center shrink-0">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div className="relative z-10 flex-1 min-w-0">
              <p className="font-bold text-black text-sm">تحبّين رَونق؟ تخيّلي نسخة VIP منها ✦</p>
              <p className="text-xs text-black/70 mt-0.5">اكتشفي ما يفتحه لكِ الاشتراك</p>
            </div>
            <ChevronLeft className="relative z-10 w-4 h-4 text-black/60 shrink-0" />
          </Card>
        </motion.button>
      )}

      {/* Motivational footer */}
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          ✦ أنتِ تستحقين العناية، كل يوم ✦
        </p>
      </div>
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
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs font-bold text-muted-foreground">{title}</span>
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
                  s.done
                    ? "bg-primary border-primary text-primary-foreground shadow-xs"
                    : "border-border"
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

              {/* Individual checkmark ripple effect */}
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
                s.done ? "text-muted-foreground line-through" : "text-foreground font-medium"
              )}
            >
              {s.name}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
