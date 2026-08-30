"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisThumbnailProps {
  src?: string | null;
  className?: string;
}

/** A visible, accessible fallback for missing or unreachable analysis photos. */
export function AnalysisThumbnail({ src, className }: AnalysisThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src && failedSrc === src);

  if (!src || failed) {
    return (
      <div
        className={cn("grid place-items-center bg-muted text-muted-foreground", className)}
        role="img"
        aria-label="صورة التحليل غير متاحة"
      >
        <div className="text-center">
          <ImageOff className="w-5 h-5 mx-auto" />
          <span className="text-[9px]">غير متاحة</span>
        </div>
      </div>
    );
  }

  return <img src={src} alt="صورة التحليل" className={className} onError={() => setFailedSrc(src)} />;
}
