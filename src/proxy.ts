import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = new Set([
  "http://localhost",
  "http://localhost:3000",
  "https://localhost",
  "capacitor://localhost",
  "ionic://localhost",
  "https://rawnak-app1-1.vercel.app",
]);

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = origin === "null" || allowedOrigins.has(origin);

  if (request.method === "OPTIONS") {
    const headers = new Headers(corsHeaders);
    if (isAllowedOrigin) headers.set("Access-Control-Allow-Origin", origin || "null");
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin || "null");
  }
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
