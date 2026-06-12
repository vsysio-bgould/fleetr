import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/app", replacement: path.resolve(__dirname, "app") },
      { find: "@/prisma", replacement: path.resolve(__dirname, "prisma") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
      exclude: [
        "node_modules/**",
        "prisma/**",
        "app/**",
        "**/*.d.ts",
        "**/*.config.*",
        "src/test/**",
      ],
    },
  },
});
