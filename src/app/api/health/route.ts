import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "rawnak-api",
    quotaPolicy: "shared-daily-v1",
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || "local",
  });
}
