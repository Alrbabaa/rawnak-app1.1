import type { View } from "@/lib/store";
import {
  MessageCircleHeart,
  Sparkles,
  Camera,
  GraduationCap,
  CalendarHeart,
  Trophy,
  Wand2,
} from "lucide-react";

export interface DiscoveryCard {
  id: string;
  icon: typeof MessageCircleHeart;
  badge: string;
  actionText: string;
  title: string;
  subtitle: string;
  view: View;
  /** Only shown while true — once the user has tried the feature, it stops
      taking up space. Evergreen cards (no condition) always qualify. */
  showWhile?: (ctx: { analyses: number; scans: number; chatMessages: number }) => boolean;
}

export const DISCOVERY_CARDS: DiscoveryCard[] = [
  {
    id: "meet-expert",
    icon: MessageCircleHeart,
    badge: "خبيرة الجمال الذكية",
    actionText: "تحدثي مع الخبيرة ✦",
    title: "مستشارتكِ الشخصية 24/7",
    subtitle: "اسألي رَونق أي سؤال عن بشرتكِ والمواد الفعالة وتوافق المنتجات في أي وقت",
    view: "chat",
    showWhile: (c) => c.chatMessages === 0,
  },
  {
    id: "organize-cabinet",
    icon: Sparkles,
    badge: "خزانة المكياج والمنتجات",
    actionText: "افتحي الخزانة ✦",
    title: "نظّمي مجموعتكِ وافحصي الانتهاء",
    subtitle: "امسحي منتجاتكِ بالكاميرا، تتبعي تاريخ الصلاحية، ورتبي روتينكِ بذكاء",
    view: "cabinet",
    showWhile: (c) => c.scans === 0,
  },
  {
    id: "beauty-academy",
    icon: GraduationCap,
    badge: "أكاديمية الجمال",
    actionText: "تصفحي المقالات ✦",
    title: "دروس ودلائل العناية بالبشرة",
    subtitle: "مقالات موثوقة ونشاطات تعلّم تختصر عليكِ الطريق نحو التوهج المستمر",
    view: "academy",
  },
  {
    id: "start-journey",
    icon: Camera,
    badge: "تحليل الكاميرا الذكي",
    actionText: "حللي بشرتكِ الآن ✦",
    title: "كشف حالة البشرة بالذكاء الاصطناعي",
    subtitle: "صورة واحدة كافية لتحديد نوع بشرتكِ والاحتياجات الأساسية بدقة",
    view: "analysis",
    showWhile: (c) => c.analyses === 0,
  },
  {
    id: "plan-occasion",
    icon: CalendarHeart,
    badge: "مخطط المناسبات",
    actionText: "خططي لإطلالتكِ ✦",
    title: "تجهيز وتنسيق الإطلالات",
    subtitle: "خطة عناية ومكياج مخصصة خطوة بخطوة لكل مناسبة خاصة بانتظاركِ",
    view: "planner",
  },
  {
    id: "achievements",
    icon: Trophy,
    badge: "شارات التحدي",
    actionText: "استكشفي الشارات ✦",
    title: "إنجازات ومكافآت التزامكِ",
    subtitle: "شارات جديدة تُفتح وتُوج بإنجازات مع كل خطوة في رحلة العناية",
    view: "achievements",
  },
  {
    id: "style-studio",
    icon: Wand2,
    badge: "استوديو الإطلالة",
    actionText: "نسّقي إطلالتكِ ✦",
    title: "ترندات ولوحات ألوان ومنسّقة إطلالة",
    subtitle: "اجمعي الفستان والحجاب والمجوهرات والإكسسوار بنقرة واحدة، واستلهمي من الترندات",
    view: "style",
  },
];

/** Picks up to `limit` cards: unexplored core features first, then
    evergreen suggestions to fill remaining slots — never more than a
    small handful, so it teaches without nagging. */
export function pickDiscoveryCards(
  ctx: { analyses: number; scans: number; chatMessages: number },
  limit = 4
): DiscoveryCard[] {
  const unexplored = DISCOVERY_CARDS.filter((c) => c.showWhile?.(ctx));
  const evergreen = DISCOVERY_CARDS.filter((c) => !c.showWhile);
  const combined = [...unexplored, ...evergreen];
  const seen = new Set<string>();
  const result: DiscoveryCard[] = [];
  for (const card of combined) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    result.push(card);
    if (result.length >= limit) break;
  }
  return result;
}
