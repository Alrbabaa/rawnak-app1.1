import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { fetchPage, htmlToPlainText } from "@/lib/page-fetch";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReqBody {
  urlOrTopic: string;
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .slice(0, 60);
}

// Admin-only content-authoring helper (drafts an article via AI — the
// actual save happens through /api/admin/articles, which is also
// requireAdmin-protected). Gated the same way here: this still costs real
// AI-provider money per call, so it must not be reachable by anonymous
// visitors — rate limiting alone only slows abuse, it doesn't stop it.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

    if (await checkAiRateLimit(req, "import-article", { max: 10, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ReqBody;
    const input = body.urlOrTopic?.trim();

    if (!input) {
      return NextResponse.json(
        { error: "يرجى تقديم رابط مقال أو عنوان/موضوع الدرس التعليمي" },
        { status: 400 }
      );
    }

    let pageText = "";
    const isUrl = /^https?:\/\//.test(input);

    if (isUrl) {
      try {
        const { html } = await fetchPage(input);
        pageText = htmlToPlainText(html);
      } catch {
        // Fallback to topic generation if URL fetch fails
      }
    }

    const systemPrompt = "أنتِ خبيرة ومحررة معتمدة لمقالات ودروس أكاديمية الجمال والتجميل. أرجعي JSON صالحاً فقط بالمخطط المطلوب.";

    const userPrompt = `نقوم بإنشاء درس تعليمي ومقال طبي موثوق لأكاديمية الجمال.
${isUrl && pageText ? `المحتوى المستخرج من الصفحة: "${pageText.slice(0, 3000)}"` : `الموضوع المطلوب: "${input}"`}

أرجعي JSON صالحًا فقط بالبنية التالية:
{
  "title": "<عنوان المقال/الدرس بالعربية، جذاب ومبني على أسس علمية>",
  "slug": "<معرّف باللغة العربية أو الإنجليزية صالحة للروابط>",
  "category": "<tips | education | skincare | makeup | seasonal>",
  "excerpt": "<ملخص تشويقي قصير ومكثف للمقال في سطرين>",
  "content": "<مقال كامل ومنسق بفقرات واضحة وعناوين فرعية، نصائح عملية وخطوات موثوقة>",
  "coverEmoji": "<إيموجي معبر مثل ✨ أو 🧴 أو 💄 أو 🌿>",
  "readMinutes": <عدد دقائق القراءة التقديري مثلاً 3 أو 5>,
  "bestFor": ["<normal | dry | oily | combination | sensitive | acne | aging>"]
}`;

    const imported = await aiService.chatJson<{
      title: string;
      slug: string;
      category: string;
      excerpt: string;
      content: string;
      coverEmoji: string;
      readMinutes: number;
      bestFor: string[];
    }>(systemPrompt, userPrompt);

    const title = imported.title || "درس تعليمي في العناية والجمال";

    return NextResponse.json({
      title,
      slug: imported.slug || slugify(title),
      category: imported.category || "skincare",
      excerpt: imported.excerpt || "دليل شامل ومجرب للعناية اليومية ونضارة البشرة.",
      content: imported.content || "الجمال يبدأ بالروتين الصحيح والتنظيف المريح...",
      coverEmoji: imported.coverEmoji || "✨",
      readMinutes: typeof imported.readMinutes === "number" ? imported.readMinutes : 3,
      bestFor: Array.isArray(imported.bestFor) ? imported.bestFor : ["normal"],
    });
  } catch (err) {
    console.error("import-article error:", err);
    return NextResponse.json(
      { error: "تعذّر استيراد المقال أو توليد محتوى الدرس. حاول مجدداً." },
      { status: 500 }
    );
  }
}
