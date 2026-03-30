import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Disable Strict Mode: React 18 double-invokes effects in dev, which causes
  // competing navigator.locks acquisitions in @supabase/auth-js and breaks auth.
  reactStrictMode: false,
  turbopack: {
    // Set root to the monorepo root so Turbopack can resolve ../src (@shared alias)
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
