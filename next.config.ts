import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  logging: {
    incomingRequests: {
      ignore: [/\/api\/auth\/google\/callback/, /\/verify-email/, /\/reset-password/],
    },
  },
  async headers() {
    return ["/verify-email", "/reset-password"].map((source) => ({
      source,
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "no-store" },
      ],
    }));
  },
  turbopack: {
    root: path.join(__dirname, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
