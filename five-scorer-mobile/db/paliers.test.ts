// Les paliers, et la copie qui doit rester conforme.
//
// Frère de « db/schema.test.ts » : même promesse, même correction quand il
// échoue — relancer « node scripts/paliers-vers-ts.mjs », jamais éditer
// « db/paliers.ts ».

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PALIERS } from "./paliers";

const ici = dirname(fileURLToPath(import.meta.url));
const dossier = join(ici, "paliers");

describe("la copie TypeScript des paliers", () => {
  it("porte tous les paliers de db/paliers/", () => {
    const versions = new Set(
      readdirSync(dossier)
        .filter((f) => /^\d{3}-.+\.sql$/.test(f))
        .map((f) => Number(f.slice(0, 3))),
    );
    expect(PALIERS.map((p) => p.version)).toEqual([...versions].sort((a, b) => a - b));
  });

  it("est octet pour octet celle des fichiers .sql", () => {
    for (const p of PALIERS) {
      const n = String(p.version).padStart(3, "0");
      const fichiers = readdirSync(dossier).filter((f) => f.startsWith(`${n}-`));
      const schema = fichiers.find((f) => f.endsWith("-schema.sql"));
      const migration = fichiers.find((f) => !f.endsWith("-schema.sql"));
      expect(migration, `palier ${n} sans migration`).toBeDefined();
      expect(p.migration).toBe(readFileSync(join(dossier, migration!), "utf8"));
      if (schema) expect(p.schema).toBe(readFileSync(join(dossier, schema), "utf8"));
    }
  });

  it("est trié par version croissante", () => {
    const v = PALIERS.map((p) => p.version);
    expect(v).toEqual([...v].sort((a, b) => a - b));
  });
});
