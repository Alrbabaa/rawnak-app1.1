import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionFromRequest } from "@/lib/firebase-session";

export const runtime = "nodejs";

interface ReqBody {
  name?: string;
  profile?: {
    age?: number | null;
    skinType?: string | null;
    skinTone?: string | null;
    concerns?: string[];
    goals?: string[];
    makeupLevel?: string | null;
    lifestyle?: string[];
    avatar?: string;
    socialInstagram?: string | null;
    socialTiktok?: string | null;
    bio?: string | null;
    // Opt-out of the public name-search directory used by
    // /api/social/search — defaults to true (on) when unset, since a
    // social directory only has value if members are findable by default,
    // but anyone can turn it off from their profile.
    socialDiscoverable?: boolean;
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

    const body = (await req.json()) as ReqBody;
    const { name, profile } = body;

    const data: Record<string, unknown> = {};
    if (name) {
      data.name = name;
      // Lowercased copy for prefix search — see /api/social/search, which
      // powers the public "بحث بالاسم" directory. Only ever derived from
      // the name itself, never a separate user input.
      data.nameLower = name.trim().toLowerCase();
    }
    if (profile) {
      if (profile.age !== undefined && profile.age !== null) data.age = profile.age;
      if (profile.skinType) data.skinType = profile.skinType;
      if (profile.skinTone) data.skinTone = profile.skinTone;
      if (profile.concerns) data.concerns = profile.concerns;
      if (profile.goals) data.goals = profile.goals;
      if (profile.makeupLevel) data.makeupLevel = profile.makeupLevel;
      if (profile.lifestyle) data.lifestyle = profile.lifestyle;
      if (profile.avatar) data.avatar = profile.avatar;
      if (profile.socialInstagram !== undefined) data.socialInstagram = profile.socialInstagram;
      if (profile.socialTiktok !== undefined) data.socialTiktok = profile.socialTiktok;
      if (profile.bio !== undefined) data.bio = profile.bio;
      if (profile.socialDiscoverable !== undefined) data.socialDiscoverable = profile.socialDiscoverable;
      data.hasOnboarded = true;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ id: session.uid, email: session.email });
    }
    data.updatedAt = Date.now();

    await adminDb.collection("users").doc(session.uid).set(data, { merge: true });

    return NextResponse.json({ id: session.uid, email: session.email });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[db/user] error:", msg);
    return NextResponse.json({ error: "فشل حفظ المستخدم" }, { status: 500 });
  }
}
