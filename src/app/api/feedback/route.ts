import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const {
      rating,
      category = "general",
      feedback,
      email,
      userName,
      skinType,
      appVersion = "1.0.0",
    } = body;

    if (!feedback || typeof feedback !== "string" || feedback.trim().length < 2) {
      return NextResponse.json(
        { error: "يرجى كتابة ملاحظاتكِ بشكل واضح قبل الإرسال" },
        { status: 400 }
      );
    }

    const feedbackDoc = {
      userId: session?.uid || null,
      userEmail: session?.email || email?.trim() || null,
      userName: userName?.trim() || "زائرة رَونق",
      rating: typeof rating === "number" && rating >= 1 && rating <= 5 ? rating : 5,
      category,
      feedback: feedback.trim(),
      skinType: skinType || null,
      appVersion,
      status: "unread",
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
      userAgent: req.headers.get("user-agent") || null,
    };

    const docRef = await adminDb.collection("feedback").add(feedbackDoc);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: "تم استلام ملاحظاتكِ بنجاح! شكرًا لمساهمتكِ في تطوير رَونق ✦",
    });
  } catch (error: any) {
    console.error("[Feedback API Error]:", error);
    return NextResponse.json(
      { error: "حدث خطأ غير متوقع أثناء إرسال الملاحظات. يرجى المحاولة لاحقاً." },
      { status: 500 }
    );
  }
}
