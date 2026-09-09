// Le schéma local, éprouvé sur un vrai moteur SQLite.
//
// Ces tests tournent sur « node:sqlite » — le SQLite embarqué dans Node, le
// même moteur que celui d'expo-sqlite sur le téléphone. Ce n'est donc pas une
// relecture du DDL : c'est le DDL exécuté.
//
// Le test central est celui d'AUTOINCREMENT. Il ne vérifie pas qu'on a bien
// tapé le mot ; il montre ce qui se passe quand il manque — l'identifiant se
// recycle, et une opération neuve prend dans la file la place d'une opération
// déjà partie au serveur.

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA } from "./schema";

const ici = dirname(fileURLToPath(import.meta.url));
const SQL_SUR_DISQUE = readFileSync(join(ici, "schema.sql"), "utf8");

function baseNeuve(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

/** Enfile une opération d'outbox et rend son identifiant. */
function enfiler(db: DatabaseSync, matchId: string | null = "m1"): number {
  const r = db
    .prepare(
      "INSERT INTO outbox (created_at, club_id, match_id, op) VALUES (?, ?, ?, ?)",
    )
    .run("2026-09-09T20:00:00.000Z", "club1", matchId, "{}");
  return Number(r.lastInsertRowid);
}

// ---------------------------------------------------------------------------

describe("la copie TypeScript du schéma", () => {
  it("est octet pour octet celle de db/schema.sql", () => {
    // Si ce test échoue, ce n'est pas un bug du test : c'est que schema.sql a
    // bougé. La correction est « node scripts/schema-vers-ts.mjs », jamais une
    // édition de schema.ts.
    expect(SCHEMA).toBe(SQL_SUR_DISQUE);
  });
});

describe("le schéma s'applique", () => {
  it("crée les 6 tables du modèle Dexie v3, et rien d'autre", () => {
    const db = baseNeuve();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => r.name);
    expect(tables).toEqual([
      "clubs",
      "events",
      "matches",
      "outbox",
      "participants",
      "roster",
    ]);
  });

  it("porte l'index du drain et celui du blocage en cascade", () => {
    const db = baseNeuve();
    const index = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'outbox%' ORDER BY name",
      )
      .all()
      .map((r) => r.name);
    expect(index).toContain("outbox_actives");
    expect(index).toContain("outbox_match");
  });

  it("se rejoue sans erreur sur une base déjà créée", () => {
    // L'app applique le schéma à chaque ouverture : le IF NOT EXISTS n'est pas
    // décoratif non plus.
    const db = baseNeuve();
    enfiler(db);
    expect(() => db.exec(SCHEMA)).not.toThrow();
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM outbox").get()!.n,
    ).toBe(1);
  });

  it("met la base en WAL sur un vrai fichier", () => {
    // En mémoire, SQLite répond « memory » et refuse WAL : la vérification
    // n'a de sens que sur disque — c'est le cas du téléphone.
    const dossier = mkdtempSync(join(tmpdir(), "five-scorer-"));
    try {
      const db = new DatabaseSync(join(dossier, "local.db"));
      db.exec(SCHEMA);
      const mode = db.prepare("PRAGMA journal_mode").get()!.journal_mode;
      expect(mode).toBe("wal");
      db.close();
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

describe("outbox.id — AUTOINCREMENT", () => {
  it("ne redonne JAMAIS un identifiant libéré", () => {
    // Le critère de l'étape 6, mot pour mot : trois ops, on supprime la 3ᵉ
    // (elle est partie au serveur), on en enfile une neuve → elle doit
    // prendre 4.
    const db = baseNeuve();
    enfiler(db);
    enfiler(db);
    enfiler(db);
    db.exec("DELETE FROM outbox WHERE id = 3");
    expect(enfiler(db)).toBe(4);
  });

  it("et sans le mot, le même scénario redonne 3 — la preuve par le contre-exemple", () => {
    const db = baseNeuve();
    db.exec(
      "CREATE TABLE temoin (id INTEGER PRIMARY KEY, op TEXT NOT NULL)",
    );
    const ins = db.prepare("INSERT INTO temoin (op) VALUES ('{}')");
    ins.run();
    ins.run();
    ins.run();
    db.exec("DELETE FROM temoin WHERE id = 3");
    expect(Number(ins.run().lastInsertRowid)).toBe(3);
  });

  it("garde l'ordre d'enfilement même après vidage complet de la file", () => {
    // Le cas du lundi : la file se vide entre deux mi-temps, puis on remarque
    // encore. Un identifiant recyclé ferait repasser une op avant une plus
    // ancienne restée bloquée.
    const db = baseNeuve();
    const avant = [enfiler(db), enfiler(db)];
    db.exec("DELETE FROM outbox");
    const apres = enfiler(db);
    expect(apres).toBeGreaterThan(Math.max(...avant));
  });
});

describe("le drain, tel que lib/sync.ts le rejouera", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = baseNeuve();
  });

  it("sert la prochaine op active dans l'ordre de la clé primaire", () => {
    const a = enfiler(db);
    const b = enfiler(db);
    const suivante = () =>
      db
        .prepare(
          "SELECT id FROM outbox WHERE blocked_at IS NULL ORDER BY id ASC LIMIT 1",
        )
        .get();
    expect(suivante()!.id).toBe(a);
    db.prepare("DELETE FROM outbox WHERE id = ?").run(a);
    expect(suivante()!.id).toBe(b);
  });

  it("un refus bloque en cascade tout le match, et ne supprime rien", () => {
    const but1 = enfiler(db, "m1");
    const but2 = enfiler(db, "m1");
    const autre = enfiler(db, "m2");

    db.prepare(
      "UPDATE outbox SET blocked_at = ?, last_error = ? WHERE match_id = ? AND blocked_at IS NULL",
    ).run("2026-09-09T20:05:00.000Z", "403", "m1");

    const bloquees = db
      .prepare("SELECT id FROM outbox WHERE blocked_at IS NOT NULL ORDER BY id")
      .all()
      .map((r) => Number(r.id));
    expect(bloquees).toEqual([but1, but2]);

    // Rien n'a disparu : on ne détruit pas la saisie d'un match sans le dire.
    expect(db.prepare("SELECT COUNT(*) AS n FROM outbox").get()!.n).toBe(3);
    // Et le match voisin continue de couler.
    expect(
      db
        .prepare(
          "SELECT id FROM outbox WHERE blocked_at IS NULL ORDER BY id ASC LIMIT 1",
        )
        .get()!.id,
    ).toBe(autre);
  });

  it("compte les actives et les bloquées pour la pastille", () => {
    enfiler(db, "m1");
    enfiler(db, "m2");
    db.prepare("UPDATE outbox SET blocked_at = ? WHERE match_id = ?").run(
      "2026-09-09T20:05:00.000Z",
      "m1",
    );
    const c = db
      .prepare(
        "SELECT COUNT(*) FILTER (WHERE blocked_at IS NULL) AS actives, COUNT(*) FILTER (WHERE blocked_at IS NOT NULL) AS bloquees FROM outbox",
      )
      .get()!;
    expect(c.actives).toBe(1);
    expect(c.bloquees).toBe(1);
  });

  it("compte les tentatives sans perdre l'op", () => {
    const id = enfiler(db);
    const echec = db.prepare(
      "UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?",
    );
    echec.run("timeout", id);
    echec.run("timeout", id);
    const l = db.prepare("SELECT attempts, last_error FROM outbox WHERE id = ?").get(id)!;
    expect(l.attempts).toBe(2);
    expect(l.last_error).toBe("timeout");
  });
});

describe("les CHECK attrapent la faute de portage", () => {
  it("refuse une équipe qui n'est ni A ni B", () => {
    const db = baseNeuve();
    expect(() =>
      db
        .prepare(
          "INSERT INTO events (id, match_id, type, team, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run("e1", "m1", "GOAL", "C", "2026-09-09T20:00:00.000Z"),
    ).toThrow(/CHECK/i);
  });

  it("refuse un type d'événement inconnu", () => {
    const db = baseNeuve();
    expect(() =>
      db
        .prepare(
          "INSERT INTO events (id, match_id, type, team, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run("e1", "m1", "PENALTY", "A", "2026-09-09T20:00:00.000Z"),
    ).toThrow(/CHECK/i);
  });

  it("refuse un statut de match hors des deux connus", () => {
    const db = baseNeuve();
    expect(() =>
      db
        .prepare(
          "INSERT INTO matches (id, club_id, kind, played_at, team_a_name, team_b_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run("m1", "c1", "INTERNAL", "2026-09-09", "Rouges", "Bleus", "SCHEDULED"),
    ).toThrow(/CHECK/i);
  });

  it("accepte en revanche un but sans buteur — le score part au premier tap", () => {
    const db = baseNeuve();
    expect(() =>
      db
        .prepare(
          "INSERT INTO events (id, match_id, type, team, player_id, minute, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run("e1", "m1", "GOAL", "A", null, null, "2026-09-09T20:00:00.000Z"),
    ).not.toThrow();
  });
});

describe("participants", () => {
  it("refuse deux lignes pour la même paire match/joueur", () => {
    const db = baseNeuve();
    const ins = db.prepare(
      "INSERT INTO participants (key, match_id, player_id, team, is_gk) VALUES (?, ?, ?, ?, ?)",
    );
    ins.run("m1::j1", "m1", "j1", "A", 0);
    // Même paire, clé mal formée : la contrainte doit tenir quand même.
    expect(() => ins.run("m1:j1", "m1", "j1", "B", 0)).toThrow(/UNIQUE/i);
  });

  it("laisse un joueur changer de camp par mise à jour", () => {
    // movePlayer écrit l'appartenance voulue, pas un delta : il est rejouable.
    const db = baseNeuve();
    db.prepare(
      "INSERT INTO participants (key, match_id, player_id, team, is_gk) VALUES (?, ?, ?, ?, ?)",
    ).run("m1::j1", "m1", "j1", "A", 0);
    db.prepare("UPDATE participants SET team = ? WHERE key = ?").run("B", "m1::j1");
    expect(
      db.prepare("SELECT team FROM participants WHERE key = ?").get("m1::j1")!.team,
    ).toBe("B");
  });
});

describe("roster", () => {
  it("archive par défaut à 0 — le champ est optionnel côté TypeScript", () => {
    const db = baseNeuve();
    db.prepare(
      "INSERT INTO roster (id, club_id, name, skill, is_gk, is_guest) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("j1", "c1", "Ibrahima", 3, 0, 0);
    expect(
      db.prepare("SELECT is_archived FROM roster WHERE id = ?").get("j1")!
        .is_archived,
    ).toBe(0);
  });
});
