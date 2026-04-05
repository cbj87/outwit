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

// Wrap with Serwist only in production — keeps dev fast with no SW interference.
async function buildConfig() {
  if (process.env.NODE_ENV === "production") {
    const withSerwist = (await import("@serwist/next")).default;
    return withSerwist({
      swSrc: "sw.ts",
      swDest: "public/sw.js",
      reloadOnOnline: true,
    })(nextConfig);
  }
  return nextConfig;
}

export default buildConfig();
