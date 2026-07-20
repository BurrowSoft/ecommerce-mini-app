import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean, self-contained production build (Docker copies just this output).
  output: "standalone",
};

export default nextConfig;
