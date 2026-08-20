import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const slug = searchParams.get("slug");

  if (slug) {
    const snap = await adminDb.collection("articles").where("slug", "==", slug).limit(1).get();
    if (snap.empty || !snap.docs[0].data().published) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    const a = snap.docs[0].data();
    return NextResponse.json({
      article: {
        id: snap.docs[0].id, title: a.title, slug: a.slug, category: a.category,
        excerpt: a.excerpt, content: a.content, coverEmoji: a.coverEmoji,
        readMinutes: a.readMinutes, bestFor: a.bestFor || [], createdAt: a.createdAt,
      },
    });
  }

  let query = adminDb.collection("articles").where("published", "==", true) as FirebaseFirestore.Query;
  if (category && category !== "all") query = query.where("category", "==", category);
  const snap = await query.orderBy("createdAt", "desc").get();

  return NextResponse.json({
    articles: snap.docs.map((d) => {
      const a = d.data();
      return {
        id: d.id, title: a.title, slug: a.slug, category: a.category,
        excerpt: a.excerpt, coverEmoji: a.coverEmoji, readMinutes: a.readMinutes,
        bestFor: a.bestFor || [], createdAt: a.createdAt,
      };
    }),
  });
}
