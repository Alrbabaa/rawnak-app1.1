"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, deriveProfileUpdateFromAnalysis, type SkinAnalysis } from "@/lib/store";
import { useCameraCapture } from "@/hooks/use-camera";
import { authedFetch } from "@/lib/firebase/authed-fetch";
import {
  Camera,
  ImagePlus,
  Sparkles,
  ScanFace,
  X,
  History,
  RefreshCw,
  SwitchCamera,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SkinAnalysis() {
  const { addAnalysis, setCurrentAnalysis, setView, analyses, profile, updateProfile } = useAppStore();
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
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState<"idle" | "camera" | "preview">("idle");

  // Hold the latest startCamera so the effect can stay keyed on `stage` only.
  // Updated in a layout effect (not directly during render) — layout effects
  // run synchronously before the browser paints and before any regular
  // effect in the same commit, so the ref is guaranteed fresh by the time
  // the effect below reads it, with no behavior change from before.
  const startCamRef = useRef(startCamera);
  useLayoutEffect(() => {
    startCamRef.current = startCamera;
  });

  // Stop camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  /**
   * FIX: Start the camera ONLY after the <video> element is mounted.
   * Setting stage to "camera" mounts the video, then this effect runs
   * (refs are guaranteed populated before effects), so startCamera can
   * attach the stream to a real element — no more black screen.
   */
  useEffect(() => {
    if (stage !== "camera") return;
    let active = true;
    startCamRef.current("user").then((ok) => {
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

  const closeCamera = () => {
    stopCamera();
    setStage("idle");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const img = await handleFile(e);
    if (img) {
      setPreview(img);
      setStage("preview");
    }
    e.target.value = "";
  };

  const analyze = async () => {
    if (!preview) return;
    setAnalyzing(true);
    try {
      const previous = analyses[0];
      const res = await authedFetch("/api/skin-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: preview,
          profileContext: {
            age: profile.age,
            skinType: profile.skinType,
            skinTone: profile.skinTone,
            concerns: profile.concerns,
            goals: profile.goals,
            previousAnalysis: previous
              ? {
                  daysAgo: Math.max(0, Math.round((Date.now() - previous.ts) / 86_400_000)),
                  overall: previous.overall,
                  skinType: previous.skinType,
                  metrics: previous.metrics,
                  summary: previous.summary,
                }
              : null,
          },
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

      const analysis: SkinAnalysis = {
        id: `an-${Date.now()}`,
        ts: Date.now(),
        imageData: preview,
        overall: data.overall,
        metrics: data.metrics,
        skinType: data.skinType,
        summary: data.summary,
        recommendations: data.recommendations || [],
        observations: data.observations || [],
        possibleConcerns: data.possibleConcerns || [],
        confidence: data.meta?.confidence,
        limitations: data.meta?.limitations || [],
        reviewStatus: data.meta?.reviewStatus,
      };
      addAnalysis(analysis);
      setCurrentAnalysis(analysis);
      // Close the loop: the routine builder and product recommendations
      // read profile.skinType/concerns, not the analysis history — without
      // this, the AI's actual findings never reach the rest of the app.
      // See deriveProfileUpdateFromAnalysis's doc comment in store.ts for
      // exactly what does/doesn't get overwritten.
      // A low-confidence single photo must not silently replace profile data.
      // With a sufficiently clear reading, the image-based result corrects
      // stale or mistaken self-reported choices and feeds later features.
      if (typeof data.meta?.confidence === "number" && data.meta.confidence >= 60) {
        updateProfile(
          deriveProfileUpdateFromAnalysis(data.skinType, data.metrics, profile.concerns)
        );
      }
      setView("results");
      toast.success("تم تحليل بشرتكِ ✦");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="py-3 space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl rawnak-rose-gradient items-center justify-center mb-3">
          <ScanFace className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold">تحليل البشرة الذكي</h1>
        <p className="text-sm text-muted-foreground mt-1">
          صورة واحدة تكشف حالة بشرتكِ بالتفصيل
        </p>
      </div>

      {/* Camera / preview area */}
      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-card border border-border">
        {stage === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 rounded-full rawnak-gradient grid place-items-center"
            >
              <Camera className="w-9 h-9 text-foreground" />
            </motion.div>
            <div>
              <p className="font-bold mb-1">جاهزة للتحليل؟</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                صورة واضحة بإضاءة جيدة تمنح أفضل النتائج. بدون مكياج للحصول على
                تحليل دقيق.
              </p>
            </div>
            <div className="flex gap-2 w-full max-w-xs">
              <Button
                onClick={enterCamera}
                className="flex-1 rounded-xl rawnak-rose-gradient text-white font-bold"
              >
                <Camera className="w-4 h-4 ml-1.5" />
                كاميرا
              </Button>
              <Button
                onClick={pickFile}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                <ImagePlus className="w-4 h-4 ml-1.5" />
                رفع صورة
              </Button>
            </div>
          </div>
        )}

        {stage === "camera" && (
          <>
            {/* The video element — always present in this stage so the ref is valid */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover bg-black"
            />
            {/* Face guide overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-60 rounded-[50%] border-2 border-[oklch(0.72_0.085_45)/0.7] border-dashed" />
            </div>
            <button
              onClick={closeCamera}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white z-10"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Switch front/back camera */}
            <button
              onClick={() => switchCamera()}
              className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur grid place-items-center text-white z-10"
              aria-label="تبديل الكاميرا"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
            {/* Capture button (only when streaming) */}
            {isStreaming && (
              <div className="absolute bottom-4 inset-x-0 flex justify-center">
                <button
                  onClick={takeShot}
                  className="w-16 h-16 rounded-full bg-white border-4 border-primary grid place-items-center active:scale-90 transition-transform"
                  aria-label="التقاط"
                >
                  <span className="w-10 h-10 rounded-full rawnak-rose-gradient" />
                </button>
              </div>
            )}
            {/* Starting / fallback overlay */}
            {!isStreaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 p-6 text-center">
                {starting ? (
                  <>
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      جارٍ تشغيل الكاميرا...
                    </p>
                  </>
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      تعذّر عرض الكاميرا. حاولي مجددًا أو ارفعي صورة.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => startCamera("user")}
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                      >
                        <RefreshCw className="w-4 h-4 ml-1.5" />
                        إعادة المحاولة
                      </Button>
                      <Button
                        onClick={pickFile}
                        size="sm"
                        className="rounded-xl rawnak-rose-gradient text-white"
                      >
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
            <img
              src={preview}
              alt="معاينة"
              className="w-full h-full object-cover"
            />
            {!analyzing && (
              <button
                onClick={() => {
                  setPreview(null);
                  setStage("idle");
                }}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur grid place-items-center text-white"
                aria-label="إعادة"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {analyzing && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 rounded-full border-white/30 border-t-white"
                  style={{ borderWidth: "3px" }}
                />
                <p className="font-bold">جارٍ تحليل بشرتكِ...</p>
                <div className="space-y-1 text-xs text-white/80 text-center">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    ✦ فحص الترطيب والملمس
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                  >
                    ✦ تحليل المسام والهالات
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                  >
                    ✦ توليد التوصيات المخصصة
                  </motion.p>
                </div>
              </div>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
      </div>

      {/* Analyze button */}
      {stage === "preview" && !analyzing && (
        <Button
          onClick={analyze}
          className="w-full h-12 rounded-2xl rawnak-rose-gradient text-white font-bold"
        >
          <Sparkles className="w-5 h-5 ml-2" />
          حلّلي بشرتي الآن
        </Button>
      )}

      {/* Tips */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-sm font-bold mb-2">لأفضل نتيجة ✦</p>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>• صورة أمامية بإضاءة طبيعية جيدة</li>
          <li>• بدون مكياج أو فلتر</li>
          <li>• الشعر بعيدًا عن الوجه</li>
          <li>• وجهكِ يملأ الإطار البيضاوي</li>
        </ul>
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          صورتكِ تُستخدم للتحليل فقط ولا تصل لأي طرف ثالث
        </div>
      </div>

      {/* History */}
      {analyses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold flex items-center gap-1.5">
              <History className="w-4 h-4 text-primary" />
              التحليلات السابقة
            </h3>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {analyses.slice(0, 8).map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setCurrentAnalysis(a);
                  setView("results");
                }}
                className="shrink-0 w-24 text-center group"
              >
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border group-hover:border-primary transition-colors">
                  <img
                    src={a.imageData}
                    alt="تحليل"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs font-bold mt-1 rawnak-gold-text">
                  {a.overall}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(a.ts).toLocaleDateString("ar", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
