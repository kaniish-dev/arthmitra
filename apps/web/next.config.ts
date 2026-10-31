import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Lets phones on the same Wi-Fi or hotspot open the dev server's Network address (hot reload
  // included), whatever private IP the network hands out. Dev only; production is unaffected.
  allowedDevOrigins: ["10.*.*.*", "172.*.*.*", "192.168.*.*", "*.local"],
  // Keeps the dev-only Next.js badge off the sidebar's Profile and Log out buttons.
  devIndicators: { position: "bottom-right" },
  // Shared workspace packages ship TypeScript source.
  transpilePackages: ["@arthmitra/engine", "@arthmitra/schema", "@arthmitra/seed"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
