"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type BeautyVideo } from "@/lib/data";
import { getQuizForLesson, type QuizQuestion } from "@/lib/academy-quiz-data";
import { saveQuizScore, getQuizHistory, type QuizResultRecord } from "@/lib/firebase/quiz-service";
import { awardAcademyXp } from "@/lib/firebase/gamification-service";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  CheckCircle2,
  XCircle,
  Award,
  Sparkles,
  RotateCcw,
  TrendingUp,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  Flame,
  Check,
  Zap,
  Calendar,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { triggerSuccessHaptic, triggerSelectionHaptic } from "@/lib/haptics";

interface LessonQuizProps {
  video: BeautyVideo;
  onQuizCompleted?: (scorePercent: number) => void;
}

export function LessonQuiz({ video, onQuizCompleted }: LessonQuizProps) {
  const { unlockAchievement } = useAppStore();

  const questions: QuizQuestion[] = getQuizForLesson(video);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<{ questionId: string; isCorrect: boolean }[]>([]);
  const [scoreCount, setScoreCount] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  
  // History tracking
  const [history, setHistory] = useState<QuizResultRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load history on mount or when video changes
  useEffect(() => {
    if (questions.length === 0) {
      return;
    }
    let isMounted = true;
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const records = await getQuizHistory(video.id);
        if (isMounted) setHistory(records);
      } catch (err) {
        console.warn("Error loading quiz history:", err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    }
    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [video.id, questions.length]);

  if (questions.length === 0) {
    return (
      <Card className="p-6 rounded-2xl border-dashed text-center space-y-2">
        <Brain className="w-9 h-9 mx-auto text-muted-foreground/50" />
        <p className="text-sm font-bold">لا يوجد اختبار موثّق لهذا الفيديو بعد</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          لن نعرض أسئلة عامة لا ترتبط بمحتوى الدرس. سيظهر الاختبار بعد إعداد أسئلة خاصة بهذا الفيديو.
        </p>
      </Card>
    );
  }

  const currentQ = questions[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    triggerSelectionHaptic();
    setSelectedOption(idx);
    setIsAnswered(true);

    const isCorrect = idx === currentQ.correctIndex;
    if (isCorrect) {
      setScoreCount((prev) => prev + 1);
      triggerSuccessHaptic();
    }

    setUserAnswers((prev) => [
      ...prev,
      { questionId: currentQ.id, isCorrect },
    ]);
  };

  const handleNextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Quiz finished
      setIsFinished(true);
      const total = questions.length;
      const finalScore = scoreCount;
      const scorePct = Math.round((finalScore / total) * 100);

      setIsSaving(true);
      try {
        const saved = await saveQuizScore({
          videoId: video.id,
          videoTitle: video.title,
          scorePercent: scorePct,
          correctAnswersCount: finalScore,
          totalQuestions: total,
          answersSummary: userAnswers,
        });

        setHistory((prev) => [saved, ...prev]);

        // Award XP and sync leaderboard
        const xpEarned = scorePct >= 100 ? 100 : scorePct >= 50 ? 50 : 25;
        const xpRes = await awardAcademyXp(xpEarned, `إكمال اختبار الدرس بنسبة ${scorePct}%`, {
          videoId: video.id,
          type: scorePct >= 100 ? "perfect_quiz" : "quiz",
        });

        if (xpRes.newBadges.length > 0) {
          xpRes.newBadges.forEach((b) => {
            toast.success(`شارة جديدة! حصلتِ على وسام [${b.title}] 🏅`);
          });
        }

        if (scorePct >= 70) {
          triggerSuccessHaptic();
          unlockAchievement("first-analysis");
          toast.success(`إنجاز ممتـاز! أحرزتِ ${scorePct}% في اختبار الدرس (+${xpEarned} XP) 🏆`);
        } else {
          toast.info(`أكملتِ الاختبار بنسبة ${scorePct}% (+${xpEarned} XP). يمكنكِ المراجعة وإعادة الاختبار لرفع النتيجة! ✨`);
        }

        if (onQuizCompleted) {
          onQuizCompleted(scorePct);
        }
      } catch (err) {
        toast.error("حدث خطأ أثناء حفظ نتيجة الاختبار");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleResetQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setUserAnswers([]);
    setScoreCount(0);
    setIsFinished(false);
    triggerSelectionHaptic();
  };

  // Best score achieved for this video
  const bestScore = history.length > 0 ? Math.max(...history.map((h) => h.scorePercent)) : null;

  return (
    <Card className="p-4 rounded-3xl border-border/80 bg-card shadow-sm space-y-4 overflow-hidden relative">
      {/* Quiz Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary grid place-items-center font-bold">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
              <span>اختبار فهم الدرس</span>
              <Badge variant="outline" className="text-[9px] rounded-full px-2 py-0 border-primary/30 text-primary">
                مباشر ✦
              </Badge>
            </h3>
            <p className="text-[10px] text-muted-foreground">اختبري استيعابكِ للدرس للوصول للنتائج المرجوة</p>
          </div>
        </div>

        {bestScore !== null && (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-full gap-1">
            <Award className="w-3 h-3 text-amber-500" />
            أعلى نتيجة: {bestScore}%
          </Badge>
        )}
      </div>

      {!isFinished ? (
        /* Question Active View */
        <div className="space-y-4">
          {/* Progress Header */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
              <span>
                السؤال {currentIndex + 1} من {questions.length}
              </span>
              <span className="text-primary font-black">
                النقاط الحالية: {scoreCount} / {questions.length}
              </span>
            </div>
            <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2 rounded-full" />
          </div>

          {/* Question Text */}
          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1">
            <h4 className="font-extrabold text-xs text-foreground leading-relaxed">
              {currentQ.question}
            </h4>
          </div>

          {/* Options Grid */}
          <div className="space-y-2">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.correctIndex;

              let btnStyle = "bg-background border-border/80 text-foreground hover:border-primary/50";
              if (isAnswered) {
                if (isCorrect) {
                  btnStyle = "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-sm";
                } else if (isSelected && !isCorrect) {
                  btnStyle = "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold";
                } else {
                  btnStyle = "bg-background/50 border-border/40 text-muted-foreground opacity-60";
                }
              }

              return (
                <button
                  key={idx}
                  disabled={isAnswered}
                  onClick={() => handleSelectOption(idx)}
                  className={cn(
                    "w-full text-right p-3 rounded-2xl border text-xs transition-all flex items-center justify-between gap-3 font-semibold",
                    btnStyle
                  )}
                >
                  <span className="flex-1 leading-relaxed">{opt}</span>

                  <span className="shrink-0">
                    {isAnswered && isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    {isAnswered && isSelected && !isCorrect && (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    )}
                    {!isAnswered && (
                      <span className="w-5 h-5 rounded-full border border-border/80 grid place-items-center text-[10px] text-muted-foreground font-bold">
                        {idx + 1}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Explanation Banner when answered */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3 pt-1"
              >
                <div
                  className={cn(
                    "p-3.5 rounded-2xl border text-xs space-y-1 leading-relaxed",
                    selectedOption === currentQ.correctIndex
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
                  )}
                >
                  <p className="font-extrabold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    الشرح العلمي المعتمد:
                  </p>
                  <p className="font-medium text-[11px] opacity-90">{currentQ.explanation}</p>
                </div>

                <Button
                  onClick={handleNextQuestion}
                  className="w-full rounded-2xl rawnak-rosegold-gradient text-black font-extrabold text-xs h-10 shadow-md gap-1.5"
                >
                  <span>{currentIndex < questions.length - 1 ? "السؤال التالي" : "عرض النتيجة النهائية"}</span>
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* Quiz Summary & Historical Scores View */
        <div className="space-y-4">
          {/* Result Banner */}
          <div className="text-center p-5 rounded-3xl bg-muted/30 border border-border/80 space-y-3 relative overflow-hidden">
            <div className="w-14 h-14 rounded-2xl rawnak-gradient grid place-items-center text-2xl mx-auto shadow-inner">
              {scoreCount === questions.length ? "🏆" : scoreCount >= Math.ceil(questions.length / 2) ? "✨" : "📚"}
            </div>

            <div>
              <Badge variant="outline" className="text-[10px] rounded-full px-3 py-0.5 font-bold mb-1">
                نتيجة الاختبار الحالية
              </Badge>
              <h4 className="font-black text-2xl text-foreground">
                {Math.round((scoreCount / questions.length) * 100)}%
              </h4>
              <p className="text-xs text-muted-foreground font-bold mt-1">
                أجبتِ صحصحاً على {scoreCount} من أصل {questions.length} أسئلة
              </p>
            </div>

            {isSaving && (
              <p className="text-[10px] text-primary font-bold animate-pulse">
                جاري توثيق النتيجة في قاعدة بيانات Firestore...
              </p>
            )}

            <Button
              onClick={handleResetQuiz}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold gap-1.5 h-8 bg-background"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة الاختبار لرفع النتيجة
            </Button>
          </div>

          {/* Historical Score Progression */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                تطوركِ وسجل الاختبارات لهذا الدرس
              </h4>
              <span className="text-[10px] text-muted-foreground font-semibold">محفوظة في Firestore ⚡</span>
            </div>

            {loadingHistory ? (
              <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
                جاري جلب سجل نتائجكِ...
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pretty-scroll pr-0.5">
                {history.map((item, idx) => {
                  const dateStr = new Date(item.timestamp).toLocaleDateString("ar-SA", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-xl grid place-items-center font-black text-[11px]",
                            item.scorePercent >= 70
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-amber-500/10 text-amber-600"
                          )}
                        >
                          {item.scorePercent}%
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-[11px]">
                            {item.correctAnswersCount} / {item.totalQuestions} إجابات صحيحة
                          </p>
                          <p className="text-[10px] text-muted-foreground">{dateStr}</p>
                        </div>
                      </div>

                      {idx === 0 && (
                        <Badge className="bg-primary/10 text-primary text-[9px] font-bold rounded-full border-none">
                          الأحدث
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground rounded-xl bg-muted/20">
                هذه أول محاولة لكِ في هذا الاختبار!
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
