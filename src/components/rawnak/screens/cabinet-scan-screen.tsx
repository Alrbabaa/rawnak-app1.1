"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type CabinetProduct } from "@/lib/store";
import { useCameraCapture } from "@/hooks/use-camera";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import { CABINET_CATEGORIES } from "@/lib/data";
import {
  ScanLine,
  ImagePlus,
  Sparkles,
  X,
  CheckCircle2,
  SwitchCamera,
  RefreshCw,
  Loader2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DetectedItem {
  key: string;
  name: string;
  brand: string;
  subCategory: string;
  confidence: number;
  include: boolean;
}

function topCategoryFor(subCategory: string): string {
  if (subCategory === "makeup") return "makeup";
  if (subCategory === "fragrance") return "fragrance";
  return "skincare";
}

export function CabinetScanScreen() {
  const { addCabinetProduct, setView } = useAppStore();
  const {
    videoRef,
    fileInputRef,
    isStreaming,
    starting,
    error: camError,
    startCamera,
    stopCamera,
    switchCamera,
    capture,
    pickFile,
    handleFile,
  } = useCameraCapture();

  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "camera" | "preview">("idle");
  const [scanning, setScanning] = useState(false);
  const [items, setItems] = useState<DetectedItem[] | null>(null);
  const [saving, setSaving] = useState(false);


  const startCamRef = useRef(startCamera);
  useLayoutEffect(() => {
    startCamRef.current = startCamera;
  });

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (stage !== "camera") return;
    let active = true;
    startCamRef.current("environment").then((ok) => {
      if (active && !ok && camError) toast.error(camError);
    });
    return () => {
      active = false;
    };
  }, [stage]);

  const enterCamera = () => setStage("camera");

  const reset = () => {
    setPreview(null);
    setItems(null);
    setStage("idle");
  };

  const takeShot = () => {
    const img = capture();
    if (img) {
      stopCamera();
      setPreview(img);
      setStage("preview");
    } else {
      toast.error("تعذّر التقاط الصورة. حاولي مرة أخرى.");
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const img = await handleFile(e);
    if (img) {
      setPreview(img);
      setStage("preview");
    }
    e.target.value = "";
  };

  const scan = async () => {
    if (!preview) return;
    setScanning(true);
    try {
      const res = await authedFetch("/api/cabinet/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.upgradeRequired) {
          toast.error(data.error);
          setView("vip");
          return;
        }
        throw new Error(data.error || "خطأ");
      }

      if (!data.items || data.items.length === 0) {
        toast("لم أتمكن من تمييز منتجات واضحة بالصورة", {
          description: "جرّبي صورة أوضح وإضاءة أفضل",
        });
        return;
      }

      setItems(
        data.items.map((it: { name: string; brand: string; subCategory: string; confidence: number }, i: number) => ({
          key: `d-${i}`,
          name: it.name,
          brand: it.brand,
          subCategory: it.subCategory,
          confidence: it.confidence,
          include: true,
        }))
      );
      toast.success(`اكتشفتُ ${data.items.length} ${data.items.length === 1 ? "منتج" : "منتجات"} ✦`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (key: string, patch: Partial<DetectedItem>) => {
    setItems((prev) => prev?.map((it) => (it.key === key ? { ...it, ...patch } : it)) || null);
  };

  const saveAll = () => {
    if (!items) return;
    const toSave = items.filter((it) => it.include && it.name.trim());
    if (toSave.length === 0) {
      toast.error("اختاري منتجًا واحدًا على الأقل للحفظ");
      return;
    }
    setSaving(true);
    toSave.forEach((it, i) => {
      const product: CabinetProduct = {
        id: `cab-${Date.now()}-${i}`,
        name: it.name.trim(),
        brand: it.brand.trim() || "غير محدد",
        category: topCategoryFor(it.subCategory),
        subCategory: it.subCategory,
        openedAt: null,
        shelfLifeMonths: 24,
        rating: 0,
        notes: "",
        imageData: preview || undefined,
        addedAt: Date.now(),
        favorite: false,
        useCount: 0,
        lastUsedAt: null,
        source: "ai-scan",
      };
      addCabinetProduct(product);
    });
    toast.success(`أُضيف ${toSave.length} ${toSave.length === 1 ? "منتج" : "منتجات"} إلى خزانتكِ ✦`);
    setSaving(false);
    setView("cabinet");
  };

  return (
    <div className="py-3 space-y-4">
      <button
        onClick={() => (items ? reset() : setView("cabinet"))}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <X className="w-4 h-4" />
        العودة
      </button>

      {!items && (
        <div className="text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rose-gradient items-center justify-center mb-3">
            <ScanLine className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">مسح خزانة المكياج ✦</h1>
          <p className="text-sm text-muted-foreground mt-1">
            صوّري حقيبة مكياجكِ أو رف منتجاتكِ، وستكتشف رَونق كل قطعة تلقائيًا
          </p>
        </div>
      )}

      {!items ? (
        <>
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-card border border-border">
            {stage === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 rounded-full rawnak-gradient grid place-items-center"
                >
                  <Sparkles className="w-8 h-8 text-foreground" />
                </motion.div>
                <p className="text-xs text-muted-foreground max-w-xs">
                  ضعي كل قطعك على سطح واضح ووجّهي الكاميرا نحوها
                </p>
                <div className="flex gap-2 w-full max-w-xs">
                  <Button onClick={enterCamera} className="flex-1 rounded-xl rawnak-rose-gradient text-white font-bold">
                    <ScanLine className="w-4 h-4 ml-1.5" />
                    كاميرا
                  </Button>
                  <Button onClick={pickFile} variant="outline" className="flex-1 rounded-xl">
                    <ImagePlus className="w-4 h-4 ml-1.5" />
                    رفع
                  </Button>
                </div>
              </div>
            )}

            {stage === "camera" && (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black" />
                <div className="absolute inset-4 border-2 border-[oklch(0.72_0.085_45)/0.7] border-dashed rounded-2xl pointer-events-none" />
                <button onClick={reset} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white z-10">
                  <X className="w-5 h-5" />
                </button>
                <button onClick={() => switchCamera()} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white z-10" aria-label="تبديل الكاميرا">
                  <SwitchCamera className="w-5 h-5" />
                </button>
                {isStreaming && (
                  <div className="absolute bottom-4 inset-x-0 flex justify-center">
                    <button onClick={takeShot} className="w-16 h-16 rounded-full bg-white border-4 border-primary grid place-items-center active:scale-90 transition-transform">
                      <span className="w-10 h-10 rounded-full rawnak-rose-gradient" />
                    </button>
                  </div>
                )}
                {!isStreaming && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-6 text-center">
                    {starting ? (
                      <>
                        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">جارٍ تشغيل الكاميرا...</p>
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-8 h-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">تعذّر عرض الكاميرا. حاولي مجددًا أو ارفعي صورة.</p>
                        <div className="flex gap-2">
                          <Button onClick={() => startCamera("environment")} variant="outline" size="sm" className="rounded-xl">
                            <RefreshCw className="w-4 h-4 ml-1.5" />
                            إعادة المحاولة
                          </Button>
                          <Button onClick={pickFile} size="sm" className="rounded-xl rawnak-rose-gradient text-white">
                            <ImagePlus className="w-4 h-4 ml-1.5" />
                            رفع صورة
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {stage === "preview" && preview && (
              <>
                <img src={preview} alt="خزانة المكياج" className="w-full h-full object-cover" />
                {!scanning && (
                  <button onClick={reset} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur grid place-items-center text-white">
                    <X className="w-5 h-5" />
                  </button>
                )}
                {scanning && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 rounded-full border-4 border-white/30 border-t-white"
                    />
                    <p className="font-bold">جارٍ اكتشاف منتجاتكِ...</p>
                  </div>
                )}
              </>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          </div>

          {stage === "preview" && !scanning && (
            <Button onClick={scan} className="w-full h-12 rounded-2xl rawnak-rose-gradient text-white font-bold">
              <Sparkles className="w-5 h-5 ml-2" />
              اكتشفي منتجاتي
            </Button>
          )}
        </>
      ) : (
        <ReviewList
          items={items}
          onUpdate={updateItem}
          onSave={saveAll}
          saving={saving}
          preview={preview}
        />
      )}
    </div>
  );
}

function ReviewList({
  items,
  onUpdate,
  onSave,
  saving,
  preview,
}: {
  items: DetectedItem[];
  onUpdate: (key: string, patch: Partial<DetectedItem>) => void;
  onSave: () => void;
  saving: boolean;
  preview: string | null;
}) {
  const includedCount = items.filter((it) => it.include).length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-3">
        {preview && (
          <img src={preview} alt="خزانة المكياج" className="w-16 h-16 rounded-2xl object-cover border border-border shrink-0" />
        )}
        <div>
          <h2 className="font-extrabold">راجعي المنتجات المكتشفة</h2>
          <p className="text-xs text-muted-foreground">عدّلي أو ألغي أي قطعة قبل الحفظ</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <AnimatePresence>
          {items.map((it) => (
            <motion.div
              key={it.key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              className={cn(
                "rounded-2xl border p-3.5 transition-opacity",
                it.include ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-50"
              )}
            >
              <div className="flex items-start gap-2.5">
                <button
                  onClick={() => onUpdate(it.key, { include: !it.include })}
                  className={cn(
                    "w-6 h-6 rounded-full grid place-items-center shrink-0 mt-1 border-2 transition-colors",
                    it.include ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                  )}
                >
                  {it.include && <CheckCircle2 className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0 space-y-2">
                  <Input
                    value={it.name}
                    onChange={(e) => onUpdate(it.key, { name: e.target.value })}
                    placeholder="اسم المنتج"
                    className="h-9 text-sm font-bold bg-background"
                  />
                  <Input
                    value={it.brand}
                    onChange={(e) => onUpdate(it.key, { brand: e.target.value })}
                    placeholder="العلامة التجارية (اختياري)"
                    className="h-8 text-xs bg-background"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CABINET_CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onUpdate(it.key, { subCategory: c.id })}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors",
                          it.subCategory === c.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {c.emoji} {c.label}
                      </button>
                    ))}
                  </div>
                  {it.confidence < 55 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      تعرّف غير مؤكد — تأكدي من الاسم قبل الحفظ
                    </p>
                  )}
                </div>

                <button
                  onClick={() => onUpdate(it.key, { include: false })}
                  className="text-muted-foreground/60 hover:text-destructive shrink-0 mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Button
        onClick={onSave}
        disabled={saving || includedCount === 0}
        className="w-full h-12 rounded-2xl rawnak-rosegold-gradient text-black font-bold sticky bottom-2"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 ml-1.5" />
        )}
        أضيفي {includedCount > 0 ? includedCount : ""} إلى خزانتي
      </Button>
    </motion.div>
  );
}
