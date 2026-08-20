import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * "من فعل ماذا ومتى" — one row per admin write action, plain Firestore.
 * Fire-and-forget by design: logging must never block or fail the actual
 * admin action it's recording, so every call site does `.catch(() => {})`
 * (or awaits inside a try/catch that swallows). This file has zero effect
 * on any user-facing behavior — it only ever *adds* a document.
 */
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "unpublish"
  | "login";

export interface AuditLogEntry {
  adminEmail: string;
  adminUid: string;
  action: AuditAction;
  resource: string; // e.g. "picks", "articles", "settings"
  resourceId?: string;
  resourceLabel?: string; // human-readable, e.g. the product name
  meta?: Record<string, unknown>;
  ip?: string;
}

function ipFromRequest(req?: NextRequest): string | undefined {
  if (!req) return undefined;
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
}

export async function logAdminAction(entry: AuditLogEntry, req?: NextRequest): Promise<void> {
  try {
    await adminDb.collection("auditLog").add({
      ...entry,
      ip: entry.ip ?? ipFromRequest(req) ?? null,
      createdAt: Date.now(),
    });
  } catch (err) {
    // Never let logging break the admin action it's describing.
    console.error("[audit-log] failed to write entry:", err);
  }
}
