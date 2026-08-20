"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import {
  VIDEO_CATEGORIES,
  BEAUTY_VIDEOS,
  RAWNAK_PICKS,
  type BeautyVideo,
  type RawnakPick,
} from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MotionModal } from "@/components/ui/motion-modal";
import { AcademyVideoPlayer } from "@/components/rawnak/academy/academy-video-player";
import { AcademyLeaderboard } from "@/components/rawnak/academy/academy-leaderboard";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  GraduationCap,
  Wand2,
  Loader2,
  Heart,
  Play,
  Plus,
  ShoppingBag,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  Crown,
  BookOpen,
  Award,
  Flame,
  Calendar,
  Layers,
  ArrowRight,
  BookmarkCheck,
  Share2,
  Tv,
  Compass,
  Download,
  Wifi,
  WifiOff,
  FileText,
  Check,
  Edit3,
  Save,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatConvertedPrice } from "@/lib/currencies";

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  VIDEO_CATEGORIES.map((c) => [c.id, c.label])
);

/* ---- Learning Paths / Playlists ---- */
const LEARNING_PATHS = [
  {
    id: "path-basics",
    title: "أساسيات العناية اليومية",
    subtitle: "التنظيف، الترطيب، والحماية من الشمس",
    emoji: "🧴",
    categoryFilter: "skincare",
    badge: "للمبتدئات",
    gradient: "from-amber-500/10 via-rose-500/5 to-transparent",
  },
  {
    id: "path-glow",
    title: "سر النضارة والتوهج الزجاجي",
    subtitle: "فيتامين سي، الأحماض، والتقشير اللطيف",
    emoji: "✨",
    categoryFilter: "skincare",
    badge: "نضارة فائقة",
    gradient: "from-pink-500/10 via-purple-500/5 to-transparent",
  },
  {
    id: "path-makeup",
    title: "فن المكياج الناعم والمناسبات",
    subtitle: "من الإطلالة اليومية الخفيفة إلى مكياج السهرات",
    emoji: "💄",
    categoryFilter: "daily",
    badge: "احترافي",
    gradient: "from-rose-500/10 via-pink-500/5 to-transparent",
  },
  {
    id: "path-acne",
    title: "علاج الحبوب والتصبغات",
    subtitle: "حلول علمية مجربة للتخلص من آثار الحبوب",
    emoji: "🌿",
    categoryFilter: "acne",
    badge: "علاجي",
    gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
  },
];

/* ---- helpers for matching related products to a video ---- */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function pickMatchesRelated(pick: RawnakPick, related: string[]): boolean {
  const pickTokens = tokenize(pick.name);
  return related.some((rel) => {
    const relTokens = tokenize(rel);
    return relTokens.some((rt) =>
      pickTokens.some((pt) => pt.includes(rt) || rt.includes(pt))
    );
  });
}

export function AcademyScreen() {
  const {
    profile,
    academyFavorites,
    toggleAcademyFavorite,
    academyHistory,
    addWatchHistory,
    setView,
    cabinet,
    addCabinetProduct,
    selectedCurrency,
  } = useAppStore();

  const [activeCat, setActiveCat] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyOffline, setOnlyOffline] = useState(false);
  const [activeVideo, setActiveVideo] = useState<BeautyVideo | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const [recs, setRecs] = useState<{ intro: string; videoIds: string[] } | null>(
    null
  );
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [videos, setVideos] = useState<BeautyVideo[]>(() => {
    let base = BEAUTY_VIDEOS;
    if (typeof window !== "undefined") {
      try {
        const cachedVids = localStorage.getItem("rawnak_academy_videos_cache");
        if (cachedVids) {
          const parsed = JSON.parse(cachedVids);
          if (Array.isArray(parsed) && parsed.length > 0) base = parsed;
        }

        const importedStr = localStorage.getItem("rawnak_academy_imported_videos");
        if (importedStr) {
          const imported = JSON.parse(importedStr);
          if (Array.isArray(imported) && imported.length > 0) {
            return [...imported, ...base];
          }
        }
      } catch {}
    }
    return base;
  });

  // Offline network detection
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [offlineDownloadedIds, setOfflineDownloadedIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedIds = localStorage.getItem("rawnak_academy_downloaded_ids");
        if (savedIds) return JSON.parse(savedIds);
      } catch {}
    }
    return [];
  });
  const [lessonNotes, setLessonNotes] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedNotes = localStorage.getItem("rawnak_academy_notes_cache");
        if (savedNotes) return JSON.parse(savedNotes);
      } catch {}
    }
    return {};
  });
  const [importModalOpen, setImportModalOpen] = useState(false);

  const handleImportVideo = (newVid: BeautyVideo) => {
    setVideos((prev) => [newVid, ...prev]);
    try {
      const saved = localStorage.getItem("rawnak_academy_imported_videos");
      const list: BeautyVideo[] = saved ? JSON.parse(saved) : [];
      localStorage.setItem("rawnak_academy_imported_videos", JSON.stringify([newVid, ...list]));
    } catch {}
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  /* Load videos from database or fall back to cached/seeds */
  useEffect(() => {
    let activeFlag = true;
    (async () => {
      try {
        const res = await fetch("/api/academy-videos");
        const data = await res.json();
        if (activeFlag && res.ok && data.videos && data.videos.length > 0) {
          setVideos(data.videos);
          try {
            localStorage.setItem("rawnak_academy_videos_cache", JSON.stringify(data.videos));
          } catch {}
        }
      } catch {
        // fallback to cached videos or static seeds
      }
    })();
    return () => {
      activeFlag = false;
    };
  }, []);

  // Toggle saving a lesson for offline viewing
  const toggleOfflineDownload = (videoId: string) => {
    setOfflineDownloadedIds((prev) => {
      const exists = prev.includes(videoId);
      const next = exists ? prev.filter((id) => id !== videoId) : [...prev, videoId];
      try {
        localStorage.setItem("rawnak_academy_downloaded_ids", JSON.stringify(next));
      } catch {}
      if (exists) {
        toast.info("تم إزالة الدرس من محفظة الأوفلاين ⚡");
      } else {
        toast.success("تم حفظ الدرس والمحتوى للمشاهدة والمراجعة بدون إنترنت ⚡");
      }
      return next;
    });
  };

  // Save personal study notes for a lesson
  const saveLessonNote = (videoId: string, noteText: string) => {
    setLessonNotes((prev) => {
      const next = { ...prev, [videoId]: noteText };
      try {
        localStorage.setItem("rawnak_academy_notes_cache", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  /* Filter logic */
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      // Category filter
      if (activeCat !== "all" && v.category !== activeCat) return false;

      // Favorites only filter
      if (onlyFavorites && !academyFavorites.includes(v.id)) return false;

      // Offline only filter (downloaded, has personal notes, or favorited)
      if (onlyOffline) {
        const isDownloaded = offlineDownloadedIds.includes(v.id);
        const hasNote = Boolean(lessonNotes[v.id]?.trim());
        const isFav = academyFavorites.includes(v.id);
        if (!isDownloaded && !hasNote && !isFav) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = v.title.toLowerCase().includes(q);
        const matchesChannel = v.channel.toLowerCase().includes(q);
        const matchesDesc = v.description.toLowerCase().includes(q);
        const matchesProducts = v.relatedProductNames.some((p) =>
          p.toLowerCase().includes(q)
        );
        const matchesNote = (lessonNotes[v.id] || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesChannel && !matchesDesc && !matchesProducts && !matchesNote) {
          return false;
        }
      }

      return true;
    });
  }, [videos, activeCat, academyFavorites, onlyFavorites, onlyOffline, searchQuery, offlineDownloadedIds, lessonNotes]);

  /* Category Progress Stats */
  const categoryStats = useMemo(() => {
    return VIDEO_CATEGORIES.filter((c) => c.id !== "all").map((c) => {
      const catVideos = videos.filter((v) => v.category === c.id);
      const watched = catVideos.filter((v) =>
        academyHistory.some((h) => h.videoId === v.id)
      );
      const total = catVideos.length;
      const countWatched = watched.length;
      const percent = total > 0 ? Math.round((countWatched / total) * 100) : 0;

      return {
        ...c,
        total,
        countWatched,
        percent,
      };
    });
  }, [videos, academyHistory]);

  /* Stats calculation */
  const watchedCount = academyHistory.length;
  const watchedMinutes = useMemo(() => {
    return academyHistory.reduce((acc, h) => {
      const v = videos.find((item) => item.id === h.videoId);
      if (!v) return acc + 10;
      const parts = v.duration.split(":").map(Number);
      return acc + (parts[0] || 10);
    }, 0);
  }, [academyHistory, videos]);

  const userLevel = useMemo(() => {
    if (watchedCount >= 10) return { title: "خبيرات رَونق 👑", nextReq: 15, levelPercent: 100 };
    if (watchedCount >= 5) return { title: "متعلّمة متقدّمة ✨", nextReq: 10, levelPercent: (watchedCount / 10) * 100 };
    if (watchedCount >= 1) return { title: "مهتمة بالعناية 🧴", nextReq: 5, levelPercent: (watchedCount / 5) * 100 };
    return { title: "مبتدئة الشغف 🌱", nextReq: 1, levelPercent: 10 };
  }, [watchedCount]);

  /* AI Video Recommendations */
  const recVideos = useMemo(
    () =>
      recs
        ? recs.videoIds
            .map((id) => videos.find((v) => v.id === id))
            .filter((v): v is BeautyVideo => Boolean(v))
        : [],
    [recs, videos]
  );

  /* Watch History */
  const historyVideos = useMemo(
    () =>
      academyHistory
        .slice(0, 6)
        .map((h) => videos.find((v) => v.id === h.videoId))
        .filter((v): v is BeautyVideo => Boolean(v)),
    [academyHistory, videos]
  );

  /* Featured Masterclass Video */
  const masterclassVideo = useMemo(
    () => videos.find((v) => v.id === "v1") || videos[0],
    [videos]
  );

  /* Related Product Picks for Active Modal Video */
  const relatedPicks = useMemo(() => {
    if (!activeVideo) return [];
    // Only show products that actually matched this video's own
    // relatedProductNames. Previously, an unmatched video (e.g. a fresh
    // import whose product names don't exist in the catalog yet) silently
    // fell back to the same top-3 RAWNAK_PICKS for every such video — this
    // showed the same "recommended products" regardless of what the video
    // was actually about. No match now correctly means no products, and
    // the player already has an honest empty state for that case.
    return RAWNAK_PICKS.filter((p) =>
      pickMatchesRelated(p, activeVideo.relatedProductNames)
    ).slice(0, 3);
  }, [activeVideo]);

  const isPickInCabinet = (pick: RawnakPick) =>
    cabinet.some((c) => c.name === pick.name);

  const fetchRecs = async () => {
    setLoadingRecs(true);
    setRecs(null);
    try {
      const res = await fetch("/api/video-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skinType: profile.skinType,
          concerns: profile.concerns,
          goals: profile.goals,
          watchedIds: academyHistory.map((h) => h.videoId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      if (!data.videoIds || data.videoIds.length === 0) {
        toast.info("لا توصيات إضافية الآن — تصفّحي الدروس بالأسفل ✦");
        return;
      }
      setRecs(data);
      toast.success("جهزتُ لكِ خريطة تعلم مخصصة ✦");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تحميل التوصيات");
    } finally {
      setLoadingRecs(false);
    }
  };

  const openVideo = (video: BeautyVideo) => {
    setActiveVideo(video);
    addWatchHistory(video.id);
  };

  const addToCabinet = (pick: RawnakPick) => {
    addCabinetProduct({
      id: `cab-${Date.now()}`,
      name: pick.name,
      brand: pick.brand,
      category: "skincare",
      subCategory: pick.category,
      openedAt: null,
      shelfLifeMonths: 12,
      rating: pick.rating,
      notes: "",
      addedAt: Date.now(),
      favorite: false,
      useCount: 0,
      lastUsedAt: null,
      price: pick.price,
      purchaseUrl: pick.purchaseUrl,
      source: "picks",
    });
    toast.success(`أُضيف "${pick.name}" إلى خزانتكِ بنجاح ✦`);
  };

  return (
    <div className="py-3 space-y-6 pb-14">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          الرئيسية
        </button>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setImportModalOpen(true)}
            size="sm"
            variant="outline"
            className="h-8 rounded-full text-xs font-bold gap-1.5 border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            استيراد فيديو يوتيوب
          </Button>

          <Badge variant="outline" className="hidden sm:inline-flex rounded-full gap-1 border-primary/30 text-primary bg-primary/5 px-3 py-1 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            أكاديمية رَونق التعليمية
          </Badge>
        </div>
      </div>

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-primary/15 via-rose-500/10 to-card border border-primary/20 shadow-xl">
        <div className="absolute top-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-right">
          <div className="w-16 h-16 rounded-2xl rawnak-rosegold-gradient flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
            <GraduationCap className="w-8 h-8 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-foreground">أكاديمية الجمال والتجميل</h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              مركز تعليمي تفاعلي متكامل للارتقاء بروتينكِ وتطوير مهارات العناية والمكياج مع تتبع إنجازاتكِ.
            </p>
          </div>
        </div>

        {/* User Learning Stats Bar */}
        <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-3 gap-2 text-center">
          <div className="bg-background/60 backdrop-blur rounded-2xl p-2.5 border border-border/50">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>الدروس المكتملة</span>
            </div>
            <span className="font-extrabold text-base text-foreground">{watchedCount} درس</span>
          </div>

          <div className="bg-background/60 backdrop-blur rounded-2xl p-2.5 border border-border/50">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
              <Clock className="w-3.5 h-3.5 text-rose-500" />
              <span>وقت التعلم</span>
            </div>
            <span className="font-extrabold text-base text-foreground">{watchedMinutes} دقيقة</span>
          </div>

          <div className="bg-background/60 backdrop-blur rounded-2xl p-2.5 border border-border/50">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>مستوى التعلم</span>
            </div>
            <span className="font-bold text-xs text-primary truncate block">{userLevel.title}</span>
          </div>
        </div>
      </div>

      {/* Points, Badges & Academy Leaderboard System */}
      <AcademyLeaderboard />

      {/* Category Progress Hub Cards */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            أقسام الأكاديمية والتتبع
          </h3>
          <span className="text-xs text-muted-foreground">اضغطي لتصفح القسم</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categoryStats.map((cat) => {
            const isSelected = activeCat === cat.id;
            return (
              <motion.div
                key={cat.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveCat(cat.id);
                  setOnlyFavorites(false);
                }}
                className={cn(
                  "p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-28 interactive-card",
                  isSelected
                    ? "bg-primary/10 border-primary shadow-md ring-2 ring-primary/40"
                    : "bg-card border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl p-1.5 rounded-xl bg-muted/60 shrink-0">
                    {cat.emoji}
                  </span>
                  <Badge
                    variant={isSelected ? "default" : "outline"}
                    className="text-[10px] rounded-full px-2"
                  >
                    {cat.percent}%
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-xs text-foreground line-clamp-1 mb-1">
                    {cat.label}
                  </h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{cat.countWatched} من {cat.total} درس</span>
                    </div>
                    <Progress value={cat.percent} className="h-1.5 rounded-full" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Featured Masterclass Video Spotlight */}
      {masterclassVideo && (
        <Card interactive className="p-0 rounded-3xl border-primary/30 overflow-hidden relative shadow-lg group">
          <div className="relative aspect-video bg-muted overflow-hidden">
            <img
              src={masterclassVideo.thumbnail}
              alt={masterclassVideo.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            
            {/* Badges */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <Badge className="bg-amber-500 text-black font-extrabold text-xs px-2.5 py-1 rounded-full shadow-md">
                <Crown className="w-3.5 h-3.5 ml-1 inline" />
                ماستر كلاس اليوم
              </Badge>
            </div>

            <span className="absolute top-3 left-3 text-xs font-extrabold bg-black/70 backdrop-blur text-white px-2.5 py-1 rounded-full border border-white/20">
              {masterclassVideo.duration}
            </span>

            {/* Play Button */}
            <button
              onClick={() => openVideo(masterclassVideo)}
              className="absolute inset-0 grid place-items-center group/btn cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-white/95 text-black grid place-items-center shadow-2xl transition-transform duration-300 group-hover/btn:scale-110">
                <Play className="w-6 h-6 fill-black ml-0.5" />
              </div>
            </button>

            {/* Bottom Content overlay */}
            <div className="absolute bottom-0 inset-x-0 p-4 text-white">
              <p className="text-xs font-semibold text-rose-300 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {masterclassVideo.channel}
              </p>
              <h3 className="font-extrabold text-base leading-snug line-clamp-1 mb-2">
                {masterclassVideo.title}
              </h3>
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/80 line-clamp-1 max-w-[70%]">
                  {masterclassVideo.description}
                </p>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openVideo(masterclassVideo);
                  }}
                  className="rounded-full rawnak-rosegold-gradient text-black font-bold text-xs shrink-0 interactive-btn"
                >
                  شاهد الآن
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* AI Personal Consultation & Recommendation */}
      <Card className="p-4 rounded-3xl rawnak-gradient border border-primary/20 shadow-md">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl rawnak-rosegold-gradient grid place-items-center shrink-0 shadow-md">
            <Wand2 className="w-5 h-5 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-foreground">توصيات الخبيرة المخصصة لكِ</h3>
              <Badge variant="secondary" className="rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                ذكاء اصطناعي
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3 leading-relaxed">
              فيديوهات مختارة تلقائيًا حسب نوع بشرتكِ ({profile.skinType || "المختلطة"}) وأهدافكِ الحالية.
            </p>
            {!recs && (
              <Button
                onClick={fetchRecs}
                disabled={loadingRecs}
                size="sm"
                className="rounded-xl rawnak-rosegold-gradient text-black font-bold w-full sm:w-auto shadow-sm interactive-btn"
              >
                {loadingRecs ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 ml-1.5" />
                )}
                اعرضي خطة دروسي المخصصة
              </Button>
            )}
          </div>
        </div>

        {recs && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 pt-3 border-t border-border/60 space-y-3"
          >
            <p className="text-xs leading-relaxed font-semibold text-foreground bg-background/50 p-3 rounded-2xl border border-border/40">
              {recs.intro}
            </p>
            {recVideos.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                {recVideos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => openVideo(v)}
                    className="shrink-0 w-40 text-right group interactive-card"
                  >
                    <div className="relative rounded-2xl overflow-hidden aspect-video bg-muted border border-border/60 shadow-sm">
                      <img
                        src={v.thumbnail}
                        alt={v.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 grid place-items-center">
                        <div className="w-8 h-8 rounded-full bg-white/95 grid place-items-center shadow-md">
                          <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded-full">
                        {v.duration}
                      </span>
                    </div>
                    <p className="text-xs font-bold mt-2 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {v.title}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">لا توجد توصيات إضافية الآن.</p>
            )}
          </motion.div>
        )}
      </Card>

      {/* Curated Learning Playlists / Paths */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-extrabold text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            مسارات التعلم المتخصصة
          </h3>
          <span className="text-xs text-muted-foreground">اختر المسار لتطبيقه</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEARNING_PATHS.map((path) => {
            const isSelected = selectedPath === path.id;
            return (
              <div
                key={path.id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedPath(null);
                    setActiveCat("all");
                  } else {
                    setSelectedPath(path.id);
                    setActiveCat(path.categoryFilter);
                    toast.info(`تصفّحي دروس: ${path.title}`);
                  }
                }}
                className={cn(
                  "p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex items-start gap-3 interactive-card",
                  isSelected
                    ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary"
                    : "bg-card border-border hover:border-primary/40"
                )}
              >
                <div className="text-2xl p-2 rounded-2xl bg-muted/80 shrink-0">
                  {path.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h4 className="font-bold text-sm text-foreground truncate">{path.title}</h4>
                    <Badge variant="outline" className="text-[10px] rounded-full shrink-0 border-primary/30 text-primary">
                      {path.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{path.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Watch History */}
      {historyVideos.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2.5 flex items-center gap-1.5 px-1">
            <Clock className="w-4 h-4 text-primary" />
            شاهدتِ مؤخرًا
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {historyVideos.map((v) => (
              <button
                key={v.id}
                onClick={() => openVideo(v)}
                className="shrink-0 w-36 text-right group interactive-card"
              >
                <div className="relative rounded-2xl overflow-hidden aspect-video bg-muted border border-border/60">
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded-full">
                    {v.duration}
                  </span>
                </div>
                <p className="text-xs font-bold mt-1.5 line-clamp-1 group-hover:text-primary transition-colors">
                  {v.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search and Category Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحثي عن درس، مكون، خبيرة، أو تقنية مكياج..."
            className="pr-10 pl-9 rounded-2xl bg-card border-border text-xs h-11 focus-visible:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1"
            >
              مسح
            </button>
          )}
        </div>

        {/* Category Chips, Favorites and Offline Toggles */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          <button
            type="button"
            onClick={() => {
              setOnlyFavorites(!onlyFavorites);
              if (!onlyFavorites) setOnlyOffline(false);
            }}
            className={cn(
              "shrink-0 px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border interactive-btn",
              onlyFavorites
                ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", onlyFavorites && "fill-white")} />
            المفضلة ({academyFavorites.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setOnlyOffline(!onlyOffline);
              if (!onlyOffline) setOnlyFavorites(false);
            }}
            className={cn(
              "shrink-0 px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border interactive-btn",
              onlyOffline
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <HardDrive className="w-3.5 h-3.5" />
            المحفوظات أوفلاين ⚡ ({offlineDownloadedIds.length})
          </button>

          <div className="h-4 w-px bg-border shrink-0 my-auto" />

          {VIDEO_CATEGORIES.map((c) => {
            const count = c.id === "all" ? videos.length : videos.filter((v) => v.category === c.id).length;
            const isActive = activeCat === c.id && !onlyFavorites && !onlyOffline;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  setActiveCat(c.id);
                  setOnlyFavorites(false);
                  setOnlyOffline(false);
                }}
                className={cn(
                  "shrink-0 px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border interactive-btn",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{c.emoji}</span>
                {c.label}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Video Library Grid */}
      {filteredVideos.length === 0 ? (
        <Card className="p-10 rounded-3xl border-border text-center">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-extrabold text-base mb-1">لا توجد دروس مطابقة لمبحثكِ</p>
          <p className="text-xs text-muted-foreground mb-4">جربي كتابة كلمة أخرى أو إلغاء الفلاتر</p>
          <Button
            onClick={() => {
              setActiveCat("all");
              setSearchQuery("");
              setOnlyFavorites(false);
              setOnlyOffline(false);
              setSelectedPath(null);
            }}
            size="sm"
            variant="outline"
            className="rounded-xl text-xs interactive-btn"
          >
            إعادة ضبط البحث
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredVideos.map((video, i) => {
            const fav = academyFavorites.includes(video.id);
            const isWatched = academyHistory.some((h) => h.videoId === video.id);
            const isDownloaded = offlineDownloadedIds.includes(video.id);
            const hasNote = Boolean(lessonNotes[video.id]?.trim());

            return (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Card interactive className="p-0 rounded-2xl border-border overflow-hidden gap-0 relative group">
                  <div
                    onClick={() => openVideo(video)}
                    className="cursor-pointer"
                  >
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      
                      <div className="absolute inset-0 grid place-items-center">
                        <div className="w-10 h-10 rounded-full bg-white/95 grid place-items-center shadow-lg transition-transform duration-200 group-hover:scale-110">
                          <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                        </div>
                      </div>

                      {/* Indicators Bar */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                        {isWatched && (
                          <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3 h-3" />
                            مكتمل
                          </div>
                        )}
                        {isDownloaded && (
                          <div className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <HardDrive className="w-3 h-3" />
                            أوفلاين ⚡
                          </div>
                        )}
                        {hasNote && (
                          <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <FileText className="w-3 h-3" />
                            ملاحظة
                          </div>
                        )}
                      </div>

                      <span className="absolute bottom-2 left-2 text-[10px] font-extrabold bg-black/70 text-white px-2 py-0.5 rounded-full backdrop-blur">
                        {video.duration}
                      </span>
                    </div>

                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px] px-2 py-0.2"
                        >
                          {CAT_LABEL[video.category] || video.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {video.channel}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm line-clamp-2 leading-snug text-foreground group-hover:text-primary transition-colors">
                        {video.title}
                      </h4>

                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {video.description}
                      </p>
                    </div>
                  </div>

                  {/* Bookmark & Download Floating Action Buttons */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOfflineDownload(video.id);
                      }}
                      className={cn(
                        "w-8 h-8 rounded-full backdrop-blur grid place-items-center transition-colors",
                        isDownloaded
                          ? "bg-emerald-600 text-white"
                          : "bg-black/50 text-white hover:bg-black/80"
                      )}
                      aria-label="حفظ أوفلاين"
                      title="حفظ أوفلاين للمشاهدة والمراجعة"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAcademyFavorite(video.id);
                        toast(
                          fav ? "أُزيلت من المفضّلة" : "أُضيفت للمفضّلة ✦"
                        );
                      }}
                      className="w-8 h-8 rounded-full bg-black/50 backdrop-blur grid place-items-center hover:bg-black/80 transition-colors"
                      aria-label="مفضّلة"
                    >
                      <Heart
                        className={cn(
                          "w-4 h-4 transition-transform active:scale-125",
                          fav ? "fill-rose-500 text-rose-500" : "text-white"
                        )}
                      />
                    </button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Custom Interactive Video Player Modal */}
      <AcademyVideoPlayer
        video={activeVideo}
        onClose={() => setActiveVideo(null)}
        onNextLesson={(nextVid) => setActiveVideo(nextVid)}
        relatedPicks={relatedPicks}
        categoryLabel={activeVideo ? CAT_LABEL[activeVideo.category] || "درس عناية" : "درس عناية"}
      />

      {/* YouTube Import Modal */}
      <YouTubeImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportVideo}
      />
    </div>
  );
}

function YouTubeImportModal({
  isOpen,
  onClose,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (video: BeautyVideo) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("skincare");
  const [channel, setChannel] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) {
      toast.error("يُرجى إدخال رابط فيديو يوتيوب صحيح");
      return;
    }

    let ytId = "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      ytId = match[2];
    } else if (url.trim().length === 11) {
      ytId = url.trim();
    } else {
      toast.error("رابط يوتيوب غير صالح — تأكدي من نسخ الرابط كاملاً");
      return;
    }

    setImporting(true);
    // Pull the real title/channel from YouTube's own oEmbed endpoint so we
    // don't have to guess — this is the same source-of-truth check the
    // admin import uses. If it fails (private/deleted video, offline,
    // etc.) we fall back to whatever the user typed rather than inventing
    // anything.
    let realTitle = "";
    let realChannel = "";
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        realTitle = oembed.title || "";
        realChannel = oembed.author_name || "";
      }
    } catch {
      // Offline or blocked — proceed with the user-entered fields only.
    }

    const newVid: BeautyVideo = {
      id: `yt_custom_${Date.now()}`,
      title: title.trim() || realTitle || "درس فيديو يوتيوب مستورد",
      youtubeId: ytId,
      category,
      channel: channel.trim() || realChannel || "قناة غير معروفة",
      duration: "10:00",
      description: realTitle
        ? `فيديو من يوتيوب: ${realTitle}`
        : "فيديو مستورد من يوتيوب — لم تتم إضافة وصف أو ملخص له بعد.",
      thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      // No AI/catalog summarization happens on this path (it's a direct,
      // unmoderated personal import), so we deliberately leave products and
      // key takeaways empty instead of attaching generic, unrelated
      // defaults — the video screens show an honest "not available" state
      // for these rather than made-up content.
      relatedProductNames: [],
      keyTakeaways: [],
    };

    setImporting(false);
    onImport(newVid);
    setUrl("");
    setTitle("");
    setChannel("");
    onClose();
    toast.success("تم استيراد فيديو يوتيوب بنجاح! ✦");
  };

  return (
    <MotionModal isOpen={isOpen} onClose={onClose} type="dialog" maxWidth="md">
      <div className="space-y-4 p-1">
        <div className="flex items-center gap-3 border-b border-border/80 pb-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600 text-white grid place-items-center font-bold text-lg shrink-0">
            ▶
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-foreground">استيراد فيديو حقيقي من يوتيوب</h3>
            <p className="text-xs text-muted-foreground">أدخلي رابط أي فيديو من YouTube لمشاهدته وتتبعه بالأكاديمية</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">رابط الفيديو من يوتيوب (URL):</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              dir="ltr"
              className="rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">عنوان الدرس (اختياري):</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: روتين العناية المسائي للمكياج"
              className="rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">اسم القناة (اختياري):</label>
            <Input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="اسم صانعة المحتوى أو القناة"
              className="rounded-xl text-xs"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={importing} className="rounded-xl text-xs">إلغاء</Button>
          <Button onClick={handleImport} disabled={importing} className="rawnak-rose-gradient text-white rounded-xl text-xs font-extrabold gap-1">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة للأكاديمية
          </Button>
        </div>
      </div>
    </MotionModal>
  );
}
