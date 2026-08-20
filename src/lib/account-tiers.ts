export type AccountTier = "standard" | "active" | "featured" | "vip" | "influencer" | "business";

export interface AccountTierMeta {
  id: AccountTier;
  label: string;
  labelEn: string;
  badgeIcon: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
  verifiedMark: boolean;
}

export const ACCOUNT_TIERS: Record<AccountTier, AccountTierMeta> = {
  standard: {
    id: "standard",
    label: "حساب عادي",
    labelEn: "Standard",
    badgeIcon: "🌸",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted/50",
    borderClass: "border-border/60",
    description: "عضوة أساسية في مجتمع رَونق",
    verifiedMark: false,
  },
  active: {
    id: "active",
    label: "حساب نشط",
    labelEn: "Active",
    badgeIcon: "⚡",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    description: "عضوة نشطة تتفاعل باستمرار وتكمل روتينها يومياً",
    verifiedMark: false,
  },
  featured: {
    id: "featured",
    label: "حساب مميز",
    labelEn: "Featured",
    badgeIcon: "✨",
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/40",
    description: "عضوة متفوقة ذات إنجازات عالية ونقاط خبرة متقدمة",
    verifiedMark: true,
  },
  vip: {
    id: "vip",
    label: "عضوة VIP",
    labelEn: "VIP",
    badgeIcon: "👑",
    colorClass: "text-violet-600 dark:text-violet-300",
    bgClass: "bg-violet-500/15",
    borderClass: "border-violet-500/40",
    description: "حساب ملكي ذو اشتراك VIP وصلاحيات حصرية",
    verifiedMark: true,
  },
  influencer: {
    id: "influencer",
    label: "حساب مؤثر / مشهور",
    labelEn: "Verified Influencer",
    badgeIcon: "⭐",
    colorClass: "text-sky-600 dark:text-sky-400",
    bgClass: "bg-sky-500/15",
    borderClass: "border-sky-500/40",
    description: "شخصية مشهورة أو صانعة محتوى معتمدة في الجمال",
    verifiedMark: true,
  },
  business: {
    id: "business",
    label: "نشاط تجاري معتمد",
    labelEn: "Business Account",
    badgeIcon: "💼",
    colorClass: "text-cyan-600 dark:text-cyan-400",
    bgClass: "bg-cyan-500/15",
    borderClass: "border-cyan-500/40",
    description: "علامة تجارية أو متجر تجميل معتمد في التطبيق",
    verifiedMark: true,
  },
};

export function getAccountTierMeta(tier?: AccountTier | string | null): AccountTierMeta {
  if (!tier || !(tier in ACCOUNT_TIERS)) {
    return ACCOUNT_TIERS.standard;
  }
  return ACCOUNT_TIERS[tier as AccountTier];
}
