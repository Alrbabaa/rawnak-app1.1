import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel packages Next.js with its own adapter. Standalone output is only
  // needed when this app is self-hosted (for example, in Docker).
  output: process.env.VERCEL ? undefined : "standalone",
  reactStrictMode: false,
  allowedDevOrigins: ["*.run.app", "localhost", "127.0.0.1"],
};

export default nextConfig;
