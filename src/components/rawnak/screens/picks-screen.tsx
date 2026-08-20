"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useAppStore, type CabinetProduct } from "@/lib/store";
import {
  RAWNAK_PICKS,
  PRODUCT_DEPARTMENTS,
  TRENDING_TAB_ID,
  categoriesForDepartment,
  type RawnakPick,
  type ProductDepartment,
} from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Heart,
  Plus,
  Check,
  ExternalLink,
  ChevronLeft,
  Sparkles,
  Filter,
  Loader2,
} from "lucide-react";
import { formatConvertedPrice, getCountryCodeForCountryName } from "@/lib/currencies";
import { PartnerDiscountCardsSection } from "@/components/rawnak/partner-discount-cards";
import { ProductsTabHeader } from "@/components/rawnak/products-tab-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ============ Local label maps ============ */
/** Category label/emoji lookups spanning all departments (a pick's `category` id is only unique within its own department's list). */
const ALL_CATEGORIES = PRODUCT_DEPARTMENTS.flatMap((department) =>
  categoriesForDepartment(department.id)
);
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  ALL_CATEGORIES.map((c) => [c.id, c.label])
);
const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  ALL_CATEGORIES.map((c) => [c.id, c.emoji])
);

/** Derive the user's skin-attribute set in `bestFor` vocabulary. */
function buildUserTraits(profile: {
  skinType: string | null;
  concerns: string[];
  goals: string[];
}): Set<string> {
  const traits = new Set<string>();
  switch (profile.skinType) {
    case "oily":
      traits.add("oily");
      break;
    case "dry":
      traits.add("dryness");
      break;
    case "sensitive":
      traits.add("sensitivity");
      break;
    case "combination":
      traits.add("oily");
      break;
    case "normal":
      traits.add("glow");
      break;
  }
  (profile.concerns || []).forEach((c) => traits.add(c));
  (profile.goals || []).forEach((g) => {
    if (g === "antiaging") traits.add("aging");
    else if (g === "acnefree") traits.add("acne");
    else if (g === "evening") traits.add("darkspots");
    else traits.add(g);
  });
  return traits;
}

export function PicksScreen() {
  const { profile, cabinet, addCabinetProduct, likedPicks, toggleLikedPick, setView, selectedCurrency, selectedCountry, pendingPicksFilter, setPendingPicksFilter } =
    useAppStore();
  const [activeDept, setActiveDept] = useState<ProductDepartment | typeof TRENDING_TAB_ID>(
    pendingPicksFilter?.department ?? "beauty"
  );
  const [activeCat, setActiveCat] = useState(pendingPicksFilter?.category ?? "all");
  const [matchSkin, setMatchSkin] = useState(false);
  const [picks, setPicks] = useState<RawnakPick[]>(RAWNAK_PICKS);
  const [loading, setLoading] = useState(true);

  // Style Studio's trend/palette cards hand off a department+category here
  // once — consume it on mount so this screen opens already filtered
  // instead of dumping the user on the generic "beauty" tab, then clear
  // the channel so it doesn't stick on a later unrelated visit.
  useEffect(() => {
    if (pendingPicksFilter) {
      setPendingPicksFilter(null);
    }
  }, []);

  const countryCode = useMemo(() => getCountryCodeForCountryName(selectedCountry), [selectedCountry]);

  /* Load picks from the database (admin-managed, already filtered server-side
     by the user's country), fall back to static seeds. */
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    (async () => {
      try {
        const res = await fetch(`/api/picks?country=${encodeURIComponent(countryCode)}`);
        const data = await res.json();
        if (active && res.ok && data.picks && data.picks.length > 0) {
          setPicks(data.picks);
        }
      } catch {
        // keep static fallback
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [countryCode]);

  /* Always show all department tabs, even before products exist in one —
     plus a pinned "الترندات" tab first (editorial cross-department picks,
     see RawnakPick.trending). */
  const departments = [
    { id: TRENDING_TAB_ID, label: "الترندات", emoji: "🔥" },
    ...PRODUCT_DEPARTMENTS,
  ];

  /* Picks within the active tab. "الترندات" cuts across every department
     using the admin's manual `trending` flag — no extra department field,
     no AI involved. */
  const deptPicks = useMemo(() => {
    const list =
      activeDept === TRENDING_TAB_ID
        ? picks.filter((p) => p.trending)
        : picks.filter((p) => (p.department || "beauty") === activeDept);
    // Manual admin ordering (drag-reorder in the Picks panel) wins when
    // set; items without one keep the API's newest-first order, pushed
    // after any manually-ordered ones. Stable sort preserves that for ties.
    return [...list].sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : Infinity;
      const bo = typeof b.order === "number" ? b.order : Infinity;
      return ao - bo;
    });
  }, [picks, activeDept]);

  /* Show the complete configured category list for a department, including
     empty categories. Previously this list was derived only from the loaded
     products, which made whole categories disappear from the catalog UI.
     Trending is cross-department, so its pills remain data-driven. */
  const categories = useMemo(() => {
    if (activeDept !== TRENDING_TAB_ID) {
      return ["all", ...categoriesForDepartment(activeDept).map((category) => category.id)];
    }

    const seen = new Set<string>();
    deptPicks.forEach((p) => seen.add(p.category));
    return ["all", ...Array.from(seen)];
  }, [activeDept, deptPicks]);

  /* User skin-traits set, memoised. */
  const userTraits = useMemo(
    () =>
      buildUserTraits({
        skinType: profile.skinType,
        concerns: profile.concerns,
        goals: profile.goals,
      }),
    [profile.skinType, profile.concerns, profile.goals]
  );

  /* How many picks match the user's skin profile (for the toggle badge) — only meaningful for the beauty department. */
  const skinMatchCount = useMemo(
    () => deptPicks.filter((p) => p.bestFor.some((b) => userTraits.has(b))).length,
    [deptPicks, userTraits]
  );

  /* Apply both filters. */
  const filteredPicks = useMemo(() => {
    return deptPicks.filter((p) => {
      if (activeCat !== "all" && p.category !== activeCat) return false;
      if (activeDept === "beauty" && matchSkin && !p.bestFor.some((b) => userTraits.has(b))) return false;
      return true;
    });
  }, [deptPicks, activeCat, activeDept, matchSkin, userTraits]);

  /* Auto-computed "الأكثر طلبًا" signal — top-3 by engagementCount within
     each department, complementing the admin's manual `trending` flag.
     Purely a local ranking of numbers already on the pick, no network
     call and no AI. A minimum count avoids badging brand-new items with
     0 or 1 accidental engagements. */
  const popularIds = useMemo(() => {
    const byDept = new Map<string, RawnakPick[]>();
    for (const p of picks) {
      const dept = p.department || "beauty";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept)!.push(p);
    }
    const ids = new Set<string>();
    for (const list of byDept.values()) {
      list
        .filter((p) => (p.engagementCount || 0) >= 3)
        .sort((a, b) => (b.engagementCount || 0) - (a.engagementCount || 0))
        .slice(0, 3)
        .forEach((p) => ids.add(p.id));
    }
    return ids;
  }, [picks]);

  /* Is the pick already in the cabinet (matched by name)? */
  const inCabinet = (name: string) => cabinet.some((c) => c.name === name);

  const handleAddToCabinet = (pick: RawnakPick) => {
    if (inCabinet(pick.name)) {
      toast("المنتج في خزانتكِ بالفعل");
      return;
    }
    const newProduct: CabinetProduct = {
      id: `cab-${Date.now()}`,
      name: pick.name,
      brand: pick.brand,
      category: "skincare",
      subCategory: pick.category,
      openedAt: null,
      shelfLifeMonths: 12,
      rating: pick.rating,
      notes: pick.description,
      addedAt: Date.now(),
      favorite: false,
      useCount: 0,
      lastUsedAt: null,
      price: pick.price,
      purchaseUrl: pick.purchaseUrl,
      source: "picks",
    };
    addCabinetProduct(newProduct);
    toast.success("أُضيف إلى خزانتكِ ✦");
  };

  const handleBuy = (pick: RawnakPick) => {
    window.open(pick.purchaseUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="py-3 space-y-4">
      <div className="flex items-center">
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
          الرئيسية
        </button>
      </div>

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rosegold-gradient items-center justify-center mb-3">
          <Sparkles className="w-7 h-7 text-black" />
        </div>
        <h1 className="text-2xl font-extrabold">اختيارات رَونق</h1>
        <p className="text-sm text-muted-foreground mt-1">
          كل ما تحتاجينه — جمال، أزياء وإكسسوارات — مع روابط شراء موثوقة
        </p>
      </div>

      <ProductsTabHeader />

      {/* Intro card */}
      <Card className="p-4 rounded-3xl border-primary/30 rawnak-gradient text-black">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-black/10 grid place-items-center shrink-0">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold leading-relaxed">
              كل منتج هنا اختارته رَونق بعناية. اضغطي «أضيفي لخزانتي» لتتبّعه، أو
              «اشتري الآن» للذهاب للمتجر.
            </p>
            <p className="text-[11px] mt-1.5 text-black/70 leading-relaxed">
              ملاحظة: بعض الروابط روابط شريك، ودعمها يساعد في استمرار رَونق مجانًا.
            </p>
          </div>
        </div>
      </Card>

      {/* Commercial Partner Discount Cards */}
      <PartnerDiscountCardsSection />

      {/* Department tabs (+ pinned "الترندات" tab first) */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {departments.map((d) => {
          const active = activeDept === d.id;
          const isTrending = d.id === TRENDING_TAB_ID;
          return (
            <button
              key={d.id}
              onClick={() => {
                setActiveDept(d.id);
                setActiveCat("all");
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl border text-xs font-bold transition-all",
                active
                  ? isTrending
                    ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white border-transparent rawnak-shadow"
                    : "rawnak-rosegold-gradient text-black border-transparent rawnak-shadow"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              <span className="text-lg leading-none">{d.emoji}</span>
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {categories.map((cat) => {
          const active = activeCat === cat;
          const label = cat === "all" ? "الكل" : CATEGORY_LABEL[cat] || cat;
          const emoji = cat === "all" ? "✨" : CATEGORY_EMOJI[cat] || "💄";
          return (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-xs font-semibold border transition-all",
                active
                  ? "rawnak-rosegold-gradient text-black border-transparent rawnak-shadow"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              <span className="text-sm">{emoji}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Smart "matches my skin" toggle — only relevant for the beauty department */}
      {activeDept === "beauty" && (
      <button
        onClick={() => setMatchSkin((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all",
          matchSkin
            ? "border-primary/50 bg-primary/10 rawnak-shadow"
            : "border-border bg-card hover:border-primary/30"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-9 h-9 rounded-xl grid place-items-center shrink-0 transition-colors",
              matchSkin ? "rawnak-rosegold-gradient" : "bg-muted"
            )}
          >
            <Filter
              className={cn("w-4 h-4", matchSkin ? "text-black" : "text-muted-foreground")}
            />
          </div>
          <div className="text-start">
            <p className="text-sm font-bold">مناسب لبشرتي</p>
            <p className="text-[11px] text-muted-foreground">
              يعرض فقط المنتجات الملائمة لنوع بشرتكِ واهتماماتكِ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {skinMatchCount > 0 && (
            <Badge
              className={cn(
                "rounded-full text-[10px]",
                matchSkin
                  ? "rawnak-rosegold-gradient text-black border-transparent"
                  : "bg-muted text-muted-foreground border-transparent"
              )}
            >
              {skinMatchCount}
            </Badge>
          )}
          <span
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors",
              matchSkin ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                matchSkin ? "left-0.5" : "left-[22px]"
              )}
            />
          </span>
        </div>
      </button>
      )}

      {/* Product grid — 2 columns, image-forward (the scannable pattern
          shoppers already know from Namshi/Noon/Shein), replacing the old
          single-column list. Each card shows one reason (not the full
          tag cloud) so every card is the same height regardless of how
          much copy a given product has — a grid only looks professional
          when rows line up. */}
      {filteredPicks.length === 0 ? (
        <Card className="p-8 rounded-3xl border-border text-center">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-bold mb-1">لا منتجات هنا بعد</p>
          <p className="text-sm text-muted-foreground">
            {deptPicks.length === 0
              ? "لم تُضَف منتجات في هذا القسم لدولتكِ بعد — جرّبي قسمًا آخر"
              : "جرّبي فئة أخرى أو أوقفي فلتر «مناسب لبشرتي»"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredPicks.map((pick, i) => {
            const liked = likedPicks.includes(pick.id);
            const added = inCabinet(pick.name);
            return (
              <motion.div
                key={pick.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card className="rounded-3xl border-border overflow-hidden flex flex-col h-full">
                  {/* Photo */}
                  <div className="relative aspect-square rawnak-gradient shrink-0">
                    {pick.photoUrl ? (
                      <img src={pick.photoUrl} alt={pick.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-4xl">{pick.emoji}</div>
                    )}
                    <button
                      onClick={() => toggleLikedPick(pick.id)}
                      aria-label="حفظ"
                      className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-background/85 backdrop-blur-sm shadow-xs"
                    >
                      <Heart
                        className={cn(
                          "w-4 h-4 transition-colors",
                          liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                        )}
                      />
                    </button>
                    {(added || popularIds.has(pick.id)) && (
                      <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                        {popularIds.has(pick.id) && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/90 text-white">
                            🔥 الأكثر طلبًا
                          </span>
                        )}
                        {added && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-background/85 backdrop-blur-sm text-primary">
                            <Check className="w-2.5 h-2.5" />
                            بالخزانة
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="text-[10px] text-muted-foreground truncate">{pick.brand}</p>
                    <h3 className="font-bold text-xs leading-tight line-clamp-2 min-h-[2.1em]">{pick.name}</h3>

                    {pick.reasons[0] && (
                      <p className="flex items-center gap-1 text-[10px] text-primary/90 mt-1 line-clamp-1">
                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                        {pick.reasons[0]}
                      </p>
                    )}

                    <div className="flex items-center gap-1 mt-1.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-bold">{pick.rating}.0</span>
                    </div>

                    <div className="mt-auto pt-2 space-y-1.5">
                      <span className="block text-xs font-extrabold rawnak-gold-text">
                        {formatConvertedPrice(pick.price, selectedCurrency)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {activeDept === "beauty" && (
                          <button
                            onClick={() => handleAddToCabinet(pick)}
                            aria-label="أضيفي لخزانتي"
                            className={cn(
                              "w-8 h-8 shrink-0 grid place-items-center rounded-xl border transition-colors",
                              added
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                            )}
                          >
                            {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </button>
                        )}
                        <Button
                          onClick={() => handleBuy(pick)}
                          size="sm"
                          className="rounded-xl rawnak-rosegold-gradient text-black font-bold flex-1 h-8 text-[11px] px-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5 ml-1" />
                          اشتري
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
