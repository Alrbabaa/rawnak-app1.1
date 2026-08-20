import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const snap = await adminDb.collection("articles").orderBy("createdAt", "desc").get();
  return NextResponse.json({
    articles: snap.docs.map((d) => {
      const a = d.data();
      return {
        id: d.id, title: a.title, slug: a.slug, category: a.category,
        excerpt: a.excerpt, content: a.content, coverEmoji: a.coverEmoji,
        readMinutes: a.readMinutes, bestFor: a.bestFor || [],
        published: a.published, createdAt: a.createdAt,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    const slug = body.slug || body.title.toLowerCase().replace(/\s+/g, "-").slice(0, 60);

    const clash = await adminDb.collection("articles").where("slug", "==", slug).limit(1).get();
    if (!clash.empty) {
      return NextResponse.json({ error: "الرابط (slug) مستخدم بالفعل" }, { status: 409 });
    }

    const docRef = await adminDb.collection("articles").add({
      title: body.title, slug, category: body.category || "tips",
      excerpt: body.excerpt || "", content: body.content || "",
      coverEmoji: body.coverEmoji || "✨", readMinutes: Number(body.readMinutes) || 3,
      bestFor: body.bestFor || [], published: body.published !== false, createdAt: Date.now(),
    });
    return NextResponse.json({ id: docRef.id, ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/articles POST] error:", msg);
    return NextResponse.json({ error: "فشل الإنشاء" }, { status: 500 });
  }
}
