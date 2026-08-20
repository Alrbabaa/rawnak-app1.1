"use client";

import { getAccountTierMeta, type AccountTier } from "@/lib/account-tiers";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Sparkles, Crown, Zap, Building2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountBadgePillProps {
  tier?: AccountTier | string | null;
  size?: "sm" | "md" | "lg";
  showIconOnly?: boolean;
  className?: string;
}

export function AccountBadgePill({
  tier,
  size = "md",
  showIconOnly = false,
  className,
}: AccountBadgePillProps) {
  const meta = getAccountTierMeta(tier);

  if (showIconOnly) {
    if (!meta.verifiedMark && meta.id === "standard") return null;

    return (
      <span
        title={meta.label}
        className={cn(
          "inline-flex items-center justify-center rounded-full shrink-0",
          meta.colorClass,
          size === "sm" && "w-3.5 h-3.5 text-[10px]",
          size === "md" && "w-4 h-4 text-xs",
          size === "lg" && "w-5 h-5 text-sm",
          className
        )}
      >
        {meta.id === "influencer" && <CheckCircle2 className="w-full h-full fill-sky-500 text-white" />}
        {meta.id === "vip" && <Crown className="w-full h-full text-amber-500 fill-amber-500/20" />}
        {meta.id === "business" && <Building2 className="w-full h-full text-cyan-500" />}
        {meta.id === "featured" && <Sparkles className="w-full h-full text-amber-500" />}
        {meta.id === "active" && <Zap className="w-full h-full text-emerald-500 fill-emerald-500/30" />}
      </span>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-extrabold rounded-full inline-flex items-center gap-1.5 border shadow-2xs transition-all shrink-0",
        meta.bgClass,
        meta.colorClass,
        meta.borderClass,
        size === "sm" && "text-[9px] px-2 py-0.2 h-4",
        size === "md" && "text-[10px] px-2.5 py-0.5 h-5",
        size === "lg" && "text-xs px-3 py-1 h-6",
        className
      )}
    >
      <span className="shrink-0">{meta.badgeIcon}</span>
      <span>{meta.label}</span>
      {meta.verifiedMark && (
        <ShieldCheck className="w-3 h-3 text-current shrink-0 ml-0.5" />
      )}
    </Badge>
  );
}
