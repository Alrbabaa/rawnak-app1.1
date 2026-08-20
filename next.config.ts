import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  allowedDevOrigins: ["*.run.app", "localhost", "127.0.0.1"],
};

export default nextConfig;
