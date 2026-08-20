"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getLocalGamificationData,
  getAcademyLeaderboard,
  awardAcademyXp,
  ALL_BADGES,
  calculateLevel,
  GAMIFICATION_UPDATED_EVENT,
  type UserGamificationData,
  type LeaderboardEntry,
  type BadgeItem,
} from "@/lib/firebase/gamification-service";
import { useAppStore } from "@/lib/store";
import { AccountBadgePill } from "@/components/rawnak/account-badge-pill";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Award,
  Zap,
  Crown,
  Sparkles,
  CheckCircle2,
  Lock,
  RefreshCw,
  TrendingUp,
  Star,
  BookOpen,
  Brain,
  FileText,
  ChevronRight,
  Flame,
  ShieldCheck,
  Medal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { triggerSuccessHaptic, triggerSelectionHaptic } from "@/lib/haptics";

export function AcademyLeaderboard() {
  const { profile } = useAppStore();

  const [activeTab, setActiveTab] = useState<"leaderboard" | "badges" | "rules">("leaderboard");
  const [userData, setUserData] = useState<UserGamificationData>(() => getLocalGamificationData());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimedDailyBonus, setClaimedDailyBonus] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const lastBonusStr = localStorage.getItem("rawnak_academy_daily_bonus_date");
    const todayStr = new Date().toISOString().slice(0, 10);
    return lastBonusStr === todayStr;
  });

  const levelInfo = calculateLevel(userData.xp);

  // Picks up cross-device progress once it lands (e.g. the async Firestore
  // restore on login) without waiting for an unrelated re-render — see
  // saveLocalGamificationData in gamification-service.ts.
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<UserGamificationData>).detail;
      setUserData(detail || getLocalGamificationData());
    };
    window.addEventListener(GAMIFICATION_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(GAMIFICATION_UPDATED_EVENT, onUpdate);
  }, []);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    try {
      const { entries, userRank: rank } = await getAcademyLeaderboard(profile.name, profile.accountTier);
      setLeaderboard(entries);
      setUserRank(rank);
    } catch (e) {
      console.warn("Failed fetching leaderboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { entries, userRank: rank } = await getAcademyLeaderboard(profile.name, profile.accountTier);
        if (isMounted) {
          setLeaderboard(entries);
          setUserRank(rank);
          setLoading(false);
        }
      } catch (e) {
        console.warn("Failed fetching leaderboard:", e);
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [profile.name]);

  const handleClaimDailyBonus = async () => {
    if (claimedDailyBonus) return;

    triggerSuccessHaptic();
    const result = await awardAcademyXp(25, "مكافأة الحضور اليومي بالأكاديمية ⚡", {
      userName: profile.name,
    });

    setUserData(result.data);
    setClaimedDailyBonus(true);
    localStorage.setItem("rawnak_academy_daily_bonus_date", new Date().toISOString().slice(0, 10));

    toast.success("تم كسب +25 نقطة خبرة لمتابعة الأكاديمية اليوم! ⚡");
    fetchLeaderboardData();
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: User's Level & XP Status Card */}
      <Card className="p-5 rounded-3xl rawnak-gradient border-border/80 text-foreground relative overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full filter blur-2xl -ml-10 -mt-10 pointer-events-none" />

        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-background/80 backdrop-blur border border-border/80 grid place-items-center text-2xl shadow-sm shrink-0">
                {levelInfo.icon}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge className="bg-primary text-primary-foreground font-black text-[10px] px-2.5 py-0.5 rounded-full">
                    المستوى {levelInfo.level}
                  </Badge>
                  <span className="text-xs font-extrabold text-foreground">
                    {levelInfo.levelTitle}
                  </span>
                </div>
                <h3 className="font-black text-xl text-foreground">
                  {profile.name ? profile.name : "جميلة رَونق"}
                </h3>
              </div>
            </div>

            {/* Rank Trophy Badge */}
            <div className="bg-background/90 backdrop-blur border border-border/80 p-2.5 rounded-2xl text-center shrink-0 shadow-sm">
              <span className="text-[10px] font-bold text-muted-foreground block">ترتيبكِ الحاضر</span>
              <span className="font-black text-base text-primary flex items-center justify-center gap-1">
                <Trophy className="w-4 h-4 text-amber-500" />#{userRank}
              </span>
            </div>
          </div>

          {/* Progress Bar to next level */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-muted-foreground">نقاط الخبرة الحالية (XP)</span>
              <span className="text-primary font-extrabold">
                {userData.xp} / {levelInfo.nextXp} XP
              </span>
            </div>
            <Progress
              value={Math.min(100, Math.round((userData.xp / levelInfo.nextXp) * 100))}
              className="h-2.5 rounded-full"
            />
          </div>

          {/* Quick Stats & Daily Bonus Button */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2.5 rounded-2xl bg-background/60 border border-border/60 text-center">
              <span className="text-[10px] text-muted-foreground block font-semibold">الشارات</span>
              <span className="font-black text-xs text-foreground flex items-center justify-center gap-1">
                <Medal className="w-3.5 h-3.5 text-amber-500" />
                {userData.badges.length} / {ALL_BADGES.length}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-background/60 border border-border/60 text-center">
              <span className="text-[10px] text-muted-foreground block font-semibold">الدروس المكتملة</span>
              <span className="font-black text-xs text-foreground flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {userData.completedLessons.length}
              </span>
            </div>

            <Button
              disabled={claimedDailyBonus}
              onClick={handleClaimDailyBonus}
              size="sm"
              className={cn(
                "rounded-2xl text-[11px] font-black h-auto py-2.5 border transition-all",
                claimedDailyBonus
                  ? "bg-muted text-muted-foreground border-border/40"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/20"
              )}
            >
              {claimedDailyBonus ? (
                "تم مكافأة اليوم ⚡"
              ) : (
                <span className="flex items-center justify-center gap-1">
                  <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  +25 XP اليوم
                </span>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* View Tabs */}
      <div className="flex items-center gap-1.5 bg-muted p-1 rounded-2xl border border-border/60">
        <button
          onClick={() => {
            triggerSelectionHaptic();
            setActiveTab("leaderboard");
          }}
          className={cn(
            "flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5",
            activeTab === "leaderboard"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <span>المتصدرات 🏆</span>
        </button>

        <button
          onClick={() => {
            triggerSelectionHaptic();
            setActiveTab("badges");
          }}
          className={cn(
            "flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5",
            activeTab === "badges"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Award className="w-3.5 h-3.5 text-primary" />
          <span>الشارات ({userData.badges.length})</span>
        </button>

        <button
          onClick={() => {
            triggerSelectionHaptic();
            setActiveTab("rules");
          }}
          className={cn(
            "flex-1 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5",
            activeTab === "rules"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Zap className="w-3.5 h-3.5 text-emerald-500" />
          <span>طرق كسب XP</span>
        </button>
      </div>

      {/* Tab 1: Leaderboard List */}
      {activeTab === "leaderboard" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              لوحة المتصدرات في الأكاديمية
            </h4>
            <Button
              onClick={fetchLeaderboardData}
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] font-bold text-muted-foreground hover:text-foreground gap-1"
            >
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              تحديث
            </Button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p>جاري تحديث لوحة الشرف والمتصدرات...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => {
                const rankNum = entry.rank || idx + 1;
                let rankBadge = (
                  <span className="w-6 h-6 rounded-full bg-muted grid place-items-center text-xs font-black text-muted-foreground">
                    {rankNum}
                  </span>
                );

                if (rankNum === 1) {
                  rankBadge = (
                    <span className="w-7 h-7 rounded-full bg-amber-500 text-white grid place-items-center font-black text-xs shadow-sm">
                      🥇
                    </span>
                  );
                } else if (rankNum === 2) {
                  rankBadge = (
                    <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-800 grid place-items-center font-black text-xs shadow-sm">
                      🥈
                    </span>
                  );
                } else if (rankNum === 3) {
                  rankBadge = (
                    <span className="w-7 h-7 rounded-full bg-amber-700 text-white grid place-items-center font-black text-xs shadow-sm">
                      🥉
                    </span>
                  );
                }

                return (
                  <motion.div
                    key={entry.id || idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex items-center justify-between gap-3",
                        entry.isCurrentUser
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                          : "border-border/70 bg-card hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {rankBadge}

                        <div className="w-10 h-10 rounded-xl bg-muted/80 grid place-items-center text-xl shrink-0">
                          {entry.avatar}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-extrabold text-xs text-foreground truncate">
                              {entry.name}
                            </p>
                            {entry.countryFlag && (
                              <span className="text-xs">{entry.countryFlag}</span>
                            )}
                            <AccountBadgePill tier={entry.accountTier || (entry.isCurrentUser ? profile.accountTier : "standard")} size="sm" />
                            {entry.isCurrentUser && (
                              <Badge className="bg-primary text-[9px] px-2 py-0 rounded-full font-bold">
                                أنتِ
                              </Badge>
                            )}
                          </div>

                          <p className="text-[10px] text-muted-foreground truncate">
                            {entry.levelTitle} • {entry.badgesCount} شارات
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="font-black text-xs text-primary block">
                          {entry.xp} XP
                        </span>
                        <span className="text-[9px] text-muted-foreground font-semibold">
                          {entry.completedCount} إنجازات
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Badges & Medals Gallery */}
      {activeTab === "badges" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
              <Award className="w-4 h-4 text-primary" />
              أوسمة وشارات إنجازاتكِ
            </h4>
            <span className="text-[10px] text-muted-foreground font-bold">
              مفتوحة {userData.badges.length} من {ALL_BADGES.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {ALL_BADGES.map((b) => {
              const unlockedItem = userData.badges.find((ub) => ub.id === b.id);
              const isUnlocked = Boolean(unlockedItem);

              return (
                <Card
                  key={b.id}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all space-y-2 relative overflow-hidden",
                    isUnlocked
                      ? "border-primary/40 bg-card shadow-sm"
                      : "border-border/40 bg-muted/20 opacity-75"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-2xl grid place-items-center text-xl shadow-inner",
                        isUnlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground grayscale"
                      )}
                    >
                      {b.icon}
                    </div>

                    {isUnlocked ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[9px] font-bold rounded-full gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        مكتسبة
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground text-[9px] font-bold rounded-full gap-1 border-border/60">
                        <Lock className="w-3 h-3" />
                        قيد الفتح
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h5 className="font-extrabold text-xs text-foreground leading-snug">
                      {b.title}
                    </h5>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                      {b.desc}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: How to earn XP */}
      {activeTab === "rules" && (
        <Card className="p-4 rounded-3xl border-border/80 bg-card space-y-3">
          <h4 className="font-extrabold text-xs text-foreground flex items-center gap-1.5 pb-2 border-b border-border/60">
            <Zap className="w-4 h-4 text-emerald-500" />
            دليل كسب نقاط الخبرة (XP) وتطوير مستواكِ
          </h4>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 grid place-items-center font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">مشاهدة إكمال درس فيديو</p>
                  <p className="text-[10px] text-muted-foreground">صقل معرفتكِ بخطوات العناية</p>
                </div>
              </div>
              <Badge className="bg-blue-500/10 text-blue-600 font-black text-xs border-none">
                +50 XP
              </Badge>
            </div>

            <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-500 grid place-items-center font-bold">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">إكمال اختبار الدرس العلمي</p>
                  <p className="text-[10px] text-muted-foreground">اختبار الفهم وتثبيت المعلومات</p>
                </div>
              </div>
              <Badge className="bg-violet-500/10 text-violet-600 font-black text-xs border-none">
                +50 إلى +100 XP
              </Badge>
            </div>

            <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 grid place-items-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">تدوين ملاحظاتكِ الخاصة للدرس</p>
                  <p className="text-[10px] text-muted-foreground">حفظ ملخص الروتين أوفلاين</p>
                </div>
              </div>
              <Badge className="bg-rose-500/10 text-rose-600 font-black text-xs border-none">
                +10 XP
              </Badge>
            </div>

            <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-foreground">مكافأة الحضور والمتابعة اليومية</p>
                  <p className="text-[10px] text-muted-foreground">زر المكافأة ببطاقة المستوى</p>
                </div>
              </div>
              <Badge className="bg-amber-500/10 text-amber-600 font-black text-xs border-none">
                +25 XP يومياً
              </Badge>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
