// Shared admin helpers & types (no React; safe to import from client components)

export interface Pick {
  id: string;
  name: string;
  brand: string;
  department: string; // ProductDepartment id (beauty, makeup, fragrance, electronics, fashion, accessories)
  category: string;
  description?: string;
  price: string;
  store: string;
  purchaseUrl: string;
  emoji: string;
  /** Real uploaded product photo (Firebase Storage URL). Falls back to `emoji` in the UI. */
  photoUrl?: string | null;
  /** ISO2 country codes this product ships to / is sold in, or ["GLOBAL"] for everywhere. */
  countries: string[];
  rating: number;
  reasons: string[];
  bestFor: string[];
  published: boolean;
  createdAt?: string;
  order?: number;
  trending?: boolean;
  engagementCount?: number;
}

export interface Video {
  id: string;
  title: string;
  youtubeId: string;
  category: string;
  channel: string;
  duration: string;
  description: string;
  thumbnail: string | null;
  featured: boolean;
  published: boolean;
  relatedProductNames: string[];
  bestFor: string[];
  keyTakeaways?: string[];
  createdAt?: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  coverEmoji: string;
  readMinutes: number;
  bestFor: string[];
  published: boolean;
  createdAt?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  skinType: string | null;
  skinTone: string | null;
  createdAt: string;
  lastActive: string;
  analysesCount: number;
  cabinetCount: number;
  activityCount: number;
  assignedAdminId?: string | null;
  assignedAdminName?: string | null;
  referralInvitesCount: number;
}

export interface AdminAccount {
  id: string;
  email: string;
  name: string | null;
}

export interface DailyNewUser {
  date: string;
  count: number;
}

export interface TopEvent {
  event: string;
  count: number;
}

export interface RecentActivity {
  id: string;
  event: string;
  email: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsData {
  metrics: {
    totalUsers: number;
    activeToday: number;
    activeWeek: number;
    activeMonth: number;
    totalAnalyses: number;
    totalCabinet: number;
    totalPicks: number;
    totalVideos: number;
    totalArticles: number;
  };
  charts: {
    dailyNewUsers: DailyNewUser[];
    topEvents: TopEvent[];
  };
  recentActivities: RecentActivity[];
}

export interface ReferralPartnerStats {
  totalRegistrations: number;
  totalClicks: number | null; // null = not tracked yet (placeholder)
  totalPremiumSubscriptions: number; // placeholder — no billing provider connected
  estimatedRevenueCents: number; // placeholder
  estimatedCommissionCents: number; // placeholder
}

export interface ReferredUser {
  referralId: string;
  userId: string;
  name: string | null;
  email: string;
  registeredAt: string;
  subscriptionStatus: string; // placeholder ("none" until billing exists)
}

export interface ReferralPartner {
  id: string;
  name: string;
  email: string | null;
  referralCode: string;
  discountPercentage: number;
  commissionPercentage: number;
  status: "active" | "inactive";
  notes: string | null;
  createdAt: string;
  stats: ReferralPartnerStats;
  referredUsers: ReferredUser[];
}

export function parseList(value: string): string[] {
  return value
    .split(/[,\n،]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ar", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// Friendly Arabic labels for activity events
const EVENT_LABELS: Record<string, string> = {
  skin_analysis: "تحليل البشرة",
  chat: "محادثة المساعد",
  product_scan: "مسح منتج",
  cabinet_add: "إضافة للخزانة",
  video_watch: "مشاهدة فيديو",
  article_read: "قراءة مقال",
  recommendation: "توصيات",
  nutrition: "نصائح التغذية",
  weather_tips: "نصائح الطقس",
  planner: "مخطط المناسبات",
  routine: "بناء روتين",
  signup: "تسجيل",
  login: "دخول",
  onboarding_complete: "إكمال الملف",
};

export function eventLabel(event: string): string {
  return EVENT_LABELS[event] || event;
}
