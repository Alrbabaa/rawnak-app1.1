"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, UserPlus, UserCheck, Users, Lock, MoreVertical, Flag, Ban } from "lucide-react";
import { toast } from "sonner";
import { MotionModal } from "@/components/ui/motion-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccountBadgePill } from "@/components/rawnak/account-badge-pill";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { useAppStore } from "@/lib/store";
import { triggerSelectionHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import type { AccountTier } from "@/lib/account-tiers";

const REPORT_REASONS: { id: string; label: string }[] = [
  { id: "harassment", label: "مضايقة أو تحرش" },
  { id: "impersonation", label: "انتحال شخصية" },
  { id: "inappropriate_content", label: "محتوى غير لائق" },
  { id: "spam", label: "إزعاج / سبام" },
  { id: "other", label: "سبب آخر" },
];

interface PublicProfileData {
  id: string;
  name: string;
  avatar: string;
  accountTier: AccountTier;
  verified: boolean;
  bio: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSelf: boolean;
  // null when the viewer doesn't follow this person — the server omits
  // the value entirely in that case (see /api/social/profile/[uid]),
  // this isn't just a client-side hide.
  streak: number | null;
  // Only present when a block exists in either direction — the server
  // sends nothing else in the response in that case (no name/avatar/bio),
  // see the early-return branch in /api/social/profile/[uid].
  blocked?: boolean;
  blockedByMe?: boolean;
}

interface PublicProfileModalProps {
  userId: string | null;
  onClose: () => void;
  onFollowChange?: (userId: string, isFollowing: boolean) => void;
  // Fired after a successful block, so the parent list (followers/search
  // results) can drop this person immediately instead of waiting for a
  // refetch.
  onBlock?: (userId: string) => void;
}

export function PublicProfileModal({ userId, onClose, onFollowChange, onBlock }: PublicProfileModalProps) {
  const updateProfile = useAppStore((s) => s.updateProfile);
  const myFollowingCount = useAppStore((s) => s.profile.followingCount ?? 0);

  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>("harassment");
  const [reportNote, setReportNote] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void Promise.resolve().then(() => {
      setLoading(true);
      setData(null);
      authedFetch(`/api/social/profile/${userId}`)
        .then((r) => r.json())
        .then((json) => {
          if (json?.id) setData(json);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [userId]);

  const handleToggleFollow = async () => {
    if (!data || busy) return;
    setBusy(true);
    triggerSelectionHaptic();
    const wasFollowing = data.isFollowing;
    try {
      const res = await authedFetch(wasFollowing ? "/api/social/unfollow" : "/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid: data.id }),
      });
      if (!res.ok) throw new Error();

      setData((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: !wasFollowing,
              followersCount: Math.max(0, prev.followersCount + (wasFollowing ? -1 : 1)),
              // Streak only becomes visible once we actually follow — re-fetch
              // to let the server decide, rather than guessing it client-side.
              streak: wasFollowing ? null : prev.streak,
            }
          : prev
      );
      updateProfile({ followingCount: Math.max(0, myFollowingCount + (wasFollowing ? -1 : 1)) });
      onFollowChange?.(data.id, !wasFollowing);

      if (!wasFollowing) {
        triggerSuccessHaptic();
        toast.success(`بدأتِ بمتابعة ${data.name} ✦`);
        // Re-fetch to get the real streak now that we follow her.
        authedFetch(`/api/social/profile/${data.id}`)
          .then((r) => r.json())
          .then((json) => json?.id && setData(json))
          .catch(() => {});
      } else {
        toast("تم إلغاء المتابعة");
      }
    } catch {
      toast.error("حدث خطأ، حاولي مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  const handleBlock = async () => {
    if (!data || busy) return;
    setBusy(true);
    try {
      const res = await authedFetch("/api/social/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid: data.id }),
      });
      if (!res.ok) throw new Error();
      toast.success(`تم حظر ${data.name}`);
      onBlock?.(data.id);
      setBlockConfirmOpen(false);
      onClose();
    } catch {
      toast.error("تعذّر الحظر، حاولي مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!data || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      const res = await authedFetch("/api/social/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid: data.id, reason: reportReason, note: reportNote }),
      });
      if (!res.ok) throw new Error();
      toast.success("تم إرسال بلاغكِ، شكراً لكِ");
      setReportOpen(false);
      setReportNote("");
    } catch {
      toast.error("تعذّر إرسال البلاغ، حاولي مرة أخرى");
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <MotionModal isOpen={!!userId} onClose={onClose} title="الملف الشخصي">
      {loading || !data ? (
        <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p>جاري التحميل...</p>
        </div>
      ) : data.blocked ? (
        <div className="p-8 text-center text-xs text-muted-foreground space-y-3">
          <Ban className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="font-bold text-foreground">
            {data.blockedByMe ? "لقد حظرتِ هذا الحساب" : "لا يمكن عرض هذا الملف الشخصي"}
          </p>
          {data.blockedByMe && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={async () => {
                setBusy(true);
                try {
                  await authedFetch("/api/social/unblock", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ targetUid: data.id }),
                  });
                  toast.success("تم إلغاء الحظر");
                  onClose();
                } catch {
                  toast.error("تعذّر إلغاء الحظر");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              إلغاء الحظر
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5 pt-1 text-center">
          {/* Report / block menu — required by App Store Review Guideline
              1.2 for any app with user-to-user interaction. Hidden on
              your own profile. */}
          {!data.isSelf && (
            <div className="flex justify-start -mb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 grid place-items-center rounded-full hover:bg-accent/60 text-muted-foreground">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setReportOpen(true)}>
                    <Flag className="w-3.5 h-3.5 ml-2" />
                    الإبلاغ عن هذا الحساب
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setBlockConfirmOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Ban className="w-3.5 h-3.5 ml-2" />
                    حظر هذا الحساب
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Avatar with the Streak Story ring — only rendered at all when
              the server included a streak value, i.e. only for people this
              viewer actually follows. */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {data.streak !== null && data.streak > 0 && (
                <div className="absolute -inset-1.5 rounded-[28px] bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500 animate-pulse" />
              )}
              <div className="relative w-20 h-20 rounded-3xl bg-muted grid place-items-center text-4xl border-2 border-background shadow-lg">
                {data.avatar}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <h3 className="font-black text-base text-foreground">{data.name}</h3>
              <AccountBadgePill tier={data.accountTier} size="sm" />
            </div>

            {data.bio && <p className="text-xs text-muted-foreground max-w-[260px]">{data.bio}</p>}
          </div>

          {/* Streak Story — the actual feature: visible only to followers */}
          <AnimatePresence mode="wait">
            {data.isSelf ? null : data.streak !== null ? (
              <motion.div
                key="streak-visible"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-[280px] rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-rose-500/10 p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-orange-500/15 grid place-items-center shrink-0">
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-right flex-1">
                  <p className="text-lg font-black text-foreground leading-none">
                    {data.streak} {data.streak === 1 ? "يوم" : "أيام"} متتالية 🔥
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    سلسلة الالتزام بالروتين — تظهر لكِ لأنكِ من متابِعاتها
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="streak-locked"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-[280px] rounded-2xl border border-dashed border-border bg-muted/30 p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-muted grid place-items-center shrink-0">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-[11px] text-muted-foreground text-right flex-1">
                  تابعيها لترَي سلسلة التزامها اليومي 🔥
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-center gap-6 text-xs">
            <div>
              <p className="font-black text-foreground text-sm">{data.followersCount}</p>
              <p className="text-muted-foreground text-[10px]">متابِعات</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <p className="font-black text-foreground text-sm">{data.followingCount}</p>
              <p className="text-muted-foreground text-[10px]">تُتابع</p>
            </div>
          </div>

          {!data.isSelf && (
            <Button
              onClick={handleToggleFollow}
              disabled={busy}
              className={
                data.isFollowing
                  ? "w-full rounded-2xl h-11 font-extrabold text-xs border border-border bg-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                  : "w-full rounded-2xl h-11 font-extrabold text-xs rawnak-gradient-btn"
              }
              variant={data.isFollowing ? "outline" : "default"}
            >
              {data.isFollowing ? (
                <>
                  <UserCheck className="w-4 h-4" /> تُتابعينها
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> متابعة
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Block confirmation */}
      <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حظر {data?.name}؟</AlertDialogTitle>
            <AlertDialogDescription>
              لن تتمكن من رؤية ملفكِ الشخصي أو متابعتكِ بعد الحظر، وسيتم إلغاء
              أي متابعة متبادلة بينكما تلقائياً. يمكنكِ إلغاء الحظر لاحقاً من
              إعدادات حسابكِ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBlock();
              }}
              disabled={busy}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              نعم، احظري
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report form */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>الإبلاغ عن {data?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={reportReason} onValueChange={setReportReason} className="gap-2.5">
              {REPORT_REASONS.map((r) => (
                <div key={r.id} className="flex items-center gap-2 justify-end">
                  <Label htmlFor={`report-${r.id}`} className="text-xs font-medium cursor-pointer">
                    {r.label}
                  </Label>
                  <RadioGroupItem value={r.id} id={`report-${r.id}`} />
                </div>
              ))}
            </RadioGroup>
            <Textarea
              placeholder="تفاصيل إضافية (اختياري)"
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              className="text-xs resize-none"
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)} disabled={reportSubmitting} className="text-xs">
              إلغاء
            </Button>
            <Button onClick={handleSubmitReport} disabled={reportSubmitting} className="text-xs">
              {reportSubmitting ? "جارِ الإرسال..." : "إرسال البلاغ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MotionModal>
  );
}
