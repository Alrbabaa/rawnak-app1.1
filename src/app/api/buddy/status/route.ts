import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";
import { generateBuddyCode, todayKeyUTC, type BuddyStatus } from "@/lib/buddy";

export const runtime = "nodejs";

/**
 * Reads (and lazily creates) this user's own buddy invite code, and — if
 * she's already paired — her buddy's completion status for today.
 *
 * Privacy: the buddy's document is read here, but only
 * `lastRoutineCompletionDate` and `name` ever leave this route. Nothing
 * else from that doc (skin data, cabinet, analyses, email) is ever
 * touched, let alone returned. See src/lib/buddy.ts for the full
 * contract.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const userRef = adminDb.collection("users").doc(session.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    const userData = userSnap.data()!;

    // Lazily assign a buddy code the first time this user's status is
    // checked — same collision-safe retry pattern as referral codes
    // (see complete-signup/route.ts).
    let myCode: string | undefined = userData.buddyCode;
    if (!myCode) {
      for (let attempt = 0; attempt < 5 && !myCode; attempt++) {
        const candidate = generateBuddyCode();
        try {
          await adminDb.collection("buddyInviteCodes").doc(candidate).create({
            uid: session.uid,
            createdAt: Date.now(),
          });
          myCode = candidate;
          await userRef.set({ buddyCode: candidate }, { merge: true });
        } catch {
          // Collision — try again.
        }
      }
    }

    const today = todayKeyUTC();
    const meDoneToday = userData.lastRoutineCompletionDate === today;

    const pairId: string | undefined = userData.buddyPairId;
    const buddyUid: string | undefined = userData.buddyUid;

    if (!pairId || !buddyUid) {
      const status: BuddyStatus = {
        hasBuddy: false,
        buddyName: null,
        meDoneToday,
        buddyDoneToday: false,
        myCode: myCode || "",
        pairPredatesToday: false,
      };
      return NextResponse.json(status);
    }

    const [pairSnap, buddySnap] = await Promise.all([
      adminDb.collection("buddyPairs").doc(pairId).get(),
      adminDb.collection("users").doc(buddyUid).get(),
    ]);

    const pairData = pairSnap.data();
    const buddyData = buddySnap.data();

    const pairPredatesToday = !!pairData && todayKeyUTC(new Date(pairData.createdAt as number)) !== today;

    const status: BuddyStatus = {
      hasBuddy: true,
      buddyName: (buddyData?.name as string | undefined) || "صديقتك",
      meDoneToday,
      buddyDoneToday: buddyData?.lastRoutineCompletionDate === today,
      myCode: myCode || "",
      pairPredatesToday,
    };
    return NextResponse.json(status);
  } catch (err) {
    console.error("buddy/status error:", err);
    return NextResponse.json({ error: "حدث خطأ، حاولي مرة أخرى" }, { status: 500 });
  }
}
