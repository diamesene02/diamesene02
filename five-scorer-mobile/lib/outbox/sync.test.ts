// Le drain de l'outbox, éprouvé contre un faux serveur et un vrai SQLite.
//
// C'est le test qui valide tout le reste, et il ne demande aucune interface :
// une base « node:sqlite » (le même moteur que sur le téléphone), un `fetch`
// de papier, et la machine à états au milieu.
//
// Le test central n'est pas « une opération part bien ». C'est celui de la
// reprise : cinquante opérations enfilées, serveur en panne, PROCESSUS TUÉ au
// milieu — une seconde instance rouverte sur le même fichier doit tout
// retrouver, dans l'ordre, sans doublon. C'est la promesse qu'on fait au
// marqueur quand on lui dit « saisis, ça partira tout seul ».

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCHEMA } from "../../db/schema";
import { appliquerSchema, type Base } from "./base";
import { BaseNode } from "./baseNode";
import { creerDrain, delaiRelance, type Drain } from "./sync";
import { compteurs, enfiler, prochaineActive } from "./outbox";
import type { OutboxOp } from "./types";

const QUAND = "2026-09-09T20:00:00.000Z";

async function baseNeuve(chemin = ":memory:"): Promise<BaseNode> {
  const base = BaseNode.ouvrir(chemin);
  await appliquerSchema(base, SCHEMA);
  return base;
}

// --- Le faux serveur --------------------------------------------------------

type Recu = { url: string; init: RequestInit };

/// Un serveur de papier. `reponse` décide du sort de chaque requête ; par
/// défaut tout est accepté.
function serveur(
  reponse: (recu: Recu, rang: number) => Response | Promise<Response> | never = () =>
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
) {
  const recus: Recu[] = [];
  const fetchFaux = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const recu = { url: String(url), init };
    recus.push(recu);
    return reponse(recu, recus.length - 1);
  }) as unknown as typeof globalThis.fetch;
  return { recus, fetch: fetchFaux };
}

function refus(status: number, error = "non"): Response {
  return new Response(JSON.stringify({ error }), { status });
}

// --- Les opérations ---------------------------------------------------------

function but(matchId: string, id: string): OutboxOp {
  return {
    kind: "addEvent",
    clubId: "club1",
    matchId,
    payload: {
      id,
      type: "GOAL",
      team: "A",
      playerId: "j1",
      minute: 12,
      createdAt: QUAND,
    },
  };
}

/// Une opération de chaque sorte : les huit variantes d'OutboxOp, donc les
/// huit rejeux à couvrir.
const TOUTES: OutboxOp[] = [
  {
    kind: "createMatch",
    clubId: "club1",
    matchId: "m1",
    payload: {
      id: "m1",
      playedAt: QUAND,
      matchKind: "INTERNAL",
      teamAName: "Rouges",
      teamBName: "Bleus",
      teamA: [{ playerId: "j1", isGk: true }],
      teamB: [{ playerId: "j2", isGk: true }],
      guests: [],
    },
  },
  but("m1", "e1"),
  { kind: "removeEvent", clubId: "club1", matchId: "m1", payload: { eventId: "e1" } },
  {
    kind: "setAssist",
    clubId: "club1",
    matchId: "m1",
    payload: { eventId: "e2", assistPlayerId: "j3" },
  },
  {
    kind: "setScorer",
    clubId: "club1",
    matchId: "m1",
    payload: { eventId: "e3", scorerPlayerId: "j4" },
  },
  {
    kind: "addParticipant",
    clubId: "club1",
    matchId: "m1",
    payload: { playerId: "j5", team: "B", isGk: false },
  },
  {
    kind: "movePlayer",
    clubId: "club1",
    matchId: "m1",
    payload: { playerId: "j5", team: "A" },
  },
  {
    kind: "finishMatch",
    clubId: "club1",
    matchId: "m1",
    payload: { mvpId: "j1", durationMin: 60 },
  },
];

// --- L'atelier --------------------------------------------------------------

type Atelier = {
  base: Base;
  drain: Drain;
  recus: Recu[];
  /// Les délais demandés à la relance, dans l'ordre.
  relances: number[];
};

function atelier(
  base: Base,
  reponse?: (recu: Recu, rang: number) => Response | Promise<Response>,
): Atelier {
  const s = serveur(reponse);
  const relances: number[] = [];
  const drain = creerDrain({
    base,
    api: "https://serveur.test",
    fetch: s.fetch,
    cookie: async () => "better-auth.session_token=jeton",
    maintenant: () => new Date(QUAND),
    // On enregistre le délai sans jamais rappeler : un test qui attend
    // vraiment cinq secondes est un test qu'on finit par désactiver.
    planifier: (_fn, ms) => {
      relances.push(ms);
      return relances.length;
    },
    annuler: () => {},
  });
  return { base, drain, recus: s.recus, relances };
}

let aFermer: BaseNode[] = [];
let aNettoyer: string[] = [];

beforeEach(() => {
  aFermer = [];
  aNettoyer = [];
});
afterEach(() => {
  for (const b of aFermer) b.fermer();
  for (const d of aNettoyer) rmSync(d, { recursive: true, force: true });
});

async function base(): Promise<BaseNode> {
  const b = await baseNeuve();
  aFermer.push(b);
  return b;
}

// ---------------------------------------------------------------------------

describe("les huit rejeux", () => {
  it("tapent une route et un verbe par sorte d'opération", async () => {
    const b = await base();
    for (const op of TOUTES) await enfiler(b, op, QUAND);

    const a = atelier(b);
    await a.drain.vider();

    // 8 opérations → 8 appels. Le chiffre est celui du §3.3 de MOBILE.md.
    expect(a.recus).toHaveLength(8);
    const racine = "https://serveur.test/api/clubs/club1";
    expect(a.recus.map((r) => `${r.init.method} ${r.url}`)).toEqual([
      `POST ${racine}/matches`,
      `POST ${racine}/matches/m1/events`,
      `DELETE ${racine}/matches/m1/events?eventId=e1`,
      `PATCH ${racine}/matches/m1/events`,
      `PATCH ${racine}/matches/m1/events`,
      `POST ${racine}/matches/m1/lineup`,
      `PATCH ${racine}/matches/m1/lineup`,
      `PATCH ${racine}/matches/m1`,
    ]);
    expect((await compteurs(b)).enAttente).toBe(0);
  });

  it("posent le cookie à la main et coupent le bocal du navigateur", async () => {
    const b = await base();
    await enfiler(b, but("m1", "e1"), QUAND);

    const a = atelier(b);
    await a.drain.vider();

    const init = a.recus[0].init as RequestInit & {
      headers: Record<string, string>;
    };
    // React Native n'a pas de bocal à cookies : « include » ne ferait rien, et
    // le serveur verrait une requête anonyme — donc un 401 incompréhensible.
    expect(init.credentials).toBe("omit");
    expect(init.headers.cookie).toBe("better-auth.session_token=jeton");
    // Le délai de huit secondes est armé pour chaque rejeu.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("envoie le corps attendu par la route « match terminé »", async () => {
    const b = await base();
    await enfiler(b, TOUTES[7], QUAND);

    const a = atelier(b);
    await a.drain.vider();

    expect(JSON.parse(String(a.recus[0].init.body))).toEqual({
      status: "FINISHED",
      mvpId: "j1",
      durationMin: 60,
    });
  });
});

describe("l'ordre de la file", () => {
  it("se prend sur l'identifiant, jamais sur l'horodatage", async () => {
    const b = await base();
    // L'horloge du téléphone recule (correction NTP, fuseau, réglage manuel).
    // Le premier but est enfilé « après » le second et le troisième.
    await enfiler(b, but("m1", "e1"), "2026-09-09T20:10:00.000Z");
    await enfiler(b, but("m1", "e2"), "2026-09-09T20:00:00.000Z");
    await enfiler(b, but("m1", "e3"), "2026-09-09T19:50:00.000Z");

    const a = atelier(b);
    await a.drain.vider();

    const envoyes = a.recus.map((r) => JSON.parse(String(r.init.body)).id);
    expect(envoyes).toEqual(["e1", "e2", "e3"]);
  });
});

describe("le serveur répond mal", () => {
  it("500 : l'opération reste en tête, la tentative est comptée, on se replanifie", async () => {
    const b = await base();
    await enfiler(b, but("m1", "e1"), QUAND);
    await enfiler(b, but("m1", "e2"), QUAND);

    const a = atelier(b, () => refus(500, "serveur en vrac"));
    await a.drain.vider();

    // Une seule tentative : la file s'arrête au premier échec réessayable,
    // sinon elle brûlerait la batterie contre un serveur à terre.
    expect(a.recus).toHaveLength(1);
    const suivante = await prochaineActive(b);
    expect(suivante?.attempts).toBe(1);
    // Toujours en tête : un échec réessayable ne fait pas perdre sa place.
    expect((suivante?.op as { payload: { id: string } }).payload.id).toBe("e1");
    expect((await compteurs(b)).enAttente).toBe(2);
    expect(a.drain.etat().derniereErreur).toContain("500");
    // 10 s, pas 5 : le compteur d'échecs est incrémenté AVANT la
    // replanification (`echecs += 1` puis le `finally`), exactement comme côté
    // web. Le plancher à 5 s ne sert donc qu'aux passages qui se terminent
    // sans échec en laissant de la file — après un blocage 403, par exemple.
    expect(a.relances).toEqual([10000]);
  });

  it("le réseau qui tombe se lit comme un 500", async () => {
    const b = await base();
    await enfiler(b, but("m1", "e1"), QUAND);

    const a = atelier(b, () => {
      throw new Error("Network request failed");
    });
    await a.drain.vider();

    expect((await compteurs(b)).enAttente).toBe(1);
    expect(a.drain.etat().reconnexionRequise).toBe(false);
    expect(a.relances).toEqual([10000]);
  });

  it("401 : on garde tout, on s'arrête, et on demande de se reconnecter", async () => {
    const b = await base();
    await enfiler(b, but("m1", "e1"), QUAND);
    await enfiler(b, but("m1", "e2"), QUAND);

    const a = atelier(b, () => refus(401, "non connecté"));
    await a.drain.vider();

    expect(a.recus).toHaveLength(1);
    expect(a.drain.etat().reconnexionRequise).toBe(true);
    expect((await compteurs(b)).enAttente).toBe(2);
    // Rien à replanifier : réessayer sans session ne peut que redonner 401.
    expect(a.relances).toEqual([]);
  });

  it("un rejeu accepté rabaisse le drapeau de reconnexion", async () => {
    const b = await base();
    await enfiler(b, but("m1", "e1"), QUAND);

    let refuser = true;
    const a = atelier(b, () => (refuser ? refus(401) : new Response("{}", { status: 200 })));
    await a.drain.vider();
    expect(a.drain.etat().reconnexionRequise).toBe(true);

    refuser = false;
    await a.drain.vider();
    expect(a.drain.etat().reconnexionRequise).toBe(false);
    expect((await compteurs(b)).enAttente).toBe(0);
  });
});

describe("le refus 403", () => {
  it("bloque toute la chaîne du match, sans rien supprimer, et laisse passer les autres", async () => {
    const b = await base();
    // Trois opérations du match refusé, deux d'un autre match : la soirée
    // continue pour ceux qui n'ont rien à voir avec le refus.
    await enfiler(b, but("m1", "e1"), QUAND);
    await enfiler(b, but("m1", "e2"), QUAND);
    await enfiler(b, but("m2", "e3"), QUAND);
    await enfiler(b, but("m1", "e4"), QUAND);
    await enfiler(b, but("m2", "e5"), QUAND);

    const a = atelier(b, (recu) =>
      recu.url.includes("/matches/m1/") ? refus(403, "droits insuffisants") : new Response("{}", { status: 200 }),
    );
    await a.drain.vider();

    // Le refus n'a été essuyé qu'une fois : les deux autres opérations de m1
    // ont été mises de côté sans être tentées. Sans ce blocage en cascade, le
    // `finishMatch` de m1 serait passé PAR-DESSUS un but refusé, et le but
    // serait devenu irrécupérable.
    const tentes = a.recus.filter((r) => r.url.includes("/matches/m1/"));
    expect(tentes).toHaveLength(1);

    const c = await compteurs(b);
    expect(c.bloquees).toBe(3);
    expect(c.enAttente).toBe(0);

    // Rien n'a été supprimé : cinq opérations enfilées, trois conservées et
    // deux acquittées par le serveur.
    const bloquees = await a.drain.listerBloquees();
    expect(bloquees.map((o) => (o.op as { payload: { id: string } }).payload.id)).toEqual([
      "e1",
      "e2",
      "e4",
    ]);
    expect(bloquees.every((o) => o.lastError?.startsWith("403"))).toBe(true);

    // Les deux opérations de m2 sont bien parties.
    expect(a.recus.filter((r) => r.url.includes("/matches/m2/"))).toHaveLength(2);
  });

  it("rejouerBloquees les remet dans la file, compteur de tentatives remis à zéro", async () => {
    const b = await base();
    await enfiler(b, but("m1", "e1"), QUAND);
    await enfiler(b, but("m1", "e2"), QUAND);

    let interdit = true;
    const a = atelier(b, () => (interdit ? refus(403) : new Response("{}", { status: 200 })));
    await a.drain.vider();
    expect((await compteurs(b)).bloquees).toBe(2);

    // L'admin a rétabli les droits.
    interdit = false;
    const remises = await a.drain.rejouerBloquees();
    await a.drain.vider();

    expect(remises).toBe(2);
    expect(await compteurs(b)).toEqual({ enAttente: 0, bloquees: 0 });
  });
});

describe("hors ligne", () => {
  it("ne tente rien, et repart tout seul au retour du réseau", async () => {
    const b = await base();
    await enfiler(b, but("m1", "e1"), QUAND);

    const s = serveur();
    const drain = creerDrain({
      base: b,
      api: "https://serveur.test",
      fetch: s.fetch,
      enLigne: false,
      planifier: () => 0,
      annuler: () => {},
    });

    await drain.vider();
    expect(s.recus).toHaveLength(0);

    drain.definirEnLigne(true);
    await drain.vider();
    expect(s.recus).toHaveLength(1);
    expect((await compteurs(b)).enAttente).toBe(0);
  });
});

describe("la relance", () => {
  it("double à chaque échec, et plafonne à soixante secondes", () => {
    expect([0, 1, 2, 3, 4, 5, 12].map(delaiRelance)).toEqual([
      5000, 10000, 20000, 40000, 60000, 60000, 60000,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Le test qui compte : la soirée entière, serveur à terre, processus tué.
// ---------------------------------------------------------------------------

describe("cinquante opérations, serveur en panne, processus relancé", () => {
  it("n'en perd aucune, n'en duplique aucune, garde l'ordre", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "five-outbox-"));
    aNettoyer.push(dossier);
    const chemin = join(dossier, "five-scorer.db");

    // --- Première vie : le marqueur saisit, le serveur est à terre.
    const b1 = await baseNeuve(chemin);
    for (let i = 0; i < 50; i++) await enfiler(b1, but("m1", `e${i}`), QUAND);

    const a1 = atelier(b1, () => {
      throw new Error("Network request failed");
    });
    await a1.drain.vider();
    expect((await compteurs(b1)).enAttente).toBe(50);
    // Le processus meurt ici : Expo Go rechargé, téléphone à plat, iOS qui
    // récupère la mémoire pendant que l'écran est éteint.
    b1.fermer();

    // --- Deuxième vie : même fichier, serveur revenu, mais capricieux.
    const b2 = BaseNode.ouvrir(chemin);
    aFermer.push(b2);
    await appliquerSchema(b2, SCHEMA);

    const recus: string[] = [];
    let panne = true;
    const a2 = atelier(b2, (recu) => {
      const id = JSON.parse(String(recu.init.body)).id as string;
      // Le serveur lâche une fois sur sept : un vrai réseau de gymnase.
      if (panne && recus.length === 20) {
        panne = false;
        throw new Error("Network request failed");
      }
      recus.push(id);
      return new Response("{}", { status: 200 });
    });

    // Le premier passage s'arrête à la coupure ; le second reprend où il en
    // était — c'est exactement ce que fait la relance planifiée, en vrai.
    await a2.drain.vider();
    await a2.drain.vider();

    const attendus = Array.from({ length: 50 }, (_, i) => `e${i}`);
    expect(recus).toEqual(attendus); // ordre conservé
    expect(new Set(recus).size).toBe(50); // aucune duplication
    expect(await compteurs(b2)).toEqual({ enAttente: 0, bloquees: 0 }); // aucune perte
  });
});
