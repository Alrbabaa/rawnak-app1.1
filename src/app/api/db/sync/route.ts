import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { uploadBase64Image } from "@/lib/firebase/upload-image";
import { generateReferralCode } from "@/lib/referral";

export const runtime = "nodejs";
export const maxDuration = 30;

interface SyncBody {
  analyses?: Array<{
    id?: string;
    overall: number;
    metrics: Record<string, number>;
    skinType: string;
    summary: string;
    recommendations: string[];
    observations?: string[];
    possibleConcerns?: string[];
    confidence?: number;
    limitations?: string[];
    reviewStatus?: string;
    imageData: string;
    ts: number;
  }>;
  cabinet?: Array<{
    id?: string;
    name: string;
    brand: string;
    category: string;
    subCategory: string;
    openedAt: number | null;
    shelfLifeMonths: number;
    rating: number;
    notes: string;
    favorite: boolean;
    useCount: number;
    lastUsedAt: number | null;
    price?: string;
    purchaseUrl?: string;
    source: string;
  }>;
  academyFavorites?: string[];
  achievements?: string[];
  plans?: Array<{
    id?: string;
    occasion: string;
    occasionLabel: string;
    date: number;
    steps: { phase: string; items: string[] }[];
    products: string[];
    duration: string;
    tips: string[];
    createdAt: number;
  }>;
  chatMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    ts: number;
  }>;
  // Skincare-routine streak (consecutive days) — needed server-side so the
  // "Streak Story" on a public profile (visible to followers only, see
  // /api/social/profile/[uid]) reflects real, current data instead of
  // going stale the moment it's only kept in localStorage.
  streak?: number;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    const uid = session.uid;
    const userRef = adminDb.collection("users").doc(uid);

    const body = (await req.json()) as SyncBody;
    const results: Record<string, number> = {};

    if (body.analyses && body.analyses.length > 0) {
      const analysesRef = userRef.collection("analyses");
      const existingSnap = await analysesRef.get();
      const byId = new Map(existingSnap.docs.map((doc) => [doc.id, doc]));
      const byTimestamp = new Map(
        existingSnap.docs.map((doc) => [Number(doc.data().createdAt), doc])
      );
      let created = 0;

      for (const a of body.analyses) {
        // Keep the client id as the Firestore id. Timestamp matching also
        // recognizes analyses written by older versions that generated a
        // different server id, preventing duplicates during migration.
        const existing = (a.id && byId.get(a.id)) || byTimestamp.get(a.ts);
        const docRef = existing?.ref || (a.id ? analysesRef.doc(a.id) : analysesRef.doc());
        const existingImageUrl = (existing?.data().imageUrl as string | undefined) || "";
        let imageUrl = existingImageUrl;

        if (!imageUrl && a.imageData?.startsWith("data:")) {
          try {
            imageUrl = await uploadBase64Image(uid, "analyses", docRef.id, a.imageData);
          } catch (e) {
            console.error("[db/sync] image upload failed:", e instanceof Error ? e.message : e);
          }
        }

        if (existing) {
          if (imageUrl && imageUrl !== existingImageUrl) {
            await docRef.update({ imageUrl });
          }
          continue;
        }

        await docRef.set({
          overall: a.overall,
          hydration: a.metrics.hydration ?? 0,
          acne: a.metrics.acne ?? 0,
          darkCircles: a.metrics.darkCircles ?? 0,
          pores: a.metrics.pores ?? 0,
          texture: a.metrics.texture ?? 0,
          evenness: a.metrics.evenness ?? 0,
          skinType: a.skinType,
          summary: a.summary,
          recommendations: a.recommendations || [],
          observations: a.observations || [],
          possibleConcerns: a.possibleConcerns || [],
          confidence: typeof a.confidence === "number" ? a.confidence : null,
          limitations: a.limitations || [],
          reviewStatus: a.reviewStatus || null,
          imageUrl,
          createdAt: a.ts,
        });
        created += 1;
      }
      results.analyses = created;
    }

    if (body.cabinet) {
      await replaceSubcollection(
        userRef.collection("cabinet"),
        body.cabinet.map((p) => ({
          name: p.name,
          brand: p.brand,
          category: p.category,
          subCategory: p.subCategory,
          openedAt: p.openedAt,
          shelfLifeMonths: p.shelfLifeMonths,
          rating: p.rating,
          notes: p.notes,
          favorite: p.favorite,
          useCount: p.useCount,
          lastUsedAt: p.lastUsedAt,
          price: p.price || null,
          purchaseUrl: p.purchaseUrl || null,
          source: p.source,
        }))
      );
      results.cabinet = body.cabinet.length;
    }

    if (body.academyFavorites) {
      await replaceSubcollection(
        userRef.collection("favorites"),
        body.academyFavorites.map((videoId) => ({ videoId }))
      );
      results.favorites = body.academyFavorites.length;
    }

    if (body.achievements) {
      await replaceSubcollection(
        userRef.collection("achievements"),
        body.achievements.map((achievementId) => ({ achievementId }))
      );
      results.achievements = body.achievements.length;
    }

    // Plans — full-replace, same strategy as cabinet/favorites/achievements.
    if (body.plans) {
      await replaceSubcollection(
        userRef.collection("plans"),
        body.plans.map((p) => ({
          occasion: p.occasion,
          occasionLabel: p.occasionLabel,
          date: p.date,
          steps: p.steps,
          products: p.products,
          duration: p.duration,
          tips: p.tips,
          createdAt: p.createdAt,
        }))
      );
      results.plans = body.plans.length;
    }

    // Chat history — a single fixed document ("current"), not a real
    // multi-session collection: the app has exactly one continuous
    // conversation with a "clear chat" action, no session-switching UI.
    // Capped to the most recent 100 messages to stay well under Firestore's
    // 1MB document limit (unbounded growth is fine locally, not as one doc).
    if (body.chatMessages) {
      const capped = body.chatMessages.slice(-100);
      await userRef.collection("chatSessions").doc("current").set({
        messages: capped,
        updatedAt: Date.now(),
      });
      results.chatMessages = capped.length;
    }

    if (Object.keys(results).length > 0) {
      await userRef.set({ updatedAt: Date.now() }, { merge: true });
    }

    if (typeof body.streak === "number" && body.streak >= 0) {
      await userRef.set({ streak: Math.floor(body.streak), updatedAt: Date.now() }, { merge: true });
      results.streak = 1;
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[db/sync] error:", msg);
    return NextResponse.json({ error: "فشل المزامنة" }, { status: 500 });
  }
}

async function replaceSubcollection(
  ref: FirebaseFirestore.CollectionReference,
  docs: Record<string, unknown>[]
) {
  const existing = await ref.get();
  const batch = adminDb.batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  docs.forEach((data) => batch.set(ref.doc(), data));
  await batch.commit();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    const uid = session.uid;

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ user: null });
    }
    const user = userSnap.data()!;

    // Backfill a referral code for accounts that predate the peer-referral
    // feature (or somehow missed it) — db/sync GET runs on every session
    // load regardless of auth method, unlike complete-signup which
    // email/password *login* (as opposed to signup) never calls.
    let referralCode = (user.referralCode as string | undefined) || null;
    if (!referralCode) {
      for (let attempt = 0; attempt < 5 && !referralCode; attempt++) {
        const candidate = generateReferralCode();
        try {
          await adminDb.collection("referralCodes").doc(candidate).create({
            uid,
            createdAt: Date.now(),
          });
          referralCode = candidate;
          await userRef.set({ referralCode: candidate }, { merge: true });
        } catch {
          // Collision — try again.
        }
      }
    }

    const [analysesSnap, cabinetSnap, favoritesSnap, achievementsSnap, plansSnap, chatSnap] = await Promise.all([
      userRef.collection("analyses").orderBy("createdAt", "desc").limit(20).get(),
      userRef.collection("cabinet").get(),
      userRef.collection("favorites").get(),
      userRef.collection("achievements").get(),
      userRef.collection("plans").orderBy("createdAt", "desc").limit(30).get(),
      userRef.collection("chatSessions").doc("current").get(),
    ]);

    return NextResponse.json({
      user: {
        id: uid,
        email: user.email,
        name: user.name,
        age: user.age ?? null,
        skinType: user.skinType ?? null,
        skinTone: user.skinTone ?? null,
        concerns: user.concerns ?? [],
        goals: user.goals ?? [],
        makeupLevel: user.makeupLevel ?? null,
        lifestyle: user.lifestyle ?? [],
        avatar: user.avatar ?? "",
        // Was previously written by /api/db/user but never actually
        // returned here, so the existing restore branch for these in
        // use-db-sync.ts silently never fired — fixing that in passing
        // since socialDiscoverable below needs the same round-trip to
        // work at all.
        socialInstagram: user.socialInstagram ?? null,
        socialTiktok: user.socialTiktok ?? null,
        bio: user.bio ?? null,
        socialDiscoverable: user.socialDiscoverable ?? true,
        hasOnboarded: user.hasOnboarded ?? Boolean(user.skinType || user.age),
        isPremium: user.isPremium ?? false,
        subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
        subscriptionProductId: user.subscriptionProductId ?? null,
        referralCode,
        referralInvitesCount: user.referralInvitesCount ?? 0,
        referralRewardUnlockedAt: user.referralRewardUnlockedAt ?? null,
        // Repeatable VIP trial earned via referrals — see
        // src/lib/referral.ts (extendVipTrial) and src/lib/vip-access.ts
        // (computeVipAccess, which combines this with isPremium).
        vipTrialExpiresAt: user.vipTrialExpiresAt ?? null,
        cabinetAiScanUsed: (user.featureUsage?.cabinetAiScan as number | undefined) ?? 0,
        // Admin-assigned only (see /api/admin/users/[id]/tier) — never
        // accepted from the self-service /api/db/user route, so a user can
        // never grant this to themselves. Defaults to "standard".
        accountTier: user.accountTier ?? "standard",
        streak: user.streak ?? 0,
        followersCount: user.followersCount ?? 0,
        followingCount: user.followingCount ?? 0,
      },
      analyses: analysesSnap.docs.map((d) => {
        const a = d.data();
        return {
          id: d.id,
          ts: a.createdAt,
          overall: a.overall,
          metrics: {
            hydration: a.hydration,
            acne: a.acne,
            darkCircles: a.darkCircles,
            pores: a.pores,
            texture: a.texture,
            evenness: a.evenness,
          },
          skinType: a.skinType,
          summary: a.summary,
          recommendations: a.recommendations || [],
          observations: a.observations || [],
          possibleConcerns: a.possibleConcerns || [],
          confidence: typeof a.confidence === "number" ? a.confidence : undefined,
          limitations: a.limitations || [],
          reviewStatus: a.reviewStatus || undefined,
          imageData: a.imageUrl || "",
        };
      }),
      cabinet: cabinetSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      academyFavorites: favoritesSnap.docs.map((d) => d.data().videoId as string),
      achievements: achievementsSnap.docs.map((d) => d.data().achievementId as string),
      plans: plansSnap.docs.map((d) => {
        const p = d.data();
        return {
          id: d.id,
          occasion: p.occasion,
          occasionLabel: p.occasionLabel,
          date: p.date,
          steps: p.steps || [],
          products: p.products || [],
          duration: p.duration,
          tips: p.tips || [],
          createdAt: p.createdAt,
        };
      }),
      chatMessages: chatSnap.exists ? chatSnap.data()?.messages || [] : [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[db/sync GET] error:", msg);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}
