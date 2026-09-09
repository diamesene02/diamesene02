// Les actions de match, éprouvées contre un vrai SQLite.
//
// Deux tests portent le reste, et ce sont ceux que le plan (§4, étape 11)
// exige :
//
//   1. **« un but écrit `events` ET `outbox`, ou ni l'un ni l'autre ».** Le
//      chemin heureux ne prouve rien tout seul : il faut voir la transaction
//      ANNULER. On injecte donc une base capricieuse qui refuse l'écriture de
//      l'outbox, et on regarde ce qui reste sur le disque — rien.
//   2. **« aucune écriture dans un match FINISHED ».** Trois portes mènent au
//      match (un but, un changement de camp, un retardataire) ; les trois
//      doivent être fermées, et fermées SANS rien laisser derrière elles.
//
// Le reste couvre ce qui a coûté des soirées côté web : la minute rétro, le
// garde anti-équipe-vide, le score qui ne descend pas sous zéro, l'invité créé
// hors ligne qui doit voyager avec le match.
//
// Le moteur est le même que sur le téléphone (§« baseNode.ts »).

import { describe, it, expect, beforeEach } from "vitest";
import { SCHEMA } from "../../db/schema";
import { appliquerSchema, type Base, type Ligne, type Resultat, type Valeur } from "../outbox/base";
import { BaseNode } from "../outbox/baseNode";
import { compteurs, prochaineActive } from "../outbox/outbox";
import type { OutboxEntry } from "../outbox/types";
import { creerMatchLocal, type MatchLocal } from "./local";
import { pKey } from "./tables";

// --- Le décor ---------------------------------------------------------------

/// 20 h 00, un lundi. Le coup d'envoi de toutes les histoires de ce fichier.
const COUP_ENVOI = "2026-09-07T18:00:00.000Z";

function horloge(depart = COUP_ENVOI) {
  let t = Date.parse(depart);
  return {
    maintenant: () => new Date(t),
    /// Fait avancer l'horloge de `minutes` — c'est la seule façon honnête de
    /// tester la dérivation de la minute d'un but.
    avancer: (minutes: number) => {
      t += minutes * 60000;
    },
  };
}

function compteurIds(prefixe = "id") {
  let n = 0;
  return () => `${prefixe}-${++n}`;
}

async function baseNeuve(chemin = ":memory:"): Promise<BaseNode> {
  const base = BaseNode.ouvrir(chemin);
  await appliquerSchema(base, SCHEMA);
  return base;
}

/// Une base qui refuse certaines écritures, pour voir la transaction annuler.
///
/// `transaction()` réenveloppe la base que la vraie transaction fournit : sans
/// ça, le rappel écrirait par l'ancienne enveloppe et le refus ne porterait
/// sur rien.
class BaseCapricieuse implements Base {
  constructor(
    private readonly vraie: Base,
    private readonly refuser: (sql: string) => boolean,
  ) {}
  script(sql: string): Promise<void> {
    return this.vraie.script(sql);
  }
  async executer(sql: string, params?: Valeur[]): Promise<Resultat> {
    if (this.refuser(sql)) throw new Error("disque plein");
    return this.vraie.executer(sql, params);
  }
  lire<T = Ligne>(sql: string, params?: Valeur[]): Promise<T[]> {
    return this.vraie.lire<T>(sql, params);
  }
  premier<T = Ligne>(sql: string, params?: Valeur[]): Promise<T | null> {
    return this.vraie.premier<T>(sql, params);
  }
  transaction<T>(fn: (base: Base) => Promise<T>): Promise<T> {
    return this.vraie.transaction((b) =>
      fn(new BaseCapricieuse(b, this.refuser)),
    );
  }
}

const CLUB = "club1";

/// L'effectif du soir : quatre joueurs du club, deux par camp.
const EFFECTIF = [
  { id: "j1", name: "Ibrahima", skill: 4, isGk: false, isGuest: false },
  { id: "j2", name: "Amadou", skill: 3, isGk: true, isGuest: false },
  { id: "j3", name: "Bakary", skill: 3, isGk: false, isGuest: false },
  { id: "j4", name: "Cheikh", skill: 2, isGk: true, isGuest: false },
];

type Decor = {
  base: BaseNode;
  local: MatchLocal;
  temps: ReturnType<typeof horloge>;
};

async function decor(): Promise<Decor> {
  const base = await baseNeuve();
  const temps = horloge();
  const local = creerMatchLocal({
    base,
    maintenant: temps.maintenant,
    nouvelId: compteurIds(),
  });
  await local.saveRoster(CLUB, EFFECTIF);
  return { base, local, temps };
}

/// Un match interne, deux joueurs de chaque côté, coup d'envoi à l'heure de
/// l'horloge injectée.
async function matchDuSoir(d: Decor, playedAt?: string): Promise<string> {
  return d.local.createMatch({
    clubId: CLUB,
    kind: "INTERNAL",
    teamAName: "Rouges",
    teamBName: "Bleus",
    teamA: [
      { playerId: "j1", isGk: false },
      { playerId: "j2", isGk: true },
    ],
    teamB: [
      { playerId: "j3", isGk: false },
      { playerId: "j4", isGk: true },
    ],
    ...(playedAt ? { playedAt } : {}),
  });
}

/// Toute la file, dans l'ordre de rejeu.
async function file(base: Base): Promise<OutboxEntry[]> {
  const lignes = await base.lire<{ op: string; id: number }>(
    "SELECT id, op FROM outbox ORDER BY id ASC",
  );
  return lignes.map((l) => ({
    id: l.id,
    createdAt: "",
    attempts: 0,
    op: JSON.parse(l.op),
  }));
}

async function nb(base: Base, table: string, ou = "1 = 1"): Promise<number> {
  const l = await base.premier<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE ${ou}`,
  );
  return l?.n ?? 0;
}

// --- Les deux tests que le plan exige --------------------------------------

describe("un but écrit events ET outbox, ou ni l'un ni l'autre", () => {
  it("les deux, quand tout va bien", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(12);

    const eventId = await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });

    expect(await nb(d.base, "events")).toBe(1);
    const f = await file(d.base);
    // La création du match, puis le but : deux opérations, dans cet ordre.
    expect(f.map((e) => e.op.kind)).toEqual(["createMatch", "addEvent"]);
    const op = f[1].op;
    if (op.kind !== "addEvent") throw new Error("op inattendue");
    // Le MÊME identifiant des deux côtés : c'est ce qui rend le rejeu
    // idempotent côté serveur.
    expect(op.payload.id).toBe(eventId);
    expect(op.payload.minute).toBe(12);
  });

  it("ni l'un ni l'autre, quand l'écriture de la file échoue", async () => {
    const base = await baseNeuve();
    const temps = horloge();
    const ids = compteurIds();
    // D'abord un match et un effectif écrits normalement.
    const sain = creerMatchLocal({ base, maintenant: temps.maintenant, nouvelId: ids });
    await sain.saveRoster(CLUB, EFFECTIF);
    const matchId = await matchDuSoir({ base, local: sain, temps });

    // Puis la même app, sur une base qui refuse d'enfiler.
    const capricieuse = new BaseCapricieuse(base, (sql) =>
      sql.startsWith("INSERT INTO outbox"),
    );
    const fragile = creerMatchLocal({
      base: capricieuse,
      maintenant: temps.maintenant,
      nouvelId: ids,
    });

    await expect(
      fragile.addEvent(matchId, { type: "GOAL", team: "A", playerId: "j1" }),
    ).rejects.toThrow("disque plein");

    // Aucun événement, et le score n'a pas bougé : la transaction a annulé
    // l'écriture métier avec l'opération, pas seulement l'opération.
    expect(await nb(base, "events")).toBe(0);
    const m = await sain.getLocalMatch(matchId);
    expect(m?.match.scoreA).toBe(0);
    // La file ne contient que la création du match, faite avant.
    expect((await file(base)).map((e) => e.op.kind)).toEqual(["createMatch"]);
  });

  it("l'annulation d'un but retire l'événement ET enfile son annulation", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(5);
    const eventId = await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });

    expect(await d.local.removeEvent(matchId, eventId)).toBe(true);
    expect(await nb(d.base, "events")).toBe(0);
    const kinds = (await file(d.base)).map((e) => e.op.kind);
    // L'addEvent N'EST PAS retiré de la file : le serveur est idempotent et
    // reçoit l'ajout puis le retrait. Effacer l'ajout laisserait le serveur
    // avec un but que personne n'annule jamais.
    expect(kinds).toEqual(["createMatch", "addEvent", "removeEvent"]);
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.match.scoreA).toBe(0);
  });
});

describe("aucune écriture dans un match terminé", () => {
  let d: Decor;
  let matchId: string;

  beforeEach(async () => {
    d = await decor();
    matchId = await matchDuSoir(d);
    d.temps.avancer(50);
    await d.local.finishMatch(matchId, "j1", 50);
  });

  it("un but est refusé, et ne laisse rien derrière lui", async () => {
    await expect(
      d.local.addEvent(matchId, { type: "GOAL", team: "A", playerId: "j1" }),
    ).rejects.toThrow("Match terminé");
    expect(await nb(d.base, "events")).toBe(0);
    expect((await file(d.base)).map((e) => e.op.kind)).toEqual([
      "createMatch",
      "finishMatch",
    ]);
  });

  it("un changement de camp est refusé", async () => {
    await expect(d.local.movePlayerTeam(matchId, "j1", "B")).rejects.toThrow(
      "Match terminé",
    );
    const p = await d.base.premier<{ team: string }>(
      "SELECT team FROM participants WHERE key = ?",
      [pKey(matchId, "j1")],
    );
    expect(p?.team).toBe("A");
    expect(await nb(d.base, "outbox")).toBe(2);
  });

  it("un retardataire est refusé", async () => {
    await expect(
      d.local.ajouterJoueurAuMatch(matchId, "j5", "A"),
    ).rejects.toThrow("Match terminé");
    expect(await nb(d.base, "participants")).toBe(4);
    expect(await nb(d.base, "outbox")).toBe(2);
  });

  it("le match porte bien son MVP et sa fin dans la file", async () => {
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.match.status).toBe("FINISHED");
    expect(m?.match.mvpId).toBe("j1");
    const f = await file(d.base);
    const op = f[1].op;
    if (op.kind !== "finishMatch") throw new Error("op inattendue");
    expect(op.payload).toEqual({ mvpId: "j1", durationMin: 50 });
  });
});

// --- La création du match ---------------------------------------------------

describe("createMatch", () => {
  it("écrit la feuille, les deux compos et l'opération", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);

    const m = await d.local.getLocalMatch(matchId);
    expect(m?.match.status).toBe("LIVE");
    expect(m?.match.playedAt).toBe(COUP_ENVOI);
    expect(m?.teamA.map((p) => p.name)).toEqual(["Ibrahima", "Amadou"]);
    expect(m?.teamB.map((p) => p.name)).toEqual(["Bakary", "Cheikh"]);
    // Le chrono part à zéro, en première période — les colonnes ont leur
    // défaut, elles ne sont pas nulles.
    expect(m?.match.clockElapsedMs).toBe(0);
    expect(m?.match.period).toBe(1);

    const op = (await file(d.base))[0].op;
    if (op.kind !== "createMatch") throw new Error("op inattendue");
    expect(op.payload.teamA).toEqual([
      { playerId: "j1", isGk: false },
      { playerId: "j2", isGk: true },
    ]);
    expect(op.payload.guests).toEqual([]);
  });

  it("embarque les invités créés hors ligne dans son payload", async () => {
    const d = await decor();
    // Un copain amené par un joueur, saisi au bord du terrain sans réseau : il
    // n'existe QUE sur l'appareil.
    const inviteId = await d.local.addLocalGuest(CLUB, "Le cousin de Bakary");
    const matchId = await d.local.createMatch({
      clubId: CLUB,
      kind: "INTERNAL",
      teamAName: "Rouges",
      teamBName: "Bleus",
      teamA: [{ playerId: "j1", isGk: false }],
      teamB: [{ playerId: inviteId, isGk: false }],
    });

    const op = (await file(d.base))[0].op;
    if (op.kind !== "createMatch") throw new Error("op inattendue");
    // Sans ce champ, le serveur répondait 400 « Joueur hors du club » — un
    // refus, donc le blocage définitif de toute la chaîne du match.
    expect(op.payload.guests).toEqual([
      { id: inviteId, name: "Le cousin de Bakary" },
    ]);
    expect(await nb(d.base, "participants", `match_id = '${matchId}'`)).toBe(2);
  });

  it("une feuille rétro garde sa date passée", async () => {
    const d = await decor();
    const hier = "2026-09-06T18:00:00.000Z";
    const matchId = await matchDuSoir(d, hier);
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.match.playedAt).toBe(hier);
  });
});

describe("launchScheduledMatch", () => {
  const seed = {
    id: "m-programme",
    clubId: CLUB,
    kind: "INTERNAL" as const,
    teamAName: "Rouges",
    teamBName: "Bleus",
    teamA: [{ playerId: "j1", isGk: false }],
    teamB: [{ playerId: "j3", isGk: false }],
  };

  it("démarre le match avec l'identifiant du serveur", async () => {
    const d = await decor();
    expect(await d.local.launchScheduledMatch(seed)).toBe("m-programme");
    const m = await d.local.getLocalMatch("m-programme");
    expect(m?.match.status).toBe("LIVE");
    expect(m?.match.playedAt).toBe(COUP_ENVOI);
    expect((await file(d.base)).map((e) => e.op.kind)).toEqual(["createMatch"]);
  });

  it("ne relance rien si le match tourne déjà sur cet appareil", async () => {
    const d = await decor();
    await d.local.launchScheduledMatch(seed);
    d.temps.avancer(10);
    await d.local.addEvent("m-programme", {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });

    // Un second appui sur « démarrer » — le geste arrive, l'app a été rouverte.
    await d.local.launchScheduledMatch(seed);

    // Le but est toujours là, et aucune seconde création n'est partie : une
    // deuxième op `createMatch` aurait remis le match à 0-0 côté serveur.
    const m = await d.local.getLocalMatch("m-programme");
    expect(m?.match.scoreA).toBe(1);
    expect((await file(d.base)).map((e) => e.op.kind)).toEqual([
      "createMatch",
      "addEvent",
    ]);
  });
});

// --- La saisie ---------------------------------------------------------------

describe("addEvent", () => {
  it("la minute se déduit du coup d'envoi", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(0);
    const e0 = await d.local.addEvent(matchId, { type: "GOAL", team: "A" });
    d.temps.avancer(37);
    const e37 = await d.local.addEvent(matchId, { type: "GOAL", team: "A" });

    const evs = (await d.local.getLocalMatch(matchId))!.events;
    expect(evs.find((e) => e.id === e0)?.minute).toBe(0);
    expect(evs.find((e) => e.id === e37)?.minute).toBe(37);
  });

  it("une feuille saisie après coup n'a pas de minute", async () => {
    const d = await decor();
    // Le match d'hier, ressaisi ce soir : plus de six heures d'écart, donc
    // rétro. Sans ce `null`, le premier but s'inscrivait à la 1 440e minute.
    const matchId = await matchDuSoir(d, "2026-09-06T18:00:00.000Z");
    const id = await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });
    const ev = (await d.local.getLocalMatch(matchId))!.events.find(
      (e) => e.id === id,
    );
    expect(ev?.minute).toBeNull();
  });

  it("un match programmé plus tard n'a pas de minute non plus", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d, "2026-09-14T18:00:00.000Z");
    const id = await d.local.addEvent(matchId, { type: "GOAL", team: "A" });
    const ev = (await d.local.getLocalMatch(matchId))!.events.find(
      (e) => e.id === id,
    );
    expect(ev?.minute).toBeNull();
  });

  it("une minute donnée à la main gagne toujours", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d, "2026-09-06T18:00:00.000Z");
    const id = await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "A",
      minute: 22,
    });
    const ev = (await d.local.getLocalMatch(matchId))!.events.find(
      (e) => e.id === id,
    );
    expect(ev?.minute).toBe(22);
  });

  it("le csc crédite l'équipe qui en profite, et compte au score", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(8);
    // j1 est en A ; son csc profite à B, et personne ne le revendique encore.
    await d.local.addEvent(matchId, { type: "OWN_GOAL", team: "B" });
    const m = await d.local.getLocalMatch(matchId);
    expect([m?.match.scoreA, m?.match.scoreB]).toEqual([0, 1]);
  });

  it("un carton ne touche pas au score", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(30);
    await d.local.addEvent(matchId, {
      type: "YELLOW_CARD",
      team: "A",
      playerId: "j1",
    });
    const m = await d.local.getLocalMatch(matchId);
    expect([m?.match.scoreA, m?.match.scoreB]).toEqual([0, 0]);
    expect(m?.teamA.find((p) => p.id === "j1")?.yellow).toBe(1);
  });

  it("un joueur non inscrit est refusé sur un match interne", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await expect(
      d.local.addEvent(matchId, { type: "GOAL", team: "A", playerId: "j9" }),
    ).rejects.toThrow("Joueur non inscrit à ce match");
    expect(await nb(d.base, "events")).toBe(0);
  });

  it("sur un match extérieur, un buteur hors compo passe", async () => {
    const d = await decor();
    // L'adversaire n'est pas dans l'effectif du club : ses buts doivent
    // rentrer quand même.
    const matchId = await d.local.createMatch({
      clubId: CLUB,
      kind: "EXTERNAL",
      opponentId: "adv1",
      teamAName: "Nous",
      teamBName: "Eux",
      teamA: [{ playerId: "j1", isGk: false }],
      teamB: [],
    });
    d.temps.avancer(3);
    await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "B",
      playerId: "inconnu",
    });
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.match.scoreB).toBe(1);
  });

  it("un match introuvable est refusé", async () => {
    const d = await decor();
    await expect(
      d.local.addEvent("nulle-part", { type: "GOAL", team: "A" }),
    ).rejects.toThrow("Match introuvable");
  });
});

describe("removeEvent", () => {
  it("ne fait rien pour un événement d'un autre match", async () => {
    const d = await decor();
    const m1 = await matchDuSoir(d);
    d.temps.avancer(4);
    const eventId = await d.local.addEvent(m1, { type: "GOAL", team: "A" });
    expect(await d.local.removeEvent("autre-match", eventId)).toBe(false);
    expect(await nb(d.base, "events")).toBe(1);
  });

  it("le score ne descend jamais sous zéro", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(4);
    const eventId = await d.local.addEvent(matchId, { type: "GOAL", team: "A" });
    // Le score est remis à 0 à la main (ce que fait un rejeu serveur mal
    // ordonné) ; l'annulation ne doit pas produire un -1 à l'écran.
    await d.base.executer("UPDATE matches SET score_a = 0 WHERE id = ?", [matchId]);
    await d.local.removeEvent(matchId, eventId);
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.match.scoreA).toBe(0);
  });
});

describe("siffletMiTemps", () => {
  it("fige le chrono, passe en 2de, ET inscrit l'événement dans la file", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.local.demarrerHorloge(matchId);
    d.temps.avancer(25);

    expect(await d.local.siffletMiTemps(matchId)).toBe(true);

    const m = await d.local.getLocalMatch(matchId);
    expect(m?.match.period).toBe(2);
    // Chrono figé : 25 minutes courues, plus rien qui tourne.
    expect(m?.match.clockElapsedMs).toBe(25 * 60_000);
    expect(m?.match.clockRunningSince).toBeNull();

    // L'événement est ce qui sépare les deux périodes dans le récap ; sans
    // lui, le sifflet ne quittait jamais le téléphone.
    expect(m?.events.map((e) => e.type)).toEqual(["HALF_TIME"]);
    expect(m?.events[0].minute).toBe(25);

    const f = await file(d.base);
    expect(f.map((e) => e.op.kind)).toEqual(["createMatch", "addEvent"]);
    const op = f[1].op;
    if (op.kind !== "addEvent") throw new Error("op inattendue");
    expect(op.payload.type).toBe("HALF_TIME");
    expect(op.payload.playerId).toBeNull();
    // Un coup de sifflet ne marque pas : le score n'a pas bougé.
    expect(m?.match.scoreA).toBe(0);
    expect(m?.match.scoreB).toBe(0);
  });

  it("refuse une seconde mi-temps, et n'enfile alors rien", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.local.demarrerHorloge(matchId);
    d.temps.avancer(25);
    await d.local.siffletMiTemps(matchId);

    expect(await d.local.siffletMiTemps(matchId)).toBe(false);
    expect(await nb(d.base, "events")).toBe(1);
    expect(await nb(d.base, "outbox")).toBe(2);
  });

  it("l'événement et la période tombent ensemble, ou pas du tout", async () => {
    const base = await baseNeuve();
    const temps = horloge();
    const ids = compteurIds();
    const sain = creerMatchLocal({ base, maintenant: temps.maintenant, nouvelId: ids });
    await sain.saveRoster(CLUB, EFFECTIF);
    const matchId = await matchDuSoir({ base, local: sain, temps });
    await sain.demarrerHorloge(matchId);
    temps.avancer(25);

    const capricieuse = new BaseCapricieuse(base, (sql) =>
      sql.startsWith("INSERT INTO outbox"),
    );
    const fragile = creerMatchLocal({
      base: capricieuse,
      maintenant: temps.maintenant,
      nouvelId: ids,
    });
    await expect(fragile.siffletMiTemps(matchId)).rejects.toThrow("disque plein");

    // Rien : ni événement, ni période 2, ni chrono figé. Une feuille en 2de
    // période dont le sifflet n'est jamais parti au serveur serait le pire
    // des deux mondes.
    const m = await sain.getLocalMatch(matchId);
    expect(await nb(base, "events")).toBe(0);
    expect(m?.match.period).toBe(1);
    expect(m?.match.clockRunningSince).not.toBeNull();
  });

  it("annuler la mi-temps ramène en première période", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.local.demarrerHorloge(matchId);
    d.temps.avancer(25);
    await d.local.siffletMiTemps(matchId);

    const avant = await d.local.getLocalMatch(matchId);
    const siffle = avant!.events[0];
    expect(await d.local.removeEvent(matchId, siffle.id)).toBe(true);

    // Sinon le sifflet donné par erreur reste donné : le bouton refuserait
    // une vraie mi-temps pour le reste du match.
    const apres = await d.local.getLocalMatch(matchId);
    expect(apres?.match.period).toBe(1);
    expect(apres?.events).toEqual([]);
    expect(await d.local.siffletMiTemps(matchId)).toBe(true);
  });

  it("annuler un but ne touche pas à la période", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.local.demarrerHorloge(matchId);
    d.temps.avancer(25);
    await d.local.siffletMiTemps(matchId);
    d.temps.avancer(3);
    const but = await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });

    await d.local.removeEvent(matchId, but);

    const m = await d.local.getLocalMatch(matchId);
    expect(m?.match.period).toBe(2);
    expect(m?.match.scoreA).toBe(0);
  });
});

describe("undoLastGoalOf", () => {
  it("annule le DERNIER but du joueur, et lui seul", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(5);
    const premier = await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });
    d.temps.avancer(10);
    const dernier = await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });
    d.temps.avancer(2);
    await d.local.addEvent(matchId, { type: "GOAL", team: "B", playerId: "j3" });

    expect(await d.local.undoLastGoalOf(matchId, "j1")).toBe(dernier);
    const evs = (await d.local.getLocalMatch(matchId))!.events;
    expect(evs.map((e) => e.id)).toContain(premier);
    expect(evs.map((e) => e.id)).not.toContain(dernier);
    const m = await d.local.getLocalMatch(matchId);
    expect([m?.match.scoreA, m?.match.scoreB]).toEqual([1, 1]);
  });

  it("rend null quand le joueur n'a rien marqué", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    expect(await d.local.undoLastGoalOf(matchId, "j2")).toBeNull();
  });

  it("ignore les cartons et les csc du joueur", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(6);
    await d.local.addEvent(matchId, {
      type: "YELLOW_CARD",
      team: "A",
      playerId: "j1",
    });
    d.temps.avancer(1);
    // Un csc de j1 : il est inscrit à son nom, mais ce n'est pas un but à lui.
    await d.local.addEvent(matchId, {
      type: "OWN_GOAL",
      team: "B",
      playerId: "j1",
    });
    expect(await d.local.undoLastGoalOf(matchId, "j1")).toBeNull();
  });
});

describe("setEventAssist et setEventScorer", () => {
  it("la passe s'attache à un but déjà saisi", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(9);
    const eventId = await d.local.addEvent(matchId, {
      type: "GOAL",
      team: "A",
      playerId: "j1",
    });
    expect(await d.local.setEventAssist(matchId, eventId, "j2")).toBe(true);

    const m = await d.local.getLocalMatch(matchId);
    expect(m?.events.find((e) => e.id === eventId)?.assistName).toBe("Amadou");
    expect(m?.teamA.find((p) => p.id === "j2")?.assists).toBe(1);
    const op = (await file(d.base)).at(-1)!.op;
    if (op.kind !== "setAssist") throw new Error("op inattendue");
    expect(op.payload).toEqual({ eventId, assistPlayerId: "j2" });
  });

  it("la passe ne s'attache pas à un csc", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(9);
    const eventId = await d.local.addEvent(matchId, {
      type: "OWN_GOAL",
      team: "B",
    });
    expect(await d.local.setEventAssist(matchId, eventId, "j2")).toBe(false);
    // Rien n'est parti : une op inutile serait rejouée contre le serveur.
    expect((await file(d.base)).map((e) => e.op.kind)).toEqual([
      "createMatch",
      "addEvent",
    ]);
  });

  it("le nom du csc s'attache après coup, sans changer l'identifiant", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(14);
    const eventId = await d.local.addEvent(matchId, {
      type: "OWN_GOAL",
      team: "B",
    });
    expect(await d.local.setEventScorer(matchId, eventId, "j1")).toBe(true);
    const m = await d.local.getLocalMatch(matchId);
    const ev = m?.events.find((e) => e.id === eventId);
    expect(ev?.playerId).toBe("j1");
    expect(ev?.playerName).toBe("Ibrahima");
    // Le score n'a pas bougé : le but était déjà compté au premier tap.
    expect(m?.match.scoreB).toBe(1);
  });

  it("un csc annulé entre-temps ne prend pas le nom en silence", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(14);
    const eventId = await d.local.addEvent(matchId, {
      type: "OWN_GOAL",
      team: "B",
    });
    await d.local.removeEvent(matchId, eventId);
    // Le faux, c'est la réponse de l'écran : « ton nom n'a pas été pris ».
    expect(await d.local.setEventScorer(matchId, eventId, "j1")).toBe(false);
  });

  it("setEventScorer refuse un but ordinaire", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(14);
    const eventId = await d.local.addEvent(matchId, { type: "GOAL", team: "A" });
    expect(await d.local.setEventScorer(matchId, eventId, "j1")).toBe(false);
  });
});

// --- La composition ---------------------------------------------------------

describe("movePlayerTeam", () => {
  it("fait passer un joueur de camp, et enfile la correction", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.local.movePlayerTeam(matchId, "j1", "B");
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.teamA.map((p) => p.id)).toEqual(["j2"]);
    expect(m?.teamB.map((p) => p.id).sort()).toEqual(["j1", "j3", "j4"]);
    const op = (await file(d.base)).at(-1)!.op;
    if (op.kind !== "movePlayer") throw new Error("op inattendue");
    expect(op.payload).toEqual({ playerId: "j1", team: "B" });
  });

  it("les buts déjà marqués gardent leur camp d'origine", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(7);
    await d.local.addEvent(matchId, { type: "GOAL", team: "A", playerId: "j1" });
    await d.local.movePlayerTeam(matchId, "j1", "B");
    const m = await d.local.getLocalMatch(matchId);
    // Le score reste 1-0 : le but a bien été marqué pour les Rouges.
    expect([m?.match.scoreA, m?.match.scoreB]).toEqual([1, 0]);
  });

  it("ne vide jamais un camp", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.local.movePlayerTeam(matchId, "j1", "B");
    // j2 est le dernier des Rouges. Un tap de trop en mode correction, et le
    // match se terminait avec tout le monde du même côté — lib/stats.ts
    // inscrivait alors une défaite à dix joueurs.
    await expect(d.local.movePlayerTeam(matchId, "j2", "B")).rejects.toThrow(
      "Il faut au moins un joueur de chaque côté",
    );
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.teamA.map((p) => p.id)).toEqual(["j2"]);
  });

  it("ne fait rien, et n'enfile rien, si le joueur est déjà du bon côté", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.local.movePlayerTeam(matchId, "j1", "A");
    expect((await file(d.base)).map((e) => e.op.kind)).toEqual(["createMatch"]);
  });

  it("refuse l'équipe B d'un match extérieur", async () => {
    const d = await decor();
    const matchId = await d.local.createMatch({
      clubId: CLUB,
      kind: "EXTERNAL",
      opponentId: "adv1",
      teamAName: "Nous",
      teamBName: "Eux",
      teamA: [
        { playerId: "j1", isGk: false },
        { playerId: "j2", isGk: true },
      ],
      teamB: [],
    });
    // Y envoyer un joueur le retirait de l'écran sans retour possible.
    await expect(d.local.movePlayerTeam(matchId, "j1", "B")).rejects.toThrow(
      "Pas d'équipe B à composer sur ce match",
    );
  });

  it("refuse un joueur qui n'est pas de la partie", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await expect(d.local.movePlayerTeam(matchId, "j9", "B")).rejects.toThrow(
      "Joueur non inscrit à ce match",
    );
  });
});

describe("ajouterJoueurAuMatch", () => {
  it("inscrit le retardataire, qui peut alors marquer", async () => {
    const d = await decor();
    const matchId = await d.local.createMatch({
      clubId: CLUB,
      kind: "INTERNAL",
      teamAName: "Rouges",
      teamBName: "Bleus",
      teamA: [{ playerId: "j1", isGk: false }],
      teamB: [{ playerId: "j3", isGk: false }],
    });
    d.temps.avancer(20);
    await d.local.ajouterJoueurAuMatch(matchId, "j2", "A");

    // Avant ce geste, addEvent refusait ses buts et il fallait tout ressaisir.
    d.temps.avancer(1);
    await d.local.addEvent(matchId, { type: "GOAL", team: "A", playerId: "j2" });
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.teamA.find((p) => p.id === "j2")?.goals).toBe(1);
    // Il entre comme joueur de champ, même s'il est gardien sur sa fiche : le
    // rôle du soir se décide sur la compo.
    expect(m?.teamA.find((p) => p.id === "j2")?.isGk).toBe(false);

    const op = (await file(d.base))[1].op;
    if (op.kind !== "addParticipant") throw new Error("op inattendue");
    expect(op.payload).toEqual({ playerId: "j2", team: "A", isGk: false });
  });

  it("un invité arrivé en retard voyage avec son nom", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    const inviteId = await d.local.addLocalGuest(CLUB, "Le voisin");
    d.temps.avancer(25);
    await d.local.ajouterJoueurAuMatch(matchId, inviteId, "B");

    const op = (await file(d.base)).at(-1)!.op;
    if (op.kind !== "addParticipant") throw new Error("op inattendue");
    // Sans `guest`, la route répondait 400 « Joueur hors du club » : un refus,
    // donc le blocage définitif de toute la file du match, buts compris.
    expect(op.payload.guest).toEqual({ id: inviteId, name: "Le voisin" });
  });

  it("un joueur déjà de la partie ne produit rien", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.local.ajouterJoueurAuMatch(matchId, "j1", "B");
    expect((await file(d.base)).map((e) => e.op.kind)).toEqual(["createMatch"]);
    const m = await d.local.getLocalMatch(matchId);
    expect(m?.teamA.map((p) => p.id)).toEqual(["j1", "j2"]);
  });
});

describe("joueursAbsentsDuMatch", () => {
  it("rend le vivier restant, trié par nom", async () => {
    const d = await decor();
    await d.local.saveRoster(CLUB, [
      ...EFFECTIF,
      { id: "j5", name: "Zoumana", skill: 3, isGk: false, isGuest: false },
      { id: "j6", name: "Élodie", skill: 4, isGk: false, isGuest: false },
    ]);
    const matchId = await matchDuSoir(d);
    const absents = await d.local.joueursAbsentsDuMatch(matchId);
    // `localeCompare` : Élodie avant Zoumana, accent compris.
    expect(absents.map((p) => p.name)).toEqual(["Élodie", "Zoumana"]);
  });

  it("écarte les archivés", async () => {
    const d = await decor();
    await d.local.saveRoster(CLUB, [
      ...EFFECTIF,
      {
        id: "j7",
        name: "Parti au bled",
        skill: 3,
        isGk: false,
        isGuest: false,
        isArchived: true,
      },
    ]);
    const matchId = await matchDuSoir(d);
    // Le cache local ne se purge jamais : sans ce filtre, un joueur archivé
    // restait proposé à l'entrée en cours de match et rentrait dans les stats.
    expect(await d.local.joueursAbsentsDuMatch(matchId)).toEqual([]);
  });

  it("rend une liste vide pour un match inconnu", async () => {
    const d = await decor();
    expect(await d.local.joueursAbsentsDuMatch("nulle-part")).toEqual([]);
  });
});

// --- Le cache et les sélecteurs ---------------------------------------------

describe("le cache du club et de l'effectif", () => {
  it("garde les réglages, et les rend par identifiant comme par slug", async () => {
    const d = await decor();
    await d.local.saveClubSettings({
      id: CLUB,
      slug: "renault-five-urban-guy",
      name: "Renault Five Urban Guy",
      colorA: "#e11d48",
      colorB: "#2563eb",
      trackAssists: true,
      trackCards: false,
      motmMode: "VOTE",
      matchDurationMin: 50,
    });

    const parId = await d.local.getLocalClub(CLUB);
    expect(parId?.name).toBe("Renault Five Urban Guy");
    // Les booléens font l'aller-retour en 0/1 sans se perdre.
    expect(parId?.trackAssists).toBe(true);
    expect(parId?.trackCards).toBe(false);
    expect(parId?.savedAt).toBe(COUP_ENVOI);

    const parSlug = await d.local.getLocalClubBySlug("renault-five-urban-guy");
    expect(parSlug?.id).toBe(CLUB);
    expect(await d.local.getLocalClubBySlug("inconnu")).toBeUndefined();
  });

  it("l'effectif remplace les fiches, photos comprises", async () => {
    const d = await decor();
    await d.local.saveRoster(CLUB, [
      { ...EFFECTIF[0], photo: "data:image/jpeg;base64,AAA", nickname: "Ibou" },
    ]);
    const matchId = await matchDuSoir(d);
    const m = await d.local.getLocalMatch(matchId);
    // La feuille doit montrer les visages au bord du terrain, sans réseau.
    expect(m?.teamA.find((p) => p.id === "j1")?.photo).toBe(
      "data:image/jpeg;base64,AAA",
    );
  });

  it("un invité local est un joueur du club, marqué invité", async () => {
    const d = await decor();
    const id = await d.local.addLocalGuest(CLUB, "Le cousin");
    const l = await d.base.premier<{ is_guest: number; skill: number; club_id: string }>(
      "SELECT is_guest, skill, club_id FROM roster WHERE id = ?",
      [id],
    );
    expect(l).toEqual({ is_guest: 1, skill: 3, club_id: CLUB });
  });
});

describe("getLiveMatchOfClub", () => {
  it("rend le match en cours le plus récent, et ignore les terminés", async () => {
    const d = await decor();
    const vieux = await matchDuSoir(d, "2026-09-01T18:00:00.000Z");
    const recent = await matchDuSoir(d, "2026-09-07T18:00:00.000Z");
    expect((await d.local.getLiveMatchOfClub(CLUB))?.id).toBe(recent);

    // C'est LE chemin de reprise du lundi soir : l'app tuée, rouverte, le
    // match retrouvé — sans serveur.
    await d.local.finishMatch(recent, null);
    expect((await d.local.getLiveMatchOfClub(CLUB))?.id).toBe(vieux);
    await d.local.finishMatch(vieux, null);
    expect(await d.local.getLiveMatchOfClub(CLUB)).toBeUndefined();
  });

  it("ne rend pas le match d'un autre club", async () => {
    const d = await decor();
    await matchDuSoir(d);
    expect(await d.local.getLiveMatchOfClub("club2")).toBeUndefined();
  });
});

describe("pendingOpsForMatch", () => {
  it("compte ce qui reste à envoyer pour ce match, et seulement lui", async () => {
    const d = await decor();
    const m1 = await matchDuSoir(d);
    d.temps.avancer(3);
    await d.local.addEvent(m1, { type: "GOAL", team: "A", playerId: "j1" });
    const m2 = await d.local.launchScheduledMatch({
      id: "m2",
      clubId: CLUB,
      kind: "INTERNAL",
      teamAName: "Rouges",
      teamBName: "Bleus",
      teamA: [{ playerId: "j1", isGk: false }],
      teamB: [{ playerId: "j3", isGk: false }],
    });

    expect(await d.local.pendingOpsForMatch(m1)).toBe(2);
    expect(await d.local.pendingOpsForMatch(m2)).toBe(1);
    expect(await d.local.pendingOpsForMatch("nulle-part")).toBe(0);
  });

  it("compte aussi les opérations refusées par le serveur", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    await d.base.executer("UPDATE outbox SET blocked_at = ? WHERE match_id = ?", [
      COUP_ENVOI,
      matchId,
    ]);
    // Une opération bloquée n'est pas partie : le récap ne doit pas se croire
    // complet. La distinction attente/refus se lit dans `compteurs()`.
    expect(await d.local.pendingOpsForMatch(matchId)).toBe(1);
    expect(await compteurs(d.base)).toEqual({ enAttente: 0, bloquees: 1 });
  });
});

describe("getLocalMatch", () => {
  it("rend la chronologie dans l'ordre, avec les noms", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(5);
    await d.local.addEvent(matchId, { type: "GOAL", team: "A", playerId: "j1" });
    d.temps.avancer(10);
    await d.local.addEvent(matchId, { type: "GOAL", team: "B", playerId: "j3" });
    d.temps.avancer(5);
    await d.local.addEvent(matchId, { type: "HALF_TIME", team: "A" });

    const m = await d.local.getLocalMatch(matchId);
    expect(m?.events.map((e) => [e.minute, e.type, e.playerName])).toEqual([
      [5, "GOAL", "Ibrahima"],
      [15, "GOAL", "Bakary"],
      [20, "HALF_TIME", null],
    ]);
    expect([m?.match.scoreA, m?.match.scoreB]).toEqual([1, 1]);
  });

  it("un joueur sorti du cache ne casse pas la feuille", async () => {
    const d = await decor();
    const matchId = await matchDuSoir(d);
    d.temps.avancer(5);
    await d.local.addEvent(matchId, { type: "GOAL", team: "A", playerId: "j1" });
    await d.base.executer("DELETE FROM roster WHERE id = ?", ["j1"]);
    const m = await d.local.getLocalMatch(matchId);
    // « ? » plutôt qu'un écran blanc : la feuille du soir doit s'afficher même
    // si le cache de l'effectif a été vidé.
    expect(m?.teamA.find((p) => p.id === "j1")?.name).toBe("?");
    expect(m?.events[0].playerName).toBe("?");
  });

  it("rend null pour un match inconnu", async () => {
    const d = await decor();
    expect(await d.local.getLocalMatch("nulle-part")).toBeNull();
  });
});

// --- La reprise -------------------------------------------------------------

describe("la reprise après fermeture de l'app", () => {
  it("une seconde instance retrouve le match et la file sur le même fichier", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dossier = mkdtempSync(join(tmpdir(), "five-scorer-match-"));
    const chemin = join(dossier, "five-scorer.db");
    try {
      const temps = horloge();
      const b1 = await baseNeuve(chemin);
      const a1 = creerMatchLocal({
        base: b1,
        maintenant: temps.maintenant,
        nouvelId: compteurIds("a"),
      });
      await a1.saveRoster(CLUB, EFFECTIF);
      const matchId = await matchDuSoir({ base: b1, local: a1, temps });
      temps.avancer(12);
      await a1.addEvent(matchId, { type: "GOAL", team: "A", playerId: "j1" });
      // L'app est tuée : pas de fermeture propre, juste la connexion perdue.
      b1.fermer();

      const b2 = await baseNeuve(chemin);
      const a2 = creerMatchLocal({
        base: b2,
        maintenant: temps.maintenant,
        nouvelId: compteurIds("b"),
      });
      const m = await a2.getLocalMatch(matchId);
      expect(m?.match.scoreA).toBe(1);
      expect(m?.events).toHaveLength(1);
      expect(await a2.pendingOpsForMatch(matchId)).toBe(2);
      // La file repart à la bonne place : la création d'abord, jamais le but.
      expect((await prochaineActive(b2))?.op.kind).toBe("createMatch");

      // Et la saisie continue là où elle s'était arrêtée.
      temps.avancer(3);
      await a2.addEvent(matchId, { type: "GOAL", team: "B", playerId: "j3" });
      expect((await a2.getLocalMatch(matchId))?.match.scoreB).toBe(1);
      b2.fermer();
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
