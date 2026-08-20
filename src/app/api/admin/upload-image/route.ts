import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { uploadPublicImage } from "@/lib/firebase/upload-image";

export const runtime = "nodejs";

/**
 * Admin-only image upload for catalog content (product photos). Accepts a
 * base64 data URL (already resized client-side) and returns a public URL
 * on Firebase Storage that can be saved on the product document.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const { dataUrl, folder } = body as { dataUrl?: string; folder?: string };
    if (!dataUrl || !dataUrl.startsWith("data:")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 });
    }
    const safeFolder = (folder || "products").replace(/[^a-z0-9-]/gi, "");
    const id = Math.random().toString(36).slice(2, 10);
    const url = await uploadPublicImage(safeFolder, id, dataUrl);
    return NextResponse.json({ url, ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/upload-image POST] error:", msg);
    return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 500 });
  }
}
