"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Gift, Share2, Copy, Loader2, Check } from "lucide-react";
import { REFERRAL_REWARD_THRESHOLD, VIP_TRIAL_DAYS_PER_REWARD, referralShareLink } from "@/lib/referral";
import { generateInviteCard } from "@/lib/share/invite-card";
import { shareImage } from "@/lib/share/share-image";
import { trackEvent } from "@/lib/track-event";
import { useVipTrialDaysRemaining } from "@/hooks/use-vip-access";
import { BuddyCard } from "@/components/rawnak/buddy-card";

export function InviteScreen() {
  const setView = useAppStore((s) => s.setView);
  const goBack = useAppStore((s) => s.goBack);
  const profile = useAppStore((s) => s.profile);
  const vipTrialDaysLeft = useVipTrialDaysRemaining();
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = profile.referralCode;
  const invites = profile.referralInvitesCount;
  const rewardUnlocked = !!profile.referralRewardUnlockedAt;
  // Progress toward the NEXT reward cycle, not toward a single one-time
  // goal — every REFERRAL_REWARD_THRESHOLD invites repeats, so this wraps
  // (e.g. invite #4 shows 1/3 toward the second week, not "done").
  const invitesInCurrentCycle = invites % REFERRAL_REWARD_THRESHOLD;
  const justCompletedCycle = invites > 0 && invitesInCurrentCycle === 0;
  const remaining = justCompletedCycle ? 0 : REFERRAL_REWARD_THRESHOLD - invitesInCurrentCycle;
  const progressPct = justCompletedCycle ? 100 : (invitesInCurrentCycle / REFERRAL_REWARD_THRESHOLD) * 100;
  const rewardCyclesCompleted = Math.floor(invites / REFERRAL_REWARD_THRESHOLD);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(referralShareLink(code));
      setCopied(true);
      toast.success("تم نسخ رابط الدعوة ✦");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذّر النسخ، جرّبي مرة أخرى");
    }
  };

  const handleShare = async () => {
    if (!code) return;
    setSharing(true);
    try {
      const blob = await generateInviteCard(code, profile.name || undefined);
      const result = await shareImage({
        blob,
        filename: `rawnak-invite-${code}.png`,
        title: "جرّبي رَونق معي ✦",
        text: `جرّبي رَونق — خبيرتكِ الشخصية بالذكاء الاصطناعي للجمال والعناية بالبشرة ✦ سجّلي بكودي "${code}" ${referralShareLink(code)}`,
      });
      if (result.fallback === "downloaded") {
        toast.success("تم حفظ بطاقة الدعوة — شاركيها من معرض الصور ✦");
        trackEvent("invite_shared", { method: "downloaded" });
      } else if (result.fallback !== "cancelled" && result.ok) {
        toast.success("تم فتح المشاركة ✦");
        trackEvent("invite_shared", { method: "share_sheet" });
      }
    } catch {
      toast.error("تعذّرت مشاركة الدعوة، حاولي مرة أخرى");
    } finally {
      setSharing(false);
    }
  };

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
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" }}
          className="inline-flex w-16 h-16 rounded-2xl rawnak-rosegold-gradient items-center justify-center mb-3"
        >
          <Gift className="w-8 h-8 text-black" />
        </motion.div>
        <h1 className="text-2xl font-extrabold">ادعي صديقاتكِ ✦</h1>
        <p className="text-sm text-muted-foreground mt-1">
          كل صديقة تنضم بكودكِ تقرّبكِ من مكافأة "دائرة التوهج"
        </p>
      </div>

      {/* Code panel */}
      <Card className="p-6 rounded-3xl rawnak-gradient text-center rawnak-shadow relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
        <div className="relative z-10">
          <p className="text-sm text-foreground/70 mb-2">كود دعوتكِ</p>
          {code ? (
            <p className="text-4xl font-extrabold tracking-widest text-foreground" dir="ltr">
              {code}
            </p>
          ) : (
            <div className="flex justify-center py-2">
              <Loader2 className="w-6 h-6 animate-spin text-foreground/60" />
            </div>
          )}
          <div className="flex gap-2 mt-5">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl h-11 bg-white/10 border-white/25 hover:bg-white/20"
              onClick={handleCopy}
              disabled={!code}
            >
              {copied ? <Check className="w-4 h-4 ml-1.5" /> : <Copy className="w-4 h-4 ml-1.5" />}
              نسخ الرابط
            </Button>
            <Button
              className="flex-1 rounded-2xl h-11 bg-black/85 text-white hover:bg-black/70"
              onClick={handleShare}
              disabled={!code || sharing}
            >
              {sharing ? (
                <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4 ml-1.5" />
              )}
              شاركي
            </Button>
          </div>
        </div>
      </Card>

      {/* Progress */}
      <Card className="p-5 rounded-3xl border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm">دائرة التوهج ✦</h3>
          <span className="text-xs text-muted-foreground">
            {invitesInCurrentCycle} / {REFERRAL_REWARD_THRESHOLD}
          </span>
        </div>
        <Progress value={progressPct} className="h-2.5" />
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          {remaining === 0
            ? `أوشكتِ على فتح الأسبوع رقم ${rewardCyclesCompleted + 1} من VIP — تحديث البيانات جارٍ`
            : `ادعي ${remaining} ${remaining === 1 ? "صديقة" : "صديقات"} أخرى لتحصلي على أسبوع VIP مجاني (كل ${REFERRAL_REWARD_THRESHOLD} دعوات = ${VIP_TRIAL_DAYS_PER_REWARD} أيام VIP، قابلة للتراكم)`}
        </p>
        {vipTrialDaysLeft > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs font-semibold text-foreground">
              تجربة VIP نشطة الآن — متبقٍ {vipTrialDaysLeft} {vipTrialDaysLeft === 1 ? "يوم" : "أيام"}
            </p>
          </div>
        )}
        {rewardUnlocked && (
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            مبروك! فتحتِ إنجاز دائرة التوهج ✦ شكرًا لنشركِ رَونق
          </p>
        )}
      </Card>

      <p className="text-xs text-center text-muted-foreground px-4 leading-relaxed">
        عندما تسجّل صديقتكِ حسابًا جديدًا بكودكِ، تُحسب الدعوة تلقائيًا — بدون أي خطوة إضافية منكِ
      </p>

      <BuddyCard />
    </div>
  );
}
