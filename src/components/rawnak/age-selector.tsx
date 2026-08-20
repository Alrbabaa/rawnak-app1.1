"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Minus, Sparkles, Check, Calendar, Sliders, ShieldCheck } from "lucide-react";
import { triggerSelectionHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface AgeSelectorProps {
  value: number | null;
  onChange: (age: number) => void;
  className?: string;
}

const ARABIC_MONTHS = [
  "يناير (1)",
  "فبراير (2)",
  "مارس (3)",
  "أبريل (4)",
  "مايو (5)",
  "يونيو (6)",
  "يوليو (7)",
  "أغسطس (8)",
  "سبتمبر (9)",
  "أكتوبر (10)",
  "نوفمبر (11)",
  "ديسمبر (12)",
];

const AGE_BRACKETS = [
  { id: "teen", label: "13 - 17 سنة", min: 13, max: 17, description: "عناية متوازنة للبشرة الشابة وتنظيم الإفرازات والوقاية من الحبّوب", emoji: "🌱" },
  { id: "early20s", label: "18 - 24 سنة", min: 18, max: 24, description: "ترطيب أساسي، حماية شمسية مضاعفة، وتنشيط النضارة الطبيعية", emoji: "✨" },
  { id: "late20s30s", label: "25 - 34 سنة", min: 25, max: 34, description: "دعم محفزات الكولاجين، الوقاية من التصبغات، وتوحيد لون البشرة", emoji: "💧" },
  { id: "mid30s40s", label: "35 - 44 سنة", min: 35, max: 44, description: "ترطيب حمضي مكثف، سيروم الريتينول المغذي، ومقاومة الخطوط", emoji: "👑" },
  { id: "late40s50s", label: "45 - 54 سنة", min: 45, max: 54, description: "ترميم الحاجز الدهني الوقائي والتغذية الخلوية للشد والنضارة", emoji: "🌸" },
  { id: "golden", label: "55+ سنة", min: 55, max: 90, description: "العناية الذهبية بالزيوت النادرة المرطبة للحفاظ على مرونة البشرة", emoji: "💫" },
];

export function AgeSelector({ value, onChange, className }: AgeSelectorProps) {
  const currentYear = new Date().getFullYear();
  const defaultAge = value || 25;
  const initialBirthYear = currentYear - defaultAge;

  const [mode, setMode] = useState<"dob" | "slider">("dob");

  // DOB state
  const [birthYear, setBirthYear] = useState<number>(initialBirthYear);
  const [birthMonth, setBirthMonth] = useState<number>(5); // June default
  const [birthDay, setBirthDay] = useState<number>(15);

  // Direct age state
  const [sliderAge, setSliderAge] = useState<number>(defaultAge);
  const [inputVal, setInputVal] = useState<string>(String(defaultAge));

  // Sync initial prop value ONLY if updated externally from outside (e.g. profile load)
  const [prevPropValue, setPrevPropValue] = useState<number | null>(value ?? null);
  if (value && value !== prevPropValue) {
    setPrevPropValue(value);
    setSliderAge(value);
    setInputVal(String(value));
    // Only re-sync birthYear if mode is slider or if birthYear has diverged drastically (more than 1 year)
    if (mode === "slider" || Math.abs((currentYear - birthYear) - value) > 1) {
      setBirthYear(currentYear - value);
    }
  }

  // Calculate age from DOB
  const calculatedAgeFromDOB = useMemo(() => {
    const today = new Date();
    let age = today.getFullYear() - birthYear;
    const monthDiff = today.getMonth() - (birthMonth - 1);
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDay)) {
      age--;
    }
    return Math.max(13, Math.min(90, age));
  }, [birthYear, birthMonth, birthDay]);

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(birthYear, birthMonth, 0).getDate();
  }, [birthYear, birthMonth]);

  // Handle DOB change with auto-clamped day
  const handleDOBChange = (y: number, m: number, d: number) => {
    const maxDaysInTargetMonth = new Date(y, m, 0).getDate();
    const validDay = Math.min(d, maxDaysInTargetMonth);

    setBirthYear(y);
    setBirthMonth(m);
    setBirthDay(validDay);

    const today = new Date();
    let computed = today.getFullYear() - y;
    const monthDiff = today.getMonth() - (m - 1);
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < validDay)) {
      computed--;
    }
    const finalAge = Math.max(13, Math.min(90, computed));
    setSliderAge(finalAge);
    setInputVal(String(finalAge));
    
    // Update parent without forcing a destructive re-sync of birthYear
    setPrevPropValue(finalAge);
    onChange(finalAge);
    triggerSelectionHaptic();
  };

  // Handle direct slider/input change
  const handleSliderUpdate = (newAge: number) => {
    const clamped = Math.max(13, Math.min(85, newAge));
    setSliderAge(clamped);
    setInputVal(String(clamped));
    setBirthYear(currentYear - clamped);
    onChange(clamped);
    triggerSelectionHaptic();
  };

  const activeAge = mode === "dob" ? calculatedAgeFromDOB : sliderAge;

  const currentBracket = useMemo(() => {
    return (
      AGE_BRACKETS.find((b) => activeAge >= b.min && activeAge <= b.max) ||
      AGE_BRACKETS[2]
    );
  }, [activeAge]);

  // Years array (from currentYear - 13 down to 1935)
  const years = useMemo(() => {
    const list: number[] = [];
    const maxYear = currentYear - 13;
    for (let y = maxYear; y >= 1935; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  return (
    <div className={cn("space-y-5 w-full max-w-md mx-auto text-right", className)}>
      {/* Mode Switcher Tabs */}
      <div className="flex bg-muted/60 p-1 rounded-2xl border border-border">
        <button
          type="button"
          onClick={() => {
            setMode("dob");
            onChange(calculatedAgeFromDOB);
            triggerSelectionHaptic();
          }}
          className={cn(
            "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
            mode === "dob"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="w-3.5 h-3.5 text-primary" />
          تاريخ الميلاد (دقة عالية)
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("slider");
            onChange(sliderAge);
            triggerSelectionHaptic();
          }}
          className={cn(
            "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
            mode === "slider"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sliders className="w-3.5 h-3.5 text-primary" />
          شريط العمر التفاعلي
        </button>
      </div>

      {/* MODE 1: High Precision Scrollable Date-of-Birth Picker */}
      {mode === "dob" && (
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-extrabold text-foreground">
                تحديد تاريخ الميلاد بالكامل
              </span>
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">
              سري وآمن
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Day Column */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 text-center">
                اليوم
              </label>
              <select
                value={Math.min(birthDay, daysInMonth)}
                onChange={(e) =>
                  handleDOBChange(birthYear, birthMonth, Number(e.target.value))
                }
                className="w-full bg-muted/50 border border-border rounded-2xl py-2.5 px-2 text-center font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Column */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 text-center">
                الشهر
              </label>
              <select
                value={birthMonth}
                onChange={(e) =>
                  handleDOBChange(birthYear, Number(e.target.value), birthDay)
                }
                className="w-full bg-muted/50 border border-border rounded-2xl py-2.5 px-2 text-center font-bold text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                {ARABIC_MONTHS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Column */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 text-center">
                السنة
              </label>
              <select
                value={birthYear}
                onChange={(e) =>
                  handleDOBChange(Number(e.target.value), birthMonth, birthDay)
                }
                className="w-full bg-muted/50 border border-border rounded-2xl py-2.5 px-2 text-center font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Calculated Age Banner */}
          <div className="pt-2">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">العمر المحسوب بدقة:</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black rawnak-gold-text">
                  {calculatedAgeFromDOB}
                </span>
                <span className="text-xs font-bold text-muted-foreground">سنة</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: Tactile High-Precision Range Slider */}
      {mode === "slider" && (
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
          <div className="text-xs text-muted-foreground font-semibold text-center">
            اسحبي الشريط أو استخدمي الأزرار للضبط المباشر:
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => handleSliderUpdate(sliderAge - 1)}
              disabled={sliderAge <= 13}
              className="w-12 h-12 rounded-2xl bg-muted/80 hover:bg-muted active:scale-95 disabled:opacity-30 grid place-items-center transition-all border border-border text-foreground"
              aria-label="إنقاص سنة"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="relative flex items-baseline justify-center gap-1 px-3 min-w-[120px]">
              <input
                type="number"
                min={13}
                max={85}
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (!isNaN(parsed) && parsed >= 13 && parsed <= 85) {
                    handleSliderUpdate(parsed);
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(inputVal, 10);
                  if (isNaN(parsed) || parsed < 13) handleSliderUpdate(13);
                  else if (parsed > 85) handleSliderUpdate(85);
                  else handleSliderUpdate(parsed);
                }}
                className="text-5xl font-black rawnak-gold-text text-center w-24 bg-transparent outline-none focus:ring-0"
              />
              <span className="text-base font-bold text-muted-foreground">سنة</span>
            </div>

            <button
              type="button"
              onClick={() => handleSliderUpdate(sliderAge + 1)}
              disabled={sliderAge >= 85}
              className="w-12 h-12 rounded-2xl bg-muted/80 hover:bg-muted active:scale-95 disabled:opacity-30 grid place-items-center transition-all border border-border text-foreground"
              aria-label="زيادة سنة"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* High-Precision Tactile Range Slider */}
          <div className="pt-2 px-1">
            <input
              type="range"
              min={13}
              max={80}
              value={sliderAge}
              onChange={(e) => handleSliderUpdate(Number(e.target.value))}
              className="w-full accent-[oklch(0.62_0.11_12)] h-2.5 bg-muted rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-extrabold">
              <span>13 سنة</span>
              <span>25 سنة</span>
              <span>40 سنة</span>
              <span>60+ سنة</span>
            </div>
          </div>
        </div>
      )}

      {/* Age Bracket Pills */}
      <div>
        <label className="text-xs font-extrabold text-foreground mb-2 block px-1">
          الفئة العمرية المستهدفة للعناية:
        </label>
        <div className="grid grid-cols-2 gap-2">
          {AGE_BRACKETS.map((bracket) => {
            const isSelected = activeAge >= bracket.min && activeAge <= bracket.max;
            return (
              <button
                key={bracket.id}
                type="button"
                onClick={() => {
                  const mid = Math.round((bracket.min + Math.min(bracket.max, 60)) / 2);
                  handleSliderUpdate(mid);
                }}
                className={cn(
                  "p-2.5 rounded-2xl border text-right transition-all flex items-start gap-2 interactive-card",
                  isSelected
                    ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/80"
                    : "bg-card border-border hover:border-primary/40"
                )}
              >
                <span className="text-lg p-1 bg-muted/60 rounded-xl shrink-0">
                  {bracket.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground truncate">{bracket.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5 block">
                    {bracket.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expert Skin Insight Box */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <span className="font-extrabold text-primary block mb-0.5">
            توصية خبراء رَونق بعمر {activeAge} سنة ({currentBracket.emoji} {currentBracket.label}):
          </span>
          <p className="text-muted-foreground">{currentBracket.description}</p>
        </div>
      </div>
    </div>
  );
}
