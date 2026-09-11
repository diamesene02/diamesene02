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
  /// Un palier FACTICE à deux instructions. Le vrai palier 1 ne pose qu'un
  /// PRAGMA : par construction, il ne peut rien laisser à moitié fait, donc
  /// il ne prouverait rien ici. Ce palier-ci crée une table PUIS pose la
  /// version — et on coupe entre les deux.
  const FACTICE: Palier[] = [
    {
      version: 2,
      migration:
        "CREATE TABLE IF NOT EXISTS essai_migration (id TEXT PRIMARY KEY);\nPRAGMA user_version = 2;",
    },
  ];

  /// Enveloppe une base et fait échouer le `script` choisi.
  ///
  /// Le compteur est PARTAGÉ par l'enveloppe et par la base que
  /// `transaction()` rend : sur expo-sqlite, le rappel d'une transaction reçoit
  /// un objet DISTINCT (c'est écrit dans `base.ts`, et c'est ce qui empêche
  /// d'écrire hors de la transaction sans s'en apercevoir). Une enveloppe qui
  /// ne se réapplique pas au passage laisserait passer le vrai `script`, et le
  /// test ne couperait rien du tout — c'est la première version de ce test, et
  /// elle passait pour de mauvaises raisons.
  function quiEchoue(base: Base, surAppelNumero: number, compteur = { n: 0 }): Base {
    return {
      script: async (sql: string) => {
        compteur.n += 1;
        if (compteur.n === surAppelNumero) throw new Error("coupure simulée");
        return base.script(sql);
      },
      transaction: (fn) => base.transaction((b) => fn(quiEchoue(b, surAppelNumero, compteur))),
      executer: (sql, params) => base.executer(sql, params),
      lire: (sql, params) => base.lire(sql, params),
      premier: (sql, params) => base.premier(sql, params),
    };
  }

  it("laisse la base sur le palier précédent, entière, avec sa file", async () => {
    const b = await baseDAvant();
    await enfiler(b);
    await appliquerSchema(b, SCHEMA); // on part d'une base saine au palier 1
    expect(await versionDe(b)).toBe(1);

    // La transaction du palier 2 échoue à sa première (et seule) instruction
    // de script : tout ce qu'elle contenait doit être annulé.
    await expect(appliquerPaliers(quiEchoue(b, 1), FACTICE)).rejects.toThrow("coupure simulée");

    expect(await versionDe(b)).toBe(1);
    const table = await b.premier(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'essai_migration'",
    );
    expect(table).toBeNull();
    const l = await b.premier<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
    expect(l?.n).toBe(1);
  });
});
