"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Pin,
  Building2,
  Filter,
  Gift,
  Store,
  Star,
  ChevronRight,
  ChevronLeft,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PartnerDiscountCard, SEED_PARTNER_CARDS } from "@/lib/partner-cards-data";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PartnerDiscountCardsSection() {
  const { selectedCountry } = useAppStore();
  const [cards, setCards] = useState<PartnerDiscountCard[]>(SEED_PARTNER_CARDS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("الكل");

  // Automatic rotation index for the carousel banner
  const [rotationIndex, setRotationIndex] = useState(0);

  // Load partner cards from backend API if available
  useEffect(() => {
    async function fetchCards() {
      try {
        const res = await fetch("/api/partner-cards");
        if (res.ok) {
          const data = await res.json();
          if (data.cards && Array.isArray(data.cards) && data.cards.length > 0) {
            setCards(data.cards);
          }
        }
      } catch (e) {
        // Fall back to SEED_PARTNER_CARDS silently
      }
    }
    fetchCards();
  }, []);

  // Country match is fully automatic now (selectedCountry is detected the
  // same way as chat dialect — see detectCountryFromTimezone in data.ts),
  // never a manual list shown to the user. A visible strip of country
  // names read badly for anyone whose country wasn't in it (or felt
  // arbitrarily ordered) — see the "Country Filters Bar" this replaced.
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchCountry =
        card.country === "الجميع" || card.country === selectedCountry;

      const matchCategory =
        categoryFilter === "الكل" || card.category === categoryFilter;

      return card.status === "active" && matchCountry && matchCategory;
    });
  }, [cards, selectedCountry, categoryFilter]);

  // Featured partner card (بطاقة شريك مميز ومكان مخصص له)
  const featuredCard = useMemo(() => {
    return (
      cards.find((c) => c.status === "active" && c.isFeatured) ||
      cards.find((c) => c.status === "active" && c.pinned) ||
      cards[0]
    );
  }, [cards]);

  // Active cards for automatic rotation banner throughout the day
  const rotationCards = useMemo(() => {
    return filteredCards.length > 0 ? filteredCards : cards.filter((c) => c.status === "active");
  }, [filteredCards, cards]);

  // Automatic rotation timer based on each card's admin-customized displayDurationSeconds
  useEffect(() => {
    if (rotationCards.length <= 1) return;
    const currentCard = rotationCards[rotationIndex % rotationCards.length];
    const durationMs = (currentCard?.displayDurationSeconds || 10) * 1000;

    const timer = setTimeout(() => {
      setRotationIndex((prev) => (prev + 1) % rotationCards.length);
    }, durationMs);

    return () => clearTimeout(timer);
  }, [rotationIndex, rotationCards]);

  const handleCopyCode = async (card: PartnerDiscountCard) => {
    try {
      await navigator.clipboard.writeText(card.discountCode);
      setCopiedId(card.id);
      toast.success(`تم نسخ كود الخصم (${card.discountCode}) الخاص بـ ${card.partnerName} ✦`);

      fetch("/api/partner-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, action: "copy" }),
      }).catch(() => {});

      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast.error("تعذر نسخ الكود تلقائياً");
    }
  };

  const handleOpenStore = (card: PartnerDiscountCard) => {
    fetch("/api/partner-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, action: "click" }),
    }).catch(() => {});

    window.open(card.storeUrl, "_blank");
  };

  const categoriesList = ["الكل", "متاجر إلكترونية", "صيدليات", "براندات مباشرة", "عيادات تجميل"];

  const activeRotatedCard = rotationCards[rotationIndex % (rotationCards.length || 1)];

  return (
    <div className="space-y-4 dir-rtl" dir="rtl">
      {/* 1. Dedicated Featured Partner Card Slot (بطاقة شريك مميز ومكان مخصص له) */}
      {featuredCard && (
        <Card className="relative overflow-hidden p-4 sm:p-5 rounded-3xl border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-card to-amber-500/5 shadow-md">
          <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white grid place-items-center text-xs shadow-xs">
                ⭐
              </span>
              <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                شريك رَونق المميز (Featured VIP Partner)
              </span>
            </div>
            <Badge className="bg-amber-500 text-white border-none text-[10px] font-bold px-2 py-0.5">
              {featuredCard.badgeText || "شريك معتمد"}
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {featuredCard.brandLogoUrl ? (
                <img
                  src={featuredCard.brandLogoUrl}
                  alt={featuredCard.partnerName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500/30 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-600 grid place-items-center font-black text-lg shrink-0">
                  {featuredCard.partnerName.slice(0, 2)}
                </div>
              )}
              <div className="space-y-1">
                <h4 className="font-black text-sm text-foreground flex items-center gap-1.5">
                  {featuredCard.partnerName}
                  {featuredCard.branchName && (
                    <span className="text-[11px] text-muted-foreground font-normal">
                      ({featuredCard.branchName})
                    </span>
                  )}
                </h4>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {featuredCard.description || "استمتعي بعروض حصرية وتخفيضات خاصة لعميلات رَونق."}
                </p>
                <span className="inline-block bg-amber-500/15 text-amber-600 font-extrabold text-xs px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                  {featuredCard.discountLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="bg-card border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs font-mono font-black text-primary flex items-center gap-2">
                <span>{featuredCard.discountCode}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(featuredCard)}
                  className="bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-sans font-bold hover:bg-amber-600 transition-all flex items-center gap-1"
                >
                  {copiedId === featuredCard.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>نسخ</span>
                </button>
              </div>
              <Button
                onClick={() => handleOpenStore(featuredCard)}
                size="sm"
                className="rounded-xl h-9 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white gap-1 shrink-0"
              >
                <span>زيارة المتجر</span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Section Card with Automatic Rotation Banner & Category/Country Filters */}
      <Card className="p-5 rounded-3xl border-border bg-card shadow-xs space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 grid place-items-center shrink-0">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-foreground flex items-center gap-1.5">
                  بطاقات وتخفيضات الشركاء ✦
                  <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-none px-2 py-0">
                    تبديل تلقائي على مدار اليوم
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  خصومات موثوقة من أشهر الصيدليات والبراندات لعميلات رَونق
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Automatic Rotation Carousel Banner (التبديل التلقائي للبطاقات حسب وقت العرض المخصص) */}
        {rotationCards.length > 0 && activeRotatedCard && (
          <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-4 overflow-hidden shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Clock className="w-3.5 h-3.5" />
                <span>عرض متناوب تلقائي ({activeRotatedCard.displayDurationSeconds || 10} ثواني)</span>
              </div>
              <div className="flex items-center gap-1">
                {rotationCards.map((rc, idx) => (
                  <button
                    key={rc.id}
                    onClick={() => setRotationIndex(idx)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      idx === (rotationIndex % rotationCards.length)
                        ? "w-6 bg-primary"
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground"
                    )}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeRotatedCard.id}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  {activeRotatedCard.brandLogoUrl ? (
                    <img
                      src={activeRotatedCard.brandLogoUrl}
                      alt={activeRotatedCard.partnerName}
                      className="w-12 h-12 rounded-xl object-cover border border-border/80 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary grid place-items-center font-bold text-base shrink-0">
                      {activeRotatedCard.partnerName.slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-muted-foreground block">{activeRotatedCard.category} • {activeRotatedCard.country}</span>
                    <h4 className="font-extrabold text-xs text-foreground">{activeRotatedCard.partnerName}</h4>
                    <span className="text-xs font-bold text-primary">{activeRotatedCard.discountLabel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <div className="bg-card border border-border rounded-xl px-3 py-1 font-mono font-bold text-xs text-primary">
                    {activeRotatedCard.discountCode}
                  </div>
                  <Button
                    onClick={() => handleCopyCode(activeRotatedCard)}
                    size="sm"
                    className="rounded-xl h-8 px-2.5 text-xs font-bold gap-1"
                  >
                    {copiedId === activeRotatedCard.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>نسخ</span>
                  </Button>
                  <Button
                    onClick={() => handleOpenStore(activeRotatedCard)}
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 px-2.5 text-xs font-bold gap-1"
                  >
                    <span>متجر</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Category filter — country matching is automatic (see
            filteredCards above), no country list shown to the user. */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-semibold">
            <span className="text-muted-foreground text-[11px] shrink-0 font-bold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              التصنيف:
            </span>
            {categoriesList.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 transition-all",
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Display Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {filteredCards.length === 0 ? (
            <div className="col-span-full text-center py-8 bg-muted/20 rounded-2xl border border-dashed border-border p-4">
              <Store className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs font-bold text-foreground">لا توجد بطاقات خصم متاحة حالياً لهذه الفلاتر</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">جرّبي اختيار "الجميع" لعرض كافة العروض المتاحة</p>
            </div>
          ) : (
            filteredCards.map((card) => {
              const isCopied = copiedId === card.id;
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "relative bg-gradient-to-br from-card to-muted/20 rounded-2xl border transition-all overflow-hidden p-3.5 flex flex-col justify-between space-y-3",
                    card.pinned || card.isFeatured
                      ? "border-amber-500/40 shadow-xs ring-1 ring-amber-500/20"
                      : "border-border/80 hover:border-border"
                  )}
                >
                  {/* Banner Header Image (if present) */}
                  {card.bannerImageUrl && (
                    <div className="relative h-20 -mx-3.5 -mt-3.5 mb-1 overflow-hidden bg-muted">
                      <img
                        src={card.bannerImageUrl}
                        alt={card.partnerName}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                      <div className="absolute bottom-2 right-3 text-white">
                        <span className="text-xs font-black drop-shadow-md block">
                          {card.partnerName}
                        </span>
                        {card.branchName && (
                          <span className="text-[10px] text-white/80 block font-medium">
                            {card.branchName}
                          </span>
                        )}
                      </div>
                      {card.isFeatured && (
                        <div className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                          ⭐ شريك مميز
                        </div>
                      )}
                    </div>
                  )}

                  {/* Top Info line if no banner image */}
                  {!card.bannerImageUrl && (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {card.brandLogoUrl ? (
                          <img
                            src={card.brandLogoUrl}
                            alt={card.partnerName}
                            className="w-10 h-10 rounded-xl object-cover border border-border/60 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center font-black text-sm shrink-0">
                            {card.partnerName.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-extrabold text-xs text-foreground flex items-center gap-1">
                            {card.partnerName}
                            {card.pinned && (
                              <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </h4>
                          {card.branchName && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                              <Building2 className="w-2.5 h-2.5" />
                              {card.branchName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {card.isFeatured && (
                          <Badge className="text-[9px] bg-amber-500 text-white border-none font-bold px-1.5 py-0">
                            مميز
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-extrabold shrink-0">
                          {card.country}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Discount Badge & Description */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-amber-500/15 text-amber-600 font-extrabold text-xs px-2 py-0.5 rounded-lg border border-amber-500/30">
                        {card.discountLabel}
                      </span>
                    </div>
                    {card.description && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        {card.description}
                      </p>
                    )}
                  </div>

                  {/* Promo Code Box & Action Buttons */}
                  <div className="pt-1 flex items-center gap-2">
                    <div className="flex-1 bg-muted/80 border border-dashed border-primary/40 rounded-xl p-1.5 flex items-center justify-between text-xs font-mono font-black text-primary px-3">
                      <span className="tracking-widest">{card.discountCode}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(card)}
                        className={cn(
                          "text-[10px] font-sans font-bold px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                          isCopied
                            ? "bg-emerald-500 text-white"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        )}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ الكود</span>
                          </>
                        )}
                      </button>
                    </div>

                    <Button
                      onClick={() => handleOpenStore(card)}
                      size="sm"
                      className="rounded-xl h-8 px-2.5 text-[11px] font-bold gap-1 shrink-0"
                      variant="outline"
                    >
                      <span>المتجر</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
