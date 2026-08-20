"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type CabinetProduct } from "@/lib/store";
import { CABINET_CATEGORIES, monthsBetween } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Plus,
  Trash2,
  Clock,
  Star,
  X,
  Wand2,
  Loader2,
  AlertTriangle,
  Link2,
  Heart,
  CheckCircle2,
  ShoppingBag,
  ScanLine,
  Crown,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatConvertedPrice } from "@/lib/currencies";
import { useHasVipAccess } from "@/hooks/use-vip-access";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { SavedItemsTab } from "@/components/rawnak/saved-items-tab";

const SUBCAT_LABEL: Record<string, string> = Object.fromEntries(
  CABINET_CATEGORIES.map((c) => [c.id, c.label])
);

/** One accent per category, used to give each section of the cabinet its
 * own visual identity (a left-border stripe + a matching section-header
 * chip) — Tailwind needs these as literal class strings, not built
 * dynamically, so each category gets its own fixed entry here. */
const CATEGORY_ACCENT: Record<string, { border: string; chip: string }> = {
  cleanser: { border: "border-r-sky-400", chip: "bg-sky-500/10 text-sky-400" },
  toner: { border: "border-r-pink-400", chip: "bg-pink-500/10 text-pink-400" },
  serum: { border: "border-r-violet-400", chip: "bg-violet-500/10 text-violet-400" },
  moisturizer: { border: "border-r-cyan-400", chip: "bg-cyan-500/10 text-cyan-400" },
  sunscreen: { border: "border-r-amber-400", chip: "bg-amber-500/10 text-amber-400" },
  treatment: { border: "border-r-emerald-400", chip: "bg-emerald-500/10 text-emerald-400" },
  makeup: { border: "border-r-fuchsia-400", chip: "bg-fuchsia-500/10 text-fuchsia-400" },
  fragrance: { border: "border-r-rose-400", chip: "bg-rose-500/10 text-rose-400" },
};
const DEFAULT_ACCENT = { border: "border-r-primary/40", chip: "bg-primary/10 text-primary" };

export function CabinetScreen() {
  const {
    cabinet,
    addCabinetProduct,
    removeCabinetProduct,
    updateCabinetProduct,
    incrementProductUse,
    toggleCabinetFavorite,
    profile,
    setView,
    selectedCurrency,
    savedProducts,
    likedPicks,
  } = useAppStore();
  const hasVipAccess = useHasVipAccess();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [routine, setRoutine] = useState<null | {
    morning: { step: string; product: string; note: string }[];
    evening: { step: string; product: string; note: string }[];
    missing: string[];
    summary: string;
  }>(null);
  const [building, setBuilding] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"cabinet" | "saved">("cabinet");

  const toggleCatCollapsed = (catId: string) =>
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });

  // Grouped by category (skincare routine order, then makeup/fragrance),
  // so the cabinet reads as organized sections instead of one long flat
  // list — an empty category is simply skipped, not shown as a blank
  // section.
  const groupedCabinet = useMemo(() => {
    type Group = { id: string; label: string; emoji: string; items: CabinetProduct[] };
    const groups: Group[] = CABINET_CATEGORIES.map((cat) => ({
      id: cat.id as string,
      label: cat.label,
      emoji: cat.emoji,
      items: cabinet.filter((p) => p.subCategory === cat.id),
    })).filter((g) => g.items.length > 0);
    // Anything with a subCategory outside the known list still needs a home.
    const known = new Set(CABINET_CATEGORIES.map((c) => c.id as string));
    const other = cabinet.filter((p) => !known.has(p.subCategory as string));
    if (other.length > 0) {
      groups.push({ id: "other", label: "أخرى", emoji: "✨", items: other });
    }
    return groups;
  }, [cabinet]);

  const cabinetStats = useMemo(() => {
    const expiringSoon = cabinet.filter((p) => {
      const days = monthsBetween(p.openedAt, p.shelfLifeMonths);
      return days !== null && days >= 0 && days < 30;
    }).length;
    const expired = cabinet.filter((p) => {
      const days = monthsBetween(p.openedAt, p.shelfLifeMonths);
      return days !== null && days < 0;
    }).length;
    const favorites = cabinet.filter((p) => p.favorite).length;
    return { total: cabinet.length, expiringSoon, expired, favorites };
  }, [cabinet]);

  const buildRoutine = async () => {
    if (cabinet.length === 0) {
      toast.error("أضيفي منتجات إلى خزانتكِ أولًا");
      return;
    }
    setBuilding(true);
    setRoutine(null);
    try {
      const res = await authedFetch("/api/cabinet-routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cabinetProducts: cabinet.map((c) => ({
            name: c.name,
            category: c.category,
            subCategory: c.subCategory,
          })),
          skinType: profile.skinType,
          concerns: profile.concerns,
          goals: profile.goals,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new Error("سجّلي الدخول لاستخدام هذه الميزة");
        if (res.status === 403) throw new Error("هذه الميزة حصرية لعضوات VIP");
        throw new Error(data.error || "خطأ");
      }
      setRoutine(data);
      toast.success("بنيتُ روتينًا من منتجاتكِ ✦");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="py-3 space-y-4">
      <div className="text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rosegold-gradient items-center justify-center mb-3">
          <Sparkles className="w-7 h-7 text-black" />
        </div>
        <h1 className="text-2xl font-extrabold">خزانة الجمال</h1>
        <p className="text-sm text-muted-foreground mt-1">
          منتجاتكِ تحت إشراف رَونق — تتبّعي الصلاحية وبني روتينًا ذكيًا
        </p>
      </div>

      {/* Tab switcher: خزانتي (owned products) vs محفوظاتي (hearted items) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setActiveTab("cabinet")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border text-sm font-bold transition-all",
            activeTab === "cabinet"
              ? "rawnak-rosegold-gradient text-black border-transparent rawnak-shadow"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
          )}
        >
          <Sparkles className="w-4 h-4" />
          خزانتي
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border text-sm font-bold transition-all",
            activeTab === "saved"
              ? "rawnak-rosegold-gradient text-black border-transparent rawnak-shadow"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
          )}
        >
          <Heart className="w-4 h-4" />
          محفوظاتي
          {savedProducts.length + likedPicks.length > 0 && (
            <Badge
              className={cn(
                "rounded-full text-[10px] px-1.5 h-4 min-w-4 mr-0.5",
                activeTab === "saved"
                  ? "bg-black/15 text-black border-transparent"
                  : "bg-muted text-muted-foreground border-transparent"
              )}
            >
              {savedProducts.length + likedPicks.length}
            </Badge>
          )}
        </button>
      </div>

      {activeTab === "saved" ? (
        <SavedItemsTab />
      ) : (
      <>
      {/* AI build routine */}
      <Card className="p-4 rounded-2xl border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl rawnak-rosegold-gradient grid place-items-center shrink-0">
            <Wand2 className="w-5 h-5 text-black" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm mb-0.5">روتين من منتجاتكِ</h3>
            <p className="text-xs text-muted-foreground mb-2">
              دعي رَونق تبني روتينكِ اليومي من المنتجات التي تملكينها
            </p>
            <Button
              onClick={buildRoutine}
              disabled={building || cabinet.length === 0}
              size="sm"
              className="rounded-xl rawnak-rosegold-gradient text-black font-bold"
            >
              {building ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 ml-1.5" />
              )}
              ابنِ روتيني
            </Button>
          </div>
        </div>
      </Card>

      {routine && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Card className="p-4 rounded-2xl border-border">
            <p className="text-sm font-medium leading-relaxed">{routine.summary}</p>
          </Card>
          <RoutineBlock title="روتين صباحي" steps={routine.morning} />
          <RoutineBlock title="روتين مسائي" steps={routine.evening} />
          {routine.missing.length > 0 && (
            <Card className="p-4 rounded-2xl border-amber-500/30 bg-amber-500/5">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                منتجات ناقصة
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {routine.missing.map((m, i) => (
                  <Badge key={i} variant="outline" className="rounded-full">
                    {m}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {/* Add product buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          onClick={() => setAdding(true)}
          className="h-12 rounded-2xl rawnak-rosegold-gradient text-black font-bold"
        >
          <Plus className="w-5 h-5 ml-1.5" />
          إضافة يدوية
        </Button>
        <Button
          onClick={() => setImporting(true)}
          variant="outline"
          className="h-12 rounded-2xl font-bold"
        >
          <Link2 className="w-5 h-5 ml-1.5" />
          استيراد برابط
        </Button>
      </div>
      <Button
        onClick={() => setView("cabinet-scan")}
        variant="outline"
        className="w-full h-12 rounded-2xl font-bold border-primary/30 relative overflow-hidden"
      >
        <ScanLine className="w-5 h-5 ml-1.5" />
        مسح مجموعتكِ بالذكاء الاصطناعي
        <Badge
          variant="outline"
          className="mr-2 rounded-full text-[10px] font-bold border-primary/40 text-primary"
        >
          {hasVipAccess ? (
            <>
              <Crown className="w-3 h-3 ml-0.5" />
              Plus
            </>
          ) : profile.cabinetAiScanUsed < 1 ? (
            "تجربة مجانية"
          ) : (
            "VIP فقط"
          )}
        </Badge>
      </Button>

      {/* Product list — grouped into sections by category (skincare
          routine order, then makeup/fragrance) instead of one flat list,
          with a summary row up top so the whole cabinet reads at a glance. */}
      {cabinet.length === 0 ? (
        <Card className="p-8 rounded-3xl border-border text-center">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-bold mb-1">خزانتكِ فارغة</p>
          <p className="text-sm text-muted-foreground">
            أضيفي منتجاتكِ لتتبّع الصلاحية وبناء روتين ذكي
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2.5 rounded-2xl border-border text-center">
              <p className="text-base font-extrabold">{cabinetStats.total}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">منتج</p>
            </Card>
            <Card className="p-2.5 rounded-2xl border-border text-center">
              <p className="text-base font-extrabold text-amber-400">{cabinetStats.expiringSoon}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">قربت تنتهي</p>
            </Card>
            <Card className="p-2.5 rounded-2xl border-border text-center">
              <p className="text-base font-extrabold text-rose-400">{cabinetStats.expired}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">منتهية</p>
            </Card>
            <Card className="p-2.5 rounded-2xl border-border text-center">
              <p className="text-base font-extrabold text-primary">{cabinetStats.favorites}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">مفضّلة</p>
            </Card>
          </div>

          {groupedCabinet.map((group) => {
            const accent = CATEGORY_ACCENT[group.id as string] || DEFAULT_ACCENT;
            const collapsed = collapsedCats.has(group.id as string);
            return (
              <div key={group.id as string} className="space-y-2.5">
                <button
                  onClick={() => toggleCatCollapsed(group.id as string)}
                  className="w-full flex items-center justify-between px-1"
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-1 rounded-full",
                      accent.chip
                    )}
                  >
                    <span>{group.emoji}</span>
                    {group.label}
                    <span className="opacity-70">· {group.items.length}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform",
                      collapsed && "-rotate-90"
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2.5 overflow-hidden"
                    >
          {group.items.map((p) => {
            const days = monthsBetween(p.openedAt, p.shelfLifeMonths);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className={cn("p-3.5 rounded-2xl border-border border-r-4", accent.border)}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl rawnak-gradient grid place-items-center text-xl shrink-0">
                      {CABINET_CATEGORIES.find((c) => c.id === p.subCategory)?.emoji || "💄"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm truncate">{p.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {p.brand}
                            {p.price && p.price !== "غير متوفر" && (
                              <span className="text-primary font-semibold"> · {formatConvertedPrice(p.price, selectedCurrency)}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleCabinetFavorite(p.id)}
                            className="w-7 h-7 grid place-items-center rounded-full hover:bg-muted"
                            aria-label="مفضّلة"
                          >
                            <Heart
                              className={cn(
                                "w-4 h-4",
                                p.favorite
                                  ? "fill-rose-500 text-rose-500"
                                  : "text-muted-foreground"
                              )}
                            />
                          </button>
                          <button
                            onClick={() => {
                              const removed = p;
                              removeCabinetProduct(p.id);
                              toast("أُزيل المنتج", {
                                action: {
                                  label: "تراجع",
                                  onClick: () => addCabinetProduct(removed),
                                },
                              });
                            }}
                            className="w-7 h-7 grid place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-rose-500"
                            aria-label="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {SUBCAT_LABEL[p.subCategory] || p.subCategory}
                        </Badge>
                        {p.source === "imported" && (
                          <Badge className="rounded-full text-[10px] bg-violet-500/15 text-violet-400">
                            <Link2 className="w-2.5 h-2.5 ml-0.5" />
                            مستورد
                          </Badge>
                        )}
                        {p.source === "picks" && (
                          <Badge className="rounded-full text-[10px] bg-primary/15 text-primary">
                            <Sparkles className="w-2.5 h-2.5 ml-0.5" />
                            اختيار رَونق
                          </Badge>
                        )}
                        {p.source === "ai-scan" && (
                          <Badge className="rounded-full text-[10px] bg-rose-500/15 text-rose-400">
                            <ScanLine className="w-2.5 h-2.5 ml-0.5" />
                            مُكتشف تلقائيًا
                          </Badge>
                        )}
                        {days !== null && (
                          <Badge
                            className={cn(
                              "rounded-full text-[10px]",
                              days < 0
                                ? "bg-rose-500/15 text-rose-400"
                                : days < 30
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-emerald-500/15 text-emerald-400"
                            )}
                          >
                            <Clock className="w-2.5 h-2.5 ml-0.5" />
                            {days < 0 ? "منتهي" : `${days} يوم`}
                          </Badge>
                        )}
                        {p.useCount > 0 && (
                          <Badge variant="outline" className="rounded-full text-[10px]">
                            استُخدم {p.useCount}×
                          </Badge>
                        )}
                        {p.rating > 0 && (
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "w-3 h-3",
                                  i < p.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30"
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Usage tracking + purchase link */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => {
                            incrementProductUse(p.id);
                            toast.success("سُجّل الاستخدام ✦");
                          }}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          استخدمتُه اليوم
                        </button>
                        {p.purchaseUrl && (
                          <a
                            href={p.purchaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            شراء
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      <AnimatePresence>
        {adding && (
          <AddProductSheet
            onClose={() => setAdding(false)}
            onAdd={(p) => {
              addCabinetProduct(p);
              setAdding(false);
              toast.success("أُضيف المنتج إلى خزانتكِ ✦");
            }}
          />
        )}
        {importing && (
          <ImportProductSheet
            onClose={() => setImporting(false)}
            onImport={(p) => {
              addCabinetProduct(p);
              setImporting(false);
              toast.success("استوردتُ المنتج إلى خزانتكِ ✦");
            }}
          />
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}

function RoutineBlock({
  title,
  steps,
}: {
  title: string;
  steps: { step: string; product: string; note: string }[];
}) {
  return (
    <Card className="p-4 rounded-2xl border-border">
      <h4 className="font-bold text-sm mb-2">{title}</h4>
      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا خطوات</p>
      ) : (
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="w-6 h-6 rounded-full rawnak-rosegold-gradient grid place-items-center text-[10px] font-bold text-black shrink-0">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{s.step}</p>
                <p className="text-xs text-primary">{s.product}</p>
                {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AddProductSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (p: CabinetProduct) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [subCategory, setSubCategory] = useState("cleanser");
  const [shelfLife, setShelfLife] = useState(12);
  const [opened, setOpened] = useState(true);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!name.trim()) {
      toast.error("أدخلي اسم المنتج");
      return;
    }
    onAdd({
      id: `cab-${Date.now()}`,
      name: name.trim(),
      brand: brand.trim() || "غير محدد",
      category: "skincare",
      subCategory,
      openedAt: opened ? Date.now() : null,
      shelfLifeMonths: shelfLife,
      rating,
      notes: notes.trim(),
      addedAt: Date.now(),
      favorite: false,
      useCount: 0,
      lastUsedAt: null,
      source: "manual",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto pretty-scroll bg-card rounded-t-3xl sm:rounded-3xl border border-border p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-lg">إضافة منتج</h3>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">اسم المنتج *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: سيروم فيتامين سي" className="bg-background" />
          </div>
          <div>
            <Label className="mb-1 block">العلامة التجارية</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="العلامة" className="bg-background" />
          </div>
          <div>
            <Label className="mb-1.5 block">الفئة</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {CABINET_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSubCategory(c.id)}
                  className={cn(
                    "p-2 rounded-xl border-2 text-center transition-all",
                    subCategory === c.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/40"
                  )}
                >
                  <span className="text-lg block">{c.emoji}</span>
                  <span className="text-[10px] font-semibold">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">الصلاحية (شهر)</Label>
              <Input
                type="number"
                min={1}
                max={36}
                value={shelfLife}
                onChange={(e) => setShelfLife(Number(e.target.value) || 12)}
                className="bg-background"
              />
            </div>
            <div>
              <Label className="mb-1 block">التقييم</Label>
              <div className="flex items-center gap-1 h-10">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n === rating ? 0 : n)}
                    aria-label={`${n} نجوم`}
                  >
                    <Star
                      className={cn(
                        "w-6 h-6 transition-colors",
                        n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={opened}
              onChange={(e) => setOpened(e.target.checked)}
              className="w-4 h-4 accent-[oklch(0.72_0.085_45)]"
            />
            فتحتُ هذا المنتج (ابدأ تتبّع الصلاحية)
          </label>
          <div>
            <Label className="mb-1 block">ملاحظات (اختياري)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظاتكِ" className="bg-background" />
          </div>
          <Button onClick={submit} className="w-full h-12 rounded-2xl rawnak-rosegold-gradient text-black font-bold">
            أضيفي للخزانة
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ImportProductSheet({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (p: CabinetProduct) => void;
}) {
  const { selectedCurrency } = useAppStore();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<null | {
    name: string;
    brand: string;
    category: string;
    subCategory: string;
    description: string;
    ingredients: string[];
    price: string;
    store: string;
    sourceUrl: string;
  }>(null);

  const fetchProduct = async () => {
    if (!url.trim() || !/^https?:\/\//.test(url.trim())) {
      toast.error("الصقي رابطًا كاملًا يبدأ بـ http");
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/import-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      setPreview(data);
      toast.success("استخرجتُ بيانات المنتج ✦");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const confirm = () => {
    if (!preview) return;
    onImport({
      id: `cab-${Date.now()}`,
      name: preview.name,
      brand: preview.brand,
      category: "skincare",
      subCategory: preview.subCategory,
      openedAt: Date.now(),
      shelfLifeMonths: 12,
      rating: 0,
      notes: preview.description + (preview.ingredients.length ? ` | مكونات: ${preview.ingredients.join("، ")}` : ""),
      addedAt: Date.now(),
      favorite: false,
      useCount: 0,
      lastUsedAt: null,
      price: preview.price,
      purchaseUrl: preview.sourceUrl,
      source: "imported",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative z-10 w-full max-w-md max-h-[88vh] overflow-y-auto pretty-scroll bg-card rounded-t-3xl sm:rounded-3xl border border-border p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            استيراد منتج برابط
          </h3>
          <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          الصقي رابط منتج من سيبورا، أمازون، نون أو أي متجر، وستقوم رَونق باستخراج
          بيانات المنتج تلقائيًا.
        </p>

        <div className="flex gap-2 mb-4">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.sephora.com/..."
            dir="ltr"
            className="bg-background text-left"
          />
          <Button
            onClick={fetchProduct}
            disabled={loading}
            className="rounded-xl rawnak-rosegold-gradient text-black font-bold shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "استخرجي"}
          </Button>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">أقرأ صفحة المنتج...</p>
          </div>
        )}

        {preview && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <Card className="p-4 rounded-2xl border-primary/30 bg-primary/5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl rawnak-gradient grid place-items-center text-xl shrink-0">
                  {CABINET_CATEGORIES.find((c) => c.id === preview.subCategory)?.emoji || "💄"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm">{preview.name}</h4>
                  <p className="text-xs text-muted-foreground">{preview.brand}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {SUBCAT_LABEL[preview.subCategory] || preview.subCategory}
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {preview.store}
                    </Badge>
                    {preview.price && preview.price !== "غير متوفر" && (
                      <span className="text-xs font-bold text-primary">{formatConvertedPrice(preview.price, selectedCurrency)}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {preview.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {preview.description}
              </p>
            )}

            {preview.ingredients.length > 0 && (
              <div>
                <p className="text-xs font-bold mb-1.5">المكونات المكتشفة:</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.ingredients.slice(0, 12).map((ing, i) => (
                    <Badge key={i} variant="secondary" className="rounded-full text-[10px]">
                      {ing}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={() => setPreview(null)} variant="outline" className="rounded-xl flex-1">
                إعادة
              </Button>
              <Button
                onClick={confirm}
                className="rounded-xl rawnak-rosegold-gradient text-black font-bold flex-1"
              >
                <CheckCircle2 className="w-4 h-4 ml-1.5" />
                أضيفي للخزانة
              </Button>
            </div>
          </motion.div>
        )}

        {!preview && !loading && (
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs text-muted-foreground w-full">متاجر مدعومة:</span>
            {["Sephora", "Amazon", "Noon", "iHerb", "Nice One"].map((s) => (
              <Badge key={s} variant="outline" className="rounded-full text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
