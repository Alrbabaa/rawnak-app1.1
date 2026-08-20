"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, type CabinetProduct } from "@/lib/store";
import { RAWNAK_PICKS, type RawnakPick } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Star, Plus, Check, ExternalLink, Loader2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatConvertedPrice, getCountryCodeForCountryName } from "@/lib/currencies";

/**
 * "محفوظاتي" — everything the user has hearted or saved, in one place,
 * inside the Cabinet screen. Three sources, each handled the way its data
 * actually lives:
 *  - `savedLooks` (Style Studio outfit combos) — ids only, resolved against
 *    the same static RAWNAK_PICKS the coordinator itself reads from, so no
 *    network call.
 *  - `likedPicks` (RawnakPick ids) — resolved by re-fetching /api/picks
 *    (already public + country-filtered), same call picks-screen.tsx makes.
 *    No AI involved.
 *  - `savedProducts` (full RecommendedProduct snapshots) — these come from
 *    a per-session AI recommendation with no backing collection, so the
 *    full object was already snapshotted locally when the user saved it
 *    (see toggleSaveProduct in store.ts). Rendered straight from local
 *    state — no network call, no AI call.
 */
export function SavedItemsTab() {
  const {
    savedProducts,
    likedPicks,
    toggleSaveProduct,
    toggleLikedPick,
    cabinet,
    addCabinetProduct,
    selectedCurrency,
    selectedCountry,
    savedLooks,
    removeLook,
    setPendingLookToLoad,
    setView,
  } = useAppStore();

  const [likedPickData, setLikedPickData] = useState<RawnakPick[]>([]);
  const [loadingPicks, setLoadingPicks] = useState(false);

  const countryCode = useMemo(() => getCountryCodeForCountryName(selectedCountry), [selectedCountry]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (likedPicks.length === 0) {
        if (active) setLikedPickData([]);
        return;
      }
      if (!active) return;
      setLoadingPicks(true);
      try {
        const res = await fetch(`/api/picks?country=${encodeURIComponent(countryCode)}`);
        const data = await res.json();
        if (active && res.ok && Array.isArray(data.picks)) {
          setLikedPickData(data.picks.filter((p: RawnakPick) => likedPicks.includes(p.id)));
        }
      } catch {
        // keep whatever we had
      } finally {
        if (active) setLoadingPicks(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [countryCode, likedPicks.length]);

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

  const isEmpty = savedProducts.length === 0 && likedPicks.length === 0 && savedLooks.length === 0;

  if (isEmpty) {
    return (
      <Card className="p-8 rounded-3xl border-border text-center">
        <Heart className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="font-bold mb-1">محفوظاتكِ فارغة</p>
        <p className="text-sm text-muted-foreground">
          اضغطي أيقونة القلب على أي منتج في «التوصيات» أو «اختيارات رَونق»، أو احفظي إطلالة من «استوديو الإطلالة»
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Saved coordinated outfits from Style Studio */}
      {savedLooks.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-extrabold text-muted-foreground px-1">
            إطلالاتي المحفوظة · {savedLooks.length}
          </p>
          <div className="space-y-2.5">
            {savedLooks.map((look, i) => {
              const items = Object.values(look.items)
                .filter((id): id is string => Boolean(id))
                .map((id) => RAWNAK_PICKS.find((p) => p.id === id))
                .filter((p): p is RawnakPick => Boolean(p));
              return (
                <motion.div
                  key={look.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.2) }}
                >
                  <Card className="p-3 rounded-2xl border-border">
                    <div className="flex items-center gap-2 mb-2.5">
                      {items.map((it) => (
                        <div
                          key={it.id}
                          className="w-10 h-10 rounded-xl rawnak-gradient grid place-items-center text-lg shrink-0"
                        >
                          {it.emoji}
                        </div>
                      ))}
                      {items.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          بعض قطع هذه الإطلالة لم تعد متوفرة
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        onClick={() => {
                          setPendingLookToLoad(look.items);
                          setView("style");
                        }}
                        size="sm"
                        className="rounded-xl rawnak-rosegold-gradient text-black font-bold flex-1 h-8 text-[11px] px-2"
                      >
                        <Wand2 className="w-3.5 h-3.5 ml-1" />
                        فتح في الاستوديو
                      </Button>
                      <button
                        onClick={() => {
                          removeLook(look.id);
                          toast("حُذفت الإطلالة");
                        }}
                        aria-label="حذف الإطلالة"
                        className="shrink-0 w-8 h-8 grid place-items-center rounded-xl border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved AI-recommended skincare products */}
      {savedProducts.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-extrabold text-muted-foreground px-1">
            منتجات من توصياتكِ · {savedProducts.length}
          </p>
          <div className="space-y-2.5">
            {savedProducts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.2) }}
              >
                <Card className="p-3 rounded-2xl border-border flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl rawnak-gradient grid place-items-center text-xl shrink-0">
                    🧴
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{p.brand}</p>
                    <p className="font-bold text-xs leading-tight truncate">{p.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-bold">{p.rating}</span>
                      <span className="text-[11px] text-muted-foreground">· {p.priceRange}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      toggleSaveProduct(p);
                      toast("أُزيل من المحفوظات");
                    }}
                    aria-label="إزالة من المحفوظات"
                    className="shrink-0 w-8 h-8 grid place-items-center rounded-full hover:bg-muted"
                  >
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                  </button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Liked Rawnak Picks (fashion, accessories, makeup, fragrance…) */}
      {likedPicks.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-extrabold text-muted-foreground px-1">
            من اختيارات رَونق · {likedPicks.length}
          </p>
          {loadingPicks ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : likedPickData.length === 0 ? (
            <Card className="p-4 rounded-2xl border-border text-center">
              <p className="text-xs text-muted-foreground">
                تعذّر تحميل بعض العناصر المحفوظة حاليًا لدولتكِ
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {likedPickData.map((pick, i) => {
                const added = inCabinet(pick.name);
                return (
                  <motion.div
                    key={pick.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                  >
                    <Card className="rounded-3xl border-border overflow-hidden flex flex-col h-full">
                      <div className="relative aspect-square rawnak-gradient shrink-0">
                        {pick.photoUrl ? (
                          <img src={pick.photoUrl} alt={pick.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-4xl">{pick.emoji}</div>
                        )}
                        <button
                          onClick={() => toggleLikedPick(pick.id)}
                          aria-label="إزالة من المحفوظات"
                          className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-background/85 backdrop-blur-sm shadow-xs"
                        >
                          <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                        </button>
                      </div>
                      <div className="p-2.5 flex flex-col flex-1">
                        <p className="text-[10px] text-muted-foreground truncate">{pick.brand}</p>
                        <h3 className="font-bold text-xs leading-tight line-clamp-2 min-h-[2.1em]">
                          {pick.name}
                        </h3>
                        <div className="flex items-center gap-1 mt-1.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-[11px] font-bold">{pick.rating}.0</span>
                        </div>
                        <div className="mt-auto pt-2 space-y-1.5">
                          <span className="block text-xs font-extrabold rawnak-gold-text">
                            {formatConvertedPrice(pick.price, selectedCurrency)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {pick.department === "beauty" && (
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
                              onClick={() => window.open(pick.purchaseUrl, "_blank", "noopener,noreferrer")}
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
      )}
    </div>
  );
}
