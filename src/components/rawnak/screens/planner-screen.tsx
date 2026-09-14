"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type BeautyPlan } from "@/lib/store";
import { OCCASIONS } from "@/lib/data";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { buildPersonalizationContext } from "@/lib/personalization";
import { useRealWeather } from "@/hooks/use-real-weather";
import { isQuotaExceeded, describeQuotaError } from "@/lib/quota-error";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarHeart,
  Sparkles,
  ChevronLeft,
  X,
  Loader2,
  Clock,
  Check,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PlannerScreen() {
  const { plans, addPlan, removePlan, profile, cabinet, analyses, routine, streak, academyHistory, setView, goBack } =
    useAppStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { status: weatherStatus, weather } = useRealWeather();

  const generate = async (occasionId: string) => {
    const occ = OCCASIONS.find((o) => o.id === occasionId);
    if (!occ) return;
    setGenerating(true);
    try {
      // Shared personalization context (skin profile, latest analysis,
      // cabinet, routine, VIP, today's real weather) — same builder that
      // feeds Rawnak Today, so the plan reflects everything real we know
      // about her, not just the four fields this screen used to send.
      const context = buildPersonalizationContext(
        { profile, analyses, cabinet, routine, streak, plans, academyHistory },
        { weather: weatherStatus === "ready" ? weather : null }
      );
      const res = await authedFetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: occ.id,
          occasionLabel: occ.label,
          context,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (isQuotaExceeded(data)) {
          toast.error(describeQuotaError(data), {
            action: data.upgradeRequired
              ? { label: "عضوية VIP", onClick: () => setView("vip") }
              : undefined,
          });
          return;
        }
        throw new Error(data.error || "خطأ");
      }

      const plan: BeautyPlan = {
        id: `plan-${Date.now()}`,
        occasion: occ.id,
        occasionLabel: occ.label,
        date: Date.now(),
        steps: data.steps || [],
        products: data.products || [],
        duration: data.duration || "30 دقيقة",
        tips: data.tips || [],
        createdAt: Date.now(),
      };
      addPlan(plan);
      setSelected(plan.id);
      toast.success("صمّمتُ لكِ خطة جمال متكاملة ✦");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setGenerating(false);
    }
  };

  const activePlan = plans.find((p) => p.id === selected);

  return (
    <div className="py-3 space-y-4">
      <button
        onClick={() => { if (!goBack()) setView("home"); }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
        رجوع
      </button>

      <div className="text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rosegold-gradient items-center justify-center mb-3">
          <CalendarHeart className="w-7 h-7 text-black" />
        </div>
        <h1 className="text-2xl font-extrabold">مخطط الجمال الذكي</h1>
        <p className="text-sm text-muted-foreground mt-1">
          خطط جمال متكاملة لكل مناسبة، مخصّصة لكِ أنتِ
        </p>
      </div>

      {/* Occasion picker */}
      <div>
        <h3 className="font-bold mb-2 px-1">اختاري المناسبة</h3>
        <div className="grid grid-cols-3 gap-2.5">
          {OCCASIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => generate(o.id)}
              disabled={generating}
              className="p-3 rounded-2xl border-2 border-border bg-card hover:border-primary/50 text-center transition-all disabled:opacity-50"
            >
              <span className="text-3xl block mb-1">{o.emoji}</span>
              <span className="text-xs font-bold block">{o.label}</span>
              <span className="text-[10px] text-muted-foreground block leading-tight mt-0.5">
                {o.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {generating && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">أصمّم خطتكِ الجمالية...</p>
        </div>
      )}

      {/* Saved plans */}
      {plans.length > 0 && (
        <div>
          <h3 className="font-bold mb-2 px-1">خططكِ المحفوظة</h3>
          <div className="space-y-2.5">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="w-full text-right"
              >
                <Card
                  className={cn(
                    "p-3.5 rounded-2xl border transition-colors",
                    selected === p.id ? "border-primary" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {OCCASIONS.find((o) => o.id === p.occasion)?.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{p.occasionLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString("ar", { day: "numeric", month: "short" })} · {p.duration}
                      </p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plan detail modal */}
      <AnimatePresence>
        {activePlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative z-10 w-full max-w-md max-h-[88vh] overflow-y-auto pretty-scroll bg-card rounded-t-3xl sm:rounded-3xl border border-border"
            >
              <div className="sticky top-0 bg-card/95 backdrop-blur p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {OCCASIONS.find((o) => o.id === activePlan.occasion)?.emoji}
                  </span>
                  <div>
                    <h3 className="font-extrabold">{activePlan.occasionLabel}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activePlan.duration}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      removePlan(activePlan.id);
                      setSelected(null);
                      toast("حُذفت الخطة");
                    }}
                    className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-rose-500"
                    aria-label="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted"
                    aria-label="إغلاق"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {activePlan.steps.map((s, i) => (
                  <div key={i}>
                    <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-full rawnak-rosegold-gradient grid place-items-center text-[10px] font-bold text-black">
                        {i + 1}
                      </span>
                      {s.phase}
                    </h4>
                    <div className="space-y-1.5 pr-7">
                      {s.items.map((item, j) => (
                        <div key={j} className="flex gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <h4 className="font-bold text-sm mb-2">المنتجات الموصى بها</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {activePlan.products.map((p, i) => (
                      <Badge key={i} variant="secondary" className="rounded-full">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-3 bg-primary/5 border border-primary/20">
                  <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    نصائح ذهبية
                  </h4>
                  <ul className="space-y-1.5">
                    {activePlan.tips.map((t, i) => (
                      <li key={i} className="text-xs flex gap-2 leading-relaxed">
                        <span className="text-primary">✦</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => {
                    setView("chat");
                    setSelected(null);
                    toast("اسألي رَونق عن تفاصيل خطتكِ");
                  }}
                  variant="outline"
                  className="w-full rounded-2xl"
                >
                  <Wand2 className="w-4 h-4 ml-1.5" />
                  اسألي رَونق عن الخطة
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
