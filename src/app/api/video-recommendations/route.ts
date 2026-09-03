import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { checkFeatureGate, recordFeatureUse } from "@/lib/feature-gate";
import { BEAUTY_VIDEOS } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReqBody {
  skinType?: string | null;
  concerns?: string[];
  goals?: string[];
  watchedIds?: string[];
}

const SKIN_TYPE_AR: Record<string, string> = {
  oily: "دهنية",
  dry: "جافة",
  combination: "مختلطة",
  normal: "عادية",
  sensitive: "حساسة",
};

const PROMPT = `أنتِ خبيرة تجميل توصي بمقاطع فيديو تعليمية للمستخدمة. بناءً على ملف بشرتها والفيديوهات المتاحة، اختاري 3 فيديوهات الأكثر فائدة لها.

أعطي النتيجة JSON صالحًا فقط بالبنية:
{
  "intro": "<جملة افتتاحية شخصية بالعربية تشرح لماذا اخترتِ هذه الفيديوهات>",
  "videoIds": ["<id 1>", "<id 2>", "<id 3>"]
}

اختاري من القائمة المتاحة فقط. أرجعي JSON صالحًا فقط.`;

interface VideoRecResult {
  intro: string;
  videoIds: string[];
}

export async function POST(req: NextRequest) {
  try {
    if (await checkAiRateLimit(req, "video-recommendations", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const gate = await checkFeatureGate(req, "videoRecommendations", "video-recommendations");
    if (!gate.ok) return gate.response;

    const body = (await req.json()) as ReqBody;
    const { skinType, concerns, goals, watchedIds } = body;

    const available = BEAUTY_VIDEOS.filter(
      (v) => !watchedIds?.includes(v.id)
    );

    const videoList = available
      .map(
        (v) =>
          `- id: ${v.id} | "${v.title}" | فئة: ${v.category} | يناسب: ${
            v.bestFor?.join("، ") || "الجميع"
          }`
      )
      .join("\n");

    const ctx = `ملف المستخدمة:
- نوع البشرة: ${skinType ? SKIN_TYPE_AR[skinType] || skinType : "غير محدد"}
- المشاكل: ${concerns?.length ? concerns.join("، ") : "عامة"}
- الأهداف: ${goals?.length ? goals.join("، ") : "عامة"}

الفيديوهات المتاحة:
${videoList || "لا توجد فيديوهات متاحة"}`;

    const parsed = await aiService.chatJson<VideoRecResult>(PROMPT, ctx);

    if (!Array.isArray(parsed.videoIds)) parsed.videoIds = [];
    if (!parsed.intro) {
      parsed.intro = "اخترتُ لكِ هذه الفيديوهات بناءً على احتياجات بشرتكِ ✦";
    }

    // Filter to valid ids only, max 3
    parsed.videoIds = parsed.videoIds
      .filter((id) => BEAUTY_VIDEOS.some((v) => v.id === id))
      .slice(0, 3);

    const usage = await recordFeatureUse(
      gate.userRef,
      "videoRecommendations",
      "video-recommendations",
      gate.usageCount,
      gate.isPremium,
      gate.limit
    );

    return NextResponse.json({ ...parsed, usage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[video-recommendations] error:", msg);
    return NextResponse.json(
      { error: "تعذّر توليد توصيات الفيديو" },
      { status: 500 }
    );
  }
}
