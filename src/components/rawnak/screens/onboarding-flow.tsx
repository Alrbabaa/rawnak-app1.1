"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import {
  SKIN_TYPES,
  SKIN_TONES,
  SKIN_CONCERNS,
  BEAUTY_GOALS,
  MAKEUP_LEVELS,
  LIFESTYLE_OPTIONS,
} from "@/lib/data";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { AgeSelector } from "@/components/rawnak/age-selector";
import { SkinConcernsGrid } from "@/components/rawnak/skin-concerns-grid";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEPS = ["ترحيب", "العمر", "نوع البشرة", "لون البشرة", "المشاكل", "الأهداف", "المكياج", "نمط الحياة"];

export function OnboardingFlow() {
  const { profile, updateProfile, completeOnboarding } = useAppStore();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState<string>(profile.age ? String(profile.age) : "");

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const toggleConcern = (id: string) => {
    const cur = profile.concerns || [];
    updateProfile({
      concerns: cur.includes(id as never)
        ? cur.filter((c) => c !== id)
        : [...cur, id as never],
    });
  };
  const toggleGoal = (id: string) => {
    const cur = profile.goals || [];
    updateProfile({
      goals: cur.includes(id as never)
        ? cur.filter((g) => g !== id)
        : [...cur, id as never],
    });
  };
  const toggleLifestyle = (id: string) => {
    const cur = profile.lifestyle || [];
    updateProfile({
      lifestyle: cur.includes(id) ? cur.filter((l) => l !== id) : [...cur, id],
    });
  };

  const canProceed = () => {
    if (step === 1) return age && Number(age) > 0 && Number(age) < 120;
    if (step === 2) return !!profile.skinType;
    if (step === 3) return !!profile.skinTone;
    if (step === 4) return (profile.concerns?.length ?? 0) > 0;
    if (step === 5) return (profile.goals?.length ?? 0) > 0;
    if (step === 6) return !!profile.makeupLevel;
    return true;
  };

  const finish = async () => {
    const finalAge = Number(age) || null;
    const finalProfile = { ...profile, age: finalAge, createdAt: Date.now() };
    updateProfile(finalProfile);

    // Save user preferences directly to Firestore profile document
    try {
      await authedFetch("/api/db/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalProfile.name,
          profile: {
            age: finalProfile.age,
            skinType: finalProfile.skinType,
            skinTone: finalProfile.skinTone,
            concerns: finalProfile.concerns,
            goals: finalProfile.goals,
            makeupLevel: finalProfile.makeupLevel,
            lifestyle: finalProfile.lifestyle,
            avatar: finalProfile.avatar,
          },
        }),
      });
    } catch {
      // Offline fallback
    }

    // NOTE: this used to also call checkIn() + unlockAchievement("streak-3")
    // here, which granted every brand-new user a fake "3-day streak"
    // achievement and started her streak counter before she ever logged an
    // actual routine. That emptied the streak/achievement system of meaning
    // from day one. Finishing onboarding no longer touches streak/achievement
    // state — both now only move the first time she genuinely checks in.
    completeOnboarding();
    toast.success("أهلاً بكِ في رَونق! ✦ لنبدأ رحلة الجمال");
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background">
      <div className="min-h-screen flex flex-col">
        {/* Progress header */}
        <div className="px-5 pt-4 pb-3 border-b border-border/60">
          <div className="flex h-10 items-center justify-between mb-3">
            <img
              src="/rawnak-logo.jpg"
              alt="رَونق"
              className="w-9 h-9 rounded-xl object-cover shadow-sm"
            />
            <span className="text-xs text-muted-foreground">
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-300",
                  i <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 px-5 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 0: Welcome */}
              {step === 0 && (
                <div className="flex flex-col items-center text-center pt-10">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="w-24 h-24 rounded-full rawnak-gradient flex items-center justify-center mb-6 float-anim"
                  >
                    <Sparkles className="w-12 h-12 text-white" />
                  </motion.div>
                  <h2 className="text-3xl font-extrabold mb-3">
                    أهلًا {profile.name || "جميلتي"}! ♡
                  </h2>
                  <p className="text-muted-foreground leading-relaxed max-w-sm mb-8">
                    لنُخصّص تجربتكِ في رَونق. أجيبي عن بضعة أسئلة سريعة لنفهم بشرتكِ
                    وأهدافكِ، ونقدّم لكِ أفضل النصائح والروتين المثالي.
                  </p>
                  <div className="space-y-3 w-full max-w-sm text-right">
                    {[
                      { icon: "✨", t: "تحليل ذكي ومخصص لبشرتك" },
                      { icon: "💬", t: "خبيرة جمال تتحدث معكِ في أي وقت" },
                      { icon: "🎯", t: "روتين وأهداف تناسبكِ أنتِ" },
                    ].map((f) => (
                      <div
                        key={f.t}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border"
                      >
                        <span className="text-2xl">{f.icon}</span>
                        <span className="text-sm font-medium">{f.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1: Age */}
              {step === 1 && (
                <div className="pt-4">
                  <StepTitle title="كم عمركِ بدقة؟" subtitle="يساعدنا في تقديم تركيزات وعناية دقيقة تناسب عمر بشرتكِ تماماً" />
                  <div className="mt-6">
                    <AgeSelector
                      value={Number(age) || 25}
                      onChange={(newAge) => setAge(String(newAge))}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Skin type */}
              {step === 2 && (
                <div className="pt-6">
                  <StepTitle title="ما نوع بشرتكِ؟" subtitle="اختاري ما يصف بشرتكِ أكثر" />
                  <div className="mt-6 space-y-2.5">
                    {SKIN_TYPES.map((t) => (
                      <SelectCard
                        key={t.id}
                        selected={profile.skinType === t.id}
                        onClick={() => updateProfile({ skinType: t.id as never })}
                        emoji={t.emoji}
                        title={t.label}
                        desc={t.desc}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Skin tone */}
              {step === 3 && (
                <div className="pt-6">
                  <StepTitle
                    title="ما لون بشرتكِ؟"
                    subtitle="اختاري الدرجة الأقرب إليكِ"
                  />
                  <div className="mt-8 space-y-2.5">
                    {SKIN_TONES.map((t) => {
                      const sel = profile.skinTone === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => updateProfile({ skinTone: t.id as never })}
                          className={cn(
                            "w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-right transition-all",
                            sel
                              ? "border-primary bg-primary/5 rawnak-shadow"
                              : "border-border bg-card hover:border-primary/40"
                          )}
                        >
                          <span
                            className="w-10 h-10 rounded-full border-2 border-white/20 shrink-0"
                            style={{ background: t.swatch }}
                          />
                          <span className="font-bold flex-1">{t.label}</span>
                          {sel && (
                            <span className="w-6 h-6 rounded-full bg-primary grid place-items-center">
                              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Concerns */}
              {step === 4 && (
                <div className="pt-6">
                  <StepTitle
                    title="ما مشاكل بشرتكِ تحديداً؟"
                    subtitle="حددي جميع النقاط التي تودين التركيز عليها لبناء روتين مخصص ونتائج مذهلة"
                  />
                  <div className="mt-6">
                    <SkinConcernsGrid
                      selectedConcerns={profile.concerns || []}
                      onToggleConcern={toggleConcern}
                      onSetConcerns={(concerns) =>
                        updateProfile({ concerns: concerns as never[] })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Step 5: Goals */}
              {step === 5 && (
                <div className="pt-6">
                  <StepTitle
                    title="أهدافكِ الجمالية؟"
                    subtitle="ما الذي تطمحين إليه لبشرتكِ؟"
                  />
                  <div className="mt-6 grid grid-cols-2 gap-2.5">
                    {BEAUTY_GOALS.map((g) => {
                      const sel = profile.goals?.includes(g.id as never);
                      return (
                        <button
                          key={g.id}
                          onClick={() => toggleGoal(g.id)}
                          className={cn(
                            "p-4 rounded-2xl border-2 text-center transition-all",
                            sel
                              ? "border-primary bg-primary/5 rawnak-shadow"
                              : "border-border bg-card hover:border-primary/40"
                          )}
                        >
                          <span className="text-3xl block mb-2">{g.emoji}</span>
                          <span className="text-sm font-semibold">{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 6: Makeup level */}
              {step === 6 && (
                <div className="pt-6">
                  <StepTitle
                    title="مستواكِ في المكياج؟"
                    subtitle="لنخصّص نصائح التجميل لكِ"
                  />
                  <div className="mt-6 space-y-2.5">
                    {MAKEUP_LEVELS.map((m) => (
                      <SelectCard
                        key={m.id}
                        selected={profile.makeupLevel === m.id}
                        onClick={() => updateProfile({ makeupLevel: m.id as never })}
                        emoji={
                          m.id === "beginner" ? "🌱" : m.id === "intermediate" ? "💄" : "👑"
                        }
                        title={m.label}
                        desc={m.desc}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Step 7: Lifestyle */}
              {step === 7 && (
                <div className="pt-6">
                  <StepTitle
                    title="نمط حياتكِ"
                    subtitle="اختاري ما ينطبق على يومكِ (اختياري)"
                  />
                  <div className="mt-6 grid grid-cols-2 gap-2.5">
                    {LIFESTYLE_OPTIONS.map((l) => {
                      const sel = profile.lifestyle?.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          onClick={() => toggleLifestyle(l.id)}
                          className={cn(
                            "p-3.5 rounded-2xl border-2 text-center transition-all",
                            sel
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/40"
                          )}
                        >
                          <span className="text-2xl block mb-1">{l.emoji}</span>
                          <span className="text-xs font-semibold leading-tight">{l.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div
          className="px-5 pt-3 flex gap-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          {step > 0 && (
            <Button
              onClick={back}
              variant="outline"
              size="lg"
              className="rounded-2xl px-5"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              onClick={next}
              disabled={!canProceed()}
              size="lg"
              className="flex-1 rounded-2xl rawnak-rose-gradient text-white font-bold disabled:opacity-40"
            >
              التالي
              <ChevronLeft className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={finish}
              size="lg"
              className="flex-1 rounded-2xl rawnak-rose-gradient text-white font-bold"
            >
              <Heart className="w-5 h-5 ml-1" fill="currentColor" />
              ابدئي رحلة الجمال
            </Button>
          )}
        </div>
        {/* Escape hatch for the "just let me try it" user — every field
            asked in steps 1-6 is read elsewhere with a graceful fallback
            already (profile-screen shows "غير محدد", academy/home-dashboard
            fall back to a default label, etc.), so calling finish() with a
            partially-filled profile is exactly as safe as calling it after
            all 6 steps — nothing downstream assumes a complete profile.
            She can always finish it later from the profile screen. */}
        {step > 0 && step < STEPS.length - 1 && (
          <button
            onClick={finish}
            className="w-full text-center text-xs text-muted-foreground py-3"
          >
            تخطي، أكمل بياناتي لاحقًا
          </button>
        )}
      </div>
    </div>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-extrabold mb-1.5">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SelectCard({
  selected,
  onClick,
  emoji,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-right transition-all",
        selected
          ? "border-primary bg-primary/5 rawnak-shadow"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1">
        <p className="font-bold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      {selected && (
        <span className="w-6 h-6 rounded-full bg-primary grid place-items-center">
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
