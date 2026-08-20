import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin, requireRole } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";
import { FEATURE_LIMITS, defaultAiLimits, type FeatureId } from "@/lib/features";

export const runtime = "nodejs";

const DOC = adminDb.collection("settings").doc("general");

const DEFAULTS = {
  supportEmail: "",
  defaultCountry: "السعودية",
  maintenanceMode: false,
  maintenanceMessage: "رَونق في صيانة قصيرة، نعود قريبًا ✦",
  announcementEnabled: false,
  announcementText: "",
  aiLimits: defaultAiLimits(),
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const snap = await DOC.get();
  const stored = snap.exists ? snap.data()! : {};
  const storedLimits = stored.aiLimits || {};
  const aiLimits = Object.fromEntries(
    (Object.keys(FEATURE_LIMITS) as FeatureId[]).map((featureId) => [
      featureId,
      { ...DEFAULTS.aiLimits[featureId], ...(storedLimits[featureId] || {}) },
    ])
  );
  return NextResponse.json({ settings: {
    ...DEFAULTS,
    ...stored,
    aiLimits,
  } });
}

/**
 * Stores config only — nothing here is read by the live app yet (no
 * client screen checks `maintenanceMode` or `announcementEnabled`).
 * Wiring either of those into actual app behavior is a separate,
 * deliberate follow-up, not something this endpoint does on its own.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, "super_admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.supportEmail !== undefined) data.supportEmail = String(body.supportEmail);
    if (body.defaultCountry !== undefined) data.defaultCountry = String(body.defaultCountry);
    if (body.maintenanceMode !== undefined) data.maintenanceMode = body.maintenanceMode === true;
    if (body.maintenanceMessage !== undefined) data.maintenanceMessage = String(body.maintenanceMessage);
    if (body.announcementEnabled !== undefined) data.announcementEnabled = body.announcementEnabled === true;
    if (body.announcementText !== undefined) data.announcementText = String(body.announcementText);
    if (body.aiLimits && typeof body.aiLimits === "object") {
      const aiLimits: Record<string, { freeUses: number; vipMonthlyCap: number; normalPeriodDays: number; vipPeriodDays: number }> = {};
      for (const featureId of Object.keys(FEATURE_LIMITS) as FeatureId[]) {
        const value = body.aiLimits[featureId];
        aiLimits[featureId] = {
          freeUses: Math.max(0, Math.min(10000, Math.floor(Number(value?.freeUses) || 0))),
          vipMonthlyCap: Math.max(0, Math.min(10000, Math.floor(Number(value?.vipMonthlyCap) || 0))),
          normalPeriodDays: Math.max(1, Math.min(365, Math.floor(Number(value?.normalPeriodDays) || 1))),
          vipPeriodDays: Math.max(1, Math.min(365, Math.floor(Number(value?.vipPeriodDays) || 1))),
        };
      }
      data.aiLimits = aiLimits;
    }
    await DOC.set(data, { merge: true });
    await logAdminAction(
      {
        adminEmail: auth.user!.email,
        adminUid: auth.user!.uid,
        action: "update",
        resource: "settings",
        resourceId: "general",
        meta: { fields: Object.keys(data) },
      },
      req
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ";
    console.error("[admin/settings PUT] error:", msg);
    return NextResponse.json({ error: "فشل الحفظ" }, { status: 500 });
  }
}
