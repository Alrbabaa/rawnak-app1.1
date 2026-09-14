"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { INGREDIENTS, CATEGORY_COLORS, WEATHER_CONDITIONS, CONCERN_LABEL } from "@/lib/data";
import {
  Search,
  BookOpen,
  Apple,
  CloudSun,
  Star,
  ChevronLeft,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isQuotaExceeded, describeQuotaError } from "@/lib/quota-error";

type Tab = "ingredients" | "nutrition" | "weather";

export function LibraryScreen() {
  const [tab, setTab] = useState<Tab>("ingredients");

  return (
    <div className="py-3 space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">مكتبة الجمال</h1>
        <p className="text-sm text-muted-foreground mt-1">
          معرفة تُمكّنكِ من اختيارات أفضل لبشرتكِ
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 rounded-2xl bg-muted/60">
        <TabBtn active={tab === "ingredients"} onClick={() => setTab("ingredients")} icon={BookOpen} label="المكونات" />
        <TabBtn active={tab === "nutrition"} onClick={() => setTab("nutrition")} icon={Apple} label="التغذية" />
        <TabBtn active={tab === "weather"} onClick={() => setTab("weather")} icon={CloudSun} label="الطقس" />
      </div>

      {tab === "ingredients" && <IngredientsTab />}
      {tab === "nutrition" && <NutritionTab />}
      {tab === "weather" && <WeatherTab />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BookOpen;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

/* ---------- Ingredients ---------- */
function IngredientsTab() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { unlockAchievement } = useAppStore();
  const [viewed, setViewed] = useState(0);

  const filtered = INGREDIENTS.filter(
    (i) =>
      i.name.includes(query) ||
      i.nameEn.toLowerCase().includes(query.toLowerCase()) ||
      i.benefit.includes(query)
  );

  const ing = INGREDIENTS.find((i) => i.id === selected);

  useEffect(() => {
    if (viewed >= 5) unlockAchievement("ingredient-explorer");
  }, [viewed, unlockAchievement]);

  if (ing) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          رجوع للقائمة
        </button>
        <Card className="p-5 rounded-3xl border-border">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{ing.emoji}</span>
            <div>
              <h2 className="text-xl font-extrabold">{ing.name}</h2>
              <p className="text-sm text-muted-foreground" dir="ltr">{ing.nameEn}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Badge className={CATEGORY_COLORS[ing.category]}>{ing.categoryLabel}</Badge>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-4 h-4",
                    i < ing.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          </div>

          <Section title="الفائدة" color="emerald">{ing.benefit}</Section>
          <Section title="الآثار الجانبية" color="amber">{ing.sideEffects}</Section>
          <Section title="تحذيرات" color="rose">{ing.warning}</Section>

          {ing.bestFor.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold mb-2">يناسب:</p>
              <div className="flex flex-wrap gap-1.5">
                {ing.bestFor.map((b) => (
                  <Badge key={b} variant="secondary" className="rounded-full">
                    {CONCERN_LABEL[b] || b}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحثي عن مكوّن..."
          className="h-11 rounded-xl pr-10 bg-card"
        />
      </div>

      <div className="space-y-2.5">
        {filtered.map((i, idx) => (
          <motion.button
            key={i.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            onClick={() => {
              setSelected(i.id);
              setViewed((v) => v + 1);
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border hover:border-primary/40 text-right transition-colors"
          >
            <span className="text-2xl">{i.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{i.name}</span>
                <span className="text-xs text-muted-foreground" dir="ltr">{i.nameEn}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">{i.benefit}</p>
            </div>
            <Badge className={cn("rounded-full text-[10px]", CATEGORY_COLORS[i.category])}>
              {i.categoryLabel}
            </Badge>
          </motion.button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            لا نتائج. جربي كلمة أخرى.
          </p>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: "emerald" | "amber" | "rose";
  children: React.ReactNode;
}) {
  const colors = {
    emerald: "border-r-emerald-400",
    amber: "border-r-amber-400",
    rose: "border-r-rose-400",
  };
  return (
    <div className={cn("border-r-2 pr-3 py-1 mb-3", colors[color])}>
      <p className="text-xs font-bold text-muted-foreground mb-0.5">{title}</p>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}

/* ---------- Nutrition ---------- */
function NutritionTab() {
  const { profile, setView } = useAppStore();
  const [data, setData] = useState<null | {
    intro: string;
    recommended: Array<{ name: string; benefit: string; icon: string }>;
    avoid: Array<{ name: string; reason: string; icon: string }>;
    lifestyle: string[];
    dailyTip: string;
  }>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchNutrition = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await authedFetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skinType: profile.skinType,
          concerns: profile.concerns,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.upgradeRequired) {
          if (mountedRef.current) {
            toast.error(d.error);
            setView("vip");
          }
          return;
        }
        throw new Error();
      }
      if (mountedRef.current) setData(d);
    } catch {
      if (mountedRef.current) {
        setError(true);
        toast.error("تعذّر تحميل النصائح الغذائية");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNutrition();
  }, [profile.skinType, profile.concerns]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">أُعدّ نصائحكِ الغذائية...</p>
      </div>
    );
  }

  if (!data || error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Apple className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-sm font-bold">تعذّر تحميل النصائح</p>
        <p className="text-xs text-muted-foreground">تحقّقي من الاتصال بالإنترنت وحاولي مرة أخرى</p>
        <Button onClick={fetchNutrition} variant="outline" size="sm" className="rounded-xl gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 rounded-3xl rawnak-gradient border-0">
        <p className="text-sm leading-relaxed font-medium">{data.intro}</p>
      </Card>

      <div>
        <h3 className="font-bold mb-2 flex items-center gap-1.5">
          <span className="text-emerald-500">✦</span> أطعمة مفيدة لبشرتكِ
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          {data.recommended.map((f, i) => (
            <Card key={i} className="p-3.5 rounded-2xl border-border">
              <span className="text-2xl">{f.icon}</span>
              <p className="font-bold text-sm mt-1">{f.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{f.benefit}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-2 flex items-center gap-1.5">
          <span className="text-amber-500">⚠</span> قلّلي منها
        </h3>
        <div className="space-y-2">
          {data.avoid.map((f, i) => (
            <Card key={i} className="p-3 rounded-2xl border-border flex items-center gap-3">
              <span className="text-xl">{f.icon}</span>
              <div className="flex-1">
                <p className="font-bold text-sm">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.reason}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-2 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          نمط حياة لبشرة أفضل
        </h3>
        <div className="space-y-2">
          {data.lifestyle.map((l, i) => (
            <div key={i} className="flex gap-2.5 p-3 rounded-2xl bg-card border border-border">
              <span className="w-6 h-6 rounded-full rawnak-gradient grid place-items-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <p className="text-sm pt-0.5">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <Card className="p-4 rounded-2xl border-primary/30 bg-primary/5">
        <p className="text-xs font-bold text-primary mb-1">نصيحة اليوم ✦</p>
        <p className="text-sm font-medium">{data.dailyTip}</p>
      </Card>
    </div>
  );
}

/* ---------- Weather ---------- */
function WeatherTab() {
  const { profile, setView } = useAppStore();
  const [condition, setCondition] = useState("mild");
  const [data, setData] = useState<null | {
    summary: string;
    tips: Array<{ title: string; detail: string; icon: string }>;
    routineAdjust: string[];
    mustHave: string;
    avoid: string;
  }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchTips = async (c: string) => {
    setLoading(true);
    setData(null);
    setError(false);
    try {
      const res = await authedFetch("/api/weather-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: c, skinType: profile.skinType }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (isQuotaExceeded(d)) {
          setError(true);
          toast.error(describeQuotaError(d), {
            action: d.upgradeRequired ? { label: "عضوية VIP", onClick: () => setView("vip") } : undefined,
          });
          return;
        }
        throw new Error();
      }
      setData(d);
    } catch {
      setError(true);
      toast.error("تعذّر تحميل نصائح الطقس");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTips("mild");
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold mb-2">كيف الطقس عندكِ اليوم؟</p>
        <div className="grid grid-cols-3 gap-2">
          {WEATHER_CONDITIONS.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                setCondition(w.id);
                fetchTips(w.id);
              }}
              className={cn(
                "p-3 rounded-2xl border-2 text-center transition-all",
                condition === w.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <span className="text-2xl block">{w.emoji}</span>
              <span className="text-[11px] font-semibold block mt-1">{w.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">أُحضّر نصائح الطقس...</p>
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <CloudSun className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-bold">تعذّر تحميل نصائح الطقس</p>
          <p className="text-xs text-muted-foreground">تحقّقي من الاتصال بالإنترنت وحاولي مرة أخرى</p>
          <Button onClick={() => fetchTips(condition)} variant="outline" size="sm" className="rounded-xl gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            إعادة المحاولة
          </Button>
        </div>
      )}

      {data && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <Card className="p-5 rounded-3xl rawnak-gradient border-0">
            <p className="text-sm leading-relaxed font-medium">{data.summary}</p>
          </Card>

          <div className="space-y-2.5">
            {data.tips.map((t, i) => (
              <Card key={i} className="p-4 rounded-2xl border-border flex gap-3">
                <span className="text-2xl">{t.icon}</span>
                <div>
                  <p className="font-bold text-sm">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.detail}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 rounded-2xl border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">أساسي اليوم ✦</p>
              <p className="text-sm font-semibold">{data.mustHave}</p>
            </Card>
            <Card className="p-4 rounded-2xl border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">تجنّبي ⚠</p>
              <p className="text-sm font-semibold">{data.avoid}</p>
            </Card>
          </div>

          <div>
            <h3 className="font-bold mb-2">تعديلات على الروتين</h3>
            <div className="space-y-1.5">
              {data.routineAdjust.map((r, i) => (
                <div key={i} className="flex gap-2 p-2.5 rounded-xl bg-card border border-border text-sm">
                  <span className="text-primary">•</span>
                  {r}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
