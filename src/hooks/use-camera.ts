"use client";

import { useCallback, useRef, useState } from "react";

export type FacingMode = "user" | "environment";

/**
 * Robust camera hook — fixes the black-screen issue.
 *
 * Key guarantees:
 *  - The <video> element MUST be mounted before startCamera() is called.
 *    Screens should set the stage to "camera" first, then trigger startCamera
 *    from a useEffect (refs are guaranteed populated before effects run).
 *  - attachStream polls for the video ref to defend against any race.
 *  - muted + playsInline are set as DOM properties (not just JSX attributes)
 *    before srcObject, so autoplay works without a user gesture.
 *  - play() is retried; granular error messages for every DOMException type.
 *  - capture() mirrors the selfie frame naturally.
 */
export function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [facing, setFacing] = useState<FacingMode>("user");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      try {
        v.srcObject = null;
      } catch {
        // ignore
      }
    }
    setIsStreaming(false);
  }, []);

  /** Wait for the <video> ref to be populated (defensive). */
  const waitForVideo = useCallback(
    (timeoutMs = 1000): Promise<HTMLVideoElement | null> => {
      return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          const v = videoRef.current;
          if (v) {
            resolve(v);
            return;
          }
          if (Date.now() - start > timeoutMs) {
            resolve(null);
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      });
    },
    []
  );

  const attachStream = useCallback(
    async (stream: MediaStream): Promise<boolean> => {
      const video = await waitForVideo();
      if (!video) return false;

      // Critical: set these as DOM PROPERTIES before srcObject so the browser
      // allows autoplay without a user gesture.
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      // iOS also needs the lowercase attribute
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.autoplay = true;

      try {
        video.srcObject = stream;
      } catch {
        return false;
      }

      // Wait for the video to know its dimensions
      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          let done = false;
          const onMeta = () => {
            if (done) return;
            done = true;
            video.removeEventListener("loadedmetadata", onMeta);
            resolve();
          };
          video.addEventListener("loadedmetadata", onMeta);
          setTimeout(onMeta, 2500);
        });
      }

      // Force play with retries (autoplay policy may reject the first call)
      const tryPlay = async () => {
        try {
          await video.play();
          return true;
        } catch {
          return false;
        }
      };

      // Wait until the first frame is actually rendered (videoWidth > 0)
      const waitForFirstFrame = async (timeoutMs = 3000): Promise<boolean> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          if (video.readyState >= 2 && video.videoWidth > 0) return true;
          await new Promise((r) => setTimeout(r, 80));
        }
        return video.readyState >= 2 && video.videoWidth > 0;
      };

      if (await tryPlay()) {
        return waitForFirstFrame();
      }
      await new Promise((r) => setTimeout(r, 200));
      if (await tryPlay()) {
        return waitForFirstFrame();
      }
      await new Promise((r) => setTimeout(r, 300));
      return (await tryPlay()) && (await waitForFirstFrame());
    },
    [waitForVideo]
  );

  const startCamera = useCallback(
    async (mode: FacingMode = "user"): Promise<boolean> => {
      setError(null);
      setStarting(true);

      // Secure-context check (getUserMedia needs HTTPS or localhost)
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setError(
          "الكاميرا غير مدعومة في هذا المتصفح أو تحتاج اتصالًا آمنًا (HTTPS). يمكنك رفع صورة بدلًا من ذلك."
        );
        setStarting(false);
        return false;
      }

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });
      } catch {
        // Fallback: any video device, no facingMode constraint
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (e: unknown) {
          const err = e as DOMException;
          if (
            err?.name === "NotAllowedError" ||
            err?.name === "SecurityError"
          ) {
            setError(
              "تم رفض إذن الكاميرا. فعّلي الإذن من إعدادات المتصفح، أو ارفعي صورة."
            );
          } else if (
            err?.name === "NotFoundError" ||
            err?.name === "OverconstrainedError"
          ) {
            setError("لم يُعثر على كاميرا. ارفعي صورة بدلًا من ذلك.");
          } else if (err?.name === "NotReadableError") {
            setError(
              "الكاميرا مستخدمة من تطبيق آخر. أغلقيها وحاولي مجددًا."
            );
          } else if (err?.name === "AbortError") {
            setError("تعذّر تشغيل الكاميرا. حاولي مرة أخرى.");
          } else {
            setError(
              "تعذّر تشغيل الكاميرا. يمكنك رفع صورة بدلًا من ذلك."
            );
          }
          setStarting(false);
          return false;
        }
      }

      if (!stream) {
        setStarting(false);
        return false;
      }
      streamRef.current = stream;
      setFacing(mode);

      const ok = await attachStream(stream);
      setIsStreaming(ok);
      setStarting(false);
      if (!ok) {
        // Stream opened but video didn't render — release the stream
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setError(
          "تعذّر عرض صورة الكاميرا. حاولي مرة أخرى أو ارفعي صورة."
        );
        return false;
      }
      return true;
    },
    [attachStream]
  );

  const switchCamera = useCallback(async (): Promise<boolean> => {
    const next: FacingMode = facing === "user" ? "environment" : "user";
    return startCamera(next);
  }, [facing, startCamera]);

  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Mirror selfie capture horizontally for a natural look
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  }, [facing]);

  const pickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): Promise<string | null> => {
      return new Promise((resolve) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const img = new Image();
          img.onload = () => {
            const max = 1280;
            let { width, height } = img;
            if (width > max || height > max) {
              const ratio = Math.min(max / width, max / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
              const c = document.createElement("canvas");
              c.width = width;
              c.height = height;
              const cx = c.getContext("2d");
              if (cx) {
                cx.drawImage(img, 0, 0, width, height);
                resolve(c.toDataURL("image/jpeg", 0.85));
                return;
              }
            }
            resolve(dataUrl);
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    },
    []
  );

  return {
    videoRef,
    fileInputRef,
    isStreaming,
    starting,
    error,
    facing,
    startCamera,
    stopCamera,
    switchCamera,
    capture,
    pickFile,
    handleFile,
  };
}
