"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { useAppStore } from "@/lib/store";
import {
  Droplets,
  Sparkle,
  Eye,
  CircleDot,
  Waves,
  Palette,
  ChevronLeft,
  Share2,
  Lightbulb,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Image as ImageIcon,
  Crown,
  Lock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { scoreLabel, glowCaption, scoreColorClass } from "@/lib/skin-score";
import { useHasVipAccess } from "@/hooks/use-vip-access";
import { generateGlowCard } from "@/lib/share/glow-card";
import { shareImage } from "@/lib/share/share-image";
import { trackEvent } from "@/lib/track-event";

const METRICS = [
  { key: "hydration", label: "الترطيب", icon: Droplets, color: "from-sky-400 to-blue-400" },
  { key: "acne", label: "نقاء البشرة", icon: Sparkle, color: "from-emerald-400 to-teal-400" },
  { key: "darkCircles", label: "الهالات", icon: Eye, color: "from-violet-400 to-purple-400" },
  { key: "pores", label: "المسام", icon: CircleDot, color: "from-amber-400 to-orange-400" },
  { key: "texture", label: "النسيج", icon: Waves, color: "from-rose-400 to-pink-400" },
  { key: "evenness", label: "توحيد اللون", icon: Palette, color: "from-fuchsia-400 to-rose-400" },
] as const;

function scoreColor(n: number) {
  return scoreColorClass(n);
}

export function ResultsScreen() {
  const currentAnalysis = useAppStore((s) => s.currentAnalysis);
  const analyses = useAppStore((s) => s.analyses);
  const setView = useAppStore((s) => s.setView);
  const unlockAchievement = useAppStore((s) => s.unlockAchievement);
  const profile = useAppStore((s) => s.profile);
  const hasVipAccess = useHasVipAccess();
  const updateProfile = useAppStore((s) => s.updateProfile);

  const analysis = currentAnalysis || analyses[0];
  const targetScore = analysis?.overall ?? 0;

  // The signature "glow reveal" moment: the score counts up in sync with the
  // ring filling, then a one-time shimmer sweep + poetic caption fade in.
  // Placed before any early return so hook order stays stable.
  const [revealed, setRevealed] = useState(false);
  const countMotion = useMotionValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Reset the reveal for a new analysis (e.g. navigating between past
    // results) — a deliberate one-shot sync tied to `targetScore` changing,
    // not a cascading-render concern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevealed(false);
    countMotion.set(0);
    const controls = animate(countMotion, targetScore, {
      duration: 1.5,
      ease: "easeOut",
      onComplete: () => setRevealed(true),
    });
    const unsub = countMotion.on("change", (v) => setDisplayValue(Math.round(v)));
    return () => {
      controls.stop();
      unsub();
    };
  }, [targetScore, countMotion]);

  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!analysis) return;
    setSharing(true);
    try {
      const blob = await generateGlowCard({
        overall: analysis.overall,
        skinType: analysis.skinType,
        imageData: profile.shareCardIncludePhoto ? analysis.imageData : null,
      });
      const result = await shareImage({
        blob,
        filename: `rawnak-glow-${Math.round(analysis.overall)}.png`,
        title: "توهجي مع رَونق ✦",
        text: "جرّبي تحليل بشرتكِ المجاني على رَونق ✦ rawnak.app",
      });
      if (result.fallback === "downloaded") {
        toast.success("تم حفظ البطاقة — شاركيها من معرض الصور ✦");
        trackEvent("glow_card_shared", { method: "downloaded" });
      } else if (result.fallback === "cancelled") {
        // Person just backed out of the share sheet — no toast needed.
      } else if (result.ok) {
        toast.success("تم فتح المشاركة ✦");
        trackEvent("glow_card_shared", { method: "share_sheet" });
      }
    } catch {
      toast.error("تعذّرت مشاركة البطاقة، حاولي مرة أخرى");
    } finally {
      setSharing(false);
    }
  };

  // ROOT CAUSE OF THE P0 FREEZE (see investigation notes below): these two
  // calls used to run directly in the render body, unconditionally, on
  // every single render. unlockAchievement()'s own "already unlocked" guard
  // still returns a *new* (empty) object from its set() call, and Zustand
  // treats any new object as a state change and notifies subscribers —
  // which, combined with this component subscribing to the *entire* store
  // (fixed above), re-triggered this exact render, which called
  // unlockAchievement() again, which notified again... a synchronous
  // infinite loop, with a multi-megabyte localStorage write (see the
  // partialize fix in store.ts) on *every single iteration*. That combination
  // is exactly what produces an Android ANR: not a slow operation, a loop
  // that never yields the main thread back to the browser/WebView at all.
  // Scoping this to a proper effect that only runs once per distinct
  // analysis fixes it at the source.
  useEffect(() => {
    if (!analysis) return;
    if (analyses.length >= 5) unlockAchievement("glow-up");
    unlockAchievement("first-analysis");
  }, [analysis?.id, analyses.length, unlockAchievement]);

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground mb-4">لا يوجد تحليل لعرضه</p>
        <Button onClick={() => setView("analysis")} className="rawnak-rose-gradient text-white">
          ابدئي تحليلًا جديدًا
        </Button>
      </div>
    );
  }

  const metrics = analysis.metrics;

  // Automatic "before / after" — the real payoff of tracking over time isn't
  // the single score, it's seeing it move. Find whichever saved analysis sits
  // immediately before this one chronologically (analyses is newest-first),
  // so this works whether she's viewing her latest result or an older one
  // from her history.
  const analysisIndex = analyses.findIndex((a) => a.id === analysis.id);
  const previousAnalysis =
    analysisIndex >= 0 && analysisIndex < analyses.length - 1
      ? analyses[analysisIndex + 1]
      : null;
  const overallDelta = previousAnalysis ? analysis.overall - previousAnalysis.overall : 0;

  return (
    <div className="py-3 space-y-5">
      {/* Back */}
      <button
        onClick={() => setView("analysis")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
        العودة للتحليل
      </button>

      {/* Hero score — the signature "glow reveal" moment */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl rawnak-gradient p-6 text-center rawnak-shadow"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/30 blur-2xl" />

        {/* Pulsing glow halo — رَونق means "radiance", so the reveal moment
            should literally glow, not just display a number. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[92px] -translate-x-1/2 w-44 h-44 rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.85 0.1 45 / 0.55) 0%, transparent 70%)",
          }}
          animate={
            revealed
              ? { scale: [1, 1.18, 1], opacity: [0.55, 0.85, 0.55] }
              : { scale: 1, opacity: 0 }
          }
          transition={{ duration: 2.6, repeat: revealed ? Infinity : 0, ease: "easeInOut" }}
        />

        {/* One-time shimmer sweep across the badge when the count-up lands */}
        {revealed && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ x: "-120%" }}
            animate={{ x: "120%" }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
            style={{
              background:
                "linear-gradient(75deg, transparent 40%, oklch(1 0 0 / 0.55) 50%, transparent 60%)",
            }}
          />
        )}

        <div className="relative z-10">
          <p className="text-sm text-foreground/70 mb-1">نتيجة بشرتكِ العامة</p>
          <div className="relative inline-block">
            <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
              <circle
                cx="80"
                cy="80"
                r="68"
                fill="none"
                stroke="oklch(1 0 0 / 0.3)"
                strokeWidth="12"
              />
              <motion.circle
                cx="80"
                cy="80"
                r="68"
                fill="none"
                stroke="oklch(0.62 0.11 12)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 68}
                initial={{ strokeDashoffset: 2 * Math.PI * 68 }}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 68 * (1 - analysis.overall / 100),
                }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className="text-5xl font-extrabold text-foreground"
                animate={revealed ? { scale: [1, 1.12, 1] } : {}}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {displayValue}
              </motion.span>
              <span className="text-xs text-foreground/60">من 100</span>
            </div>
          </div>
          <p className="font-bold text-lg mt-3">{scoreLabel(analysis.overall)}</p>
          <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-white/40 text-xs font-semibold text-foreground">
            نوع البشرة: {analysis.skinType}
          </span>

          <motion.p
            className="mt-3 text-sm font-medium text-foreground/80"
            initial={{ opacity: 0, y: 6 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {glowCaption(analysis.overall)}
          </motion.p>
        </div>
      </motion.div>

      {/* Summary */}
      <Card className="p-5 rounded-3xl border-border">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full rawnak-rose-gradient grid place-items-center shrink-0">
            <Sparkle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold mb-1">ملخص التحليل</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {analysis.summary}
            </p>
          </div>
        </div>
      </Card>

      {/* Show the evidence behind the score instead of asking the user to
          trust an unexplained number. Observations are image-grounded;
          possible concerns are deliberately labelled as interpretations. */}
      {(analysis.observations?.length || analysis.possibleConcerns?.length) ? (
        <Card className="p-5 rounded-3xl border-border space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-primary" />
              لماذا ظهرت هذه النتيجة؟
            </h3>
            {typeof analysis.confidence === "number" && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                وضوح التحليل {analysis.confidence}%
              </span>
            )}
          </div>

          {analysis.observations?.length ? (
            <div>
              <p className="text-xs font-bold mb-2">ما ظهر في الصورة</p>
              <div className="space-y-2">
                {analysis.observations.map((observation, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{observation}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {analysis.possibleConcerns?.length ? (
            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-3">
              <p className="text-xs font-bold mb-2">ما قد تعنيه الملاحظات</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                {analysis.possibleConcerns.map((concern, index) => (
                  <li key={index}>• {concern}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.limitations?.length ? (
            <p className="text-[11px] text-muted-foreground border-t border-border pt-3 leading-relaxed">
              حدود القراءة: {analysis.limitations.join("، ")}
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Before / after — automatic comparison with the previous analysis,
          shown the moment she sees her new result instead of buried in a
          separate trends screen. This is the "did it actually work" answer. */}
      {previousAnalysis && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-5 rounded-3xl border-border bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-primary" />
                مقارنة مع تحليلكِ السابق
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {new Date(previousAnalysis.ts).toLocaleDateString("ar", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>

            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-muted-foreground">
                  {previousAnalysis.overall}
                </p>
                <p className="text-[10px] text-muted-foreground">قبل</p>
              </div>
              <ChevronLeft
                className={cn(
                  "w-6 h-6 -scale-x-100",
                  overallDelta > 0
                    ? "text-emerald-500"
                    : overallDelta < 0
                      ? "text-rose-500"
                      : "text-muted-foreground"
                )}
              />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-foreground">{analysis.overall}</p>
                <p className="text-[10px] text-muted-foreground">الآن</p>
              </div>
              <span
                className={cn(
                  "text-xs font-extrabold px-2.5 py-1 rounded-full",
                  overallDelta > 0
                    ? "bg-emerald-500/10 text-emerald-600"
                    : overallDelta < 0
                      ? "bg-rose-500/10 text-rose-600"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {overallDelta > 0 ? "+" : ""}
                {overallDelta}
              </span>
            </div>

            {/* Per-metric deltas, only for what actually changed */}
            <div className="space-y-1.5 pt-3 border-t border-border/60">
              {METRICS.map((m) => {
                const prevVal = previousAnalysis.metrics?.[m.key] ?? 0;
                const curVal = metrics?.[m.key] ?? 0;
                const d = curVal - prevVal;
                if (d === 0) return null;
                return (
                  <div key={m.key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span
                      className={cn(
                        "font-bold",
                        d > 0 ? "text-emerald-600" : "text-rose-600"
                      )}
                    >
                      {d > 0 ? "+" : ""}
                      {d}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Metrics grid */}
      <div>
        <h3 className="font-bold mb-3 px-1">تفاصيل المؤشرات</h3>
        <div className="grid grid-cols-2 gap-3">
          {METRICS.map((m, i) => {
            const val = metrics?.[m.key] ?? 0;
            const Icon = m.icon;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="p-4 rounded-2xl border-border h-full">
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl bg-gradient-to-br ${m.color} grid place-items-center`}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className={`text-lg font-extrabold ${scoreColor(val)}`}>
                      {val}
                    </span>
                  </div>
                  <p className="text-xs font-semibold mb-1.5">{m.label}</p>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${val}%` }}
                      transition={{ duration: 1, delay: i * 0.08 + 0.3 }}
                      className={`h-full bg-gradient-to-l ${m.color} rounded-full`}
                    />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h3 className="font-bold mb-3 px-1 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          توصيات مخصصة لكِ
        </h3>
        <div className="space-y-2.5">
          {analysis.recommendations.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-3 p-3.5 rounded-2xl bg-card border border-border"
            >
              <span className="w-7 h-7 rounded-full rawnak-gradient grid place-items-center shrink-0 text-xs font-bold text-foreground">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed pt-0.5">{r}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Honest premium teaser: progress is measured from future analyses,
          never invented from a fixed score increase. */}
      {!hasVipAccess ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Card className="relative overflow-hidden p-5 rounded-3xl border-primary/30 bg-card">
            <div className="absolute top-0 right-0 w-32 h-32 rawnak-rosegold-gradient blur-3xl opacity-20 pointer-events-none" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full rawnak-rosegold-gradient text-black font-extrabold text-xs">
                  <Crown className="w-3.5 h-3.5" />
                  رؤى VIP الحصرية
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  معاينة مقفولة
                </span>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-foreground">
                  متابعة تطور بشرتكِ عبر الوقت
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  قارني التحليلات القادمة بهذه القراءة لتعرفي ما تحسّن فعلًا وما يحتاج تعديلًا، اعتمادًا على صوركِ الحقيقية لا على رقم متوقع.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-muted/60 border border-border/80 space-y-2">
                <p className="text-xs font-bold">قراءتكِ المرجعية الحالية: {analysis.overall}/100</p>
                <p className="text-[11px] text-muted-foreground">سيظهر اتجاه التحسن بعد وجود قراءة لاحقة قابلة للمقارنة.</p>
              </div>

              <Button
                onClick={() => setView("vip")}
                className="w-full rounded-xl rawnak-rosegold-gradient text-black font-bold text-xs h-10"
              >
                افتحي سجل المتابعة مع رَونق VIP
                <ChevronLeft className="w-4 h-4 mr-1" />
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : (
        <Card className="p-5 rounded-3xl border-primary/30 bg-primary/5 space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h4 className="font-bold text-sm text-foreground">تحليل VIP المتقدم مفعل ✦</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            تم حفظ تفاصيل هذا التحليل في أرشيفكِ الشخصي. سيقوم النظام بمقارنة التطور مع التحليل القادم تلقائيًا.
          </p>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-1 p-1 rounded-2xl bg-muted text-xs font-bold">
          <button
            onClick={() => updateProfile({ shareCardIncludePhoto: false })}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-colors",
              !profile.shareCardIncludePhoto ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            وضع الخصوصية
          </button>
          <button
            onClick={() => updateProfile({ shareCardIncludePhoto: true })}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-colors",
              profile.shareCardIncludePhoto ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            مع صورتي
          </button>
        </div>
        <Button
          className="w-full rounded-2xl h-12 rawnak-rose-gradient text-white font-bold"
          onClick={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4 ml-1.5" />
          )}
          شاركي توهجكِ ✦
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="rounded-2xl h-12"
            onClick={() => {
              setView("chat");
              toast("اسألي الخبيرة عن نتائجكِ");
            }}
          >
            اسألي الخبيرة
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button
            className="rounded-2xl h-12 rawnak-rose-gradient text-white font-bold"
            onClick={() => {
              toast.success("تم حفظ التحليل في سجلّكِ ✦");
              setView("home");
            }}
          >
            <CheckCircle2 className="w-4 h-4 ml-1.5" />
            حفظ ومتابعة
          </Button>
        </div>
      </div>
    </div>
  );
}
