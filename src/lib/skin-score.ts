/**
 * Shared scoring copy for skin analysis results. Pulled out of
 * results-screen.tsx so the shareable glow card (src/lib/share/glow-card.ts)
 * shows the exact same label/caption for a given score instead of a second,
 * driftable copy of the same logic.
 */

export function scoreLabel(n: number): string {
  if (n >= 80) return "ممتاز";
  if (n >= 65) return "جيد جدًا";
  if (n >= 50) return "جيد";
  if (n >= 35) return "يحتاج عناية";
  return "تحتاج تركيز";
}

export function glowCaption(n: number): string {
  if (n >= 80) return "بشرتكِ تتوهّج اليوم ✦";
  if (n >= 65) return "توهّج حقيقي في تكوّن ✦";
  if (n >= 50) return "خطوات ثابتة نحو الإشراق ✦";
  if (n >= 35) return "كل عناية تُحسب، رحلتكِ بدأت ✦";
  return "التوهّج يبدأ من هنا، معكِ خطوة بخطوة ✦";
}

/** Tailwind class version — used by results-screen.tsx (DOM). */
export function scoreColorClass(n: number): string {
  if (n >= 75) return "text-emerald-500";
  if (n >= 50) return "text-amber-500";
  return "text-rose-500";
}

/** Concrete hex version — used by glow-card.ts (Canvas 2D fillStyle doesn't
 * reliably resolve Tailwind/oklch tokens across all WebView engines). */
export function scoreColorHex(n: number): string {
  if (n >= 75) return "#10b981"; // emerald-500
  if (n >= 50) return "#f59e0b"; // amber-500
  return "#f43f5e"; // rose-500
}
