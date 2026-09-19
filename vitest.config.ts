import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // next-intl's navigation imports "next/navigation" without an extension,
    // which plain Node cannot resolve; inlined, Vite resolves it, so a test
    // can import a component that links (through @/i18n/routing).
    server: { deps: { inline: ["next-intl"] } },
  },
});
