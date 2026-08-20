export interface PartnerDiscountCard {
  id: string;
  partnerName: string;
  branchName?: string; // e.g. "فرع عمان - الأردن", "فرع الرياض", "المتجر الإلكتروني الرئيسي"
  brandLogoUrl?: string;
  bannerImageUrl?: string;
  discountCode: string;
  discountLabel: string; // e.g. "خصم 15% حصري"
  badgeText?: string; // e.g. "عرض محدود", "حصري لعميلات رَونق"
  description?: string;
  storeUrl: string;
  category: "صيدليات" | "متاجر إلكترونية" | "براندات مباشرة" | "عيادات تجميل";
  country:
    | "الجميع"
    | "السعودية"
    | "الإمارات"
    | "الأردن"
    | "مصر"
    | "الكويت"
    | "قطر"
    | "البحرين"
    | "عُمان"
    | "المغرب"
    | "الجزائر"
    | "تونس"
    | "ليبيا"
    | "السودان"
    | "العراق"
    | "لبنان"
    | "فلسطين";
  cardDesign?: "gold" | "rosegold" | "emerald" | "purple" | "obsidian";
  expiresAt?: string; // e.g. "2026-12-31" or ISO string
  pinned: boolean; // Pinned cards show first
  isFeatured?: boolean; // Dedicated featured partner slot
  displayDurationSeconds?: number; // Custom display duration in seconds for automatic rotation
  status: "active" | "inactive" | "expired";
  clickCount: number;
  copyCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export const SEED_PARTNER_CARDS: PartnerDiscountCard[] = [
  {
    id: "card-sephora-jo",
    partnerName: "سيفورا الشرق الأوسط",
    branchName: "فرع عمان والأردن الإلكتروني",
    brandLogoUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=120&h=120&fit=crop",
    bannerImageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=300&fit=crop",
    discountCode: "RAWNAK15",
    discountLabel: "خصم 15% حصري",
    badgeText: "عُروض الأردن",
    description: "كوبون تخفيض حصري لعميلات رَونق على كافّة منتجات العناية بالبشرة والمكياج.",
    storeUrl: "https://sephora.com",
    category: "متاجر إلكترونية",
    country: "الأردن",
    cardDesign: "rosegold",
    expiresAt: "2026-12-31",
    pinned: true,
    isFeatured: false,
    displayDurationSeconds: 10,
    status: "active",
    clickCount: 142,
    copyCount: 289,
    createdAt: new Date().toISOString(),
  },
  {
    id: "card-niceone-ksa",
    partnerName: "نايس ون (Nice One)",
    branchName: "الفرع الرئيسي - السعودية والخليج",
    brandLogoUrl: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=120&h=120&fit=crop",
    bannerImageUrl: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&h=300&fit=crop",
    discountCode: "RAWNAK20",
    discountLabel: "خصم 20% بحد أقصى",
    badgeText: "الأعلى استخدماً 🔥",
    description: "تخفيض مباشر على السيرومات والعطور ومنتجات العناية الأصلية 100%.",
    storeUrl: "https://niceone.com",
    category: "متاجر إلكترونية",
    country: "السعودية",
    cardDesign: "gold",
    expiresAt: "2026-11-30",
    pinned: true,
    isFeatured: true, // Featured VIP partner card slot
    displayDurationSeconds: 15,
    status: "active",
    clickCount: 310,
    copyCount: 520,
    createdAt: new Date().toISOString(),
  },
  {
    id: "card-parapharma-ma",
    partnerName: "بارافارماسي أندلس الدار البيضاء",
    branchName: "فرع المعاريف - المغرب",
    brandLogoUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=120&h=120&fit=crop",
    bannerImageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&h=300&fit=crop",
    discountCode: "RAWNAKMA",
    discountLabel: "خصم 20% على المنتجات الفرنسية والمحلية",
    badgeText: "شريك مميز شمال إفريقيا 🇲🇦",
    description: "خصم خاص لعميلات رَونق في المغرب على منتجات العناية الطبية بالبشرة والشعر.",
    storeUrl: "https://parapharma.ma",
    category: "صيدليات",
    country: "المغرب",
    cardDesign: "emerald",
    expiresAt: "2026-12-31",
    pinned: true,
    isFeatured: false,
    displayDurationSeconds: 12,
    status: "active",
    clickCount: 188,
    copyCount: 312,
    createdAt: new Date().toISOString(),
  },
  {
    id: "card-dz-cosmetics",
    partnerName: "صيدلية الجزائر الكبرى",
    branchName: "حيدرة - الجزائر العاصمة",
    brandLogoUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=120&h=120&fit=crop",
    bannerImageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&h=300&fit=crop",
    discountCode: "RAWNAKDZ",
    discountLabel: "تخفيض 15% على مستحضرات التجميل والعناية",
    badgeText: "عروض الجزائر 🇩🇿",
    description: "كوبون معتمد لعميلات رَونق في الجزائر لتسوق أفضل ماركات التجميل والعناية الطبيعية.",
    storeUrl: "https://dz-cosmetics.com",
    category: "صيدليات",
    country: "الجزائر",
    cardDesign: "rosegold",
    expiresAt: "2026-12-31",
    pinned: false,
    isFeatured: false,
    displayDurationSeconds: 10,
    status: "active",
    clickCount: 145,
    copyCount: 230,
    createdAt: new Date().toISOString(),
  },
  {
    id: "card-tunis-beauty",
    partnerName: "تونس بيوتي بوتيك",
    branchName: "المرسى - تونس",
    brandLogoUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=120&h=120&fit=crop",
    bannerImageUrl: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=300&fit=crop",
    discountCode: "RAWNAKTN",
    discountLabel: "خصم 20 دينار تونسي",
    badgeText: "شريك تونس 🇹🇳",
    description: "عروض حصرية على منتجات العناية بالبشرة العضوية والمكياج في تونس.",
    storeUrl: "https://tunisbeauty.tn",
    category: "براندات مباشرة",
    country: "تونس",
    cardDesign: "purple",
    expiresAt: "2026-12-31",
    pinned: false,
    isFeatured: false,
    displayDurationSeconds: 10,
    status: "active",
    clickCount: 112,
    copyCount: 195,
    createdAt: new Date().toISOString(),
  },
  {
    id: "card-dermaceutic-eg",
    partnerName: "ديرماكير التخصصي",
    branchName: "فرع القاهرة والجيزة - مصر",
    brandLogoUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=120&h=120&fit=crop",
    bannerImageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&h=300&fit=crop",
    discountCode: "GLOW10",
    discountLabel: "خصم 10% على واقيات الشمس",
    badgeText: "صيدليات معتمدة",
    description: "خصم خاص لعائلة رَونق بمصر على المستحضرات العلاجية والطبية.",
    storeUrl: "https://dermacare.com",
    category: "صيدليات",
    country: "مصر",
    cardDesign: "emerald",
    expiresAt: "2026-10-15",
    pinned: false,
    isFeatured: false,
    displayDurationSeconds: 10,
    status: "active",
    clickCount: 95,
    copyCount: 160,
    createdAt: new Date().toISOString(),
  },
  {
    id: "card-glow-ae",
    partnerName: "بوتيك غلو ريسبي الإمارات",
    branchName: "فرع دبي مول - الإمارات",
    brandLogoUrl: "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=120&h=120&fit=crop",
    bannerImageUrl: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&h=300&fit=crop",
    discountCode: "RAWNAK30",
    discountLabel: "خصم 30 د.إ مباشر",
    badgeText: "خصم مباشر VIP",
    description: "استمتعي بخصم مباشر عند تسوق مجموعات النضارة والترطيب الفائق.",
    storeUrl: "https://glowrecipe.ae",
    category: "براندات مباشرة",
    country: "الإمارات",
    cardDesign: "purple",
    expiresAt: "2026-12-01",
    pinned: false,
    isFeatured: false,
    displayDurationSeconds: 10,
    status: "active",
    clickCount: 205,
    copyCount: 340,
    createdAt: new Date().toISOString(),
  },
];
