import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Même alias que tsconfig.json ("@/*" -> "./*") : Next.js le résout tout
// seul, Vite/vitest ne le connaît pas sans ce mapping explicite.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts"],
  },
});
