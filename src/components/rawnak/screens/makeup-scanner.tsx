"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, type ProductScan } from "@/lib/store";
import { useCameraCapture } from "@/hooks/use-camera";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import {
  ScanLine,
  ImagePlus,
  Sparkles,
  X,
  Package,
  CheckCircle2,
  AlertTriangle,
  Droplet,
  SwitchCamera,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export function MakeupScanner() {
  const { addScan, scans, profile, setView, unlockAchievement } = useAppStore();
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
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState<"idle" | "camera" | "preview">("idle");
  const [result, setResult] = useState<ProductScan | null>(null);

  // Hold the latest startCamera so the effect can stay keyed on `stage` only.
  // Updated in a layout effect, not directly during render (see skin-analysis.tsx
  // for the full rationale — same fix applied here for consistency).
  const startCamRef = useRef(startCamera);
  useLayoutEffect(() => {
    startCamRef.current = startCamera;
  });

  useEffect(() => {
    return () => stopCamera();
  }, []);

  /**
   * FIX: Start the camera ONLY after the <video> element is mounted.
   * Setting stage to "camera" mounts the video, then this effect runs
   * (refs are populated before effects), so startCamera attaches the
   * stream to a real element — no black screen.
   */
  useEffect(() => {
    if (stage !== "camera") return;
    let active = true;
    startCamRef.current("environment").then((ok) => {
      if (active && !ok && camError) {
        toast.error(camError);
      }
    });
    return () => {
      active = false;
    };
  }, [stage]);

  const enterCamera = () => setStage("camera");

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
      const res = await authedFetch("/api/product-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: preview,
          userSkinType: profile.skinType,
          userConcerns: profile.concerns,
        }),
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

      const scan: ProductScan = {
        id: `sc-${Date.now()}`,
        ts: Date.now(),
        imageData: preview,
        name: data.name,
        brand: data.brand,
        category: data.category,
        ingredients: data.ingredients,
        compatibility: data.compatibility,
        benefits: data.benefits,
        warnings: data.warnings,
        usage: data.usage,
      };
      addScan(scan);
      setResult(scan);
      unlockAchievement("scanner-pro");
      toast.success("تم تحليل المنتج ✦");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setStage("idle");
  };

  return (
    <div className="py-3 space-y-4">
      <button
        onClick={() => setView("analysis")}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <X className="w-4 h-4" />
        العودة
      </button>

      <div className="text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rose-gradient items-center justify-center mb-3">
          <ScanLine className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold">فاحص المنتجات الذكي</h1>
        <p className="text-sm text-muted-foreground mt-1">
          صوّري أي منتج لمعرفة مكوناته وملاءمته لبشرتكِ
        </p>
      </div>

      {!result ? (
        <>
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-card border border-border">
            {stage === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 rounded-full rawnak-gradient grid place-items-center"
                >
                  <Package className="w-8 h-8 text-foreground" />
                </motion.div>
                <p className="text-xs text-muted-foreground max-w-xs">
                  وجّهي الكاميرا نحو العبوة أو قائمة المكونات
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
                        <Package className="w-8 h-8 text-muted-foreground" />
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
                <img src={preview} alt="منتج" className="w-full h-full object-cover" />
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
                    <p className="font-bold">جارٍ تحليل المنتج...</p>
                  </div>
                )}
              </>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          </div>

          {stage === "preview" && !scanning && (
            <Button onClick={scan} className="w-full h-12 rounded-2xl rawnak-rose-gradient text-white font-bold">
              <Sparkles className="w-5 h-5 ml-2" />
              فحص المنتج
            </Button>
          )}

          {scans.length > 0 && (
            <div>
              <h3 className="font-bold mb-2">منتجات فُحصت مسبقًا</h3>
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                {scans.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setResult(s)}
                    className="shrink-0 w-24 text-center"
                  >
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border hover:border-primary transition-colors">
                      <img src={s.imageData} alt={s.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[10px] mt-1 line-clamp-1 font-medium">{s.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <ScanResult result={result} onReset={reset} />
      )}
    </div>
  );
}

function ScanResult({ result, onReset }: { result: ProductScan; onReset: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex gap-3">
        <img src={result.imageData} alt={result.name} className="w-24 h-24 rounded-2xl object-cover border border-border" />
        <div className="flex-1 min-w-0">
          <Badge className="mb-1 bg-primary/10 text-primary hover:bg-primary/15">{result.category}</Badge>
          <h2 className="font-extrabold text-lg leading-tight line-clamp-2">{result.name}</h2>
          <p className="text-sm text-muted-foreground">{result.brand}</p>
        </div>
      </div>

      {/* Compatibility */}
      <div className="rounded-2xl p-4 rawnak-gradient">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-foreground">ملاءمة المنتج لبشرتكِ</span>
          <span className="text-2xl font-extrabold text-foreground">{result.compatibility}%</span>
        </div>
        <Progress value={result.compatibility} className="h-2.5 bg-white/40" />
        <p className="text-xs text-foreground/70 mt-2">
          {result.compatibility >= 75
            ? "ممتاز لبشرتكِ! منتج مناسب ✦"
            : result.compatibility >= 50
            ? "جيد، مع بعض التحفظات"
            : "قد لا يكون الأمثل لبشرتكِ"}
        </p>
      </div>

      {/* Benefits */}
      {result.benefits.length > 0 && (
        <div className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <h3 className="font-bold mb-2 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            الفوائد
          </h3>
          <ul className="space-y-1.5">
            {result.benefits.map((b, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-emerald-500">✦</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <h3 className="font-bold mb-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            ملاحظات وتحذيرات
          </h3>
          <ul className="space-y-1.5">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-amber-500">⚠</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ingredients */}
      {result.ingredients.length > 0 && (
        <div className="rounded-2xl p-4 bg-card border border-border">
          <h3 className="font-bold mb-2 flex items-center gap-1.5">
            <Droplet className="w-4 h-4 text-primary" />
            المكونات الرئيسية
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {result.ingredients.map((ing, i) => (
              <Badge key={i} variant="secondary" className="rounded-full text-xs">
                {ing}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Usage */}
      <div className="rounded-2xl p-4 bg-card border border-border">
        <h3 className="font-bold mb-1.5">طريقة الاستخدام</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{result.usage}</p>
      </div>

      <Button onClick={onReset} variant="outline" className="w-full rounded-2xl h-12">
        فحص منتج آخر
      </Button>
    </motion.div>
  );
}
