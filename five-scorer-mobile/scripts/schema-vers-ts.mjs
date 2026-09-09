// Recopie `db/schema.sql` dans `db/schema.ts`.
//
// Pourquoi une copie plutôt qu'un import : Metro ne sait pas charger un `.sql`
// sans `babel-plugin-inline-import`, et cette chaîne Babel a un historique
// documenté de casse à chaque montée d'Expo SDK. Un module TypeScript ordinaire
// ne casse jamais.
//
// La divergence est impossible en silence : `db/schema.test.ts` compare les
// deux octet pour octet à chaque `npm run tester`. Quand il échoue, la
// correction est de relancer ce script — jamais d'éditer `db/schema.ts`.
//
//   node scripts/schema-vers-ts.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(racine, "db/schema.sql"), "utf8");

if (sql.includes("`") || sql.includes("${")) {
  throw new Error(
    "db/schema.sql contient un accent grave ou une interpolation : " +
      "le littéral gabarit ne peut plus le porter tel quel.",
  );
}

const entete = `// GÉNÉRÉ — ne pas éditer à la main.
//
// Copie conforme de \`db/schema.sql\`, qui est la seule source du schéma.
// Régénérer avec : node scripts/schema-vers-ts.mjs
// L'égalité octet pour octet est vérifiée par \`db/schema.test.ts\`.

`;

writeFileSync(
  join(racine, "db/schema.ts"),
  `${entete}export const SCHEMA = \`${sql}\`;\n`,
  "utf8",
);

console.log(`db/schema.ts écrit — ${sql.length} octets de SQL.`);
