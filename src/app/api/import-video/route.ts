import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/admin-auth";
import { extractYouTubeId, isValidYouTubeId } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReqBody {
  urlOrTopic: string;
}

// Admin-only content-authoring helper — see import-article/route.ts for why
// this needs a real auth check, not just rate limiting.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

    if (await checkAiRateLimit(req, "import-video", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ReqBody;
    const input = body.urlOrTopic?.trim();

    if (!input) {
      return NextResponse.json(
        { error: "يرجى تقديم رابط فيديو يوتيوب أو عنوان/موضوع الدرس" },
        { status: 400 }
      );
    }

    const youtubeId = extractYouTubeId(input);
    let oembedData: { title?: string; author_name?: string } = {};

    if (youtubeId) {
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`,
          { headers: { "User-Agent": "Mozilla/5.0" } }
        );
        if (oembedRes.ok) {
          oembedData = await oembedRes.json();
        }
      } catch {
        // Fallback to AI generation if oembed fails
      }
    }

    // The AI is only ever used to draft descriptive metadata (title,
    // category, description, related products). It must NEVER be trusted
    // to invent the YouTube video ID itself — that has to come from a real
    // link the admin pasted in (verified below via YouTube's own oEmbed
    // endpoint), never from a model guess. This is what previously let a
    // failed/topic-only import silently fall back to a hardcoded, unrelated
    // video ID and present it as if it were the real imported video.
    const systemPrompt = "أنتِ خبيرة ومحررة معتمدة لإعداد محتوى أكاديمية الجمال والتجميل. أرجعي JSON صالحاً فقط بالمخطط المطلوب. لا تخترعي أبدًا معرّف فيديو يوتيوب.";

    const userPrompt = `نقوم بإضافة درس فيديو جديد لأكاديمية الجمال.
${youtubeId ? `معرّف الفيديو المعتمد (حقيقي، تم استخراجه من الرابط): "${youtubeId}"` : "لم يُقدَّم رابط يوتيوب صالح — هذا استيراد بموضوع نصي فقط."}
${oembedData.title ? `عنوان الفيديو الفعلي من يوتيوب: "${oembedData.title}"` : ""}
${oembedData.author_name ? `اسم القناة الفعلي: "${oembedData.author_name}"` : ""}
المُدخل الإضافي أو الموضوع: "${input}"

أرجعي JSON صالحًا فقط بالبنية التالية (لا تضمّني حقل youtubeId إطلاقًا، سيُحدَّد ذلك برمجيًا من الرابط الحقيقي فقط):
{
  "title": "<عنوان جذاب ومناسب للدرس باللغة العربية>",
  "category": "<skincare | daily | bridal | acne | antiaging | reviews>",
  "channel": "<اسم القناة إن كان معروفًا، وإلا اتركيه فارغًا>",
  "duration": "<المدة التقديرية بالدقائق والثواني مثل 08:45>",
  "description": "<وصف تعليمي دقيق ومفيد للدرس وما ستتعلمه المشاهدة، مبني على عنوان الفيديو الفعلي فقط>",
  "keyTakeaways": ["<نقطة عملية 1 مرتبطة تحديدًا بعنوان هذا الفيديو>", "<نقطة عملية 2>", "<نقطة عملية 3>"],
  "relatedProductNames": ["<اسم منتج متعلق 1>", "<اسم منتج متعلق 2>", "<اسم منتج متعلق 3>"],
  "bestFor": ["<normal | dry | oily | combination | sensitive | acne | aging>"]
}

تنبيه مهم: ليس لديكِ إمكانية مشاهدة الفيديو الفعلي أو الوصول لنصه أو ترجمته — استندي فقط إلى العنوان الحقيقي والموضوع المُعطى، ولا تختلقي تفاصيل محددة (كأرقام دقائق أو خطوات حرفية) تدّعين أنها من داخل الفيديو نفسه. اجعلي "description" و"keyTakeaways" عامة بما يكفي لتصف موضوع الفيديو المرجّح دون الادعاء بمعرفة تفاصيله الدقيقة.`;

    const imported = await aiService.chatJson<{
      title: string;
      category: string;
      channel: string;
      duration: string;
      description: string;
      keyTakeaways: string[];
      relatedProductNames: string[];
      bestFor: string[];
    }>(systemPrompt, userPrompt);

    // The only source of truth for the video ID is the input the admin
    // actually gave us — a real, verifiable YouTube link/ID. If none was
    // found, we return the drafted metadata (still useful as a starting
    // point) but leave youtubeId empty and flag it, instead of fabricating
    // a placeholder video that isn't the one the admin meant to add.
    const finalYoutubeId = isValidYouTubeId(youtubeId) ? youtubeId : "";

    if (!finalYoutubeId) {
      return NextResponse.json({
        title: imported.title || oembedData.title || "درس عناية جديد",
        youtubeId: "",
        category: imported.category || "skincare",
        channel: oembedData.author_name || imported.channel || "",
        duration: imported.duration || "10:00",
        description: imported.description || "شرح عملي مفصل لخطوات العناية والجمال.",
        thumbnail: "",
        keyTakeaways: Array.isArray(imported.keyTakeaways) ? imported.keyTakeaways : [],
        relatedProductNames: Array.isArray(imported.relatedProductNames) ? imported.relatedProductNames : [],
        bestFor: Array.isArray(imported.bestFor) ? imported.bestFor : ["normal"],
        warning: "لم يتم العثور على رابط يوتيوب صالح ضمن ما أدخلتِه. تم توليد بيانات الدرس المقترحة فقط — يرجى لصق رابط الفيديو الحقيقي على يوتيوب وإدخال معرّفه يدويًا قبل الحفظ.",
      });
    }

    // We have a real, verified (or at least well-formed) YouTube ID —
    // prefer YouTube's own oEmbed data for the title/channel since that's
    // ground truth from the source, and only fall back to the AI draft for
    // fields oEmbed doesn't provide. The description/keyTakeaways are an AI
    // draft based on the real title only (never on footage the AI can't
    // access) — surfaced as an editable starting point for the admin to
    // review and correct before publishing, not as a verified transcript.
    return NextResponse.json({
      title: oembedData.title || imported.title || "درس عناية جديد",
      youtubeId: finalYoutubeId,
      category: imported.category || "skincare",
      channel: oembedData.author_name || imported.channel || "",
      duration: imported.duration || "10:00",
      description: imported.description || "شرح عملي مفصل لخطوات العناية والجمال.",
      thumbnail: `https://img.youtube.com/vi/${finalYoutubeId}/hqdefault.jpg`,
      keyTakeaways: Array.isArray(imported.keyTakeaways) ? imported.keyTakeaways : [],
      relatedProductNames: Array.isArray(imported.relatedProductNames) ? imported.relatedProductNames : [],
      bestFor: Array.isArray(imported.bestFor) ? imported.bestFor : ["normal"],
      note: "الوصف وأهم الخطوات مُولَّدة تلقائيًا استنادًا إلى عنوان الفيديو فقط (وليس مشاهدة فعلية له) — يُرجى مراجعتها وتعديلها لتُطابق محتوى الفيديو الحقيقي قبل النشر.",
    });
  } catch (err) {
    console.error("import-video error:", err);
    return NextResponse.json(
      { error: "تعذّر استيراد الفيديو أو توليد بيانات الدرس. تأكدي من الرابط أو أضيفيه يدويًا." },
      { status: 500 }
    );
  }
}
