import type { NextConfig } from "next";

// Empty locally. CI sets PAGES_BASE_PATH=/eligibility-integration-broker for GitHub Pages.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
