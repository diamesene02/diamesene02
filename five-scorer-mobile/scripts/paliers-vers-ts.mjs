// Recopie « db/paliers/*.sql » dans « db/paliers.ts ».
//
// Même raison que « scripts/schema-vers-ts.mjs », et même promesse : Metro ne
// sait pas charger un « .sql » sans `babel-plugin-inline-import`, et cette
// chaîne Babel casse à chaque montée d'Expo SDK. Un module TypeScript ordinaire
// ne casse jamais.
//
// La divergence est impossible en silence : « db/paliers.test.ts » compare les
// deux octet pour octet à chaque « npm run tester ». Quand il échoue, la
// correction est de relancer ce script — jamais d'éditer « db/paliers.ts ».
//
//   node scripts/paliers-vers-ts.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const dossier = join(racine, "db/paliers");

/// Un palier se reconnaît à « NNN-nom.sql ». Deux fichiers par palier :
/// « NNN-schema.sql » est l'INSTANTANÉ du schéma à ce palier (une archive, pour
/// que les tests puissent construire une vraie base d'avant) ; tout autre
/// « NNN-*.sql » est la MIGRATION qui mène du palier précédent à celui-là.
const fichiers = readdirSync(dossier).filter((f) => /^\d{3}-.+\.sql$/.test(f)).sort();

const parVersion = new Map();
for (const f of fichiers) {
  const version = Number(f.slice(0, 3));
  const sql = readFileSync(join(dossier, f), "utf8");
  if (sql.includes("`") || sql.includes("${")) {
    throw new Error(
      `db/paliers/${f} contient un accent grave ou une interpolation : ` +
        "le littéral gabarit ne peut plus le porter tel quel.",
    );
  }
  const entree = parVersion.get(version) ?? { version, schema: "", migration: "" };
  if (f.endsWith("-schema.sql")) entree.schema = sql;
  else entree.migration = sql;
  parVersion.set(version, entree);
}

const paliers = [...parVersion.values()].sort((a, b) => a.version - b.version);
for (const p of paliers) {
  if (!p.migration) {
    throw new Error(
      `Le palier ${p.version} n'a pas de migration : il faut un ` +
        `db/paliers/${String(p.version).padStart(3, "0")}-<nom>.sql.`,
    );
  }
}

const entete = `// GÉNÉRÉ — ne pas éditer à la main.
//
// Copie conforme des fichiers de \`db/paliers/\`, qui sont la seule source des
// migrations. Régénérer avec : node scripts/paliers-vers-ts.mjs
// L'égalité octet pour octet est vérifiée par \`db/paliers.test.ts\`.

/// Un palier du miroir local.
///
/// \`schema\` est l'INSTANTANÉ du schéma à ce palier — une archive, figée le
/// jour où le palier est né et jamais retouchée. Elle sert aux tests, qui en
/// construisent une vraie base d'avant ; elle ne s'exécute jamais en
/// production.
///
/// \`migration\` est ce qui mène du palier précédent à celui-ci. C'est le seul
/// des deux que l'app exécute.
export type Palier = { version: number; schema: string; migration: string };

`;

const corps = paliers
  .map(
    (p) =>
      `  {\n    version: ${p.version},\n    schema: \`${p.schema}\`,\n    migration: \`${p.migration}\`,\n  },`,
  )
  .join("\n");

writeFileSync(
  join(racine, "db/paliers.ts"),
  `${entete}export const PALIERS: Palier[] = [\n${corps}\n];\n`,
  "utf8",
);

console.log(`db/paliers.ts écrit — ${paliers.length} palier(s).`);
