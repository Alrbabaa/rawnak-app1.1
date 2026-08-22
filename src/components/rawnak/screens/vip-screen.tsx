"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSubscription } from "@/hooks/use-subscription";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  ChevronLeft,
  Check,
  Loader2,
  Smartphone,
  Sparkles,
  Camera,
  MessageCircleHeart,
  GraduationCap,
  CalendarHeart,
  ShieldCheck,
  TrendingUp,
  Sparkle,
  Zap,
  Lock,
  Star,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { trackEvent } from "@/lib/track-event";
import { cn } from "@/lib/utils";

const BENEFITS = [
  {
    icon: Camera,
    title: "تحليلات بشرة غير محدودة & تنبؤ التطور",
    desc: "افتحي تفاصيل أعمق لكل تحليل: خريطة تطور البشرة لـ 90 يومًا ومقارنات دقيقة عبر الوقت.",
    previewTag: "تنبؤ 90 يومًا",
  },
  {
    icon: MessageCircleHeart,
    title: "خبيرة الجمال الذكية معكِ ليل نهار",
    desc: "أسئلة بلا حدود وردود تفصيلية فورية، بدون أي تقييد أو انتظار.",
    previewTag: "استشارات بلا حدود",
  },
  {
    icon: CalendarHeart,
    title: "تنسيق الروتين & مخطط المناسبات الذكي",
    desc: "ترتيب علمي لطبقات المنتجات مع تنبيه التفاعلات، بالإضافة لإطلالات المناسبات المخصصة.",
    previewTag: "تنسيق ذكي",
  },
  {
    icon: GraduationCap,
    title: "محتوى الأكاديمية والدروس الحصرية",
    desc: "ماستر كلاس متقدم في العناية بالبشرة والمكياج لا يظهر في النسخة المجانية.",
    previewTag: "دروس حصريّة",
  },
  {
    icon: ShieldCheck,
    title: "تجربة راقية بلا إعلانات",
    desc: "أداء فائق السرعة وواجهة صافية تليق بروتينكِ اليومي.",
    previewTag: "تجربة فائقة",
  },
] as const;

const VIP_PREVIEWS = [
  {
    id: "forecast",
    label: "تنبؤ التطور 🔮",
    title: "خريطة تطور بشرتكِ لـ 90 يومًا القادمة",
    desc: "خوارزمية ذكية تتنبأ بمستوى النضارة، التناغم، والترطيب بناءً على التزامكِ اليومي بالروتين.",
    badge: "VIP Exclusive",
    statLabel: "نسبة التحسن المتوقعة",
    statVal: "+38% نضارة",
  },
  {
    id: "consultant",
    label: "الخبيرة العميقة 💬",
    title: "استشارات كيميائية ومكونات دقيقة",
    desc: "تحليل توافق المواد الفعالة (Niacinamide, Retinol, Vitamin C) وإرشادات شخصية للوقاية من التهيج.",
    badge: "Unlimited AI",
    statLabel: "سرعة الاستجابة",
    statVal: "فورية 24/7",
  },
  {
    id: "sequencing",
    label: "ترتيب الروتين 🧪",
    title: "ترتيب المنتجات الدقيق (Layering)",
    desc: "تحديد أي منتج يوضع أولاً بالدقيقة ومقادير التطبيق المثالية لحدا أقصى من الامتصاص.",
    badge: "Smart Order",
    statLabel: "امتصاص المكونات",
    statVal: "أعلى بنسبة 45%",
  },
] as const;

const COMPARISON = [
  { feature: "تحليل البشرة بالكاميرا", free: "أساسي (مرتين/أسبوع)", vip: "غير محدود + تنبؤ 90 يومًا" },
  { feature: "الدردشة مع خبيرة الجمال", free: "محدودة", vip: "استشارات بلا حدود 24/7" },
  { feature: "روتين اليوم والتتبع", free: "متاح بالكامل", vip: "متاح + ترتيب ذكي للطبقات" },
  { feature: "خزانة المكياج والمنتجات", free: "متاحة بالكامل", vip: "متاحة + تنبيه انتهاء الصلاحية" },
  { feature: "مخطط المناسبات والإطلالات", free: "خطة واحدة", vip: "خطط غير محدودة لمختلف المناسبات" },
  { feature: "أكاديمية الجمال والدروس", free: "المقالات العامة", vip: "دروس حصريّة ومقالات VIP" },
];

export function VipScreen() {
  const setView = useAppStore((s) => s.setView);
  const goBack = useAppStore((s) => s.goBack);
  const { isNative, offering, loading, error, isPremiumActive, fetchOfferings, purchase, restore } =
    useSubscription();

  const [activePreview, setActivePreview] = useState<string>("forecast");
  // Presentation-only state. It deliberately lives inside this screen,
  // disappears on unmount, and never touches the persisted profile,
  // Firebase, or RevenueCat entitlement state.
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    if (isNative) fetchOfferings();
  }, [isNative, fetchOfferings]);

  const currentPreview = VIP_PREVIEWS.find((p) => p.id === activePreview) || VIP_PREVIEWS[0];

  return (
    <div className="py-3 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (!goBack()) setView("home");
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          رجوع
        </button>

        {/* Isolated web-only presentation toggle. */}
        {!isNative && (
          <button
            onClick={() => {
              const nextState = !isPreviewMode;
              setIsPreviewMode(nextState);
              toast.success(nextState ? "تم تفعيل تجربة VIP العرض ✦" : "تمت العودة للنسخة المجانية");
            }}
            className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-medium"
          >
            {isPreviewMode ? "إنهاء معاينة VIP" : "تجربة VIP (معاينة)"}
          </button>
        )}
      </div>

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl rawnak-rosegold-gradient p-6 text-center rawnak-shadow"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/30 blur-2xl" />
        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="inline-flex w-16 h-16 rounded-2xl bg-black/10 items-center justify-center mb-3 shadow-sm"
          >
            <Crown className="w-8 h-8 text-black" />
          </motion.div>
          <h1 className="text-2xl font-extrabold text-black">رَونق VIP</h1>
          <p className="text-sm text-black/80 mt-1.5 max-w-[28ch] mx-auto leading-relaxed font-medium">
            تجربة عناية شخصية فاخرة، تفتح لكِ أسرار بشرتكِ ورعاية خبيرة لا تتوقف
          </p>
        </div>
      </motion.div>

      {/* VIP Active Status */}
      {isPremiumActive && (
        <Card className="p-5 rounded-2xl border-primary/30 bg-primary/10 text-center space-y-1">
          <div className="inline-flex p-2 rounded-full bg-primary/20 text-primary mb-1">
            <Check className="w-5 h-5" />
          </div>
          <p className="font-bold text-base">عضويتكِ في VIP فعّالة الآن ✦</p>
          <p className="text-xs text-muted-foreground">
            تتمتعين بجميع مزايا التحليل المتقدم والاستشارات الحصرية
          </p>
        </Card>
      )}

      {isPreviewMode && !isPremiumActive && (
        <Card className="p-4 rounded-2xl border-dashed border-primary/40 bg-primary/5 text-center">
          <p className="font-bold text-sm">أنتِ الآن داخل معاينة VIP المؤقتة</p>
          <p className="text-xs text-muted-foreground mt-1">
            هذه المعاينة بصرية داخل هذه الشاشة فقط ولا تمنح أي صلاحية مدفوعة.
          </p>
        </Card>
      )}

      {/* Interactive Feature Previews */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            معاينة مميزات VIP الحصرية
          </h2>
          <span className="text-[11px] text-muted-foreground">اضغطي للمعاينة</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {VIP_PREVIEWS.map((prev) => {
            const isSelected = activePreview === prev.id;
            return (
              <button
                key={prev.id}
                onClick={() => setActivePreview(prev.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                  isSelected
                    ? "rawnak-rosegold-gradient text-black border-transparent shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {prev.label}
              </button>
            );
          })}
        </div>

        {/* Active Preview Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPreview.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-5 rounded-3xl border-primary/20 relative overflow-hidden bg-card">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px]">
                  {currentPreview.badge}
                </Badge>
                <span className="text-xs font-extrabold text-primary flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  {currentPreview.statVal}
                </span>
              </div>

              <h3 className="font-extrabold text-base mb-1.5">{currentPreview.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {currentPreview.desc}
              </p>

              {/* Sample Visual Mock */}
              <div className="p-3.5 rounded-2xl bg-muted/60 border border-border/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{currentPreview.statLabel}</span>
                  <span className="font-bold text-foreground">{currentPreview.statVal}</span>
                </div>
                <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                  <div className="rawnak-rosegold-gradient h-full w-[78%] rounded-full" />
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Detailed Benefit List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground px-1 flex items-center gap-1.5">
          <Star className="w-4 h-4 text-primary" />
          ما الذي ستحصلين عليه؟
        </h2>

        <div className="space-y-2.5">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-4 rounded-2xl border-border flex items-start gap-3 bg-card">
                  <div className="w-10 h-10 rounded-xl rawnak-rosegold-gradient grid place-items-center shrink-0 shadow-xs">
                    <Icon className="w-5 h-5 text-black" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm truncate">{b.title}</p>
                      <span className="text-[10px] font-semibold text-primary shrink-0 bg-primary/10 px-2 py-0.5 rounded-full">
                        {b.previewTag}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {b.desc}
                    </p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground px-1 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-primary" />
          مقارنة العضويّات
        </h2>

        <Card className="p-4 rounded-3xl border-border overflow-hidden bg-card">
          <div className="divide-y divide-border">
            <div className="grid grid-cols-3 pb-2 text-xs font-bold text-muted-foreground">
              <span>الميزة</span>
              <span className="text-center">المجانية</span>
              <span className="text-left text-primary">VIP ✦</span>
            </div>
            {COMPARISON.map((row, idx) => (
              <div key={idx} className="grid grid-cols-3 py-2.5 text-xs items-center gap-1">
                <span className="font-semibold text-foreground text-[11px] leading-snug">
                  {row.feature}
                </span>
                <span className="text-center text-muted-foreground text-[10px]">
                  {row.free}
                </span>
                <span className="text-left font-bold text-primary text-[10px] leading-snug">
                  {row.vip}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* RevenueCat Native Subscription Packages or Fallback */}
      {!isNative && !isPremiumActive && (
        <Card className="p-5 rounded-2xl border-border text-center space-y-2 bg-card">
          <Smartphone className="w-8 h-8 mx-auto text-muted-foreground/60 mb-1" />
          <p className="text-sm font-bold">الاشتراك المباشر متاح عبر تطبيق الجوال</p>
          <p className="text-xs text-muted-foreground max-w-[32ch] mx-auto leading-relaxed">
            يمكنكِ تحميل تطبيق رَونق لأجهزة أندرويد و iOS للاشتراك الفعلي وحفظ اشتراككِ بحسابكِ.
          </p>
          <Button
            onClick={() => {
              setIsPreviewMode(true);
              toast.success("تم تفعيل وضع المعاينة VIP بنجاح ✦");
            }}
            className="mt-2 rounded-xl rawnak-rosegold-gradient text-black font-bold text-xs"
          >
            تجربة شاشة VIP الآن
          </Button>
        </Card>
      )}

      {isNative && loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {isNative && !loading && error && (
        <Card className="p-5 rounded-2xl border-border text-center bg-card">
          <p className="text-sm font-bold">تعذّر تحميل باقات الاشتراك</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
          <Button onClick={() => fetchOfferings()} variant="outline" size="sm" className="mt-3 rounded-xl">
            إعادة المحاولة
          </Button>
        </Card>
      )}

      {isNative && offering && !isPremiumActive && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground px-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            اختاري الباقة المناسبة لكِ
          </p>
          {offering.availablePackages.map((pkg) => (
            <Card key={pkg.identifier} className="p-4 rounded-2xl border-primary/30 bg-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-foreground">{pkg.product.title}</p>
                  <p className="text-xs text-muted-foreground">{pkg.product.description}</p>
                </div>
                <p className="font-extrabold text-lg text-primary">{pkg.product.priceString}</p>
              </div>
              <Button
                onClick={async () => {
                  const result = await purchase(pkg.identifier);
                  if (result.ok) {
                    toast.success("مرحبًا بكِ في VIP ✦");
                    trackEvent("purchase", { package_id: pkg.identifier });
                  } else if (result.error) toast.error(result.error);
                }}
                disabled={loading}
                className="w-full rawnak-rosegold-gradient text-black font-semibold rounded-xl"
              >
                انضمي إلى VIP الآن
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-2">
                يمكنكِ الإلغاء في أي وقت بدون رسوم إضافية
              </p>
            </Card>
          ))}
        </div>
      )}

      {isNative && (
        <button
          onClick={async () => {
            const result = await restore();
            if (result.ok) toast.success("تمت استعادة اشتراككِ ✦");
            else if (result.error) toast.error(result.error);
          }}
          disabled={loading}
          className="w-full text-center text-xs text-muted-foreground py-2 hover:text-foreground transition-colors"
        >
          استعادة مشترياتي السابقة
        </button>
      )}
    </div>
  );
}
