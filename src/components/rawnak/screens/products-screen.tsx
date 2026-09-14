"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Heart, Loader2, ChevronLeft, Sparkles, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProductsTabHeader } from "@/components/rawnak/products-tab-header";
import { PRODUCT_DEPARTMENTS, categoriesForDepartment, type RecommendedProduct, type ProductDepartment } from "@/lib/data";
import { isQuotaExceeded, describeQuotaError, type QuotaErrorPayload } from "@/lib/quota-error";
import { buildPersonalizationContext } from "@/lib/personalization";

type Product = RecommendedProduct;

const EMOJIS: Record<string, string> = {
  غسول: "🧴",
  مرطب: "💧",
  سيروم: "🧪",
  "واقي شمس": "☀️",
  تونر: "🌸",
  علاج: "💊",
};

export function ProductsScreen() {
  const { profile, analyses, cabinet, routine, streak, plans, academyHistory, savedProducts, toggleSaveProduct, setView, goBack } =
    useAppStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<QuotaErrorPayload | null>(null);
  const [activeDept, setActiveDept] = useState<ProductDepartment | "all">("all");
  const [activeCat, setActiveCat] = useState<string>("all");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await authedFetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: {
              skinType: profile.skinType,
              concerns: profile.concerns,
              goals: profile.goals,
              age: profile.age,
            },
            latestAnalysis: analyses[0]
              ? { overall: analyses[0].overall, skinType: analyses[0].skinType }
              : null,
            context: buildPersonalizationContext({ profile, analyses, cabinet, routine, streak, plans, academyHistory }),
          }),
        });
        const d = await res.json();
        if (active && res.ok && d.products) setProducts(d.products);
        if (active && !res.ok && (d.upgradeRequired || isQuotaExceeded(d))) {
          setNeedsUpgrade(true);
          if (isQuotaExceeded(d)) setQuotaInfo(d);
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile, analyses]);

  // تصفية المنتجات حسب الأقسام
  const filteredByDept = activeDept === "all" 
    ? products 
    : products.filter((p) => (p.department || "beauty") === activeDept);

  // الأقسام الفرعية للقسم النشط
  const categories = useMemo(() => {
    if (activeDept === "all") return [{ id: "all", label: "الكل" }];
    const cats = categoriesForDepartment(activeDept as ProductDepartment);
    return [
      { id: "all", label: "الكل", emoji: "✨" },
      ...cats.map(c => ({ id: c.id, label: c.label, emoji: c.emoji }))
    ];
  }, [activeDept]);

  // تصفية نهائية حسب الأقسام الفرعية
  const filteredProducts = activeCat === "all"
    ? filteredByDept
    : filteredByDept.filter((p) => p.category === activeCat);

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
          <ShoppingBag className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold">منتجات موصى بها لكِ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          مختارة بعناية بناءً على ملف بشرتكِ وأهدافكِ
        </p>
      </div>

      <ProductsTabHeader />

      {/* Department tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <button
          onClick={() => {
            setActiveDept("all");
            setActiveCat("all");
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl border text-xs font-bold transition-all",
            activeDept === "all"
              ? "rawnak-rosegold-gradient text-black border-transparent rawnak-shadow"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
          )}
        >
          <span className="text-lg leading-none">✨</span>
          الكل
        </button>
        {PRODUCT_DEPARTMENTS.map((d) => {
          const active = activeDept === d.id;
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
                  ? "rawnak-rosegold-gradient text-black border-transparent rawnak-shadow"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              <span className="text-lg leading-none">{d.emoji}</span>
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Category filter pills — يظهر فقط إذا كان هناك أقسام فرعية */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {categories.map((cat) => {
            const active = activeCat === cat.id;
            const label = cat.label;
            const emoji = cat.emoji || "💄";
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
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
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">أختار الأفضل لبشرتكِ...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((p, i) => {
            const saved = savedProducts.some((s) => s.id === p.id);
            return (
              <motion.div
                key={p.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="p-4 rounded-3xl border-border">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-2xl rawnak-gradient grid place-items-center text-3xl shrink-0">
                      {EMOJIS[p.category] || "💄"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{p.brand}</p>
                          <h3 className="font-bold text-sm leading-tight line-clamp-2">{p.name}</h3>
                        </div>
                        <button
                          onClick={() => {
                            toggleSaveProduct(p);
                            toast(saved ? "أُزيل من المحفوظات" : "حُفظ في قائمتكِ ✦");
                          }}
                          className="shrink-0 w-8 h-8 grid place-items-center rounded-full hover:bg-muted"
                          aria-label="حفظ"
                        >
                          <Heart
                            className={cn("w-5 h-5 transition-colors", saved ? "fill-rose-500 text-rose-500" : "text-muted-foreground")}
                          />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {p.category}
                        </Badge>
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          {p.tag}
                        </Badge>
                        <div className="flex items-center gap-0.5 mr-auto">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold">{p.rating}</span>
                          <span className="text-xs text-muted-foreground">{p.priceRange}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                    {p.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-xl bg-primary/5">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <p className="text-xs">
                      <span className="font-bold text-primary">المكوّن الرئيسي:</span>{" "}
                      {p.keyIngredient} — {p.benefit}
                    </p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && filteredProducts.length === 0 && needsUpgrade && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            {quotaInfo ? describeQuotaError(quotaInfo) : "استخدمتِ تجربتكِ المجانية من التوصيات الذكية ✦"}
          </p>
          <Button onClick={() => setView("vip")} className="mt-3 rounded-xl">
            الترقية إلى VIP
          </Button>
        </div>
      )}

      {!loading && filteredProducts.length === 0 && !needsUpgrade && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">تعذّر تحميل التوصيات حاليًا</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-3 rounded-xl">
            إعادة المحاولة
          </Button>
        </div>
      )}
    </div>
  );
}
