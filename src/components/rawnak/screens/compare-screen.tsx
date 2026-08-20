"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, type BeforeAfter } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Images,
  ChevronLeft,
  ImagePlus,
  X,
  MoveHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CompareScreen() {
  const { comparisons, addComparison, setView, goBack, unlockAchievement } = useAppStore();
  const [mode, setMode] = useState<"list" | "create">("list");
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>, set: (s: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const save = () => {
    if (!before || !after) {
      toast.error("أضيفي الصورتين أولًا");
      return;
    }
    const comp: BeforeAfter = {
      id: `cmp-${Date.now()}`,
      ts: Date.now(),
      beforeImage: before,
      afterImage: after,
      label: label.trim() || "مقارنة رحلتي",
    };
    addComparison(comp);
    unlockAchievement("before-after");
    toast.success("حُفظت المقارنة ✦");
    setMode("list");
    setBefore(null);
    setAfter(null);
    setLabel("");
  };

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
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rose-gradient items-center justify-center mb-3">
          <Images className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold">قبل وبعد</h1>
        <p className="text-sm text-muted-foreground mt-1">
          تتبّعي رحلة تحسّن بشرتكِ بصريًا
        </p>
      </div>

      {mode === "list" ? (
        <>
          <Button
            onClick={() => setMode("create")}
            className="w-full h-12 rounded-2xl rawnak-rose-gradient text-white font-bold"
          >
            <Sparkles className="w-5 h-5 ml-2" />
            أضيفي مقارنة جديدة
          </Button>

          {comparisons.length === 0 ? (
            <Card className="p-8 rounded-3xl border-border text-center">
              <Images className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-bold mb-1">لا توجد مقارنات بعد</p>
              <p className="text-sm text-muted-foreground">
                أضيفي صورتين لترَي تقدّم بشرتكِ مع الوقت
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {comparisons.map((c) => (
                <ComparisonCard key={c.id} comp={c} />
              ))}
            </div>
          )}
        </>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ImageSlot
              label="قبل"
              image={before}
              onPick={() => beforeInput.current?.click()}
              onClear={() => setBefore(null)}
            />
            <ImageSlot
              label="بعد"
              image={after}
              onPick={() => afterInput.current?.click()}
              onClear={() => setAfter(null)}
            />
            <input ref={beforeInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e, setBefore)} />
            <input ref={afterInput} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e, setAfter)} />
          </div>

          <div>
            <label className="text-sm font-bold mb-1.5 block">وصف المقارنة</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="مثال: بعد شهر من الريتينول"
              className="w-full h-11 px-4 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                setMode("list");
                setBefore(null);
                setAfter(null);
              }}
              variant="outline"
              className="rounded-2xl px-5"
            >
              إلغاء
            </Button>
            <Button onClick={save} className="flex-1 rounded-2xl rawnak-rose-gradient text-white font-bold">
              حفظ المقارنة
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ImageSlot({
  label,
  image,
  onPick,
  onClear,
}: {
  label: string;
  image: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-2 border-dashed border-border bg-card">
      {image ? (
        <>
          <img src={image} alt={label} className="w-full h-full object-cover" />
          <span className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur text-white text-xs font-bold">
            {label}
          </span>
          <button
            onClick={onClear}
            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <button onClick={onPick} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImagePlus className="w-8 h-8" />
          <span className="text-xs font-semibold">{label}</span>
        </button>
      )}
    </div>
  );
}

function ComparisonCard({ comp }: { comp: BeforeAfter }) {
  const [slider, setSlider] = useState(50);

  return (
    <Card className="p-3 rounded-3xl border-border overflow-hidden">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-bold text-sm">{comp.label}</h3>
        <span className="text-xs text-muted-foreground">
          {new Date(comp.ts).toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden select-none">
        {/* After (base) */}
        <img src={comp.afterImage} alt="بعد" className="absolute inset-0 w-full h-full object-cover" />
        <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur text-white text-xs font-bold z-10">
          بعد
        </span>
        {/* Before (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
        >
          <img src={comp.beforeImage} alt="قبل" className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur text-white text-xs font-bold">
            قبل
          </span>
        </div>
        {/* Divider */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
          style={{ right: `${slider}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-0 w-8 h-8 rounded-full bg-white shadow-lg grid place-items-center">
            <MoveHorizontal className="w-4 h-4 text-foreground" />
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={slider}
          onChange={(e) => setSlider(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
          aria-label="مقارنة"
        />
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">
        اسحبي للمقارنة ←
      </p>
    </Card>
  );
}
