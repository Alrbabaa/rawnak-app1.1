"use client";

import { motion } from "framer-motion";
import {
  Flower2,
  Leaf,
  Sprout,
  Sun,
  Crown,
  Sparkles,
  Feather,
  Smartphone,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
 * Botanical / natural decorative system — five presentation
 * variants sharing one icon set and one tone palette.
 * ============================================================ */

export type DecorIconName =
  | "flower"
  | "leaf"
  | "sprout"
  | "sun"
  | "crown"
  | "sparkle"
  | "feather"
  | "smartphone"
  | "zap";

const ICONS: Record<DecorIconName, LucideIcon> = {
  flower: Flower2,
  leaf: Leaf,
  sprout: Sprout,
  sun: Sun,
  crown: Crown,
  sparkle: Sparkles,
  feather: Feather,
  smartphone: Smartphone,
  zap: Zap,
};

/** Icons pulled from when a variant doesn't get an explicit icon prop.
 * "smartphone" and "zap" are intentionally left out here — they're not
 * botanical, they're for badge() when it's labelling a tech/AI feature
 * rather than a plant motif (see DecorBadge's icon prop). */
const BOTANICAL_ICONS: DecorIconName[] = ["flower", "leaf", "sprout", "sun", "crown", "sparkle", "feather"];

/** Rawnak's five shopping departments, each with its own soft identity —
 * plus "theme", which instead of a fixed palette pulls live from the
 * active app-wide color theme (colorTheme in store.ts / the `.theme-*`
 * class on <html>, applied in theme-provider.tsx) via its CSS custom
 * properties (--primary, --grad-a/b, --grad-rg-a/b/c, --primary-glow-*).
 * Switching the theme in the profile screen re-colors every "theme"-toned
 * decoration automatically, no re-render logic needed. It's the default
 * for all five variants — pass a department tone explicitly when a
 * section's category identity should stay fixed instead (e.g. a fashion
 * banner that should read as fashion-green even in the "ocean" theme).
 * "neutral" stays available as a flat muted-gray option for either case. */
export type DecorTone =
  | "theme"
  | "beauty"
  | "makeup"
  | "fragrance"
  | "fashion"
  | "accessories"
  | "neutral";

const TONE: Record<
  DecorTone,
  { bg: string; soft: string; text: string; ring: string; gradient: string }
> = {
  theme: {
    bg: "bg-primary/8",
    soft: "bg-primary/12",
    text: "text-primary",
    ring: "ring-primary/25",
    gradient: "linear-gradient(135deg, var(--grad-a), var(--grad-b))",
  },
  beauty: {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    soft: "bg-rose-100/70 dark:bg-rose-900/30",
    text: "text-rose-500 dark:text-rose-400",
    ring: "ring-rose-200 dark:ring-rose-900/60",
    gradient: "linear-gradient(135deg, oklch(0.94 0.03 15), oklch(0.88 0.06 10))",
  },
  makeup: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    soft: "bg-orange-100/70 dark:bg-orange-900/30",
    text: "text-orange-500 dark:text-orange-400",
    ring: "ring-orange-200 dark:ring-orange-900/60",
    gradient: "linear-gradient(135deg, oklch(0.94 0.04 55), oklch(0.87 0.08 45))",
  },
  fragrance: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    soft: "bg-purple-100/70 dark:bg-purple-900/30",
    text: "text-purple-500 dark:text-purple-400",
    ring: "ring-purple-200 dark:ring-purple-900/60",
    gradient: "linear-gradient(135deg, oklch(0.93 0.03 305), oklch(0.86 0.06 300))",
  },
  fashion: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    soft: "bg-emerald-100/70 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-200 dark:ring-emerald-900/60",
    gradient: "linear-gradient(135deg, oklch(0.93 0.04 155), oklch(0.85 0.07 150))",
  },
  accessories: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    soft: "bg-amber-100/70 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-200 dark:ring-amber-900/60",
    gradient: "linear-gradient(135deg, oklch(0.94 0.04 85), oklch(0.86 0.08 75))",
  },
  neutral: {
    bg: "bg-muted",
    soft: "bg-muted/70",
    text: "text-muted-foreground",
    ring: "ring-border",
    gradient: "linear-gradient(135deg, var(--grad-rg-a), var(--grad-rg-b), var(--grad-rg-c))",
  },
};

function DecorIcon({
  name,
  className,
  style,
}: {
  name: DecorIconName;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} style={style} aria-hidden="true" />;
}

/* ============================================================
 * variant="background" — a soft floating watermark layer.
 * Wrap it in a `relative overflow-hidden` parent; it fills that
 * parent with pointer-events-none, low-opacity, gently drifting
 * botanical marks (petals, sparkles, buds). Positions are fixed
 * (not randomised) so server and client render identically.
 * ============================================================ */

interface BackgroundItem {
  icon: DecorIconName;
  top: string;
  left: string;
  size: number;
  rotate: number;
  delay: number;
  duration: number;
}

const BACKGROUND_ITEMS: BackgroundItem[] = [
  { icon: "flower", top: "6%", left: "10%", size: 44, rotate: -14, delay: 0, duration: 7 },
  { icon: "leaf", top: "18%", left: "84%", size: 32, rotate: 22, delay: 0.6, duration: 8 },
  { icon: "sparkle", top: "58%", left: "6%", size: 22, rotate: 0, delay: 1.1, duration: 5 },
  { icon: "sprout", top: "80%", left: "72%", size: 36, rotate: -8, delay: 0.3, duration: 9 },
  { icon: "sun", top: "4%", left: "56%", size: 28, rotate: 0, delay: 0.9, duration: 6 },
  { icon: "feather", top: "42%", left: "92%", size: 26, rotate: 35, delay: 1.4, duration: 7.5 },
  { icon: "flower", top: "90%", left: "22%", size: 30, rotate: 16, delay: 0.2, duration: 8.5 },
  { icon: "sparkle", top: "30%", left: "38%", size: 18, rotate: 0, delay: 1.8, duration: 4.5 },
];

function DecorBackground({ tone = "theme", className }: { tone?: DecorTone; className?: string }) {
  const t = TONE[tone];
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none select-none", className)}>
      {BACKGROUND_ITEMS.map((item, i) => (
        <motion.div
          key={i}
          className={cn("absolute blur-[0.5px]", t.text)}
          style={{ top: item.top, left: item.left, opacity: 0.14 }}
          animate={{
            y: [0, -10, 0],
            rotate: [item.rotate, item.rotate + 6, item.rotate],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <DecorIcon name={item.icon} style={{ width: item.size, height: item.size }} />
        </motion.div>
      ))}
    </div>
  );
}

/* ============================================================
 * variant="corner" — a small botanical cluster (flower + sprig)
 * climbing over one corner of a card/section. Parent needs
 * `relative overflow-hidden` (or plain `relative` if you want it
 * to spill slightly past the edge).
 * ============================================================ */

const CORNER_POSITION: Record<string, string> = {
  tr: "-top-2 -right-2 rotate-[8deg]",
  tl: "-top-2 -left-2 -rotate-[8deg] -scale-x-100",
  br: "-bottom-2 -right-2 rotate-[172deg] -scale-y-100",
  bl: "-bottom-2 -left-2 rotate-[188deg]",
};

function DecorCorner({
  tone = "theme",
  corner = "tr",
  className,
}: {
  tone?: DecorTone;
  corner?: "tr" | "tl" | "br" | "bl";
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn("absolute w-14 h-14 pointer-events-none select-none z-0", CORNER_POSITION[corner], className)}
      aria-hidden="true"
    >
      <DecorIcon name="leaf" className={cn("absolute w-9 h-9 opacity-25", t.text)} style={{ top: 10, left: 4, transform: "rotate(-20deg)" }} />
      <DecorIcon name="flower" className={cn("absolute w-7 h-7 opacity-70", t.text)} style={{ top: 0, left: 14 }} />
      <DecorIcon name="sparkle" className={cn("absolute w-3.5 h-3.5 opacity-60", t.text)} style={{ top: 4, left: 2 }} />
    </div>
  );
}

/* ============================================================
 * variant="banner" — an inner strip carrying one department's
 * identity (soft tone + a short botanical icon row + optional
 * label). Use inside a card/header to signal category at a glance.
 * ============================================================ */

function DecorBanner({
  tone = "theme",
  label,
  className,
  children,
}: {
  tone?: DecorTone;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl px-4 py-3 flex items-center gap-2.5", t.bg, className)}
      style={{ background: t.gradient }}
    >
      <div className="flex items-center -space-x-1.5 rtl:space-x-reverse shrink-0">
        <DecorIcon name="leaf" className={cn("w-4 h-4 opacity-70", t.text)} />
        <DecorIcon name="flower" className={cn("w-5 h-5", t.text)} />
        <DecorIcon name="sparkle" className={cn("w-3.5 h-3.5 opacity-70", t.text)} />
      </div>
      {label && <span className={cn("text-sm font-bold", t.text)}>{label}</span>}
      {children}
    </div>
  );
}

/* ============================================================
 * variant="divider" — a symmetric botanical section divider:
 * line — leaf — flower (center) — leaf — line, mirrored.
 * ============================================================ */

function DecorDivider({ tone = "theme", className }: { tone?: DecorTone; className?: string }) {
  const t = TONE[tone];
  return (
    <div className={cn("flex items-center gap-2.5 py-1", className)} aria-hidden="true">
      <span className={cn("flex-1 h-px bg-current opacity-20", t.text)} />
      <DecorIcon name="leaf" className={cn("w-3.5 h-3.5 opacity-50 -scale-x-100", t.text)} />
      <DecorIcon name="flower" className={cn("w-4 h-4", t.text)} />
      <DecorIcon name="leaf" className={cn("w-3.5 h-3.5 opacity-50", t.text)} />
      <span className={cn("flex-1 h-px bg-current opacity-20", t.text)} />
    </div>
  );
}

/* ============================================================
 * variant="badge" — a small botanical medallion: icon + optional
 * label in a soft pill. Pass icon="smartphone" or icon="zap" for
 * a tech/AI-feature badge that still matches the family's shape
 * language instead of a plain botanical one.
 * ============================================================ */

function DecorBadge({
  tone = "theme",
  icon = "sparkle",
  label,
  className,
}: {
  tone?: DecorTone;
  icon?: DecorIconName;
  label?: string;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full ring-1",
        t.soft,
        t.ring,
        className
      )}
    >
      <DecorIcon name={icon} className={cn("w-3 h-3", t.text)} />
      {label && <span className={cn("text-[11px] font-bold", t.text)}>{label}</span>}
    </span>
  );
}

/* ============================================================
 * Public entry point — one component, five variants.
 * ============================================================ */

export type BotanicalDecorProps =
  | ({ variant: "background" } & Parameters<typeof DecorBackground>[0])
  | ({ variant: "corner" } & Parameters<typeof DecorCorner>[0])
  | ({ variant: "banner" } & Parameters<typeof DecorBanner>[0])
  | ({ variant: "divider" } & Parameters<typeof DecorDivider>[0])
  | ({ variant: "badge" } & Parameters<typeof DecorBadge>[0]);

/**
 * Reusable botanical/natural decorative element, five presentation modes:
 *  - background — soft floating watermark layer behind a section
 *  - corner     — small flower+sprig cluster climbing a card's corner
 *  - banner     — inner strip carrying a department's soft identity
 *  - divider    — symmetric botanical section divider
 *  - badge      — small botanical (or tech, via icon="smartphone"/"zap") medallion
 *
 * `tone="theme"` (the default) follows the app's active color theme live —
 * switching themes in the profile screen re-colors it automatically. Pass
 * a department tone (beauty/makeup/fragrance/fashion/accessories) instead
 * when a section's category identity should stay fixed regardless of
 * theme, or "neutral" for a flat muted option.
 */
export function BotanicalDecor(props: BotanicalDecorProps) {
  switch (props.variant) {
    case "background":
      return <DecorBackground {...props} />;
    case "corner":
      return <DecorCorner {...props} />;
    case "banner":
      return <DecorBanner {...props} />;
    case "divider":
      return <DecorDivider {...props} />;
    case "badge":
      return <DecorBadge {...props} />;
  }
}

export { BOTANICAL_ICONS };
