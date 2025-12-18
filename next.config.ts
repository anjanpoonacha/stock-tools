import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Externalize ws library for both Webpack and Turbopack
  serverExternalPackages: ['ws'],
};

export default nextConfig;
