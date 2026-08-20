"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import {
  RAWNAK_PICKS,
  STYLE_TRENDS,
  COLOR_PALETTES,
  type RawnakPick,
} from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Wand2,
  Palette,
  TrendingUp,
  ShoppingBag,
  Heart,
  ExternalLink,
  BookmarkPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductsTabHeader } from "@/components/rawnak/products-tab-header";
import { BotanicalDecor } from "@/components/rawnak/botanical-decor";
import { toast } from "sonner";

type SlotId = "top" | "hijab" | "jewelry" | "accessory";

const SLOTS: { id: SlotId; label: string; filter: (p: RawnakPick) => boolean }[] = [
  {
    id: "top",
    label: "الفستان / التنورة",
    filter: (p) =>
      p.department === "fashion" &&
      ["dresses", "evening", "skirts"].includes(p.category),
  },
  {
    id: "hijab",
    label: "الحجاب",
    filter: (p) => p.department === "fashion" && p.category === "hijab",
  },
  {
    id: "jewelry",
    label: "المجوهرات",
    filter: (p) =>
      p.department === "accessories" &&
      ["jewelry", "watches"].includes(p.category),
  },
  {
    id: "accessory",
    label: "الإكسسوار",
    filter: (p) =>
      (p.department === "accessories" &&
        ["hair", "phone", "bags", "scarves", "sunglasses"].includes(p.category)) ||
      (p.department === "fashion" && ["bags", "hats", "shoes"].includes(p.category)),
  },
];

function priceNumber(price: string): number {
  const n = parseFloat(price.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function StyleStudioScreen() {
  const {
    setView,
    goBack,
    likedPicks,
    toggleLikedPick,
    setPendingPicksFilter,
    pendingLookToLoad,
    setPendingLookToLoad,
    saveLook,
  } = useAppStore();
  const [selected, setSelected] = useState<Partial<Record<SlotId, string>>>({});

  // A saved look opened from "محفوظاتي" hands its selection off here once,
  // then clears the channel — this screen owns the coordinator's live
  // state from that point on, same handoff pattern as pendingPicksFilter.
  useEffect(() => {
    if (pendingLookToLoad) {
      void Promise.resolve().then(() => {
        setSelected(pendingLookToLoad);
        setPendingLookToLoad(null);
      });
    }
  }, [pendingLookToLoad]);

  const slotOptions = useMemo(() => {
    const map: Record<SlotId, RawnakPick[]> = { top: [], hijab: [], jewelry: [], accessory: [] };
    for (const slot of SLOTS) {
      map[slot.id] = RAWNAK_PICKS.filter(slot.filter);
    }
    return map;
  }, []);

  const selectedItems = SLOTS.map((s) => ({
    slot: s,
    item: selected[s.id] ? RAWNAK_PICKS.find((p) => p.id === selected[s.id]) : undefined,
  }));
  const chosenCount = selectedItems.filter((s) => s.item).length;
  const totalPrice = selectedItems.reduce(
    (sum, s) => sum + (s.item ? priceNumber(s.item.price) : 0),
    0
  );

  return (
    <div className="py-3 space-y-5">
      <button
        onClick={() => { if (!goBack()) setView("home"); }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
        رجوع
      </button>

      <div className="relative text-center overflow-hidden rounded-3xl py-4">
        <BotanicalDecor variant="background" tone="theme" />
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rosegold-gradient items-center justify-center mb-3 relative z-10">
          <Wand2 className="w-7 h-7 text-black" />
        </div>
        <h1 className="text-2xl font-extrabold relative z-10 flex items-center justify-center gap-2">
          استوديو الإطلالة
          <BotanicalDecor variant="badge" tone="theme" icon="sparkle" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1 relative z-10">
          نسّقي إطلالتكِ، تصفّحي الترندات، واستلهمي من لوحات الألوان
        </p>
      </div>

      <ProductsTabHeader />

      {/* ============ Trend radar ============ */}
      <div className="relative">
        <BotanicalDecor variant="corner" tone="fashion" corner="tr" />
        <h3 className="font-bold mb-2 px-1 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-primary" />
          ترندات الموسم
        </h3>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {STYLE_TRENDS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setPendingPicksFilter({ department: t.department, category: t.category });
                setView("picks");
              }}
              className="shrink-0 w-40 rounded-2xl p-4 text-right relative overflow-hidden shadow-xs"
              style={{ background: t.gradient }}
            >
              <span className="text-2xl">{t.emoji}</span>
              <p className="font-extrabold text-sm mt-2 text-black">{t.title}</p>
              <p className="text-[10px] text-black/60 font-medium mb-1">{t.titleEn}</p>
              <p className="text-[11px] text-black/70 leading-snug">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ============ Color palettes ============ */}
      <div>
        <h3 className="font-bold mb-2 px-1 flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-primary" />
          لوحات الألوان وقواعد التنسيق
        </h3>
        <div className="space-y-2.5">
          {COLOR_PALETTES.map((p) => (
            <Card key={p.id} className="p-3.5 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-sm">{p.name}</p>
                <div className="flex -space-x-1.5 rtl:space-x-reverse">
                  {p.colors.map((c) => (
                    <span
                      key={c.hex}
                      title={c.label}
                      className="w-6 h-6 rounded-full border-2 border-background"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2.5">{p.tip}</p>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {p.colors.map((c) => (
                  <span
                    key={c.hex}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono"
                  >
                    {c.label} · {c.hex}
                  </span>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPendingPicksFilter({ department: p.department, category: p.category });
                  setView("picks");
                }}
                className="w-full text-xs h-8 rounded-xl gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                تسوّقي القطع المطابقة
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <BotanicalDecor variant="divider" tone="theme" />

      {/* ============ Outfit coordinator ============ */}
      <div>
        <h3 className="font-bold mb-1 px-1 flex items-center gap-1.5">
          <Wand2 className="w-4 h-4 text-primary" />
          منسّقة الإطلالة
        </h3>
        <p className="text-xs text-muted-foreground px-1 mb-3">
          اختاري قطعة من كل ركن لبناء إطلالة متناغمة بنقرة واحدة
        </p>

        <BotanicalDecor variant="banner" tone="fashion" label="أربعة أركان، إطلالة واحدة" className="mb-4" />

        <div className="space-y-4">
          {SLOTS.map((slot) => (
            <div key={slot.id}>
              <p className="text-xs font-bold text-muted-foreground mb-1.5 px-1">{slot.label}</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                {slotOptions[slot.id].length === 0 && (
                  <p className="text-[11px] text-muted-foreground px-1">لا تتوفر قطع بعد في هذا الركن</p>
                )}
                {slotOptions[slot.id].map((item) => {
                  const isSelected = selected[slot.id] === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        setSelected((s) => ({
                          ...s,
                          [slot.id]: isSelected ? undefined : item.id,
                        }))
                      }
                      className={cn(
                        "shrink-0 w-20 rounded-xl border-2 p-2 text-center transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      )}
                    >
                      <span className="text-2xl">{item.emoji}</span>
                      <p className="text-[10px] font-medium mt-1 line-clamp-2 leading-tight">
                        {item.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Combined look preview */}
        <AnimatePresence>
          {chosenCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <Card className="p-4 rounded-2xl rawnak-gradient border-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-extrabold text-sm text-foreground">إطلالتكِ المنسّقة ✦</p>
                  <button
                    onClick={() => {
                      saveLook(selected);
                      toast.success("حُفظت الإطلالة في محفوظاتكِ ✦");
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-foreground bg-background/70 px-2.5 py-1.5 rounded-xl hover:bg-background/90"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    حفظ الإطلالة
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {selectedItems.map(({ slot, item }) => (
                    <div
                      key={slot.id}
                      className="aspect-square rounded-xl bg-background/70 grid place-items-center text-2xl"
                    >
                      {item ? item.emoji : <span className="text-xs text-muted-foreground">{slot.label}</span>}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-foreground/80">
                    {chosenCount} من {SLOTS.length} قطع مختارة
                  </span>
                  {totalPrice > 0 && (
                    <span className="text-sm font-extrabold text-foreground">
                      الإجمالي: {totalPrice.toFixed(0)} ر.س
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {selectedItems
                    .filter((s) => s.item)
                    .map(({ item }) => (
                      <div
                        key={item!.id}
                        className="flex items-center justify-between bg-background/60 rounded-xl p-2"
                      >
                        <span className="text-xs font-medium truncate">{item!.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleLikedPick(item!.id)}
                            className="w-7 h-7 grid place-items-center rounded-full hover:bg-background/80"
                            aria-label="أعجبني"
                          >
                            <Heart
                              className={cn(
                                "w-3.5 h-3.5",
                                likedPicks.includes(item!.id) ? "fill-primary text-primary" : "text-muted-foreground"
                              )}
                            />
                          </button>
                          <a
                            href={item!.purchaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 grid place-items-center rounded-full hover:bg-background/80"
                            aria-label="تسوقي"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
