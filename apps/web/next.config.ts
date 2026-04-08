import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8787";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
