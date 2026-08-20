"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  X,
  Clock,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonList } from "@/components/rawnak/skeletons";

interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  coverEmoji: string;
  readMinutes: number;
  bestFor: string[];
  createdAt: string;
}

interface ArticleFull extends ArticleSummary {
  content: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  tips: "نصائح",
  education: "تعليمي",
  skincare: "العناية بالبشرة",
  makeup: "المكياج",
  seasonal: "موسمي",
};

const CATEGORY_EMOJI: Record<string, string> = {
  tips: "💡",
  education: "📚",
  skincare: "🧴",
  makeup: "💄",
  seasonal: "🌸",
};

export function ArticlesScreen() {
  const { setView, profile } = useAppStore();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("all");
  const [openArticle, setOpenArticle] = useState<ArticleFull | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/articles");
        const data = await res.json();
        if (active && res.ok) setArticles(data.articles || []);
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const categories = ["all", ...Array.from(new Set(articles.map((a) => a.category)))];

  const filtered =
    activeCat === "all"
      ? articles
      : articles.filter((a) => a.category === activeCat);

  const openBySlug = async (slug: string) => {
    setLoadingArticle(true);
    try {
      const res = await fetch(`/api/articles?slug=${slug}`);
      const data = await res.json();
      if (res.ok) setOpenArticle(data.article);
    } catch {
      // ignore
    } finally {
      setLoadingArticle(false);
    }
  };

  // Personalized: highlight articles matching user's concerns/goals
  const userTraits = new Set([
    ...(profile.concerns || []),
    ...(profile.goals || []),
    profile.skinType || "",
  ]);

  return (
    <div className="py-3 space-y-4">
      <button
        onClick={() => setView("home")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4" />
        الرئيسية
      </button>

      <div className="text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rosegold-gradient items-center justify-center mb-3">
          <BookOpen className="w-7 h-7 text-black" />
        </div>
        <h1 className="text-2xl font-extrabold">مقالات الجمال</h1>
        <p className="text-sm text-muted-foreground mt-1">
          نصائح ومعلومات من خبيرة رَونق
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCat(c)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all",
              activeCat === c
                ? "rawnak-rosegold-gradient text-black"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {c === "all" ? "✨ الكل" : `${CATEGORY_EMOJI[c] || "📄"} ${CATEGORY_LABEL[c] || c}`}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <Card className="p-8 rounded-3xl border-border text-center">
          <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-bold mb-1">لا مقالات بعد</p>
          <p className="text-sm text-muted-foreground">عُودي قريبًا لمحتوى جديد</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a, i) => {
            const matches = a.bestFor.some((b) => userTraits.has(b));
            return (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openBySlug(a.slug)}
                className="w-full text-right"
              >
                <Card className="p-4 rounded-2xl border-border hover:border-primary/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-2xl rawnak-gradient grid place-items-center text-3xl shrink-0">
                      {a.coverEmoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {CATEGORY_EMOJI[a.category] || "📄"} {CATEGORY_LABEL[a.category] || a.category}
                        </Badge>
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          <Clock className="w-2.5 h-2.5 ml-0.5" />
                          {a.readMinutes} د
                        </Badge>
                        {matches && (
                          <Badge className="rounded-full text-[10px] bg-primary/15 text-primary">
                            <Sparkles className="w-2.5 h-2.5 ml-0.5" />
                            لكِ
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-bold text-sm leading-snug line-clamp-2">{a.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.excerpt}</p>
                    </div>
                  </div>
                </Card>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Article reader modal */}
      <AnimatePresence>
        {openArticle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpenArticle(null)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative z-10 w-full max-w-md max-h-[88vh] overflow-y-auto pretty-scroll bg-card rounded-t-3xl sm:rounded-3xl border border-border"
            >
              <div className="sticky top-0 bg-card/95 backdrop-blur p-4 border-b border-border flex items-center justify-between z-10">
                <h3 className="font-extrabold text-base line-clamp-1">{openArticle.title}</h3>
                <button
                  onClick={() => setOpenArticle(null)}
                  className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted shrink-0"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {CATEGORY_EMOJI[openArticle.category]} {CATEGORY_LABEL[openArticle.category]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    <Clock className="w-2.5 h-2.5 ml-0.5" />
                    {openArticle.readMinutes} د قراءة
                  </Badge>
                </div>
                <div className="text-center text-6xl mb-4">{openArticle.coverEmoji}</div>
                <div className="prose prose-invert max-w-none">
                  <p className="text-base font-semibold mb-3 text-primary">{openArticle.excerpt}</p>
                  <div
                    className={cn(
                      "text-sm leading-relaxed text-foreground/90",
                      "[&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_strong]:text-foreground",
                      "[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
                      "[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2",
                      "[&_ul]:list-disc [&_ul]:pr-4 [&_ul]:mb-3 [&_ul]:space-y-1",
                      "[&_ol]:list-decimal [&_ol]:pr-4 [&_ol]:mb-3 [&_ol]:space-y-1"
                    )}
                  >
                    <ReactMarkdown>{openArticle.content}</ReactMarkdown>
                  </div>
                </div>
                <div className="mt-6 p-3 rounded-2xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-xs text-muted-foreground">
                    ✦ رَونق — خبيرة الجمال الشخصية لديكِ ✦
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
