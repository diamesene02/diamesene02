import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Les tests de `lib/` écrivent dans le Postgres LOCAL : il leur faut
// DATABASE_URL. Next lit `.env` tout seul, vitest non — la suite dépendait donc
// de ce que le shell portait, et sautait 77 tests EN SILENCE (« 102 passed |
// 77 skipped », code de sortie 1) sur une machine où la variable manquait.
// On le lit ici, dans le contexte Node de la configuration : le faire dans
// `setupFiles` ne suffit pas, l'environnement jsdom des tests ne partage pas
// le même `process.env` que le client Prisma.
function env(): Record<string, string> {
  try {
    const brut = readFileSync(fileURLToPath(new URL(".env", import.meta.url)), "utf8");
    const lu: Record<string, string> = {};
    for (const ligne of brut.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(ligne);
      if (m) lu[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return lu;
  } catch {
    // Pas de `.env` : les tests qui ont besoin de la base se sautent d'eux-mêmes.
    return {};
  }
}

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
    env: env(),
  },
});
