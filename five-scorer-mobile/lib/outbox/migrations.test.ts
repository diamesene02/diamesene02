// L'échelle de migration, éprouvée sur un vrai moteur SQLite.
//
// Le test central est celui de CONVERGENCE. Il ne vérifie pas qu'une migration
// « passe » : il montre que les deux façons d'obtenir une base — naître neuve,
// ou monter depuis l'ancien schéma — donnent le MÊME schéma. Sans lui, les
// téléphones du club divergeraient selon leur date d'installation, et le
// défaut ne se verrait qu'à la première requête qui touche la différence.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseNode } from "./baseNode";
import { appliquerSchema, type Base } from "./base";
import { appliquerPaliers, cible, versionDe, type Palier } from "./migrations";
import { PALIERS } from "../../db/paliers";
import { SCHEMA } from "../../db/schema";

const ici = dirname(fileURLToPath(import.meta.url));
const SCHEMA_001 = readFileSync(
  join(ici, "..", "..", "db", "paliers", "001-schema.sql"),
  "utf8",
);

/// Une base telle qu'un téléphone du club la porte AUJOURD'HUI : l'ancien
/// schéma, et aucune version — `user_version` vaut 0, implicite.
async function baseDAvant(): Promise<BaseNode> {
  const b = BaseNode.ouvrir();
  await b.script(SCHEMA_001);
  return b;
}

/// Le schéma d'une base, tel que SQLite le rend. C'est la seule comparaison
/// qui vaille : pas le texte qu'on a écrit, celui que le moteur a gardé.
async function schemaDe(b: Base): Promise<unknown[]> {
  return b.lire(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name",
  );
}

function enfiler(b: Base): Promise<unknown> {
  return b.executer(
    "INSERT INTO outbox (created_at, club_id, match_id, op) VALUES (?, ?, ?, ?)",
    ["2026-09-11T20:00:00.000Z", "club1", "m1", "{}"],
  );
}

// ---------------------------------------------------------------------------

describe("deux chemins, un seul schéma", () => {
  it("une base MONTÉE et une base NEUVE ont exactement le même schéma", async () => {
    const ancienne = await baseDAvant();
    await appliquerSchema(ancienne, SCHEMA);

    const neuve = BaseNode.ouvrir();
    await appliquerSchema(neuve, SCHEMA);

    expect(await schemaDe(ancienne)).toEqual(await schemaDe(neuve));
  });

  it("…et la même version", async () => {
    const ancienne = await baseDAvant();
    await appliquerSchema(ancienne, SCHEMA);

    const neuve = BaseNode.ouvrir();
    await appliquerSchema(neuve, SCHEMA);

    expect(await versionDe(ancienne)).toBe(cible(PALIERS));
    expect(await versionDe(neuve)).toBe(cible(PALIERS));
  });
});

describe("la file survit à la migration", () => {
  it("l'opération en attente est encore là après", async () => {
    const b = await baseDAvant();
    await enfiler(b);
    const avant = await b.premier<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");

    await appliquerSchema(b, SCHEMA);

    const apres = await b.premier<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    expect(apres?.n).toBe(avant?.n);
    expect(apres?.n).toBe(1);
  });

  it("rejouer l'ouverture ne remonte rien et ne perd rien", async () => {
    const b = await baseDAvant();
    await enfiler(b);

    await appliquerSchema(b, SCHEMA);
    await appliquerSchema(b, SCHEMA); // deuxième ouverture de l'app
    await appliquerSchema(b, SCHEMA); // troisième

    expect(await versionDe(b)).toBe(cible(PALIERS));
    const l = await b.premier<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    expect(l?.n).toBe(1);
  });
});

describe("une base vidée de toutes ses tables", () => {
  it("est traitée comme NEUVE, malgré sqlite_sequence", async () => {
    // `outbox.id` est AUTOINCREMENT, ce qui crée `sqlite_sequence` — une table
    // interne qui survit au DROP de toutes les autres. Une sonde générique
    // (« une table, n'importe laquelle ») déclarait donc cette base
    // « existante » et la faisait entrer dans l'échelle au palier 0.
    const b = BaseNode.ouvrir();
    await appliquerSchema(b, SCHEMA);
    for (const t of ["events", "participants", "matches", "outbox", "roster", "clubs"]) {
      await b.executer(`DROP TABLE ${t}`);
    }
    await b.script("PRAGMA user_version = 0;");

    const restantes = await b.lire<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    expect(restantes.map((r) => r.name)).toContain("sqlite_sequence");

    await appliquerSchema(b, SCHEMA);
    expect(await versionDe(b)).toBe(cible(PALIERS));
  });
});

describe("une base plus haute que la cible", () => {
  it("n'est pas touchée — aucune migration descendante", async () => {
    const b = await baseDAvant();
    await enfiler(b);
    await b.script("PRAGMA user_version = 99;");

    await appliquerPaliers(b, PALIERS);

    expect(await versionDe(b)).toBe(99);
    const l = await b.premier<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    expect(l?.n).toBe(1);
  });
});

describe("un palier coupé au milieu", () => {
  /// Un palier FACTICE à DEUX instructions, dont la seconde est INVALIDE.
  ///
  /// C'est la seule façon de couper au milieu, et il a fallu deux essais pour
  /// le comprendre. Un décorateur qui fait échouer le n-ième appel à `script()`
  /// ne coupe rien : `appliquerPaliers` exécute un palier entier en UN SEUL
  /// `script()`, donc la coupure tombe forcément AVANT ou APRÈS, jamais au
  /// milieu — et le test passait à l'identique sans aucune transaction.
  ///
  /// Ici c'est SQLite lui-même qui échoue, à la deuxième instruction, après
  /// que la première a créé sa table. Sans transaction, cette table reste.
  /// Avec, elle disparaît. C'est ça qu'on veut prouver.
  const FACTICE: Palier[] = [
    {
      version: 2,
      migration:
        "CREATE TABLE essai_migration (id TEXT PRIMARY KEY);\n" +
        "PRAGMA user_version = 2;\n" +
        "CETTE INSTRUCTION N'EST PAS DU SQL;",
    },
  ];

  it("laisse la base sur le palier précédent, entière, avec sa file", async () => {
    const b = await baseDAvant();
    await enfiler(b);
    await appliquerSchema(b, SCHEMA);
    expect(await versionDe(b)).toBe(1);

    await expect(appliquerPaliers(b, FACTICE)).rejects.toThrow();

    // Tout ce que le palier avait commencé doit avoir disparu.
    expect(await versionDe(b)).toBe(1);
    expect(
      await b.premier(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'essai_migration'",
      ),
    ).toBeNull();
    const l = await b.premier<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    expect(l?.n).toBe(1);
  });

  it("…et SANS transaction, la moitié du palier resterait — c'est la contre-épreuve", async () => {
    // Si ce test échoue, c'est que la transaction ne sert à rien : le test
    // au-dessus passerait alors pour de mauvaises raisons, et il l'a déjà fait
    // deux fois. On rejoue le même palier SANS transaction et on montre que la
    // base reste à moitié migrée.
    const b = await baseDAvant();
    await appliquerSchema(b, SCHEMA);

    await expect(b.script(FACTICE[0].migration)).rejects.toThrow();

    expect(
      await b.premier(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'essai_migration'",
      ),
    ).not.toBeNull();
    expect(await versionDe(b)).toBe(2);
  });
});

describe("un palier qui RENOMME une table", () => {
  /// Le cas que le premier palier non trivial rencontrera — et la spec 0002,
  /// « le nom », le rendra probable.
  ///
  /// Il n'est pas théorique : il dépend entièrement de l'ORDRE dans lequel
  /// `appliquerSchema` pose le schéma cible et fait monter l'échelle. Si le
  /// schéma cible passe en PREMIER, il crée la table d'arrivée VIDE, et
  /// l'`ALTER TABLE … RENAME TO` du palier tombe sur « there is already
  /// another table with this name ». La transaction s'annule, l'ouverture
  /// lève, et « Réessayer » rejoue exactement la même séquence : la soirée qui
  /// dort dans ce fichier devient inatteignable.
  const ANCIEN = `
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      club_id TEXT,
      match_id TEXT,
      op TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS joueurs (id TEXT PRIMARY KEY, nom TEXT);
  `;
  const CIBLE = `
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      club_id TEXT,
      match_id TEXT,
      op TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vestiaire (id TEXT PRIMARY KEY, nom TEXT);
  `;
  const RENOMME: Palier[] = [
    { version: 1, migration: "PRAGMA user_version = 1;" },
    { version: 2, migration: "ALTER TABLE joueurs RENAME TO vestiaire;\nPRAGMA user_version = 2;" },
  ];

  it("monte sans perdre ses lignes, et sans buter sur la table d'arrivée", async () => {
    const b = BaseNode.ouvrir();
    await b.script(ANCIEN);
    await b.executer("INSERT INTO joueurs (id, nom) VALUES (?, ?)", ["j1", "Sofiane"]);
    await enfiler(b);

    await appliquerSchema(b, CIBLE, RENOMME);

    expect(await versionDe(b)).toBe(2);
    // La ligne a suivi le renommage : c'est tout l'enjeu.
    const l = await b.premier<{ nom: string }>("SELECT nom FROM vestiaire WHERE id = 'j1'");
    expect(l?.nom).toBe("Sofiane");
    // Et l'ancienne table n'est plus là.
    expect(
      await b.premier("SELECT name FROM sqlite_master WHERE type='table' AND name='joueurs'"),
    ).toBeNull();
    const f = await b.premier<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    expect(f?.n).toBe(1);
  });
});
