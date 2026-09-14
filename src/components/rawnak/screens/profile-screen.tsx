"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { ThemeSwitcher } from "@/components/rawnak/theme-switcher";
import { SkinConcernsGrid } from "@/components/rawnak/skin-concerns-grid";
import { AgeSelector } from "@/components/rawnak/age-selector";
import { CONCERN_LABEL, SKIN_TYPES, BEAUTY_GOALS, DIALECTS } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppFooter } from "../app-footer";
import { AccountBadgePill } from "@/components/rawnak/account-badge-pill";
import { FollowersModal } from "@/components/rawnak/followers-modal";
import { AdminTierModal } from "@/components/rawnak/admin-tier-modal";
import { calculateLevel, getLocalGamificationData, getAcademyLeaderboard, GAMIFICATION_UPDATED_EVENT, type UserGamificationData } from "@/lib/firebase/gamification-service";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Crown,
  Images,
  ShoppingBag,
  ChevronLeft,
  Heart,
  Sparkles,
  Flame,
  CalendarHeart,
  Headset,
  History,
  GraduationCap,
  Star,
  Info,
  LogOut,
  Pencil,
  Moon,
  Sun,
  Bell,
  BookOpen,
  Gift,
  MessagesSquare,
  Instagram,
  AtSign,
  Check,
  Palette,
  UserCheck,
  ChevronDown,
  Settings,
  Sparkle,
  SlidersHorizontal,
  Share2,
  MessageSquarePlus,
  Globe,
  Camera,
  Users,
  UserPlus,
  ShieldCheck,
  Award,
  Zap,
  Eye,
  Trash2,
  Ban,
  EyeOff,
  Lock,
} from "lucide-react";
import { CURRENCY_MAP } from "@/lib/currencies";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { FeedbackModal } from "@/components/rawnak/feedback-modal";
import { BlockedUsersModal } from "@/components/rawnak/blocked-users-modal";
import { Capacitor } from "@capacitor/core";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { requestAndRegisterPush, clearRegisteredPush } from "@/lib/firebase/messaging";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trackEvent } from "@/lib/track-event";
import { useHasVipAccess, useVipTrialDaysRemaining } from "@/hooks/use-vip-access";

const GOAL_LABEL: Record<string, string> = Object.fromEntries(
  BEAUTY_GOALS.map((g) => [g.id, g.label])
);

const AVATAR_EMOJIS = ["💄", "🌸", "✨", "🦋", "🌙", "👑", "🌷", "💫", "🎀", "🪞"];

export function ProfileScreen() {
  const {
    profile,
    streak,
    analyses,
    comparisons,
    achievements,
    setView,
    logout,
    deleteAccount,
    updateProfile,
    selectedCurrency,
    selectedCountry,
    role,
  } = useAppStore();
  const hasVipAccess = useHasVipAccess();
  const vipTrialDaysLeft = useVipTrialDaysRemaining();

  const activeCurrencyConfig = CURRENCY_MAP[selectedCurrency] || CURRENCY_MAP.SAR;

  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followersTab, setFollowersTab] = useState<"following" | "followers" | "explore">("following");
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  // Collapsed by default — the level/XP card, admin panel entry, and
  // achievements strip are "extra" detail, not the reason someone opens
  // their account page. Keeping them one tap away instead of always-on
  // shortens the page and makes the settings tabs below reachable faster.
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [editingSocial, setEditingSocial] = useState(false);
  const [showConcernsEdit, setShowConcernsEdit] = useState(false);
  const [showAgeEdit, setShowAgeEdit] = useState(false);
  const [supportUnread, setSupportUnread] = useState(false);

  useEffect(() => {
    let active = true;
    authedFetch("/api/support/unread")
      .then((r) => r.json())
      .then((j) => { if (active) setSupportUnread(Boolean(j?.unread)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const [instagram, setInstagram] = useState(profile.socialInstagram || "");
  const [tiktok, setTiktok] = useState(profile.socialTiktok || "");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [gamificationData, setGamificationData] = useState<UserGamificationData>(() => getLocalGamificationData());
  const levelInfo = calculateLevel(gamificationData.xp);

  // Same cross-device refresh signal as the Academy leaderboard screen —
  // picks up the async Firestore restore on login instead of showing a
  // stale (or reset-to-zero) XP/level until some unrelated re-render.
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<UserGamificationData>).detail;
      setGamificationData(detail || getLocalGamificationData());
    };
    window.addEventListener(GAMIFICATION_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(GAMIFICATION_UPDATED_EVENT, onUpdate);
  }, []);

  // Real leaderboard rank (was previously hardcoded to a fixed "#2" for
  // every user, regardless of actual XP). Falls back to showing nothing
  // rather than a fabricated number while it loads or if the fetch fails.
  const [academyRank, setAcademyRank] = useState<number | null>(null);
  useEffect(() => {
    let isMounted = true;
    getAcademyLeaderboard(profile.name, profile.accountTier)
      .then(({ userRank }) => {
        if (isMounted) setAcademyRank(userRank);
      })
      .catch(() => {
        if (isMounted) setAcademyRank(null);
      });
    return () => {
      isMounted = false;
    };
  }, [profile.name, profile.accountTier, gamificationData.xp]);

  // Trust ONLY the server-verified role (from the Firebase ID token's custom
  // claims — see firebase-session.ts / admin-check.ts). Never re-derive admin
  // status from a client-side email substring check: `.includes()` on the
  // email would also match look-alike addresses (e.g. anything containing
  // the admin's email as a substring), incorrectly granting the admin UI.
  const isAdminUser = role === "admin" || role === "super_admin";

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً — يُرجى اختيار صورة أقل من 5 ميجابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      updateProfile({ profileImage: base64 });
      toast.success("تم تحديث صورتكِ الشخصية بنجاح ✦");
    };
    reader.readAsDataURL(file);
  };

  // Sub-menu open state for collapsible categories
  const [openSection, setOpenSection] = useState<"appearance" | "skin" | "explore" | "account">("appearance");

  const [pushEnabled, setPushEnabled] = useState(
    () => typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  );
  const [pushBusy, setPushBusy] = useState(false);

  const handleTogglePush = async (enable: boolean) => {
    setPushBusy(true);
    try {
      if (enable) {
        const token = await requestAndRegisterPush();
        if (token) {
          setPushEnabled(true);
          toast.success("تم تفعيل الإشعارات ✦");
          trackEvent("push_enabled");
        } else {
          toast.error("تعذّر تفعيل الإشعارات — تأكدي من صلاحيات المتصفح");
        }
      } else {
        await clearRegisteredPush();
        setPushEnabled(false);
        toast("تم إيقاف الإشعارات");
      }
    } finally {
      setPushBusy(false);
    }
  };

  const unlockedAchievements = achievements.filter((a) => a.unlocked);
  const unlockedCount = unlockedAchievements.length;
  const skinTypeLabel =
    SKIN_TYPES.find((s) => s.id === profile.skinType)?.label || "غير محدد";

  const saveName = () => {
    updateProfile({ name: name.trim() || profile.name });
    setEditing(false);
    toast.success("تم تحديث الاسم ✦");
  };

  const saveSocial = () => {
    updateProfile({
      socialInstagram: instagram.trim() || null,
      socialTiktok: tiktok.trim() || null,
    });
    setEditingSocial(false);
    toast.success("تم تحديث الحسابات ✦");
  };

  // The name-search directory (/api/social/search) reads this flag from
  // Firestore directly — updateProfile() alone only changes local state,
  // so this has to be pushed explicitly or toggling it off would silently
  // do nothing server-side while looking like it worked.
  const handleToggleDiscoverable = async (checked: boolean) => {
    updateProfile({ socialDiscoverable: checked });
    toast(checked ? "أصبح ملفكِ قابلًا للاكتشاف بالبحث" : "تم إخفاء ملفكِ عن نتائج البحث");
    try {
      await authedFetch("/api/db/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { socialDiscoverable: checked } }),
      });
    } catch {
      // Local state already reflects the choice; the next debounced/manual
      // sync opportunity will retry — no need to alarm the user over a
      // transient network hiccup for a non-destructive setting.
    }
  };

  const toggleSection = (sec: "appearance" | "skin" | "explore" | "account") => {
    setOpenSection((prev) => (prev === sec ? sec : sec));
  };

  return (
    <div className="py-3 space-y-5">
      {/* Profile Header & Social Card */}
      <Card className="p-5 rounded-3xl border-primary/20 bg-card relative overflow-hidden shadow-xs">
        <div className="absolute top-0 left-0 w-40 h-40 rounded-full rawnak-rosegold-gradient opacity-20 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="w-20 h-20 rawnak-rose-gradient border-4 border-background shadow-md overflow-hidden">
                {profile.profileImage ? (
                  <img
                    src={profile.profileImage}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : profile.avatar ? (
                  <AvatarFallback className="bg-transparent text-3xl">
                    {profile.avatar}
                  </AvatarFallback>
                ) : (
                  <AvatarFallback className="bg-transparent text-white text-2xl font-extrabold">
                    {profile.name?.charAt(0) || "ر"}
                  </AvatarFallback>
                )}
              </Avatar>

              <label
                htmlFor="profile-photo-upload"
                className="absolute bottom-0 left-0 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-110 transition-transform cursor-pointer"
                title="تغيير أو رفع صورة شخصية"
              >
                <Camera className="w-3.5 h-3.5" />
                <input
                  id="profile-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              {editing ? (
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-border bg-background text-sm font-semibold"
                    autoFocus
                  />
                  <Button size="sm" onClick={saveName} className="rawnak-rose-gradient text-white rounded-xl">
                    حفظ
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-xl font-extrabold truncate text-foreground">
                      {profile.name || "ضيفة رَونق"}
                    </h2>
                    <AccountBadgePill tier={profile.accountTier} size="sm" />
                    <button
                      onClick={() => setEditing(true)}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                      title="تعديل الاسم"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground truncate font-medium" dir="ltr">
                    {profile.email}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setAvatarPickerOpen((v) => !v)}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-lg"
                    >
                      <span>اختيار رمزية</span>
                      <ChevronDown className={cn("w-3 h-3 transition-transform", avatarPickerOpen && "rotate-180")} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Social Followers & Community Row */}
          <div className="grid grid-cols-3 gap-2 p-2 rounded-2xl bg-muted/40 border border-border/60">
            <button
              onClick={() => {
                setFollowersTab("followers");
                setFollowersModalOpen(true);
              }}
              className="text-center p-2 rounded-xl hover:bg-background/80 transition-all space-y-0.5"
            >
              <span className="font-extrabold text-sm text-foreground block">
                {profile.followersCount ?? 0}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">متابِعة</span>
            </button>

            <button
              onClick={() => {
                setFollowersTab("following");
                setFollowersModalOpen(true);
              }}
              className="text-center p-2 rounded-xl hover:bg-background/80 transition-all border-x border-border/60 space-y-0.5"
            >
              <span className="font-extrabold text-sm text-foreground block">
                {profile.followingCount ?? 0}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">تُتابعين</span>
            </button>

            <button
              onClick={() => setView("academy")}
              className="text-center p-2 rounded-xl hover:bg-background/80 transition-all space-y-0.5"
            >
              <span className="font-extrabold text-sm text-primary block flex items-center justify-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                {academyRank !== null ? `#${academyRank}` : "—"}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">الترتيب</span>
            </button>
          </div>

          {/* Avatar Emoji Selector */}
          <AnimatePresence>
            {avatarPickerOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden pt-2 border-t border-border/60"
              >
                <p className="text-xs text-muted-foreground mb-2">اختاري رمزيتكِ المفضلة:</p>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        updateProfile({ avatar: emoji });
                        setAvatarPickerOpen(false);
                        toast.success("تم تغيير الرمزية ✦");
                      }}
                      className={cn(
                        "w-10 h-10 rounded-2xl grid place-items-center text-lg bg-muted/60 hover:bg-primary/20 transition-all border border-border/50",
                        profile.avatar === emoji && "border-primary bg-primary/20 scale-105"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Social Links & Bio presentation */}
          <div className="pt-2 border-t border-border/60">
            {editingSocial ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-pink-500 shrink-0" />
                  <input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="اسم حسابكِ في انستغرام (مثال: @username)"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-border bg-background text-xs"
                    dir="ltr"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-sky-500 shrink-0" />
                  <input
                    value={tiktok}
                    onChange={(e) => setTiktok(e.target.value)}
                    placeholder="اسم حسابكِ في تيك توك"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-border bg-background text-xs"
                    dir="ltr"
                  />
                </div>
                <Button size="sm" onClick={saveSocial} className="rawnak-rose-gradient text-white w-full rounded-xl text-xs">
                  <Check className="w-3.5 h-3.5 ml-1" />
                  حفظ شبكاتكِ الاجتماعية
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {profile.socialInstagram ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 text-xs font-bold border border-pink-500/20">
                      <Instagram className="w-3.5 h-3.5" />
                      {profile.socialInstagram}
                    </span>
                  ) : null}
                  {profile.socialTiktok ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold border border-sky-500/20">
                      <AtSign className="w-3.5 h-3.5" />
                      {profile.socialTiktok}
                    </span>
                  ) : null}
                  {!profile.socialInstagram && !profile.socialTiktok && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Share2 className="w-3.5 h-3.5 text-primary" />
                      ربط حسابات انستغرام وتيك توك
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setEditingSocial(true)}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  {profile.socialInstagram || profile.socialTiktok ? "تعديل" : "إضافة"}
                </button>
              </div>
            )}
          </div>

          {/* Social Stats Dashboard */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            <StatCard icon={<Flame className="w-4 h-4 text-orange-500" />} value={streak} label="أيام متتالية" />
            <StatCard icon={<Sparkles className="w-4 h-4 text-primary" />} value={analyses.length} label="تحليل بشرة" />
            <StatCard icon={<Trophy className="w-4 h-4 text-amber-500" />} value={unlockedCount} label="إنجازات" />
            <StatCard icon={<Images className="w-4 h-4 text-sky-500" />} value={comparisons.length} label="مقارنات" />
          </div>
        </div>
      </Card>

      {/* Toggle for the extra detail block below (gamification, admin,
          achievements) — collapsed by default, see profileDetailsOpen. */}
      <button
        onClick={() => setProfileDetailsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          {profileDetailsOpen ? "إخفاء التفاصيل" : "عرض المستوى والإنجازات"}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", profileDetailsOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {profileDetailsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-5 overflow-hidden"
          >
      {/* Competitive Gamification Level & XP Progress Card */}
      <Card className="p-4 rounded-3xl border border-primary/30 bg-card space-y-3 shadow-2xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary text-xl grid place-items-center shrink-0">
              {levelInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Badge className="bg-primary text-primary-foreground text-[10px] font-black px-2 py-0 rounded-full">
                  المستوى {levelInfo.level}
                </Badge>
                <span className="font-extrabold text-xs text-foreground">{levelInfo.levelTitle}</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                {gamificationData.xp} / {levelInfo.nextXp} XP (نقاط الخبرة والتفاعل)
              </p>
            </div>
          </div>

          <Button
            onClick={() => setView("academy")}
            size="sm"
            variant="outline"
            className="rounded-xl text-xs font-black h-8 px-3 gap-1 border-primary/30 shrink-0"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            لوحة الشرف
          </Button>
        </div>

        <Progress
          value={Math.min(100, Math.round((gamificationData.xp / levelInfo.nextXp) * 100))}
          className="h-2 rounded-full"
        />
      </Card>

      {/* Admin Account Review Card (Visible for Admins) */}
      {isAdminUser && (
        <Card className="p-4 rounded-3xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent space-y-2 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white grid place-items-center shadow-xs shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-xs text-foreground truncate">لوحة مراجعة وشارات الحسابات (Admin)</h4>
                  <Badge className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0 rounded-full shrink-0">
                    إدمن
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  مراجعة الحسابات وتغيير الرتب (عادي، نشط، مميز، VIP، مؤثر/مشهور، نشاط تجاري)
                </p>
              </div>
            </div>

            <Button
              onClick={() => setAdminModalOpen(true)}
              size="sm"
              className="rounded-xl text-xs font-black h-8 px-3 bg-amber-500 hover:bg-amber-600 text-white gap-1 shadow-xs shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" />
              مراجعة الحسابات
            </Button>
          </div>
        </Card>
      )}

      {/* Unlocked Achievements Mini Showcase */}
      {unlockedAchievements.length > 0 && (
        <Card className="p-4 rounded-3xl border-primary/20 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="font-extrabold text-xs text-foreground">إنجازاتكِ الأخيرة</h3>
            </div>
            <button
              onClick={() => setView("achievements")}
              className="text-xs text-primary font-bold flex items-center gap-0.5 hover:underline"
            >
              عرض الكل ({achievements.length})
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {unlockedAchievements.slice(0, 4).map((ach) => (
              <div
                key={ach.id}
                onClick={() => setView("achievements")}
                className="shrink-0 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center flex items-center gap-2 cursor-pointer hover:bg-amber-500/20 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500 text-black grid place-items-center text-xs shrink-0 font-bold">
                  ★
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-foreground truncate max-w-[100px]">{ach.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{ach.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-Menu Navigation Tabs */}
      <div className="space-y-3">
        {/* Navigation Category Pill Selector */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border">
          <SubMenuTab
            active={openSection === "appearance"}
            onClick={() => toggleSection("appearance")}
            icon={<Palette className="w-3.5 h-3.5" />}
            label="المظهر"
          />
          <SubMenuTab
            active={openSection === "skin"}
            onClick={() => toggleSection("skin")}
            icon={<Heart className="w-3.5 h-3.5" />}
            label="بشرتي"
          />
          <SubMenuTab
            active={openSection === "explore"}
            onClick={() => toggleSection("explore")}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="الأدوات"
          />
          <SubMenuTab
            active={openSection === "account"}
            onClick={() => toggleSection("account")}
            icon={<Settings className="w-3.5 h-3.5" />}
            label="الحساب"
          />
        </div>

        {/* Section 1: Appearance & Theme Customization */}
        <AnimatePresence mode="wait">
          {openSection === "appearance" && (
            <motion.div
              key="appearance"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <Card className="p-4 rounded-3xl border-border bg-card space-y-4">
                <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <h3 className="font-extrabold text-sm text-foreground">تخصيص ثيم الألوان والوضع</h3>
                </div>

                {/* Theme Switcher Widget */}
                <ThemeSwitcher />

                <div className="h-px bg-border/60 my-2" />

                {/* Romantic vs Professional Personality Mode */}
                <TooltipProvider delayDuration={200}>
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/40 border border-border/50">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-2xl grid place-items-center shrink-0 shadow-2xs",
                        profile.personalityMode === "romantic" ? "rawnak-rosegold-gradient text-black" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Heart className="w-4 h-4" fill={profile.personalityMode === "romantic" ? "currentColor" : "none"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-xs">الوضع الرومانسي لشخصية رَونق</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground" aria-label="معلومات">
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-56 text-xs">
                            مفعّل: رفيقة دافئة تحتفي بجمالكِ. متوقف: خبيرة جمال مهنية ومباشرة.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {profile.personalityMode === "romantic" ? "أسلوب دافئ ومدعّم بالدلال" : "أسلوب علمي ومباشر"}
                      </p>
                    </div>
                    <Switch
                      checked={profile.personalityMode === "romantic"}
                      onCheckedChange={(checked) => {
                        updateProfile({ personalityMode: checked ? "romantic" : "professional" });
                        toast(checked ? "الوضع الرومانسي مفعّل ♡" : "الوضع المهني مفعّل");
                      }}
                    />
                  </div>
                </TooltipProvider>

                {/* Dialect Selector */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-muted grid place-items-center text-muted-foreground shrink-0">
                      <MessagesSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-xs">لهجة الدردشة واستجابات AI</p>
                      <p className="text-[11px] text-muted-foreground">اختاري اللهجة الأقرب لقلبكِ</p>
                    </div>
                  </div>
                  <Select
                    value={profile.dialect || "msa"}
                    onValueChange={(id) => {
                      updateProfile({ dialect: id as typeof profile.dialect });
                      const label = DIALECTS.find((d) => d.id === id)?.label || id;
                      toast(`تم اختيار لهجة ${label}`);
                    }}
                  >
                    <SelectTrigger className="h-8 w-28 text-xs font-bold rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIALECTS.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom AI companion name — VIP perk */}
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/40 border border-border/50">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-2xl grid place-items-center shrink-0",
                      hasVipAccess ? "rawnak-rosegold-gradient text-black" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {hasVipAccess ? <Sparkle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs">اسم خبيرة الجمال</p>
                    {hasVipAccess ? (
                      <Input
                        defaultValue={profile.companionName || ""}
                        placeholder="رَونق"
                        maxLength={20}
                        className="h-8 mt-1 text-xs rounded-xl bg-background"
                        onBlur={(e) => {
                          const trimmed = e.target.value.trim();
                          if (trimmed === (profile.companionName || "")) return;
                          updateProfile({ companionName: trimmed || null });
                          toast(trimmed ? `أصبح اسمها ${trimmed} ✦` : "أُعيد الاسم الافتراضي رَونق");
                        }}
                      />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        اختاري اسمًا خاصًا لخبيرة جمالكِ — ميزة VIP
                      </p>
                    )}
                  </div>
                  {!hasVipAccess && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-xl shrink-0" onClick={() => setView("vip")}>
                      VIP
                    </Button>
                  )}
                </div>

                {/* Country & Currency — auto-detected from device location,
                    same as chat dialect; no manual list shown to the user. */}
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/40 border border-border/50">
                  <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">الدولة والعملة</p>
                    <p className="text-[11px] text-muted-foreground">
                      {activeCurrencyConfig.flag} {activeCurrencyConfig.countryAr} · {activeCurrencyConfig.nameAr} ({activeCurrencyConfig.symbol}) — محدَّدة تلقائيًا حسب موقعكِ
                    </p>
                  </div>
                </div>

                {/* Notifications & Push */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-muted grid place-items-center text-muted-foreground shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-xs">التنبيهات والإشعارات</p>
                      <p className="text-[11px] text-muted-foreground">تذكير يومي بروتين الصباح والمساء</p>
                    </div>
                  </div>
                  {!Capacitor.isNativePlatform() ? (
                    <Switch checked={pushEnabled} disabled={pushBusy} onCheckedChange={handleTogglePush} />
                  ) : (
                    <Switch
                      checked={profile.remindersEnabled}
                      onCheckedChange={(v) => {
                        updateProfile({ remindersEnabled: v });
                        toast(v ? "تم تفعيل التذكير ✦" : "تم إيقاف التذكير");
                      }}
                    />
                  )}
                </div>

                {/* Discoverability in the "استكشاف" search directory */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-muted grid place-items-center text-muted-foreground shrink-0">
                      {profile.socialDiscoverable === false ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs">الظهور في البحث</p>
                      <p className="text-[11px] text-muted-foreground">
                        السماح للعضوات الأخريات بإيجادكِ عند البحث بالاسم
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={profile.socialDiscoverable !== false}
                    onCheckedChange={handleToggleDiscoverable}
                  />
                </div>
              </Card>
            </motion.div>
          )}

          {/* Section 2: Skin Profile & Preferences */}
          {openSection === "skin" && (
            <motion.div
              key="skin"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <Card className="p-5 rounded-3xl border-border bg-card space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-primary" />
                    <h3 className="font-extrabold text-sm text-foreground">بيانات ملف بشرتكِ</h3>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Row label="نوع البشرة المحدد" value={skinTypeLabel} />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-muted-foreground font-medium">العمر المحدد:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {profile.age ? `${profile.age} سنة` : "غير محدد"}
                      </span>
                      <button
                        onClick={() => setShowAgeEdit((v) => !v)}
                        className="text-[11px] text-primary font-bold hover:underline flex items-center gap-0.5 bg-primary/10 px-2 py-0.5 rounded-md"
                      >
                        <Pencil className="w-3 h-3" />
                        {showAgeEdit ? "إغلاق" : "تعديل"}
                      </button>
                    </div>
                  </div>

                  {showAgeEdit && (
                    <div className="p-3 bg-muted/40 rounded-2xl border border-border mt-2">
                      <AgeSelector
                        value={profile.age}
                        onChange={(newAge) => {
                          updateProfile({ age: newAge });
                        }}
                      />
                    </div>
                  )}

                  {profile.makeupLevel && (
                    <Row
                      label="مستوى الخبرة بالماكياج"
                      value={
                        profile.makeupLevel === "beginner"
                          ? "مبتدئة"
                          : profile.makeupLevel === "intermediate"
                          ? "متوسطة"
                          : "متقدمة"
                      }
                    />
                  )}
                </div>

                {/* Concerns Sub-block */}
                <div className="pt-3 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-foreground">مشاكل البشرة المستهدفة</p>
                    <button
                      onClick={() => setShowConcernsEdit((v) => !v)}
                      className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      {showConcernsEdit ? "إغلاق" : "تعديل المشاكل"}
                    </button>
                  </div>

                  {!showConcernsEdit ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {profile.concerns && profile.concerns.length > 0 ? (
                        profile.concerns.map((c) => (
                          <Badge key={c} variant="secondary" className="rounded-full text-[11px] px-3 py-1">
                            {CONCERN_LABEL[c] || c}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic">لم تحددي أي مشاكل بعد</p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 p-3 rounded-2xl bg-muted/30 border border-border">
                      <SkinConcernsGrid
                        selectedConcerns={profile.concerns || []}
                        onToggleConcern={(id) => {
                          const cur = profile.concerns || [];
                          const updated = cur.includes(id as never)
                            ? cur.filter((c) => c !== id)
                            : [...cur, id as never];
                          updateProfile({ concerns: updated });
                        }}
                        onSetConcerns={(concerns) => {
                          updateProfile({ concerns: concerns as never[] });
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Goals */}
                {profile.goals && profile.goals.length > 0 && (
                  <div className="pt-3 border-t border-border/60 space-y-1.5">
                    <p className="text-xs font-extrabold text-foreground">أهداف العناية</p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.goals.map((g) => (
                        <Badge key={g} variant="outline" className="rounded-full text-[11px]">
                          {GOAL_LABEL[g] || g}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* Section 3: Explore Features Grid */}
          {openSection === "explore" && (
            <motion.div
              key="explore"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <ExploreCard
                  icon={<GraduationCap className="w-5 h-5 text-purple-500" />}
                  title="أكاديمية الجمال"
                  desc="دروس ومقالات عناية"
                  onClick={() => setView("academy")}
                />
                <ExploreCard
                  icon={<Star className="w-5 h-5 text-amber-500" />}
                  title="اختيارات رَونق"
                  desc="منتجات منتقاة موثوقة"
                  onClick={() => setView("picks")}
                />
                <ExploreCard
                  icon={<BookOpen className="w-5 h-5 text-emerald-500" />}
                  title="قاموس المكونات"
                  desc="تحليل المواد الفعالة"
                  onClick={() => setView("library")}
                />
                <ExploreCard
                  icon={<CalendarHeart className="w-5 h-5 text-pink-500" />}
                  title="مخطط المناسبات"
                  desc="خطط جمال وإطلالات"
                  onClick={() => setView("planner")}
                />
                <ExploreCard
                  icon={<History className="w-5 h-5 text-sky-500" />}
                  title="رحلة بشرتي"
                  desc="أرشيف وسجل التطور"
                  onClick={() => setView("timeline")}
                />
                <ExploreCard
                  icon={<ShoppingBag className="w-5 h-5 text-rose-500" />}
                  title="توصيات المنتجات"
                  desc="ترشيحات مخصصة لنوع بشرتكِ"
                  onClick={() => setView("products")}
                />
                <ExploreCard
                  icon={<Trophy className="w-5 h-5 text-amber-600" />}
                  title="سجل الإنجازات"
                  desc={`${unlockedCount} شارة مكتملة`}
                  onClick={() => setView("achievements")}
                />
                <ExploreCard
                  icon={<Images className="w-5 h-5 text-indigo-500" />}
                  title="مقارنات قبل وبعد"
                  desc={`${comparisons.length} مقارنة محفوظة`}
                  onClick={() => setView("compare")}
                />
              </div>
            </motion.div>
          )}

          {/* Section 4: Account & Subscriptions */}
          {openSection === "account" && (
            <motion.div
              key="account"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              {/* VIP Subscription CTA */}
              <button onClick={() => setView("vip")} className="w-full text-right">
                <Card className="p-4 rounded-3xl border-primary/30 rawnak-rosegold-gradient flex items-center gap-3 shadow-2xs">
                  <div className="w-10 h-10 rounded-2xl bg-black/15 grid place-items-center shrink-0">
                    <Crown className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1">
                    <p className="font-extrabold text-black text-sm">
                      {hasVipAccess ? "عضوية VIP فعّالة ✦" : "الترقية إلى رَونق VIP"}
                    </p>
                    <p className="text-xs text-black/80 font-medium">
                      {vipTrialDaysLeft > 0
                        ? `تجربة VIP من الدعوات — متبقٍ ${vipTrialDaysLeft} ${vipTrialDaysLeft === 1 ? "يوم" : "أيام"}`
                        : hasVipAccess
                          ? "إدارة الاشتراك وتفاصيل المزايا"
                          : "تجربة خبيرة ذكية بلا حدود"}
                    </p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-black/70" />
                </Card>
              </button>

              {/* Referrals CTA */}
              <button onClick={() => setView("invite")} className="w-full text-right">
                <Card className="p-4 rounded-3xl border-border bg-card flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl rawnak-rose-gradient grid place-items-center shrink-0 text-white shadow-2xs">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-extrabold text-sm text-foreground">دعوة الصديقات ✦</p>
                    <p className="text-xs text-muted-foreground">
                      {profile.referralInvitesCount > 0
                        ? `${profile.referralInvitesCount} دعوة ناجحة حتى الآن`
                        : "شاركي رمزكِ الخاص واكسبي شارات وتجارب حصرية"}
                    </p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </Card>
              </button>

              {/* Share Feedback CTA */}
              <button onClick={() => setFeedbackOpen(true)} className="w-full text-right">
                <Card className="p-4 rounded-3xl border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center shrink-0 shadow-2xs">
                    <MessageSquarePlus className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-extrabold text-sm text-foreground">مشاركة الملاحظات والآراء ✦</p>
                    <p className="text-xs text-muted-foreground">
                      أرسلي اقتراحاتكِ أو إبلاغاً مباشرة إلى فريق رَونق
                    </p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </Card>
              </button>

              {/* Customer service — chats with whichever admin a super_admin
                  assigned to this account (see assignedAdminId), or a
                  general "فريق رَونق" placeholder before anyone is assigned. */}
              <button onClick={() => { setSupportUnread(false); setView("support"); }} className="w-full text-right">
                <Card className="p-3.5 rounded-2xl border-border bg-card flex items-center gap-3 text-xs font-bold text-foreground">
                  <div className="relative shrink-0">
                    <Headset className="w-4 h-4 text-primary" />
                    {supportUnread && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="flex-1">الدعم وخدمة العملاء</span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </Card>
              </button>

              <button onClick={() => setView("about")} className="w-full text-right">
                <Card className="p-3.5 rounded-2xl border-border bg-card flex items-center gap-3 text-xs font-bold text-foreground">
                  <Info className="w-4 h-4 text-primary" />
                  <span className="flex-1">عن رَونق والخصوصية والشروط</span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </Card>
              </button>

              {/* Blocked users management — required alongside the block
                  feature itself so blocks are reachable and reversible. */}
              <button
                onClick={() => setBlockedUsersOpen(true)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-muted/50 border border-border hover:bg-accent/50 transition-colors text-foreground font-bold text-xs"
              >
                <Ban className="w-4 h-4" />
                <span className="flex-1 text-right">المستخدمات المحظورات</span>
              </button>

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  toast("تم تسجيل الخروج بنجاح");
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors text-rose-600 dark:text-rose-400 font-bold text-xs"
              >
                <LogOut className="w-4 h-4" />
                <span className="flex-1 text-right">تسجيل الخروج من الحساب</span>
              </button>

              {/* Delete account — required by Apple App Store Guideline
                  5.1.1(v) and Google Play's account-deletion policy. Must
                  actually delete the account, not just sign out. */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={deletingAccount}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-red-600/10 border border-red-600/30 hover:bg-red-600/20 transition-colors text-red-700 dark:text-red-400 font-bold text-xs disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="flex-1 text-right">حذف الحساب نهائياً</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف الحساب نهائياً؟</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم حذف حسابكِ وجميع بياناتكِ بشكل نهائي ولا يمكن التراجع عن
                      هذا الإجراء — يشمل ذلك تحليلات بشرتكِ وصورها، روتينكِ، سلاسل
                      إنجازاتكِ، وأي محتوى اجتماعي (متابعون، رفيقة توهج). هل ترغبين
                      بالمتابعة؟
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingAccount}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deletingAccount}
                      onClick={async (e) => {
                        e.preventDefault();
                        setDeletingAccount(true);
                        try {
                          const result = await deleteAccount();
                          if (!result.ok) {
                            toast(result.error || "تعذّر حذف الحساب، يرجى المحاولة لاحقاً");
                            setDeletingAccount(false);
                            return;
                          }
                          // `pending: true` means Apple re-auth redirected the
                          // whole webview (Capacitor) — the app is about to
                          // reload and completeOAuthRedirect() will finish the
                          // deletion, so there's nothing more to do here.
                          if (!result.pending) {
                            toast("تم حذف حسابكِ بنجاح");
                          }
                        } catch (err) {
                          toast("تعذّر حذف الحساب، يرجى المحاولة لاحقاً");
                          setDeletingAccount(false);
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      نعم، احذفي حسابي
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <BlockedUsersModal isOpen={blockedUsersOpen} onClose={() => setBlockedUsersOpen(false)} />
      <FollowersModal
        isOpen={followersModalOpen}
        onClose={() => setFollowersModalOpen(false)}
        initialTab={followersTab}
      />
      <AdminTierModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />
      <AppFooter />
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="text-center p-2.5 rounded-2xl bg-muted/50 border border-border/50">
      <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
      <p className="text-base font-black text-foreground leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground font-semibold mt-1">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="font-extrabold text-foreground">{value}</span>
    </div>
  );
}

function SubMenuTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all",
        active
          ? "rawnak-rosegold-gradient text-black shadow-2xs scale-[1.02]"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ExploreCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="p-3.5 rounded-2xl border-border bg-card hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between space-y-2 group"
    >
      <div className="w-9 h-9 rounded-xl bg-muted/80 grid place-items-center group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div>
        <p className="font-extrabold text-xs text-foreground group-hover:text-primary transition-colors">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">{desc}</p>
      </div>
    </Card>
  );
}
