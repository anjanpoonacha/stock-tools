import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark 'ws' as external to prevent bundling issues in production
      config.externals = config.externals || [];
      config.externals.push({
        ws: 'commonjs ws',
      });
    }
    return config;
  },
};

export default nextConfig;
