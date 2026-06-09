import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Don't bundle pptxgenjs — it's a heavy Node.js server package.
  // Loaded from node_modules at runtime in API routes.
  serverExternalPackages: ["pptxgenjs"],
};

export default nextConfig;
