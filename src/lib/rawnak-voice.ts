import type { WeatherNow } from "@/hooks/use-real-weather";

/**
 * Rawnak's "alive" voice — proactive, caring, and companion-focused lines shown on
 * the Home dashboard, AI Chat, and contextual greetings.
 */

const MORNING = [
  "صباح النور والجمال ✦ يوم جديد، وبشرة متألقة بانتظاركِ",
  "صباحكِ يبدأ بلمسة عناية هادئة ✦ كيف تخططين ليومكِ اليوم؟",
  "صباح الورد ✦ روتين الصباح بانتظاركِ لمنحكِ الانتعاش الكامل",
  "إشراقة جديدة لهذا اليوم ✦ لا تنسي واقي الشمس قبل الخروج",
];

const AFTERNOON = [
  "وقت مثالي لاستراحة عناية قصيرة في منتصف اليوم ✦",
  "كيف حال بشرتكِ الآن؟ جربي رشّ ماء ورد أو مرطب خفيف",
  "منتصف اليوم ✦ شرب كوب ماء الآن يمنح بشرتكِ ترطيبًا داخليًا مضاعفًا",
  "يوم حافل؟ خذي دقيقة للتنفس واسترخاء ملامح الوجه ✦",
];

const EVENING = [
  "المساء وقت جميل للاستراخاء وروتين هادئ ينعش روحكِ وبشرتكِ ✦",
  "اعتني ببشرتكِ بعد يوم طويل ✦ إزالة المكياج هي أول خطوات التوهج",
  "روتين المساء ينتظركِ ✦ امنحي نفسكِ لحظات الدلال التي تستحقينها",
  "مساء الأناقة ✦ بشرتكِ تنام وتتجدد معكِ الليلة",
];

const NIGHT = [
  "قبل النوم، خطوة عناية أخيرة لتستيقظي ببشرة مشرفة ناعمة ✦",
  "ليلة هادئة تبدأ بروتين مسائي كامل وتأمل لطيف",
  "بشرتكِ تتجدد وتصلح نفسها أثناء نومكِ — اعتني بها الآن ✦",
  "تصبحين على جمال وتوهج ✦ ليلة سعيدة",
];

function timeOfDayPool(hour: number) {
  if (hour >= 5 && hour < 11) return MORNING;
  if (hour >= 11 && hour < 17) return AFTERNOON;
  if (hour >= 17 && hour < 22) return EVENING;
  return NIGHT;
}

function dayRotatingPick(pool: string[]) {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return pool[dayOfYear % pool.length];
}

function weatherLine(weather: WeatherNow | null): string | null {
  if (!weather) return null;
  if (weather.tempC >= 35) {
    return `الجو حار اليوم (${weather.tempC}°م) ${weather.emoji} — احرصي على ترطيب مضاعف وواقي الشمس`;
  }
  if (weather.tempC <= 12) {
    return `الأجواء باردة اليوم (${weather.tempC}°م) ${weather.emoji} — بشرتكِ تحتاج عناية غنية بالمرطبات كحاجز حماية`;
  }
  if (weather.label.includes("ممطر") || weather.label.includes("رذاذ") || weather.label.includes("غائم")) {
    return `أجواء جميلة ولطيفة اليوم ${weather.emoji} — وقت مثالي لروتينكِ والاستمتاع بتوهجكِ`;
  }
  return null;
}

function streakLine(streak: number): string | null {
  if (streak >= 30) return `شهر كامل من الالتزام والجمال ✦ ${streak} يومًا متتاليًا — أنتِ ملهمة بحق!`;
  if (streak >= 14) return `${streak} يومًا متتاليًا من العناية ✦ التزام رائع يصنع فرقًا حقيقيًا`;
  if (streak >= 7) return `أسبوع كامل بلا انقطاع ✦ ${streak} أيام متتالية، استمري بهذا التوهج`;
  if (streak === 3) return "ثلاثة أيام متتالية ✦ عادة زاهية وجديدة تتشكل في حياتكِ";
  return null;
}

export function getRawnakMessage({
  streak,
  weather,
  now = new Date(),
}: {
  streak: number;
  weather: WeatherNow | null;
  now?: Date;
}): string {
  const weatherMsg = weatherLine(weather);
  if (weatherMsg) return weatherMsg;

  const streakMsg = streakLine(streak);
  if (streakMsg) return streakMsg;

  return dayRotatingPick(timeOfDayPool(now.getHours()));
}

export function getRawnakSubGreeting(userName?: string): string {
  const hour = new Date().getHours();
  const nameStr = userName ? `يا ${userName}` : "عزيزتي";
  if (hour >= 5 && hour < 11) return `صباح الخير والورد ${nameStr} ♡`;
  if (hour >= 11 && hour < 17) return `مساء الخير والنور ${nameStr} ♡`;
  if (hour >= 17 && hour < 22) return `مساء الأناقة والدلال ${nameStr} ♡`;
  return `أوقات هادئة وطيبة ${nameStr} ♡`;
}

