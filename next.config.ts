import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const sentryAuth = Boolean(process.env.SENTRY_AUTH_TOKEN?.trim());
const sentryProject = Boolean(process.env.SENTRY_ORG?.trim() && process.env.SENTRY_PROJECT?.trim());

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Source map upload only when CI/prod credentials exist — never required for local build.
  sourcemaps: {
    disable: !(sentryAuth && sentryProject),
  },
  widenClientFileUpload: false,
  disableLogger: true,
  automaticVercelMonitors: false,
});
