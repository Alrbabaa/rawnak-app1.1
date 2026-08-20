"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Sun, Moon, Eye, Palette, Heart, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore, COLOR_THEMES, type ColorTheme } from "@/lib/store";
import { triggerSelectionHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ThemeMeta {
  id: ColorTheme;
  label: string;
  enName: string;
  desc: string;
  swatch: string;
  gradient: string;
  accentBg: string;
}

export const THEMES_META: ThemeMeta[] = [
  {
    id: "rose",
    label: "وردي ذهبي",
    enName: "Rose Gold",
    desc: "أناقة كلاسيكية دافئة برونق ذهبي ووردي فاخر",
    swatch: "oklch(0.72 0.085 45)",
    gradient: "linear-gradient(135deg, oklch(0.72 0.085 45), oklch(0.68 0.1 18))",
    accentBg: "rgba(220, 160, 120, 0.15)",
  },
  {
    id: "lavender",
    label: "لافندر حالم",
    enName: "Lavender",
    desc: "درجات بنفسجية هادئة تفيض بالسحر والاسترخاء",
    swatch: "oklch(0.68 0.09 300)",
    gradient: "linear-gradient(135deg, oklch(0.68 0.09 300), oklch(0.62 0.1 280))",
    accentBg: "rgba(180, 130, 220, 0.15)",
  },
  {
    id: "ocean",
    label: "أزرق المحيط",
    enName: "Ocean",
    desc: "انتعاش وهدوء ونقاء بدرجات الأزرق المائي",
    swatch: "oklch(0.62 0.09 220)",
    gradient: "linear-gradient(135deg, oklch(0.62 0.09 220), oklch(0.58 0.09 235))",
    accentBg: "rgba(100, 180, 220, 0.15)",
  },
  {
    id: "mocha",
    label: "موكا دافئ",
    enName: "Mocha",
    desc: "ألوان التراب والموكا الدافئة لشعور بالرقي والهدوء",
    swatch: "oklch(0.6 0.07 55)",
    gradient: "linear-gradient(135deg, oklch(0.6 0.07 55), oklch(0.52 0.06 40))",
    accentBg: "rgba(180, 140, 110, 0.15)",
  },
  {
    id: "pearl",
    label: "لؤلؤي ناعم",
    enName: "Pearl",
    desc: "بساطة لؤلؤية بلمسات عاجية ناعمة ونظيفة",
    swatch: "oklch(0.85 0.03 80)",
    gradient: "linear-gradient(135deg, oklch(0.85 0.03 80), oklch(0.72 0.03 60))",
    accentBg: "rgba(220, 215, 190, 0.15)",
  },
  {
    id: "midnight",
    label: "أزرق الليل",
    enName: "Midnight",
    desc: "غموض وفخامة سماء منتصف الليل العميقة",
    swatch: "oklch(0.55 0.09 265)",
    gradient: "linear-gradient(135deg, oklch(0.55 0.09 265), oklch(0.48 0.1 285))",
    accentBg: "rgba(120, 130, 220, 0.15)",
  },
];

export function ThemeSwitcher() {
  const { colorTheme, setColorTheme, theme, toggleTheme } = useAppStore();
  const [hoveredTheme, setHoveredTheme] = useState<ColorTheme | null>(null);

  const activeThemeId = hoveredTheme || colorTheme;
  const activeMeta = THEMES_META.find((t) => t.id === activeThemeId) || THEMES_META[0];

  const handleSelectTheme = (themeId: ColorTheme) => {
    if (colorTheme === themeId) return;
    setColorTheme(themeId);
    triggerSuccessHaptic();
    const meta = THEMES_META.find((t) => t.id === themeId);
    toast.success(`تم تفعيل ثيم ${meta?.label || themeId} ✦`);
  };

  return (
    <Card className="p-5 rounded-3xl border-border space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full rawnak-gradient grid place-items-center shrink-0">
            <Palette className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              لون وتصميم التطبيق
              <Badge variant="outline" className="text-[10px] py-0 border-primary/30 text-primary">
                معاينة حية
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              اختاري الثيم الذي يعبر عن ذوقكِ وجمالكِ
            </p>
          </div>
        </div>

        {/* Quick Dark/Light Toggle */}
        <button
          onClick={() => {
            toggleTheme();
            triggerSelectionHaptic();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/80 hover:bg-muted text-xs font-semibold transition-colors"
          title="تبديل الوضع الليلي / النهاري"
        >
          {theme === "light" ? (
            <>
              <Moon className="w-3.5 h-3.5 text-primary" />
              <span>نهاري</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>ليلي</span>
            </>
          )}
        </button>
      </div>

      {/* Live Preview Card */}
      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold">
            <Eye className="w-3.5 h-3.5 text-primary" />
            معاينة العناصر المباشرة ({activeMeta.label})
          </span>
          {hoveredTheme && (
            <span className="text-[10px] text-primary animate-pulse">
              [تمرير للمعاينة]
            </span>
          )}
        </div>

        {/* Mock UI Showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Sample Card & Badge */}
          <div className="p-3 rounded-xl bg-card border border-border/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full grid place-items-center text-xs font-bold text-black"
                style={{ background: activeMeta.gradient }}
              >
                ✦
              </div>
              <div>
                <p className="text-xs font-bold">بشرة متألقة</p>
                <p className="text-[10px] text-muted-foreground">نضارة 94% اليوم</p>
              </div>
            </div>
            <Badge
              className="text-[10px] px-2 py-0.5 border-0 text-black font-extrabold"
              style={{ background: activeMeta.gradient }}
            >
              Plus
            </Badge>
          </div>

          {/* Sample Button & Progress */}
          <div className="p-3 rounded-xl bg-card border border-border/70 flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[10px] font-semibold">
                <span>الالتزام اليومي</span>
                <span className="text-primary font-bold">100%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: "85%", background: activeMeta.gradient }}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="h-7 px-3 text-[11px] font-bold text-black border-0 shrink-0"
              style={{ background: activeMeta.gradient }}
            >
              حفظ
            </Button>
          </div>
        </div>
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {THEMES_META.map((t) => {
          const isSelected = colorTheme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleSelectTheme(t.id)}
              onMouseEnter={() => setHoveredTheme(t.id)}
              onMouseLeave={() => setHoveredTheme(null)}
              className={cn(
                "relative p-3 rounded-2xl border-2 text-right transition-all flex flex-col justify-between group overflow-hidden",
                isSelected
                  ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40 bg-card hover:bg-muted/40"
              )}
            >
              {/* Swatch Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="relative">
                  <span
                    className="w-7 h-7 rounded-full block border border-black/20 shadow-sm"
                    style={{ background: t.gradient }}
                  />
                  {isSelected && (
                    <motion.span
                      layoutId="activeThemeBadge"
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-xs"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </motion.span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  {t.enName}
                </span>
              </div>

              {/* Theme Titles */}
              <div>
                <p className="text-xs font-bold leading-snug flex items-center justify-between">
                  {t.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {t.desc}
                </p>
              </div>

              {/* Active Indicator Bar */}
              <div
                className={cn(
                  "h-1 rounded-full mt-2.5 transition-all duration-300",
                  isSelected ? "opacity-100" : "opacity-20 group-hover:opacity-60"
                )}
                style={{ background: t.gradient }}
              />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
