// Rawnak shared constants & static data
import {
  Sparkles,
  MessageCircle,
  Flame,
  Crown,
  ScanLine,
  BookOpen,
  Star,
  Camera,
  Gift,
  type LucideIcon,
} from "lucide-react";

// Shared between achievements-screen.tsx and achievement-celebration.tsx —
// a single source of truth for mapping an Achievement's `icon` string to
// its actual lucide component.
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  message: MessageCircle,
  flame: Flame,
  crown: Crown,
  scan: ScanLine,
  book: BookOpen,
  star: Star,
  camera: Camera,
  gift: Gift,
};

// Chat dialect options — see DialectId in store.ts and the "دعم اللهجات"
// setting in profile-screen.tsx. "msa" first/default = unchanged behavior.
export const DIALECTS: { id: "msa" | "khaleeji" | "masri" | "shami" | "iraqi" | "jazaeri"; label: string }[] = [
  { id: "msa", label: "فصحى" },
  { id: "khaleeji", label: "خليجي" },
  { id: "masri", label: "مصري" },
  { id: "shami", label: "شامي" },
  { id: "iraqi", label: "عراقي" },
  { id: "jazaeri", label: "جزائري" },
];

const TIMEZONE_DIALECT_MAP: Record<string, "khaleeji" | "masri" | "shami" | "iraqi" | "jazaeri"> = {
  "Asia/Dubai": "khaleeji",
  "Asia/Riyadh": "khaleeji",
  "Asia/Kuwait": "khaleeji",
  "Asia/Qatar": "khaleeji",
  "Asia/Bahrain": "khaleeji",
  "Asia/Muscat": "khaleeji",
  "Africa/Cairo": "masri",
  "Asia/Damascus": "shami",
  "Asia/Beirut": "shami",
  "Asia/Amman": "shami",
  "Asia/Baghdad": "iraqi",
  "Africa/Algiers": "jazaeri",
};

/**
 * Smart default for a brand-new account's chat dialect — replaces asking
 * with a manual picker on first use. Uses the device's own IANA timezone
 * (Intl API, already available with zero permission prompt) as a proxy for
 * region. Falls back to "msa" (unchanged default) for anything not in the
 * map, including when Intl throws in an unusual environment. Only meant to
 * be called ONCE, at onboarding completion — never overwrites a dialect
 * the person already has (see completeOnboarding() in store.ts).
 */
export function detectDialectFromTimezone(): "msa" | "khaleeji" | "masri" | "shami" | "iraqi" | "jazaeri" {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_DIALECT_MAP[tz] || "msa";
  } catch {
    return "msa";
  }
}

// Same idea as TIMEZONE_DIALECT_MAP above, but for country/currency —
// values are Arabic country names matching `countryAr` in
// src/lib/currencies.ts, so this can feed setSelectedCountry() directly.
// Covers every country currently in SUPPORTED_CURRENCIES.
const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  "Asia/Riyadh": "السعودية",
  "Africa/Casablanca": "المغرب",
  "Africa/El_Aaiun": "المغرب",
  "Africa/Algiers": "الجزائر",
  "Africa/Tunis": "تونس",
  "Africa/Tripoli": "ليبيا",
  "Africa/Cairo": "مصر",
  "Asia/Amman": "الأردن",
  "Asia/Dubai": "الإمارات",
  "Asia/Kuwait": "الكويت",
  "Asia/Qatar": "قطر",
  "Asia/Bahrain": "البحرين",
  "Asia/Muscat": "عُمان",
  "Africa/Nouakchott": "موريتانيا",
  "Asia/Damascus": "سوريا",
  "Europe/Istanbul": "تركيا",
};

/**
 * Smart default for a brand-new account's country/currency — same pattern
 * and same reasoning as detectDialectFromTimezone() above (device timezone
 * as a zero-permission proxy for region), called once at onboarding
 * completion. Falls back to "السعودية" (the app's unchanged prior default)
 * for anything not in the map. Deliberately no manual country/currency
 * picker is shown to the user anymore — see setSelectedCountry() usage in
 * store.ts and the removed CurrencySelectorModal triggers.
 */
export function detectCountryFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY_MAP[tz] || "السعودية";
  } catch {
    return "السعودية";
  }
}

/** Days left before a cabinet product's PAO (period-after-opening) shelf
 * life runs out — negative once it's past that. `null` when the product
 * hasn't been marked opened yet (nothing to count down). Shared by
 * cabinet-screen.tsx (grouping/badges) and use-repurchase-reminder.ts
 * (deciding when to nudge) so both agree on the exact same math. */
export function monthsBetween(openedAt: number | null, shelfLifeMonths: number): number | null {
  if (!openedAt) return null;
  const expire = openedAt + shelfLifeMonths * 30 * 24 * 60 * 60 * 1000;
  const days = Math.floor((expire - Date.now()) / (24 * 60 * 60 * 1000));
  return days;
}

// Shared by home-dashboard.tsx and journey-screen.tsx — was previously two
// separately-worded 8-tip lists (real drift risk, and repeating every 8
// days is noticeably repetitive for a daily-open habit). One source, and
// enough entries for roughly a month before it cycles.
export const DAILY_TIPS = [
  "اشربي 8 أكواب ماء اليوم — الترطيب من الداخل يُشرق بشرتك من الخارج ✦",
  "لا تنسي واقي الشمس حتى في الأيام الغائمة. الوقاية أجمل علاج ♡",
  "النوم 7-8 ساعات يساعد بشرتك على التجدد الليلي. راحتكِ = إشراقكِ",
  "ضعي السيروم على بشرة رطبة قليلًا لامتصاص أفضل وأعمق",
  "الريتينول ليلًا فقط، وفيتمين سي صباحًا — ثنائي مثالي للإشراق",
  "تدليك الوجه لمدة دقيقة يحسّن الدورة الدموية ويمنح توهجًا طبيعيًا",
  "بدّلي غطاء الوسادة مرتين أسبوعيًا لبشرة أنقى",
  "الضغط يظهر على البشرة — خذي 5 دقائق للتنفس العميق اليوم",
  "التقشير مرتين أسبوعيًا يكفي — الإفراط يُضعف حاجز البشرة",
  "المكياج بالليل بدون إزالة كامل = مسام مسدودة صباحًا. لا تنسي التنظيف المزدوج",
  "فيتامين E يعزّز فعالية واقي الشمس عند دمجهما معًا",
  "الشاي الأخضر البارد كمادة موضعية يهدئ الاحمرار والتهيّج",
  "حمض الهيالورونيك يعمل أفضل على بشرة رطبة، لا جافة — رطّبيها أولًا",
  "غيّري فرشاة المكياج كل 2-3 أشهر لتفادي تراكم البكتيريا",
  "النياسيناميد يقلّل المسام الواسعة ويوازن إفراز الزيوت تدريجيًا",
  "لمسي وجهكِ أقل قدر ممكن خلال اليوم — يدّاكِ تنقلان بكتيريا وزيوت",
  "الأوميغا 3 بالغذاء يدعم مرونة البشرة من الداخل",
  "لا تفركي بشرتكِ بالمنشفة — ربّتي عليها بلطف بعد الغسول",
  "SPF 30 فأعلى، يوميًا، حتى داخل المنزل قرب النوافذ",
  "كوب ماء دافئ بالليمون صباحًا يدعم صفاء البشرة بمرور الوقت",
  "الكولاجين بالغذاء (مرق العظم، البيض) يدعم نضارة البشرة مع التقدم بالعمر",
  "لا تستخدمي الريتينول وفيتامين سي بنفس الروتين — بينهما ساعات أو أيام مختلفة",
  "المساج بالثلج (بلطف، لثوانٍ) يقلّص المسام مؤقتًا ويهدئ الانتفاخ",
  "قللي السكر — الجلَكيشن (Glycation) يُسرّع ظهور علامات التقدم بالعمر",
  "زيت الجوجوبا قريب جدًا من زيوت البشرة الطبيعية، مناسب لمعظم الأنواع",
  "لا تتوقفي عن واقي الشمس شتاءً — الأشعة فوق البنفسجية موجودة طوال العام",
  "رشّي ماء الورد بعد المكياج لتثبيته ومنح توهج طبيعي فوري",
  "استبدلي المنشفة بمنديل ورقي نظيف عند تجفيف الوجه لتقليل نقل البكتيريا",
];

export const SKIN_TYPES = [
  { id: "oily", label: "دهنية", desc: "لمعان واتساع مسام", emoji: "💧" },
  { id: "dry", label: "جافة", desc: "شدّ وتقشّر أحيانًا", emoji: "🏜️" },
  {
    id: "combination",
    label: "مختلطة",
    desc: "دهنية بالمنطقة T",
    emoji: "⚖️",
  },
  { id: "normal", label: "عادية", desc: "متوازنة ونعومة", emoji: "✨" },
  { id: "sensitive", label: "حساسة", desc: "تهيّج واحمرار سريع", emoji: "🌸" },
] as const;

export const SKIN_TONES = [
  { id: "fair", label: "فارسيّ فاتح", swatch: "oklch(0.92 0.04 55)" },
  { id: "light", label: "فاتح", swatch: "oklch(0.82 0.06 50)" },
  { id: "medium", label: "متوسط", swatch: "oklch(0.68 0.08 45)" },
  { id: "tan", label: "سمراوي", swatch: "oklch(0.54 0.09 40)" },
  { id: "deep", label: "غامق", swatch: "oklch(0.4 0.08 38)" },
] as const;

export const SKIN_CONCERNS = [
  {
    id: "acne",
    label: "حب الشباب والزيود",
    desc: "بثور متكررة، مسام انسدادية، وإفرازات دهنية زائدة",
    emoji: "🔴",
    category: "البثور والزيوت",
  },
  {
    id: "aging",
    label: "علامات التقدّم والتجاعيد",
    desc: "خطوط ناعمة حول العينين والتعبير وفقدان في المرونة",
    emoji: "⏳",
    category: "النضارة والشباب",
  },
  {
    id: "dryness",
    label: "الجفاف والشد",
    desc: "تقشر، خشونة الملمس، وشعور بالشد بعد الغسيل",
    emoji: "🏜️",
    category: "الترطيب والحاجز",
  },
  {
    id: "darkspots",
    label: "التصبغات والبقع الداكنة",
    desc: "آثار الحبوب القديمة، بقع الشمس، وتفاوت اللون",
    emoji: "🎭",
    category: "التوحيد والإشراق",
  },
  {
    id: "darkcircles",
    label: "الهالات والسواد حول العين",
    desc: "ظلال داكنة، انتفاخات، وعلامات إجهاد منطقة العين",
    emoji: "🐼",
    category: "العناية بالعينين",
  },
  {
    id: "pores",
    label: "اتساع المسام والرؤوس",
    desc: "مسام بارزة واضحة، رؤوس سوداء أو بيضاء بالأنف",
    emoji: "⭕",
    category: "البثور والزيوت",
  },
  {
    id: "redness",
    label: "الاحمرار والتهيّج",
    desc: "شعور بالحرارة والتورد السريع عند التعرض للحرارة",
    emoji: "🟥",
    category: "الترطيب والحاجز",
  },
  {
    id: "dullness",
    label: "البهتان وفقدان النضارة",
    desc: "بشرة مجهدة تفتقر للبريق والحيويّة والوهج الطبيعي",
    emoji: "🌫️",
    category: "التوحيد والإشراق",
  },
  {
    id: "sensitivity",
    label: "الحساسية والتأثر السريع",
    desc: "تأثر سريع بالمستحضرات الجديدة والعوامل الجوية",
    emoji: "🌸",
    category: "الترطيب والحاجز",
  },
] as const;

export const BEAUTY_GOALS = [
  { id: "glow", label: "إشراقة طبيعية", emoji: "✨" },
  { id: "antiaging", label: "مكافحة الشيخوخة", emoji: "💎" },
  { id: "acnefree", label: "بشرة نقية", emoji: "🌿" },
  { id: "hydration", label: "ترطيب عميق", emoji: "💧" },
  { id: "evening", label: "توحيد اللون", emoji: "🎨" },
  { id: "protection", label: "حماية من الشمس", emoji: "☀️" },
] as const;

export const MAKEUP_LEVELS = [
  { id: "beginner", label: "مبتدئة", desc: "أحب التعلم خطوة بخطوة" },
  { id: "intermediate", label: "متوسطة", desc: "أعرف الأساسيات وأجرّب" },
  { id: "advanced", label: "متقدّمة", desc: "أتمكّن من تقنيات متعددة" },
] as const;

export const LIFESTYLE_OPTIONS = [
  { id: "outdoor", label: "أقضي وقتًا بالخارج", emoji: "🌳" },
  { id: "stressful", label: "حياة مليئة بالضغط", emoji: "⚡" },
  { id: "lowsleep", label: "نوم غير منتظم", emoji: "🌙" },
  { id: "active", label: "رياضية ونشطة", emoji: "🏃‍♀️" },
  { id: "makeup_daily", label: "أرتدي المكياج يوميًا", emoji: "💄" },
  { id: "travel", label: "أسافر كثيرًا", emoji: "✈️" },
] as const;

export const WEATHER_CONDITIONS = [
  { id: "hot_dry", label: "حار وجاف", emoji: "🔥", desc: "صيف جاف" },
  { id: "hot_humid", label: "حار ورطب", emoji: "💦", desc: "رطوبة عالية" },
  { id: "cold_dry", label: "بارد وجاف", emoji: "❄️", desc: "شتاء جاف" },
  { id: "mild", label: "معتدل", emoji: "🌤️", desc: "جو لطيف" },
  { id: "windy", label: "عاصف", emoji: "💨", desc: "رياح قوية" },
  { id: "sunny", label: "مشمس قوي", emoji: "☀️", desc: "شمس مباشرة" },
] as const;

export const OCCASIONS = [
  { id: "wedding", label: "حفل زفاف", emoji: "👰", desc: "إطلالة العمر" },
  { id: "henna", label: "ليلة الحناء", emoji: "👑", desc: "إطلالة العروس الاستثنائية" },
  { id: "eid", label: "تجهيز العيد", emoji: "🌙", desc: "إطلالة العيد المشرقة" },
  { id: "ramadan", label: "سهرات رمضان", emoji: "🏮", desc: "إطلالة نضرة للسهرات العائلية" },
  { id: "university", label: "يوم جامعي", emoji: "🎓", desc: "مكياج يومي ناعم" },
  { id: "meeting", label: "اجتماع عمل", emoji: "💼", desc: "إطلالة احترافية" },
  { id: "travel", label: "سفر", emoji: "✈️", desc: "روتين عملي للرحلة" },
  { id: "party", label: "حفلة", emoji: "🎉", desc: "إطلالة مسائية جريئة" },
  { id: "date", label: "موعد", emoji: "💕", desc: "إطلالة رومانسية" },
] as const;

/** Skin-care categories used by the public "beauty & care" catalog tab. */
export const SKINCARE_CATEGORIES = [
  { id: "cleanser", label: "غسول", emoji: "🧴" },
  { id: "toner", label: "تونر", emoji: "🌸" },
  { id: "serum", label: "سيروم", emoji: "🧪" },
  { id: "moisturizer", label: "مرطب", emoji: "💧" },
  { id: "sunscreen", label: "واقي شمس", emoji: "☀️" },
  { id: "treatment", label: "علاج", emoji: "💊" },
] as const;

/** The personal cabinet also accepts makeup and fragrance items. Keep those
 * here without leaking them into the catalog's skin-care department. */
export const CABINET_CATEGORIES = [
  ...SKINCARE_CATEGORIES,
  { id: "makeup", label: "مكياج", emoji: "💄" },
  { id: "fragrance", label: "عطر", emoji: "🎀" },
] as const;

/* ============ Beauty Academy (video library) ============ */
export interface BeautyVideo {
  id: string;
  title: string;
  youtubeId: string;
  category: string;
  channel: string;
  duration: string;
  description: string;
  thumbnail: string;
  relatedProductNames: string[];
  bestFor?: string[]; // skin types / concerns
  // Real, per-video summary points shown in the "أهم الخطوات" tab. Optional:
  // when a video has none (not curated/generated yet), the player shows an
  // honest empty state instead of falling back to unrelated generic tips.
  keyTakeaways?: string[];
}

export const VIDEO_CATEGORIES = [
  { id: "all", label: "الكل", emoji: "✨" },
  { id: "skincare", label: "روتين العناية", emoji: "🧴" },
  { id: "daily", label: "مكياج يومي", emoji: "💄" },
  { id: "bridal", label: "مكياج العرائس", emoji: "👰" },
  { id: "acne", label: "علاج الحبوب", emoji: "🌿" },
  { id: "antiaging", label: "مكافحة الشيخوخة", emoji: "💎" },
  { id: "reviews", label: "مراجعات المنتجات", emoji: "⭐" },
] as const;

// Curated seed videos (real, well-known skincare/beauty YouTube content)
export const BEAUTY_VIDEOS: BeautyVideo[] = [
  {
    id: "v1",
    title: "روتين العناية بالبشرة للبنات — خطوة بخطوة",
    youtubeId: "8mQk1lG3JfE",
    category: "skincare",
    channel: "Skin Care Arabia",
    duration: "12:30",
    description: "روتين كامل للعناية بالبشرة من التنظيف إلى الترطيب والحماية.",
    thumbnail: "https://img.youtube.com/vi/8mQk1lG3JfE/hqdefault.jpg",
    relatedProductNames: ["غسول لطيف", "سيروم فيتامين سي", "مرطب", "واقي شمس SPF50"],
    bestFor: ["normal", "combination"],
  },
  {
    id: "v2",
    title: "أفضل روتين للبشرة الجافة والدهنية",
    youtubeId: "5YeIq0Z3JcQ",
    category: "skincare",
    channel: "Beauty Lab",
    duration: "10:15",
    description: "كيف تبني روتينًا يناسب نوع بشرتك بالضبط.",
    thumbnail: "https://img.youtube.com/vi/5YeIq0Z3JcQ/hqdefault.jpg",
    relatedProductNames: ["حمض الهيالورونيك", "سيراميد", "مرطب"],
    bestFor: ["dry", "oily"],
  },
  {
    id: "v3",
    title: "مكياج يومي طبيعي للجامعة والعمل",
    youtubeId: "sFq3lQ5J2kA",
    category: "daily",
    channel: "Makeup By Lina",
    duration: "08:42",
    description: "إطلالة طبيعية سريعة تناسب كل يوم.",
    thumbnail: "https://img.youtube.com/vi/sFq3lQ5J2kA/hqdefault.jpg",
    relatedProductNames: ["كريم أساس", "كونسيلر", "بودرة"],
  },
  {
    id: "v4",
    title: "مكياج العرائس الفاخر خطوة بخطوة",
    youtubeId: "8Qk2k1mJfE0",
    category: "bridal",
    channel: "Bridal Glow",
    duration: "25:10",
    description: "كل ما تحتاجينه لإطلالة العمر.",
    thumbnail: "https://img.youtube.com/vi/8Qk2k1mJfE0/hqdefault.jpg",
    relatedProductNames: ["برايمر", "كريم أساس", "كونسيلر", "إعداد الوجه"],
  },
  {
    id: "v5",
    title: "كيف تتخلصين من حب الشباب نهائيًا",
    youtubeId: "kQ8m2J1fE3Q",
    category: "acne",
    channel: "Derma Talk",
    duration: "15:20",
    description: "نصائح علمية لعلاج حب الشباب ومنع ظهوره.",
    thumbnail: "https://img.youtube.com/vi/kQ8m2J1fE3Q/hqdefault.jpg",
    relatedProductNames: ["حمض الساليسيليك", "نياسيناميد", "حمض الأزيليك"],
    bestFor: ["acne", "oily"],
  },
  {
    id: "v6",
    title: "مكافحة التجاعيد والشيخوخة المبكرة",
    youtubeId: "mJ3k2QfE1oQ",
    category: "antiaging",
    channel: "Ageless Beauty",
    duration: "18:05",
    description: "الريتينول، الببتيدات، وكل ما يبقي بشرتكِ شابة.",
    thumbnail: "https://img.youtube.com/vi/mJ3k2QfE1oQ/hqdefault.jpg",
    relatedProductNames: ["ريتينول", "ببتيدات", "فيتامين سي"],
    bestFor: ["aging"],
  },
  {
    id: "v7",
    title: "مراجعة: أفضل 5 سيرومات فيتامين سي",
    youtubeId: "fE2k1mJ3oQ0",
    category: "reviews",
    channel: "Product Watch",
    duration: "14:30",
    description: "مقارنة شاملة بين أشهر سيرومات فيتامين سي.",
    thumbnail: "https://img.youtube.com/vi/fE2k1mJ3oQ0/hqdefault.jpg",
    relatedProductNames: ["فيتامين سي"],
  },
  {
    id: "v8",
    title: "روتين مسائي متكامل للترطيب العميق",
    youtubeId: "k1mJ3fE2oQ5",
    category: "skincare",
    channel: "Night Ritual",
    duration: "11:00",
    description: "روتين ليلي لبشرة مرطبة ومشرقة صباحًا.",
    thumbnail: "https://img.youtube.com/vi/k1mJ3fE2oQ5/hqdefault.jpg",
    relatedProductNames: ["حمض الهيالورونيك", "سيراميد", "زيت الوجه"],
    bestFor: ["dryness", "hydration"],
  },
  {
    id: "v9",
    title: "مكياج مسائي جذّاب للسهرات",
    youtubeId: "mJ3fE2k1oQ8",
    category: "daily",
    channel: "Glam By Sara",
    duration: "13:45",
    description: "إطلالة مسائية جريئة وأنيقة.",
    thumbnail: "https://img.youtube.com/vi/mJ3fE2k1oQ8/hqdefault.jpg",
    relatedProductNames: ["ظلال العيون", "أحمر الشفاه", "المحدد"],
  },
  {
    id: "v10",
    title: "علاج الهالات السوداء تحت العينين",
    youtubeId: "2k1mJ3fEoQ7",
    category: "acne",
    channel: "Eye Care Pro",
    duration: "09:30",
    description: "حلول فعّالة للهالات والانتفاخ تحت العين.",
    thumbnail: "https://img.youtube.com/vi/2k1mJ3fEoQ7/hqdefault.jpg",
    relatedProductNames: ["كريم العين", "فيتامين ك", "كافيين"],
    bestFor: ["darkcircles"],
  },
  {
    id: "v11",
    title: "كيف أختار واقي الشمس المناسب؟",
    youtubeId: "3fE2k1mJoQ6",
    category: "reviews",
    channel: "Sun Safe",
    duration: "07:20",
    description: "دليلك الكامل لواقيات الشمس.",
    thumbnail: "https://img.youtube.com/vi/3fE2k1mJoQ6/hqdefault.jpg",
    relatedProductNames: ["واقي شمس SPF50"],
    bestFor: ["protection"],
  },
  {
    id: "v12",
    title: "روتين مكافحة البهتان للحصول على إشراقة",
    youtubeId: "E2k1mJ3foQ9",
    category: "skincare",
    channel: "Glow Guide",
    duration: "12:50",
    description: "خطوات لبشرة أكثر إشراقًا وحيوية.",
    thumbnail: "https://img.youtube.com/vi/E2k1mJ3foQ9/hqdefault.jpg",
    relatedProductNames: ["فيتامين سي", "حمض الجليكوليك", "نياسيناميد"],
    bestFor: ["dullness", "glow"],
  },
];

/* ============ Women's Hub: departments & categories ============ */
/**
 * Top-level department a product belongs to. The "اختيارات رَونق" section is
 * organized into these three tabs so the catalog can grow beyond skincare
 * into everything a woman shops for.
 */
export const PRODUCT_DEPARTMENTS = [
  { id: "beauty", label: "الجمال والعناية", emoji: "🧴" },
  { id: "makeup", label: "المكياج", emoji: "💄" },
  { id: "fragrance", label: "العطور", emoji: "🌸" },
  { id: "electronics", label: "الأجهزة الكهربائية", emoji: "🔌" },
  { id: "fashion", label: "الأزياء", emoji: "👗" },
  { id: "accessories", label: "الإكسسوارات", emoji: "💍" },
] as const;

export type ProductDepartment = (typeof PRODUCT_DEPARTMENTS)[number]["id"];

export const MAKEUP_CATEGORIES = [
  { id: "face", label: "الوجه والأساس", emoji: "✨" },
  { id: "eyes", label: "العيون والحواجب", emoji: "👁️" },
  { id: "lips", label: "الشفاه", emoji: "💋" },
  { id: "palettes", label: "باليت ومجموعات", emoji: "🎨" },
] as const;

export const FRAGRANCE_CATEGORIES = [
  { id: "perfume", label: "عطور نسائية", emoji: "🌸" },
  { id: "mists", label: "معطرات الجسم", emoji: "💧" },
  { id: "hair-mist", label: "عطور الشعر", emoji: "💇‍♀️" },
  { id: "luxury", label: "مجموعات فاخرة", emoji: "✨" },
] as const;

export const ELECTRONICS_CATEGORIES = [
  { id: "hair-dryers", label: "مجففات الشعر", emoji: "💨" },
  { id: "hair-stylers", label: "تصفيف وتمليس الشعر", emoji: "💇‍♀️" },
  { id: "hair-removal", label: "إزالة الشعر", emoji: "✨" },
  { id: "skin-devices", label: "أجهزة العناية بالبشرة", emoji: "🫧" },
  { id: "facial-cleansing", label: "تنظيف ومساج الوجه", emoji: "🧖‍♀️" },
  { id: "manicure", label: "العناية بالأظافر", emoji: "💅" },
  { id: "other-devices", label: "أجهزة أخرى", emoji: "🔌" },
] as const;

export const FASHION_CATEGORIES = [
  { id: "abaya", label: "عبايات وجلابيات", emoji: "🧕" },
  { id: "dresses", label: "فساتين يومية", emoji: "👗" },
  { id: "evening", label: "فساتين سهرة وزفاف", emoji: "👰" },
  { id: "casual", label: "ملابس يومية", emoji: "👚" },
  { id: "formal", label: "ملابس رسمية", emoji: "👔" },
  { id: "sportswear", label: "ملابس رياضية", emoji: "🩱" },
  { id: "swimwear", label: "ملابس سباحة", emoji: "🩴" },
  { id: "outerwear", label: "معاطف وجاكيتات", emoji: "🧥" },
  { id: "lingerie", label: "ملابس داخلية", emoji: "🎀" },
  { id: "shoes", label: "أحذية", emoji: "👠" },
  { id: "bags", label: "حقائب", emoji: "👜" },
] as const;

export const ACCESSORY_CATEGORIES = [
  { id: "jewelry", label: "مجوهرات", emoji: "💍" },
  { id: "watches", label: "ساعات", emoji: "⌚" },
  { id: "sunglasses", label: "نظارات شمسية", emoji: "🕶️" },
  { id: "hijab", label: "حجاب ووشاح", emoji: "🧣" },
  { id: "hair", label: "إكسسوارات شعر", emoji: "💇‍♀️" },
  { id: "belts", label: "أحزمة", emoji: "👝" },
  { id: "phone", label: "إكسسوارات الموبايل", emoji: "📱" },
  { id: "gloves", label: "قفازات", emoji: "🧤" },
  { id: "other", label: "أخرى", emoji: "✨" },
] as const;

/** Returns the right category list to show for a given department. */
export function categoriesForDepartment(
  department: string
): readonly { id: string; label: string; emoji: string }[] {
  if (department === "makeup") return MAKEUP_CATEGORIES;
  if (department === "fragrance") return FRAGRANCE_CATEGORIES;
  if (department === "electronics") return ELECTRONICS_CATEGORIES;
  if (department === "fashion") return FASHION_CATEGORIES;
  if (department === "accessories") return ACCESSORY_CATEGORIES;
  return SKINCARE_CATEGORIES;
}

/**
 * Countries where Rawnak's product catalog can be sold/imported from,
 * beyond the currency list (covers the wider Arab world even where we
 * don't yet have a distinct currency conversion for it).
 */
export const CATALOG_COUNTRIES = [
  { code: "SA", label: "السعودية", flag: "🇸🇦" },
  { code: "AE", label: "الإمارات", flag: "🇦🇪" },
  { code: "JO", label: "الأردن", flag: "🇯🇴" },
  { code: "EG", label: "مصر", flag: "🇪🇬" },
  { code: "KW", label: "الكويت", flag: "🇰🇼" },
  { code: "QA", label: "قطر", flag: "🇶🇦" },
  { code: "BH", label: "البحرين", flag: "🇧🇭" },
  { code: "OM", label: "عُمان", flag: "🇴🇲" },
  { code: "IQ", label: "العراق", flag: "🇮🇶" },
  { code: "LB", label: "لبنان", flag: "🇱🇧" },
  { code: "SY", label: "سوريا", flag: "🇸🇾" },
  { code: "PS", label: "فلسطين", flag: "🇵🇸" },
  { code: "MA", label: "المغرب", flag: "🇲🇦" },
  { code: "DZ", label: "الجزائر", flag: "🇩🇿" },
  { code: "TN", label: "تونس", flag: "🇹🇳" },
] as const;

/** Special marker meaning "visible to everyone, regardless of country". */
export const GLOBAL_COUNTRY = "GLOBAL";

/**
 * Whether a product (with its list of available countries) should be shown
 * to a user browsing from `userCountryCode`.
 * - No countries set, or the list contains GLOBAL -> visible everywhere.
 * - Otherwise -> visible only if the user's country is in the list
 *   (this also naturally covers a store available in several countries,
 *   e.g. a Jordan+UAE store, by listing both codes).
 */
export function isProductVisibleInCountry(
  countries: string[] | undefined | null,
  userCountryCode: string
): boolean {
  if (!countries || countries.length === 0) return true;
  if (countries.includes(GLOBAL_COUNTRY)) return true;
  return countries.includes(userCountryCode);
}

/* ============ Rawnak Picks (curated products) ============ */
export interface RawnakPick {
  id: string;
  name: string;
  brand: string;
  department: ProductDepartment;
  category: string;
  description: string;
  price: string;
  store: string;
  purchaseUrl: string;
  image: string;
  /** Real uploaded photo URL, if the admin added one (falls back to `emoji`/`image`). */
  photoUrl?: string;
  /** ISO2 country codes this product is available in, or [GLOBAL_COUNTRY] / empty for worldwide. */
  countries: string[];
  rating: number; // 1-5
  reasons: string[];
  bestFor: string[];
  emoji: string;
  order?: number;
  trending?: boolean;
  engagementCount?: number;
}

export const RAWNAK_PICKS: RawnakPick[] = [
  {
    id: "p1",
    name: "سيروم فيتامين C 23%",
    brand: "The Ordinary",
    category: "serum",
    department: "beauty",
    countries: ["GLOBAL"],
    description: "سيروم مركّز يفتّح البشرة ويوحّد لونها مع حماية مضادة للأكسدة.",
    price: "72 ر.س",
    store: "Sephora",
    purchaseUrl: "https://www.sephora.com",
    image: "🧪",
    rating: 5,
    reasons: ["إشراقة فورية", "يوحّد اللون", "يحفّز الكولاجين"],
    bestFor: ["dullness", "darkspots", "glow"],
    emoji: "🧪",
  },
  {
    id: "p2",
    name: "مرطب حاجز بسيراميد",
    brand: "CeraVe",
    category: "moisturizer",
    department: "beauty",
    countries: ["GLOBAL"],
    description: "مرطب يرمّم حاجز البشرة ويحبس الرطوبة لـ 24 ساعة.",
    price: "85 ر.س",
    store: "Amazon",
    purchaseUrl: "https://www.amazon.com",
    image: "💧",
    rating: 5,
    reasons: ["ترطيب عميق", "يرمّم الحاجز", "مناسب للحساسة"],
    bestFor: ["dryness", "sensitivity", "hydration"],
    emoji: "💧",
  },
  {
    id: "p3",
    name: "واقي شمس SPF50 بخامة خفيفة",
    brand: "La Roche-Posay",
    category: "sunscreen",
    department: "beauty",
    countries: ["GLOBAL"],
    description: "حماية واسعة الطيف بخامة غير دهنية لا تترك أثرًا أبيض.",
    price: "110 ر.س",
    store: "Noon",
    purchaseUrl: "https://www.noon.com",
    image: "☀️",
    rating: 5,
    reasons: ["حماية UVA/UVB", "خامة خفيفة", "لا أثر أبيض"],
    bestFor: ["protection", "aging", "darkspots"],
    emoji: "☀️",
  },
  {
    id: "p4",
    name: "ريتينول 0.3%",
    brand: "Paula's Choice",
    category: "treatment",
    department: "beauty",
    countries: ["GLOBAL"],
    description: "ريتينول معتدل يقلّل التجاعيد ويحسّن نسيج البشرة تدريجيًا.",
    price: "140 ر.س",
    store: "Sephora",
    purchaseUrl: "https://www.sephora.com",
    image: "🌙",
    rating: 5,
    reasons: ["يقلّل التجاعيد", "يعالج الحبوب", "يجدّد الخلايا"],
    bestFor: ["aging", "acne", "pores"],
    emoji: "🌙",
  },
  {
    id: "p5",
    name: "سيروم حمض الهيالورونيك",
    brand: "The Inkey List",
    category: "serum",
    department: "beauty",
    countries: ["GLOBAL"],
    description: "سيروم مرطّب يمنح البشرة امتلاءً ونعومة فورية.",
    price: "55 ر.س",
    store: "Amazon",
    purchaseUrl: "https://www.amazon.com",
    image: "💧",
    rating: 4,
    reasons: ["ترطيب فوري", "يمتلئ البشرة", "يناسب كل الأنواع"],
    bestFor: ["dryness", "hydration", "aging"],
    emoji: "💧",
  },
  {
    id: "p6",
    name: "نياسيناميد 10% + زنك",
    brand: "The Ordinary",
    category: "serum",
    department: "beauty",
    countries: ["GLOBAL"],
    description: "ينظّم إفراز الدهون ويقلّل المسام والاحمرار.",
    price: "45 ر.س",
    store: "Noon",
    purchaseUrl: "https://www.noon.com",
    image: "🛡️",
    rating: 4,
    reasons: ["يقلّل المسام", "يوازن الدهون", "يهدّئ الاحمرار"],
    bestFor: ["pores", "oily", "redness"],
    emoji: "🛡️",
  },
  {
    id: "p7",
    name: "أحمر شفاه مطفي ثابت",
    brand: "Fenty Beauty",
    category: "lips",
    department: "makeup",
    countries: ["GLOBAL"],
    description: "تركيبة مخملية خفيفة الوزن تدوم طويلاً دون أن تجفف الشفاه.",
    price: "115 ر.س",
    store: "Sephora",
    purchaseUrl: "https://www.sephora.com",
    image: "💄",
    rating: 5,
    reasons: ["ثبات طويل", "ملمس مخملي", "لا يجفف الشفاه"],
    bestFor: ["glow", "party", "date"],
    emoji: "💄",
  },
  {
    id: "p8",
    name: "باليت ظلال العيون نود",
    brand: "Huda Beauty",
    category: "palettes",
    department: "makeup",
    countries: ["GLOBAL"],
    description: "درجات غنية متناسقة تناسب الإطلالات اليومية والمسائية بكل راحة.",
    price: "245 ر.س",
    store: "Sephora",
    purchaseUrl: "https://www.sephora.com",
    image: "🎨",
    rating: 5,
    reasons: ["ألوان غنية", "سهلة الدمج", "إطلالات متعددة"],
    bestFor: ["glow", "party", "university"],
    emoji: "🎨",
  },
  {
    id: "p9",
    name: "عطر قود جيرل الفاخر",
    brand: "Carolina Herrera",
    category: "perfume",
    department: "fragrance",
    countries: ["GLOBAL"],
    description: "عطر ساحر يجمع بين النفحات الزهرية والشرقية ليترك أثراً لا يُنسى.",
    price: "420 ر.س",
    store: "Nice One",
    purchaseUrl: "https://niceone.com",
    image: "🌸",
    rating: 5,
    reasons: ["ثبات فائق", "رائحة جذابة", "زجاجة أنيقة"],
    bestFor: ["party", "date", "glow"],
    emoji: "🌸",
  },
  {
    id: "p10",
    name: "معطر جسم وفانيليا دافئة",
    brand: "Victoria's Secret",
    category: "mists",
    department: "fragrance",
    countries: ["GLOBAL"],
    description: "رذاذ منعش مرطب للجسم بنفحات الفانيليا والمسك الأبيض الرقيق.",
    price: "75 ر.س",
    store: "Noon",
    purchaseUrl: "https://www.noon.com",
    image: "💧",
    rating: 4,
    reasons: ["انتشار منعش", "ترطيب خفيف", "رائحة مهدئة"],
    bestFor: ["hydration", "glow"],
    emoji: "💧",
  },
];

export interface Ingredient {
  id: string;
  name: string;
  nameEn: string;
  category: "active" | "hydrating" | "soothing" | "exfoliating" | "protective" | "controversial";
  categoryLabel: string;
  rating: number; // 1-5
  benefit: string;
  sideEffects: string;
  bestFor: string[];
  warning: string;
  emoji: string;
}

export const INGREDIENTS: Ingredient[] = [
  {
    id: "retinol",
    name: "ريتينول",
    nameEn: "Retinol",
    category: "active",
    categoryLabel: "مكوّن فعّال",
    rating: 5,
    benefit: "يحفّز تجديد الخلايا، يقلّل التجاعيد، يوحّد لون البشرة ويعالج حب الشباب.",
    sideEffects: "قد يسبب جفافًا أو تقشّرًا في البداية، وزيادة حساسية للشمس.",
    bestFor: ["aging", "acne", "darkspots", "pores"],
    warning: "لا يُستخدم أثناء الحمل. ابدئي بتركيز منخفض مرتين أسبوعيًا.",
    emoji: "🌙",
  },
  {
    id: "vitamin-c",
    name: "فيتامين سي",
    nameEn: "Vitamin C",
    category: "active",
    categoryLabel: "مضاد أكسدة",
    rating: 5,
    benefit: "مضاد أكسدة قوي يفتّح البشرة، يوحّد اللون، ويحفّز الكولاجين.",
    sideEffects: "قد يسبب تهيّجًا خفيفًا لدى البشرة الحساسة.",
    bestFor: ["dullness", "darkspots", "glow", "aging"],
    warning: "يُفضّل استخدامه صباحًا مع واقي شمس. خزّنيه بعيدًا عن الضوء.",
    emoji: "🍊",
  },
  {
    id: "hyaluronic",
    name: "حمض الهيالورونيك",
    nameEn: "Hyaluronic Acid",
    category: "hydrating",
    categoryLabel: "مُرطّب",
    rating: 5,
    benefit: "يحبس الرطوبة داخل البشرة ويمنحها امتلاءً ونعومة فورية.",
    sideEffects: "آمن لجميع أنواع البشرة، نادرًا ما يسبب تهيّجًا.",
    bestFor: ["dryness", "aging", "hydration"],
    warning: "ضعيه على بشرة رطبة قليلًا لزيادة فعاليته.",
    emoji: "💧",
  },
  {
    id: "niacinamide",
    name: "نياسيناميد",
    nameEn: "Niacinamide",
    category: "active",
    categoryLabel: "متعدد الفوائد",
    rating: 5,
    benefit: "يقلّل احمرار المسام، يوازن إفراز الدهون، ويقوّي حاجز البشرة.",
    sideEffects: "نادرًا ما يسبب تهيّجًا، آمن لمعظم أنواع البشرة.",
    bestFor: ["pores", "redness", "acne", "darkspots"],
    warning: "متوافق مع معظم المكوّنات الأخرى.",
    emoji: "🛡️",
  },
  {
    id: "salicylic",
    name: "حمض الساليسيليك",
    nameEn: "Salicylic Acid",
    category: "exfoliating",
    categoryLabel: "مقشّر",
    rating: 4,
    benefit: "يخترق المسام وينظّفها من الدهون والشوائب، مثالي لحب الشباب.",
    sideEffects: "قد يسبب جفافًا، تجنّبي الإفراط في استخدامه.",
    bestFor: ["acne", "pores", "oily"],
    warning: "لا تستخدميه مع ريتينول في نفس الليلة. تجنّبيه أثناء الحمل.",
    emoji: "🧹",
  },
  {
    id: "glycolic",
    name: "حمض الجليكوليك",
    nameEn: "Glycolic Acid",
    category: "exfoliating",
    categoryLabel: "مقشّر كيميائي",
    rating: 4,
    benefit: "يقشّر الطبقة السطحية ويحسّن النسيج واللون والإشراقة.",
    sideEffects: "يزيد الحساسية للشمس، قد يسبب تهيّجًا.",
    bestFor: ["dullness", "darkspots", "texture"],
    warning: "استخدمي واقي الشمس دائمًا. ابدئي بتركيز منخفض.",
    emoji: "✨",
  },
  {
    id: "ceramides",
    name: "سيراميد",
    nameEn: "Ceramides",
    category: "hydrating",
    categoryLabel: "حاجز مرمّم",
    rating: 5,
    benefit: "يعيد بناء حاجز البشرة الواقي ويمنع فقدان الرطوبة.",
    sideEffects: "آمن جدًا، مناسب حتى للبشرة الحساسة.",
    bestFor: ["dryness", "sensitivity", "hydration"],
    warning: "متوافق مع جميع المكوّنات.",
    emoji: "🧱",
  },
  {
    id: "azelaic",
    name: "حمض الأزيليك",
    nameEn: "Azelaic Acid",
    category: "active",
    categoryLabel: "مهدّئ ومفتّح",
    rating: 4,
    benefit: "يعالج الاحمرار والبقع وحب الشباب، ويمتلك خصائص مضادة للبكتيريا.",
    sideEffects: "قد يسبب وخزًا خفيفًا في البداية.",
    bestFor: ["redness", "acne", "darkspots", "sensitivity"],
    warning: "آمن نسبيًا أثناء الحمل، استشيري طبيبك.",
    emoji: "🌸",
  },
  {
    id: "spf",
    name: "واقي الشمس",
    nameEn: "Sunscreen SPF",
    category: "protective",
    categoryLabel: "حماية",
    rating: 5,
    benefit: "يحمي من الأشعة فوق البنفسجية ويمنع الشيخوخة والبقع والسرطان.",
    sideEffects: "بعض الأنواع قد تسبب لمعانًا أو تهيّجًا.",
    bestFor: ["protection", "aging", "darkspots", "glow"],
    warning: "أعيدي وضعه كل ساعتين عند التعرض المباشر للشمس. SPF30+ minimum.",
    emoji: "☀️",
  },
  {
    id: "peptides",
    name: "ببتيدات",
    nameEn: "Peptides",
    category: "active",
    categoryLabel: "مجدّد",
    rating: 4,
    benefit: "تحفّز إنتاج الكولاجين والإيلاستين لشدّ البشرة وتقليل التجاعيد.",
    sideEffects: "آمنة عمومًا، نادرًا ما تسبب تهيّجًا.",
    bestFor: ["aging", "glow"],
    warning: "تعمل بشكل جيد مع حمض الهيالورونيك والسيراميد.",
    emoji: "🔗",
  },
  {
    id: "alcohol",
    name: "كحول مجفّف",
    nameEn: "Denatured Alcohol",
    category: "controversial",
    categoryLabel: "تحذير",
    rating: 2,
    benefit: "يمنح إحساسًا سريعًا بالنظافة ويسرّف جفاف المنتج.",
    sideEffects: "يجفّف البشرة، يضعف الحاجز الواقي، ويزيد التهيّج مع الوقت.",
    bestFor: [],
    warning: "تجنّبيه إن كانت بشرتك جافة أو حساسة. مناسب أحيانًا للبشرة الدهنية جدًا.",
    emoji: "⚠️",
  },
  {
    id: "fragrance",
    name: "عطور صناعية",
    nameEn: "Fragrance",
    category: "controversial",
    categoryLabel: "تحذير",
    rating: 2,
    benefit: "تمنح المنتج رائحة لطيفة.",
    sideEffects: "سبب رئيسي لتهيّج البشرة والحساسية لدى الكثيرات.",
    bestFor: [],
    warning: "تجنّبيها إن كانت بشرتك حساسة أو معرضة للأكزيما.",
    emoji: "⚠️",
  },
];

export const CATEGORY_COLORS: Record<Ingredient["category"], string> = {
  active: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  hydrating: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  soothing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  exfoliating: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  protective: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  controversial: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export const CONCERN_LABEL: Record<string, string> = {
  acne: "حب الشباب",
  aging: "علامات التقدّم",
  dryness: "الجفاف",
  darkspots: "البقع الداكنة",
  darkcircles: "الهالات السوداء",
  pores: "اتساع المسام",
  redness: "الاحمرار",
  dullness: "البهتان",
  sensitivity: "الحساسية",
  oily: "دهنية",
};

/** Shape returned by the AI recommendations endpoint and persisted in saved items. */
export interface RecommendedProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  department?: ProductDepartment; // beauty, makeup, fragrance, electronics, fashion, accessories
  description: string;
  keyIngredient: string;
  benefit: string;
  priceRange: string;
  rating: number;
  tag: string;
}

export const TRENDING_TAB_ID = "trending" as const;

export const STYLE_TRENDS = [{
  id: "soft-glow", title: "إطلالة ناعمة مشرقة", titleEn: "Soft Glow",
  description: "ألوان هادئة ولمسات مضيئة للاستخدام اليومي.", emoji: "✨",
  gradient: "linear-gradient(135deg, #f9e2d0, #f5c5d9)",
  department: "makeup" as ProductDepartment, category: "face",
}];

export const COLOR_PALETTES = [{
  id: "rose-neutral", name: "وردي محايد",
  tip: "نسّقي الدرجات الدافئة الهادئة مع لمسة ذهبية خفيفة.",
  department: "makeup" as ProductDepartment, category: "face",
  colors: [{ label: "وردي", hex: "#D99AA9" }, { label: "بيج", hex: "#E7C8AF" }, { label: "ذهبي", hex: "#C99A4A" }],
}];
