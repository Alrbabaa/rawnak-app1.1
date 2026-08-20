import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { aiService } from "@/lib/ai/service";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { adminDb } from "@/lib/firebase/admin";
import { canUseFeature, remainingFreeUses, currentMonthKey, vipMonthlyCapReached, FEATURE_LIMITS, type FeatureLimit } from "@/lib/features";
import { computeVipAccess } from "@/lib/vip-access";
import { CABINET_CATEGORIES } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 90;

const VALID_SUBCATEGORIES = new Set<string>(CABINET_CATEGORIES.map((c) => c.id));
const MAX_ITEMS = 20;
const FEATURE_ID = "cabinetAiScan" as const;

interface ReqBody {
  image: string;
}

interface DetectedItemRaw {
  name?: string;
  brand?: string;
  subCategory?: string;
  confidence?: number;
}

interface ScanResult {
  items: DetectedItemRaw[];
}

const SCAN_PROMPT = `أنتِ خبيرة تصنيف منتجات تجميل وعناية بالبشرة. حلّلي الصورة المرفقة لمجموعة منتجات (قد تكون حقيبة مكياج أو رف منتجات) وحدّدي كل قطعة منتج ظاهرة بوضوح على حدة، كل قطعة على حدة وليس كمجموعة واحدة.

لكل منتج تكتشفينه، أعطي:
- name: اسم المنتج ونوعه بالعربية بشكل وصفي (مثال: "أحمر شفاه مطفي وردي"، "ماسكرا تكثيف وإطالة"، "كونسيلر بيج فاتح")
- brand: العلامة التجارية إن كانت مقروءة بوضوح من الصورة أو العبوة، وإلا اتركيها فارغة ""
- subCategory: واحدة بالضبط من هذه القيم فقط: cleanser, toner, serum, moisturizer, sunscreen, treatment, makeup, fragrance (لحقيبة مكياج، معظم القطع ستكون "makeup")
- confidence: عدد صحيح من 0 إلى 100 يعكس مدى ثقتكِ بدقة التعرّف على هذا المنتج تحديدًا (اسمه ونوعه، ليس بالضرورة العلامة التجارية)

قواعد مهمة:
- تجاهلي الخلفية والأدوات التي ليست منتجات (فرش مكياج بمفردها، أكياس، مرايا، إسفنجات بلا عبوة).
- لا تخترعي منتجات غير مرئية فعليًا بالصورة. لو الصورة غير واضحة أو لا تحتوي منتجات مميزة، أرجعي مصفوفة فارغة.
- لا تكرري نفس المنتج مرتين إن ظهر مرة واحدة فقط.

أعطي النتيجة بصيغة JSON صالحة فقط (بدون أي نص أو شرح إضافي، بدون markdown)، بالبنية التالية:
{
  "items": [
    { "name": "...", "brand": "...", "subCategory": "...", "confidence": 85 }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "يجب تسجيل الدخول لاستخدام هذه الميزة" }, { status: 401 });
    }

    if (await checkAiRateLimit(req, "cabinet-scan", { max: 6, windowMs: 10 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "طلبات كثيرة جدًا، حاولي مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ReqBody;
    const { image } = body;
    if (!image || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "صورة غير صالحة" }, { status: 400 });
    }

    // Server-side entitlement check — the only one that counts. A client
    // check exists too (cabinet-scan-screen.tsx) purely for UX (showing the
    // VIP prompt before the person even tries), but this is what actually
    // enforces the limit.
    const userRef = adminDb.collection("users").doc(session.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 });
    }
    const user = userSnap.data()!;
    const settingsSnap = await adminDb.collection("settings").doc("general").get();
    const configured = settingsSnap.data()?.aiLimits?.[FEATURE_ID] as Partial<FeatureLimit> | undefined;
    const defaults = FEATURE_LIMITS[FEATURE_ID];
    const limit: FeatureLimit = {
      freeUses: Number.isInteger(configured?.freeUses) && configured!.freeUses! >= 0 ? configured!.freeUses! : defaults.freeUses,
      vipMonthlyCap: Number.isInteger(configured?.vipMonthlyCap) && configured!.vipMonthlyCap! >= 0 ? configured!.vipMonthlyCap! : defaults.vipMonthlyCap,
    };
    // Effective VIP access = billing OR active referral trial — see
    // src/lib/vip-access.ts / src/lib/feature-gate.ts.
    const isPremium = computeVipAccess(user.isPremium, user.subscriptionExpiresAt, user.vipTrialExpiresAt);
    const usageCount = (user.featureUsage?.[FEATURE_ID] as number | undefined) || 0;

    if (!canUseFeature(FEATURE_ID, isPremium, usageCount, limit)) {
      return NextResponse.json(
        {
          error: "استخدمتِ تجربتكِ المجانية لمسح الخزانة بالذكاء الاصطناعي. رقّي لـ VIP لاستخدامها مجددًا.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }

    // VIP "unlimited" is a soft monthly cap, not literally infinite — see
    // the doc comment on FEATURE_LIMITS in features.ts.
    const monthKey = currentMonthKey();
    const monthlyCountBefore =
      (user.featureUsageMonthly?.[FEATURE_ID]?.[monthKey] as number | undefined) || 0;
    if (isPremium && vipMonthlyCapReached(FEATURE_ID, monthlyCountBefore, limit)) {
      return NextResponse.json(
        {
          error: "وصلتِ للحد الشهري لهذه الميزة ضمن VIP. سيُعاد الحد تلقائيًا مطلع الشهر القادم.",
          monthlyLimitReached: true,
        },
        { status: 429 }
      );
    }

    const parsed = await aiService.visionJson<ScanResult>(SCAN_PROMPT, [image]);

    if (!Array.isArray(parsed.items)) {
      return NextResponse.json({ error: "تعذّر تفسير نتيجة المسح" }, { status: 500 });
    }

    const clampConfidence = (n: unknown) =>
      typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;

    const items = parsed.items
      .filter((it): it is DetectedItemRaw & { name: string } => typeof it.name === "string" && it.name.trim().length > 0)
      .slice(0, MAX_ITEMS)
      .map((it) => {
        const sub = it.subCategory && VALID_SUBCATEGORIES.has(it.subCategory) ? it.subCategory : "makeup";
        return {
          name: it.name.trim(),
          brand: typeof it.brand === "string" ? it.brand.trim() : "",
          subCategory: sub as "cleanser" | "toner" | "serum" | "moisturizer" | "sunscreen" | "treatment" | "makeup" | "fragrance",
          confidence: clampConfidence(it.confidence),
        };
      });

    // Usage is recorded on every successful scan, premium included — cheap
    // to track, useful later (e.g. deciding the free-tier limit itself),
    // and canUseFeature() already bypasses the free-trial cap for premium
    // (the separate vipMonthlyCap check above is what bounds VIP usage).
    const usageUpdate: Record<string, FirebaseFirestore.FieldValue> = {
      [`featureUsage.${FEATURE_ID}`]: FieldValue.increment(1),
    };
    if (isPremium) {
      usageUpdate[`featureUsageMonthly.${FEATURE_ID}.${monthKey}`] = FieldValue.increment(1);
    }
    await userRef.set(usageUpdate, { merge: true });

    return NextResponse.json({
      items,
      usage: {
        isPremium,
        used: usageCount + 1,
        remainingFree: remainingFreeUses(FEATURE_ID, usageCount + 1, limit),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير معروف";
    console.error("[cabinet-scan] error:", msg);
    return NextResponse.json(
      { error: "حدث خطأ أثناء مسح الصورة. حاولي مرة أخرى." },
      { status: 500 }
    );
  }
}
