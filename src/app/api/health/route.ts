import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "rawnak-api",
    quotaPolicy: "shared-daily-v1",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "config-fallback",
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || "local",
  });
}
