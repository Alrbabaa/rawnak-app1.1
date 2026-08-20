"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Star,
  Send,
  Loader2,
  Lightbulb,
  Bug,
  Heart,
  MessageCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { id: "suggestion", label: "اقتراح تحسين", icon: Lightbulb, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  { id: "bug", label: "إبلاغ عن مشكلة", icon: Bug, color: "text-rose-500 bg-rose-500/10 border-rose-500/30" },
  { id: "compliment", label: "إعجاب وتشجيع", icon: Heart, color: "text-pink-500 bg-pink-500/10 border-pink-500/30" },
  { id: "general", label: "رأي عام", icon: MessageCircle, color: "text-sky-500 bg-sky-500/10 border-sky-500/30" },
];

const RATING_LABELS: Record<number, string> = {
  1: "يحتاج إلى تحسين كبير",
  2: "مقبول، بانتظار المزيد",
  3: "تجربة جيدة",
  4: "رائع ومفيد جدًا",
  5: "ممتاز ومبهر! ✦",
};

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { profile } = useAppStore();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("suggestion");
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [email, setEmail] = useState<string>(profile.socialInstagram ? "" : "");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const activeRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || feedbackText.trim().length < 2) {
      toast.error("يرجى كتابة ملاحظاتكِ بشكل واضح قبل الإرسال");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authedFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          category,
          feedback: feedbackText,
          email: email.trim() || undefined,
          userName: profile.name || "زائرة رَونق",
          skinType: profile.skinType || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "حدث خطأ أثناء إرسال الملاحظات");
      }

      setSubmitted(true);
      toast.success(data.message || "تم إرسال ملاحظاتكِ بنجاح! شكرًا لكِ ✦");
      setTimeout(() => {
        handleResetAndClose();
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || "عذرًا، تعذر إرسال الملاحظات. حاول مجددًا.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setFeedbackText("");
    setRating(5);
    setCategory("suggestion");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleResetAndClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl overflow-hidden"
            dir="rtl"
          >
            {/* Close Button */}
            <button
              onClick={handleResetAndClose}
              className="absolute top-4 left-4 p-2 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>

            {submitted ? (
              /* Success View */
              <div className="py-8 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 grid place-items-center mx-auto"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </motion.div>
                <div className="space-y-1">
                  <h3 className="font-black text-xl text-foreground">وصلت ملاحظاتكِ بنجاح! ✦</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    شكراً لكِ يا جميلة على مساهمتكِ القيمة. نقرأ كل كلمة بعناية لنبني لكِ تجربة استثنائية دائماً.
                  </p>
                </div>
              </div>
            ) : (
              /* Form View */
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Header */}
                <div className="space-y-1 pr-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>صوتكِ يبني رَونق</span>
                  </div>
                  <h2 className="font-black text-xl text-foreground">مشاركة الملاحظات والآراء</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    يسعدنا سماع انطباعاتكِ واقترحاتكِ لتطوير المزايا والتطبيق دائماً.
                  </p>
                </div>

                {/* Rating Stars */}
                <div className="space-y-2 bg-muted/30 p-3.5 rounded-2xl border border-border/50 text-center">
                  <p className="text-xs font-extrabold text-foreground">كيف تقيّمين تجربتكِ مع رَونق؟</p>
                  <div className="flex items-center justify-center gap-1.5 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 transition-transform active:scale-125 focus:outline-none"
                      >
                        <Star
                          className={cn(
                            "w-7 h-7 transition-colors",
                            star <= activeRating
                              ? "fill-amber-400 text-amber-400 drop-shadow-2xs"
                              : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold text-amber-500 h-4">
                    {RATING_LABELS[activeRating] || ""}
                  </p>
                </div>

                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-foreground block">
                    نوع الملاحظة
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all text-right",
                            isSelected
                              ? `${cat.color} shadow-2xs font-extrabold`
                              : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          )}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-foreground block">
                      تفاصيل ملاحظتكِ أو اقتراحكِ <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      {feedbackText.length}/500
                    </span>
                  </div>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
                    placeholder="اكتبي لنا ملحوظتكِ، الفكرة التي تحبين إضافتها، أو أي مشكلة واجهتكِ..."
                    required
                    rows={4}
                    className="w-full text-xs p-3.5 rounded-2xl bg-muted/30 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/60 resize-none transition-all"
                  />
                </div>

                {/* Optional Email */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground block">
                    البريد الإلكتروني للرد (اختياري)
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="مثال: name@domain.com"
                    className="h-10 text-xs rounded-xl bg-muted/20"
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={submitting || !feedbackText.trim()}
                    className="flex-1 rounded-2xl rawnak-rose-gradient text-white font-extrabold text-xs h-11 gap-2 shadow-sm interactive-btn"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الإرسال إلى الفايرستور...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 rotate-180" />
                        <span>إرسال الملاحظات ✦</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
