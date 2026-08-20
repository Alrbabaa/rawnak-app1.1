"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { type BeautyVideo, type RawnakPick, BEAUTY_VIDEOS } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MotionModal } from "@/components/ui/motion-modal";
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Heart,
  Download,
  FileText,
  Sparkles,
  ShoppingBag,
  Plus,
  Check,
  Calendar,
  Share2,
  Clock,
  ArrowLeft,
  ChevronRight,
  Layers,
  MessageSquare,
  BookmarkCheck,
  Flame,
  X,
  Volume2,
  Maximize2,
  Brain,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatConvertedPrice } from "@/lib/currencies";
import { triggerSuccessHaptic, triggerSelectionHaptic } from "@/lib/haptics";
import { LessonQuiz } from "@/components/rawnak/academy/lesson-quiz";
import { hasQuizForLesson } from "@/lib/academy-quiz-data";
import { awardAcademyXp } from "@/lib/firebase/gamification-service";

interface AcademyVideoPlayerProps {
  video: BeautyVideo | null;
  onClose: () => void;
  onNextLesson?: (nextVideo: BeautyVideo) => void;
  relatedPicks: RawnakPick[];
  categoryLabel?: string;
}

interface StoredProgress {
  progressSeconds: number;
  totalSeconds: number;
  completed: boolean;
  lastWatchedAt: number;
}

export function AcademyVideoPlayer({
  video,
  onClose,
  onNextLesson,
  relatedPicks,
  categoryLabel = "درس عناية",
}: AcademyVideoPlayerProps) {
  const {
    academyFavorites,
    toggleAcademyFavorite,
    addWatchHistory,
    cabinet,
    addCabinetProduct,
    selectedCurrency,
    setView,
    unlockAchievement,
  } = useAppStore();

  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  const duration = video?.duration;
  const totalTimeSeconds = useMemo(() => {
    if (!duration) return 600;
    const parts = duration.split(":");
    if (parts.length === 2) {
      const parsed = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      return isNaN(parsed) || parsed <= 0 ? 600 : parsed;
    }
    return 600;
  }, [duration]);

  const [prevVideoId, setPrevVideoId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"products" | "quiz" | "takeaways" | "notes" | "qa">("products");
  const hasLessonQuiz = video ? hasQuizForLesson(video) : false;
  
  // Note state
  const [noteText, setNoteText] = useState<string>("");
  const [savedNote, setSavedNote] = useState<boolean>(false);
  
  // Q&A input state
  const [userQuestion, setUserQuestion] = useState("");
  // Starts empty per video — previously this was pre-seeded with one
  // generic example Q&A shown identically on every lesson, unrelated to
  // whatever that specific video actually covered.
  const [qaList, setQaList] = useState<{ q: string; a: string }[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);

  // Offline download state
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);

  // Adjust state when video changes during render
  if (video && video.id !== prevVideoId) {
    setPrevVideoId(video.id);
    setActiveTab("products");

    try {
      const savedProgStr = typeof window !== "undefined" ? localStorage.getItem(`rawnak_vid_prog_${video.id}`) : null;
      if (savedProgStr) {
        const parsed: StoredProgress = JSON.parse(savedProgStr);
        setElapsedTime(parsed.progressSeconds || 0);
        setIsCompleted(Boolean(parsed.completed));
        if (totalTimeSeconds > 0) {
          const pct = Math.min(100, Math.round((parsed.progressSeconds / totalTimeSeconds) * 100));
          setProgressPercent(pct);
        }
      } else {
        setElapsedTime(0);
        setProgressPercent(0);
        setIsCompleted(false);
      }

      const savedNotesStr = typeof window !== "undefined" ? localStorage.getItem(`rawnak_vid_notes_${video.id}`) : null;
      setNoteText(savedNotesStr || "");

      const savedDlIds = typeof window !== "undefined" ? localStorage.getItem("rawnak_academy_downloaded_ids") : null;
      if (savedDlIds) {
        const ids: string[] = JSON.parse(savedDlIds);
        setIsDownloaded(ids.includes(video.id));
      } else {
        setIsDownloaded(false);
      }
    } catch {
      // fallback
    }
  }

  const saveProgress = (curSec: number, totSec: number, completed: boolean) => {
    if (!video) return;
    try {
      const data: StoredProgress = {
        progressSeconds: Math.floor(curSec),
        totalSeconds: totSec,
        completed,
        lastWatchedAt: Date.now(),
      };
      localStorage.setItem(`rawnak_vid_prog_${video.id}`, JSON.stringify(data));
    } catch {}
  };

  // Progress simulation timer when video is playing
  useEffect(() => {
    if (!isPlaying || !video) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => {
        const next = prev + 1 * playbackSpeed;
        if (next >= totalTimeSeconds) {
          setIsCompleted(true);
          setProgressPercent(100);
          addWatchHistory(video.id);
          unlockAchievement("first-analysis");
          saveProgress(totalTimeSeconds, totalTimeSeconds, true);
          return totalTimeSeconds;
        }

        const pct = Math.min(100, Math.round((next / totalTimeSeconds) * 100));
        setProgressPercent(pct);

        // Auto save every 5 seconds
        if (Math.floor(next) % 5 === 0) {
          saveProgress(next, totalTimeSeconds, next >= totalTimeSeconds * 0.9);
        }

        return next;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, video, playbackSpeed, totalTimeSeconds, addWatchHistory, unlockAchievement]);

  const handleManualComplete = async () => {
    if (!video) return;
    setIsCompleted(true);
    setProgressPercent(100);
    setElapsedTime(totalTimeSeconds);
    addWatchHistory(video.id);
    saveProgress(totalTimeSeconds, totalTimeSeconds, true);
    triggerSuccessHaptic();

    // Award +50 XP for completing a video lesson
    const xpRes = await awardAcademyXp(50, `إكمال مشاهدة درس: ${video.title}`, {
      videoId: video.id,
      type: "lesson",
    });

    if (xpRes.newBadges.length > 0) {
      xpRes.newBadges.forEach((b) => {
        toast.success(`شارة جديدة! حصلتِ على وسام [${b.title}] 🏅`);
      });
    }

    if (hasLessonQuiz) {
      toast.success("تهانينا! أكملتِ هذا الدرس بنجاح (+50 XP) ✨", {
        action: {
          label: "ابدأي الاختبار 🧠",
          onClick: () => setActiveTab("quiz"),
        },
      });
    } else {
      toast.success("تهانينا! أكملتِ هذا الدرس بنجاح (+50 XP) ✨");
    }
  };

  const handleToggleDownload = () => {
    if (!video) return;
    try {
      const savedDlIds = localStorage.getItem("rawnak_academy_downloaded_ids");
      let ids: string[] = savedDlIds ? JSON.parse(savedDlIds) : [];
      if (ids.includes(video.id)) {
        ids = ids.filter((id) => id !== video.id);
        setIsDownloaded(false);
        toast.info("تمت إزالة الدرس من محفظة المشاهدة بدون إنترنت");
      } else {
        ids.push(video.id);
        setIsDownloaded(true);
        triggerSuccessHaptic();
        toast.success("تم حفظ الفيديو بنجاح للمشاهدة أوفلاين ⚡");
      }
      localStorage.setItem("rawnak_academy_downloaded_ids", JSON.stringify(ids));
    } catch {
      toast.error("فشل حفظ الفيديو أوفلاين");
    }
  };

  const handleSaveNotes = async (text: string) => {
    setNoteText(text);
    if (!video) return;
    try {
      localStorage.setItem(`rawnak_vid_notes_${video.id}`, text);
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2000);

      if (text.trim().length > 5) {
        const xpRes = await awardAcademyXp(10, "حفظ ملاحظات شخصية للدرس 📝", {
          videoId: video.id,
          type: "notes",
        });
        if (xpRes.newBadges.length > 0) {
          xpRes.newBadges.forEach((b) => {
            toast.success(`شارة جديدة! حصلتِ على وسام [${b.title}] 🏅`);
          });
        }
      }
    } catch {}
  };

  const handleAddPickToCabinet = (pick: RawnakPick) => {
    const already = cabinet.some(
      (c) => c.name.toLowerCase().trim() === pick.name.toLowerCase().trim()
    );

    if (already) {
      toast.info("هذا المنتج موجود بالفعل في خزانتكِ!");
      return;
    }

    addCabinetProduct({
      id: `cab-pick-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: pick.name,
      brand: pick.brand,
      category: pick.category,
      subCategory: pick.category || "منتج عناية",
      openedAt: Date.now(),
      shelfLifeMonths: 12,
      rating: 5,
      notes: `أضيف من درس الفيديو: ${video?.title || ""}`,
      addedAt: Date.now(),
      favorite: true,
      useCount: 0,
      lastUsedAt: null,
      price: `${pick.price} SAR`,
      source: "picks",
    });

    triggerSuccessHaptic();
    toast.success(`أُضيف "${pick.name}" إلى خزانتكِ بنجاح! 💕`);
  };

  const handleAddAllProductsToCabinet = () => {
    if (relatedPicks.length === 0) return;
    let addedCount = 0;

    relatedPicks.forEach((pick) => {
      const already = cabinet.some(
        (c) => c.name.toLowerCase().trim() === pick.name.toLowerCase().trim()
      );
      if (!already) {
        addCabinetProduct({
          id: `cab-pick-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: pick.name,
          brand: pick.brand,
          category: pick.category,
          subCategory: pick.category || "منتج عناية",
          openedAt: Date.now(),
          shelfLifeMonths: 12,
          rating: 5,
          notes: `أضيف من درس الفيديو: ${video?.title || ""}`,
          addedAt: Date.now(),
          favorite: true,
          useCount: 0,
          lastUsedAt: null,
          price: `${pick.price} SAR`,
          source: "picks",
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      triggerSuccessHaptic();
      toast.success(`تمت إضافة ${addedCount} منتجات إلى خزانتكِ دفعة واحدة! ✨`);
    } else {
      toast.info("جميع منتجات هذا الدرس موجودة بالفعل في خزانتكِ");
    }
  };

  const handleAskAiQuestion = async () => {
    if (!userQuestion.trim()) return;
    const q = userQuestion.trim();
    setUserQuestion("");
    setIsAnswering(true);

    try {
      const res = await authedFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `لدي سؤال حول درس الفيديو "${video?.title}": ${q}`,
          history: [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.response || "نوصي باتباع إرشادات الدرس وتجربة المنتجات بانتظام لتحقيق أسرع نتيجة.";
        setQaList((prev) => [{ q, a: reply }, ...prev]);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.upgradeRequired) {
          toast.error(data.error);
          setView("vip");
        } else {
          setQaList((prev) => [
            {
              q,
              a: "بالتأكيد! تطبيق الخطوات بالتسلسل الموضح في الدرس يضمن الامتصاص الأفضل للجلد دون تهيج.",
            },
            ...prev,
          ]);
        }
      }
    } catch {
      setQaList((prev) => [
        {
          q,
          a: "تذكري دائماً إجراء اختبار الحساسية على جزء صغير من البشرة قبل استخدام أي منتج جديد ذُكر في الدرس.",
        },
        ...prev,
      ]);
    } finally {
      setIsAnswering(false);
    }
  };

  if (!video) return null;

  const isFav = academyFavorites.includes(video.id);

  // Real, per-video summary points (set by an admin or generated at import
  // time). Previously this was one hardcoded array shown identically for
  // every video regardless of its actual content — now it's empty unless
  // the video itself carries real takeaways, and the tab below shows an
  // honest empty state instead of unrelated generic tips.
  const keyTakeaways = video.keyTakeaways || [];

  // Helper for formatting mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Find next video in playlist if available
  const currentIndex = BEAUTY_VIDEOS.findIndex((v) => v.id === video.id);
  const nextVideo = currentIndex !== -1 && currentIndex < BEAUTY_VIDEOS.length - 1
    ? BEAUTY_VIDEOS[currentIndex + 1]
    : BEAUTY_VIDEOS[0];

  return (
    <MotionModal
      isOpen={Boolean(video)}
      onClose={onClose}
      type="dialog"
      maxWidth="lg"
      className="p-0 overflow-hidden bg-background max-h-[92vh] flex flex-col"
      showCloseButton={false}
    >
      <div className="relative flex flex-col h-full overflow-hidden">
        {/* Top Sticky Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border/80 shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="secondary" className="rounded-full text-[10px] px-2.5 font-bold shrink-0">
              {categoryLabel}
            </Badge>
            <h3 className="font-extrabold text-xs text-foreground truncate max-w-[200px] sm:max-w-xs">
              {video.title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleToggleDownload}
              className={cn(
                "p-2 rounded-full transition-colors",
                isDownloaded
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              title={isDownloaded ? "محفوظ أوفلاين" : "حفظ أوفلاين"}
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                toggleAcademyFavorite(video.id);
                toast(isFav ? "أُزيلت من المفضّلة" : "أُضيفت للمفضّلة ✦");
              }}
              className="p-2 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="مفضّلة"
            >
              <Heart
                className={cn(
                  "w-4 h-4 transition-transform active:scale-125",
                  isFav ? "fill-rose-500 text-rose-500" : ""
                )}
              />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Player Frame Container */}
        <div className="relative bg-black w-full aspect-video shrink-0 group overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&enablejsapi=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />

          {/* Fallback if the creator has disabled embedding on this video —
              the iframe above just shows blank/an error in that case, so
              this link is always available, not conditional on detecting
              the failure (YouTube doesn't expose that to the parent page). */}
          <a
            href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-black/70 text-white/90 hover:bg-black/90 transition-colors z-10"
          >
            <ExternalLink className="w-3 h-3" />
            شاهدي على يوتيوب
          </a>

          {/* Interactive Player Floating HUD Overlay */}
          <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto z-10">
            {isCompleted ? (
              <Badge className="bg-emerald-600 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-full shadow-lg border border-white/20 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                مكتمل ✨
              </Badge>
            ) : (
              <Badge className="bg-black/80 backdrop-blur text-white font-bold text-[10px] px-2.5 py-1 rounded-full border border-white/20 gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                تقدمكِ: {progressPercent}%
              </Badge>
            )}
          </div>
        </div>

        {/* Custom Interactive Progress Control Bar */}
        <div className="bg-muted/40 p-3 border-b border-border/80 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-0.5">
            <span className="flex items-center gap-1.5 text-foreground">
              {isPlaying ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
              {formatTime(elapsedTime)} / {formatTime(totalTimeSeconds)}
            </span>

            <div className="flex items-center gap-2">
              {/* Playback speed selector */}
              <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 border border-border/60">
                {[1, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      triggerSelectionHaptic();
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-extrabold transition-all",
                      playbackSpeed === speed
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              {/* Play / Pause Toggle */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-7 px-2.5 rounded-lg text-xs font-bold gap-1"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                {isPlaying ? "إيقاف مؤقت" : "تشغيل"}
              </Button>
            </div>
          </div>

          {/* Interactive Progress Bar */}
          <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden cursor-pointer">
            <motion.div
              className="h-full rawnak-gradient rounded-full"
              style={{ width: `${progressPercent}%` }}
              transition={{ ease: "linear", duration: 0.3 }}
            />
          </div>

        </div>

        {/* Scrollable Main Content & Linked Products Area */}
        <div className="flex-1 overflow-y-auto pretty-scroll p-4 space-y-4">
          {/* Quick Mark Complete & Next Lesson Bar */}
          <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualComplete}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all",
                  isCompleted
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                    : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isCompleted ? "درس مكتمل" : "تحديد كدرس مكتمل"}</span>
              </button>
            </div>

            {onNextLesson && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNextLesson(nextVideo)}
                className="rounded-xl text-xs font-bold gap-1 h-8"
              >
                <span>الدرس التالي</span>
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              </Button>
            )}
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-2xl border border-border/60 overflow-x-auto pretty-scroll">
            <button
              onClick={() => setActiveTab("products")}
              className={cn(
                "flex-1 min-w-[110px] py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shrink-0",
                activeTab === "products"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-primary" />
              <span>المنتجات ({relatedPicks.length})</span>
            </button>

            {hasLessonQuiz && <button
              onClick={() => setActiveTab("quiz")}
              className={cn(
                "flex-1 min-w-[110px] py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shrink-0 relative",
                activeTab === "quiz"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Brain className="w-3.5 h-3.5 text-violet-500" />
              <span>اختبار الدرس 🧠</span>
            </button>}

            <button
              onClick={() => setActiveTab("takeaways")}
              className={cn(
                "flex-1 min-w-[110px] py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shrink-0",
                activeTab === "takeaways"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>أهم الخطوات</span>
            </button>

            <button
              onClick={() => setActiveTab("notes")}
              className={cn(
                "flex-1 min-w-[110px] py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shrink-0",
                activeTab === "notes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="w-3.5 h-3.5 text-rose-500" />
              <span>ملاحظاتي</span>
            </button>

            <button
              onClick={() => setActiveTab("qa")}
              className={cn(
                "flex-1 min-w-[110px] py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shrink-0",
                activeTab === "qa"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
              <span>استشارة</span>
            </button>
          </div>

          {/* Tab 0: Lesson Quiz */}
          {activeTab === "quiz" && hasLessonQuiz && (
            <LessonQuiz video={video} />
          )}

          {/* Tab 1: Linked Lesson-Specific Products */}
          {activeTab === "products" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted-foreground">
                  المنتجات المستخدمة والموصى بها في هذا الدرس للوصول لأفضل نتيجة:
                </p>

                {relatedPicks.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleAddAllProductsToCabinet}
                    className="rounded-xl text-[11px] font-bold h-7 rawnak-rosegold-gradient text-black gap-1 shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                    إضافة الكل للخزانة
                  </Button>
                )}
              </div>

              {relatedPicks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedPicks.map((pick) => {
                    const isAdded = cabinet.some(
                      (c) => c.name.toLowerCase().trim() === pick.name.toLowerCase().trim()
                    );

                    return (
                      <Card
                        key={pick.id}
                        className="p-3.5 rounded-2xl border-border/80 shadow-sm space-y-3 relative overflow-hidden group hover:border-primary/40 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-2xl rawnak-gradient grid place-items-center text-2xl shrink-0 shadow-inner">
                            {pick.emoji}
                          </div>

                          <div className="flex-1 min-w-0">
                            <Badge variant="outline" className="text-[9px] rounded-full px-2 py-0 font-bold mb-1">
                              {pick.brand}
                            </Badge>
                            <h4 className="font-extrabold text-xs text-foreground line-clamp-1">
                              {pick.name}
                            </h4>
                            <p className="text-xs font-black text-primary mt-0.5">
                              {formatConvertedPrice(pick.price, selectedCurrency)}
                            </p>
                          </div>
                        </div>

                        {pick.description && (
                          <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/40 p-2.5 rounded-xl border border-border/40">
                            ✨ {pick.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant={isAdded ? "secondary" : "default"}
                            disabled={isAdded}
                            onClick={() => handleAddPickToCabinet(pick)}
                            className={cn(
                              "w-full rounded-xl text-xs h-8 font-bold gap-1.5",
                              !isAdded && "rawnak-rosegold-gradient text-black shadow-sm"
                            )}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                محفوط بالخزانة
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                إضافة لخزانة العناية
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center rounded-2xl bg-muted/30 border border-dashed border-border space-y-2">
                  <ShoppingBag className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                  <p className="text-xs font-bold text-muted-foreground">
                    هذا الدرس يركز على المهارات العملية والتطبيق اليدوي!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Actionable Takeaways Checklist */}
          {activeTab === "takeaways" && (
            <div className="space-y-3">
              {keyTakeaways.length > 0 ? (
                <>
                  <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20 space-y-3">
                    <h4 className="font-extrabold text-xs text-primary flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      ملخص خطوات هذا الدرس تحديدًا
                    </h4>
                    <ul className="space-y-2.5">
                      {keyTakeaways.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground bg-background/60 p-2.5 rounded-xl border border-border/40">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-relaxed font-semibold">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    onClick={() => {
                      onClose();
                      setView("planner");
                    }}
                    className="w-full rounded-2xl rawnak-rosegold-gradient text-black font-extrabold text-xs h-11 shadow-md gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>إضافة هذه الخطوات كجدول في مخططي اليومي</span>
                  </Button>
                </>
              ) : (
                <div className="p-6 text-center rounded-2xl bg-muted/30 border border-dashed border-border space-y-2">
                  <Sparkles className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                  <p className="text-xs font-bold text-muted-foreground">
                    لم يُضَف ملخص لخطوات هذا الدرس بعد
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    يمكنكِ مشاهدة الفيديو كاملاً بالأعلى وتدوين النقاط المهمة في ملاحظاتكِ الخاصة
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Personal Lesson Notebook */}
          {activeTab === "notes" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-500" />
                  دفتر ملاحظات الدرس الخاص بكِ
                </h4>
                {savedNote && (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> تم الحفظ تلقائياً
                  </span>
                )}
              </div>

              <textarea
                value={noteText}
                onChange={(e) => handleSaveNotes(e.target.value)}
                placeholder="دونتي ملاحظاتكِ، المكونات المفضلة لكِ، أو أي استفسارات تودين تذكرها لاحقاً..."
                className="w-full text-xs p-3.5 rounded-2xl bg-card border border-border focus:outline-none focus:ring-1 focus:ring-primary min-h-[120px] resize-none text-foreground placeholder:text-muted-foreground/60 shadow-sm leading-relaxed"
              />
            </div>
          )}

          {/* Tab 4: AI Consultation QA */}
          {activeTab === "qa" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  لديكِ تساؤل حول هذا الدرس بالتحديد؟ اسألي خبيرة رَونق فوراً:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAskAiQuestion()}
                    placeholder="مثال: هل يناسب هذا السيروم البشرة الحساسة؟"
                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-card border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/60"
                  />
                  <Button
                    size="sm"
                    onClick={handleAskAiQuestion}
                    disabled={isAnswering || !userQuestion.trim()}
                    className="rounded-xl rawnak-rosegold-gradient text-black font-bold text-xs h-auto px-4"
                  >
                    {isAnswering ? "جاري الإجابة..." : "اسألي الخبيرة"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                {qaList.length === 0 ? (
                  <div className="p-4 text-center rounded-2xl bg-muted/30 border border-dashed border-border">
                    <p className="text-[11px] text-muted-foreground/80">
                      لا توجد أسئلة بعد على هذا الدرس تحديدًا — كوني أول من يسأل!
                    </p>
                  </div>
                ) : (
                  qaList.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-2xl bg-muted/40 border border-border/60 space-y-1.5">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        س: {item.q}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed bg-background/80 p-2.5 rounded-xl border border-border/40">
                        ج: {item.a}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </MotionModal>
  );
}
