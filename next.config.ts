import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [new URL("https://replicate.com/**"), new URL("https://replicate.delivery/**")],
  },
};

export default nextConfig;
