import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // Bound worker/process pressure for SQLite integration tests on local Windows.
    maxWorkers: 1,
    fileParallelism: false,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: [
        "e2e/**",
        "scripts/**",
        "content/**",
        "docs/**",
        "audit/**",
        "design/**",
        "prisma/migrations/**",
        "**/*.config.*",
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
