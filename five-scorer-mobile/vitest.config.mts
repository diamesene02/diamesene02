import { defineConfig } from "vitest/config";

// Les tests de ce projet tournent en Node pur, sans React Native ni jsdom :
// on ne teste ici que de la logique portable (lib/noyau/, puis la couche
// SQLite et le drain de l'outbox). Les écrans se vérifient par `tsc` et par
// `expo export`, pas par un rendu simulé.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "db/**/*.test.ts"],
  },
});
