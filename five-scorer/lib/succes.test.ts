// Les succès — le moteur pur (lib/succes.ts), sur des historiques de papier.
//
// Aucune base : le moteur reçoit un historique compact et rend le club. Les
// cas ci-dessous sont ceux qui feraient mentir un succès au bord du terrain —
// la soirée cumulée qui fabrique des triplés, le but ajouté en correction
// qui invente une remontada, la soirée annulée qui casserait une série,
// l'invité qui prendrait la tête des niveaux.

import { describe, it, expect } from "vitest";
import { computeElo } from "./elo";
import { cleJour } from "./jour";
import {
  calculerSucces,
  FAMILLES,
  jourDuClub,
  lireOrdreDesButs,
  matiereDuPalier,
  niveauPourXp,
  seuilNiveau,
  titreNiveau,
  type Camp,
  type Historique,
  type JoueurHistorique,
  type MatchHistorique,
  type SaisonHistorique,
  type VoteHistorique,
} from "./succes";

// ─── Fabrique d'historiques ───────────────────────────────────────────────

/// Le n-ième lundi de 2026 (le 5 janvier est un lundi), 19 h à Paris en
/// hiver ; `k` décale de quinze minutes par match de la soirée.
const lundi = (n: number, k = 0) =>
  new Date(Date.UTC(2026, 0, 5 + 7 * n, 18, 0) + k * 15 * 60_000);

type But = { camp: Camp; par?: string | null; passe?: string | null; min?: number | null; csc?: boolean };
const but = (camp: Camp, par: string | null, extra: Omit<But, "camp" | "par"> = {}): But => ({
  camp,
  par,
  ...extra,
});

type SpecMatch = {
  id: string;
  le: Date;
  cree?: Date;
  soiree?: string | null;
  saison?: string | null;
  kind?: "INTERNAL" | "EXTERNAL";
  status?: MatchHistorique["status"];
  a: string[];
  b?: string[];
  buts?: But[];
  mvp?: string | null;
  gk?: string[];
  corrige?: boolean;
};

function match(s: SpecMatch): MatchHistorique {
  const buts = s.buts ?? [];
  return {
    id: s.id,
    playedAt: s.le,
    createdAt: s.cree ?? s.le,
    matchDayId: s.soiree ?? null,
    seasonId: s.saison ?? null,
    kind: s.kind ?? "INTERNAL",
    status: s.status ?? "FINISHED",
    scoreA: buts.filter((x) => x.camp === "A").length,
    scoreB: buts.filter((x) => x.camp === "B").length,
    mvpId: s.mvp ?? null,
    correctedAt: s.corrige ? new Date(s.le.getTime() + 3600_000) : null,
    participants: [
      ...s.a.map((playerId) => ({ playerId, initialTeam: "A" as const, isGk: !!s.gk?.includes(playerId) })),
      ...(s.b ?? []).map((playerId) => ({ playerId, initialTeam: "B" as const, isGk: !!s.gk?.includes(playerId) })),
    ],
    events: buts.map((x, i) => ({
      id: `${s.id}-e${i}`,
      type: x.csc ? ("OWN_GOAL" as const) : ("GOAL" as const),
      team: x.camp,
      playerId: x.par ?? null,
      assistPlayerId: x.passe ?? null,
      // Par défaut, une feuille minutée dans l'ordre de saisie.
      minute: x.min === undefined ? i + 1 : x.min,
      createdAt: new Date(s.le.getTime() + (i + 1) * 1000),
    })),
  };
}

const joueur = (id: string, extra: Partial<JoueurHistorique> = {}): JoueurHistorique => ({
  id,
  name: id,
  isGuest: false,
  isArchived: false,
  userId: null,
  ...extra,
});

function historique(p: {
  matchs: MatchHistorique[];
  joueurs?: JoueurHistorique[];
  saisons?: SaisonHistorique[];
  annulees?: string[];
  votes?: VoteHistorique[];
  reglages?: Partial<Historique["reglages"]>;
}): Historique {
  // Sans liste explicite, tous ceux que l'historique nomme sont du club.
  const ids = new Set<string>();
  for (const m of p.matchs) {
    for (const x of m.participants) ids.add(x.playerId);
    for (const e of m.events) {
      if (e.playerId) ids.add(e.playerId);
      if (e.assistPlayerId) ids.add(e.assistPlayerId);
    }
    if (m.mvpId) ids.add(m.mvpId);
  }
  const joueurs = p.joueurs ?? [...ids].map((id) => joueur(id));
  return {
    reglages: { pointsWin: 3, pointsDraw: 1, trackAssists: true, motmMode: "VOTE", ...p.reglages },
    matchs: p.matchs,
    joueurs,
    saisons: p.saisons ?? [],
    soireesAnnulees: p.annulees ?? [],
    votes: p.votes ?? [],
  };
}

const MAINTENANT = new Date("2026-09-21T12:00:00Z");
const calcul = (h: Historique, maintenant = MAINTENANT) => calculerSucces(h, maintenant);

function badge(h: Historique, playerId: string, id: string) {
  const s = calcul(h).parJoueur.get(playerId);
  if (!s) throw new Error(`joueur ${playerId} absent`);
  const b = s.badges.find((x) => x.id === id);
  if (!b) throw new Error(`badge ${id} absent pour ${playerId}`);
  return b;
}
const deblocagesDe = (h: Historique, playerId: string, id: string) =>
  calcul(h).parJoueur.get(playerId)!.deblocages.filter((d) => d.badgeId === id);
const serie = (h: Historique, playerId: string, id: string) =>
  calcul(h).parJoueur.get(playerId)!.series.find((s) => s.id === id)!;

// ─── Le jour du club ──────────────────────────────────────────────────────

describe("jourDuClub", () => {
  it("rend exactement la clé de cleJour (lib/jour.ts), changements d'heure compris", () => {
    const instants = [
      "2026-09-14T21:30:00Z", // 23:30 à Paris, le 14
      "2026-09-14T22:30:00Z", // 00:30 à Paris, le 15
      "2026-10-24T23:30:00Z", // veille du passage à l'heure d'hiver
      "2026-10-25T23:30:00Z",
      "2026-03-28T23:30:00Z", // passage à l'heure d'été
      "2026-03-29T22:30:00Z",
      "2026-01-05T18:00:00Z",
      "2026-12-31T23:30:00Z",
    ];
    for (const s of instants) expect(jourDuClub(new Date(s))).toBe(cleJour(new Date(s)));
  });
});

// ─── Niveau, matières ─────────────────────────────────────────────────────

describe("niveau", () => {
  it("suit les seuils 0 / 100 / 300 / 600 / 1000", () => {
    expect([1, 2, 3, 4, 5, 10, 20].map(seuilNiveau)).toEqual([0, 100, 300, 600, 1000, 4500, 19000]);
    expect(niveauPourXp(0).niveau).toBe(1);
    expect(niveauPourXp(99).niveau).toBe(1);
    expect(niveauPourXp(100).niveau).toBe(2);
    expect(niveauPourXp(299).niveau).toBe(2);
    expect(niveauPourXp(300).niveau).toBe(3);
    expect(niveauPourXp(600).niveau).toBe(4);
    expect(niveauPourXp(1000).niveau).toBe(5);
    expect(niveauPourXp(4500).niveau).toBe(10);
    expect(niveauPourXp(18999).niveau).toBe(19);
    expect(niveauPourXp(19000).niveau).toBe(20);
  });

  it("donne le titre de chaque tranche", () => {
    expect([1, 2, 3, 5, 6, 9, 10, 14, 15, 19, 20, 31].map(titreNiveau)).toEqual([
      "Recrue", "Recrue", "Titulaire", "Titulaire", "Cadre", "Cadre",
      "Taulier", "Taulier", "Pilier", "Pilier", "Légende", "Légende",
    ]);
  });

  it("mesure la progression vers le niveau suivant", () => {
    const n = niveauPourXp(450);
    expect(n).toMatchObject({ niveau: 3, titre: "Titulaire", xp: 450, xpNiveau: 300, xpSuivant: 600 });
    expect(n.progression).toBe(0.5);
  });

  it("donne sa matière à chaque rang de palier, et l'or à un palier unique", () => {
    expect([1, 2, 3, 4, 5, 6, 8].map((r) => matiereDuPalier(r, 8))).toEqual([
      "bronze", "argent", "or", "platine", "legende", "legende", "legende",
    ]);
    expect(matiereDuPalier(1, 1)).toBe("or");
  });
});

// ─── Ce qui compte ────────────────────────────────────────────────────────

describe("ce qui compte", () => {
  it("ignore les matchs annulés, en direct et programmés", () => {
    const h = historique({
      matchs: [
        match({ id: "annule", le: lundi(0), status: "CANCELED", a: ["k"], b: ["z"], buts: [but("A", "k")] }),
        match({ id: "direct", le: lundi(1), status: "LIVE", a: ["k"], b: ["z"], buts: [but("A", "k")] }),
        match({ id: "prevu", le: lundi(2), status: "SCHEDULED", a: ["k"], b: ["z"] }),
      ],
    });
    const s = calcul(h).parJoueur.get("k")!;
    expect(s.deblocages).toEqual([]);
    expect(s.niveau.xp).toBe(0);
    expect(s.badges.find((b) => b.id === "centurion")!.valeur).toBe(0);
  });

  it("départage deux matchs au même playedAt par createdAt, pas par id", () => {
    // « m1 » a le plus petit id mais a été saisi APRÈS « m2 » : l'ordre de
    // saisie est l'ordre joué. Défaite puis victoire : série en cours de 1.
    const h = historique({
      matchs: [
        match({ id: "m1", le: lundi(0), cree: new Date(lundi(0).getTime() + 60_000), a: ["p"], b: ["z"], buts: [but("A", "p")] }),
        match({ id: "m2", le: lundi(0), cree: lundi(0), a: ["p"], b: ["z"], buts: [but("B", "z")] }),
      ],
    });
    expect(serie(h, "p", "victoires").enCours).toBe(1);
  });

  it("rend toutes les familles du catalogue quand le club suit tout", () => {
    const h = historique({ matchs: [match({ id: "m", le: lundi(0), a: ["p"], b: ["z"] })] });
    const s = calcul(h).parJoueur.get("p")!;
    expect(s.badges.map((b) => b.id)).toEqual(FAMILLES.map((f) => f.id));
    expect(FAMILLES).toHaveLength(26);
  });
});

// ─── Cumuls ───────────────────────────────────────────────────────────────

describe("cumuls", () => {
  it("date chaque palier au match qui franchit le seuil", () => {
    const h = historique({
      matchs: [
        match({ id: "m1", le: lundi(0), a: ["k"], b: ["z"], buts: [but("A", "k"), but("A", "k")] }),
        match({ id: "m2", le: lundi(1), a: ["k"], b: ["z"], buts: [but("A", "k"), but("A", "k")] }),
        match({ id: "m3", le: lundi(2), a: ["k"], b: ["z"], buts: [but("A", "k")] }),
      ],
    });
    const b = badge(h, "k", "buteur");
    expect(b).toMatchObject({
      palier: 2, matiere: "argent", valeur: 5, prochain: 10,
      matchId: "m3", obtenuLe: lundi(2).toISOString(), description: "5 buts en carrière",
    });
    expect(deblocagesDe(h, "k", "buteur").map((d) => [d.seuil, d.matchId, d.libelle])).toEqual([
      [5, "m3", "5 buts"],
      [1, "m1", "Premier but"],
    ]);
  });

  it("ne compte pas un CSC comme un but de son auteur", () => {
    const h = historique({
      matchs: [match({ id: "m", le: lundi(0), a: ["k"], b: ["z"], buts: [but("B", "k", { csc: true })] })],
    });
    expect(badge(h, "k", "buteur").valeur).toBe(0);
    expect(badge(h, "z", "buteur").valeur).toBe(0);
  });

  it("compte les passes décisives", () => {
    const buts = [1, 2, 3, 4, 5].map(() => but("A", "k", { passe: "p" }));
    const h = historique({ matchs: [match({ id: "m", le: lundi(0), a: ["k", "p"], b: ["z"], buts })] });
    expect(badge(h, "p", "passeur")).toMatchObject({ palier: 2, valeur: 5, matchId: "m" });
  });

  it("compte les matchs EXTERNAL dans les buts, les matchs et les victoires", () => {
    const h = historique({
      matchs: [
        match({ id: "x1", le: lundi(0), kind: "EXTERNAL", a: ["k"], buts: [but("A", "k"), but("B", null)] }),
        match({ id: "x2", le: lundi(1), kind: "EXTERNAL", a: ["k"], buts: [but("A", "k")] }),
        // Un but sans participation, possible sur un EXTERNAL : il compte,
        // comme au classement (getLeaderboard).
        match({ id: "x3", le: lundi(2), kind: "EXTERNAL", a: ["p"], buts: [but("A", "k")] }),
      ],
    });
    expect(badge(h, "k", "buteur").valeur).toBe(3);
    expect(badge(h, "k", "centurion").valeur).toBe(2);
    expect(badge(h, "k", "victoires").valeur).toBe(1);
  });

  it("ne tire aucune soirée, aucun Élo ni aucune soirée gagnée d'un EXTERNAL", () => {
    const h = historique({
      matchs: [match({ id: "x", le: lundi(0), kind: "EXTERNAL", a: ["k"], buts: [but("A", "k")] })],
    });
    const s = calcul(h).parJoueur.get("k")!;
    expect(s.badges.find((b) => b.id === "habitue")!.valeur).toBe(0);
    expect(s.badges.find((b) => b.id === "roi-du-lundi")!.valeur).toBe(0);
    expect(s.badges.find((b) => b.id === "elo")!.valeur).toBe(1000);
  });

  it("compte les saisons différentes pour « Vétéran »", () => {
    const h = historique({
      matchs: [
        match({ id: "m1", le: lundi(0), saison: "s1", a: ["p"], b: ["z"] }),
        match({ id: "m2", le: lundi(1), saison: "s1", a: ["p"], b: ["z"] }),
        match({ id: "m3", le: lundi(40), saison: "s2", a: ["p"], b: ["z"] }),
        match({ id: "m4", le: lundi(41), a: ["p"], b: ["z"] }), // v1 : sans saison
      ],
    });
    expect(badge(h, "p", "veteran")).toMatchObject({ palier: 1, valeur: 2, matchId: "m3" });
  });
});

// ─── Succès par match et soirée cumulée ───────────────────────────────────

describe("par match", () => {
  it("un doublé et un coup du chapeau", () => {
    const h = historique({
      matchs: [
        match({ id: "m1", le: lundi(0), a: ["k"], b: ["z"], buts: [but("A", "k"), but("A", "k")] }),
        match({ id: "m2", le: lundi(1), a: ["k"], b: ["z"], buts: [but("A", "k"), but("A", "k"), but("A", "k")] }),
      ],
    });
    expect(badge(h, "k", "double")).toMatchObject({ valeur: 2, palier: 1, matchId: "m1" });
    expect(badge(h, "k", "triple")).toMatchObject({ valeur: 1, palier: 1, matchId: "m2", matiere: "bronze" });
  });

  it("ignore la soirée cumulée pour les succès par match, pas pour les cumuls", () => {
    // Une soirée saisie après coup en un match : 12 à 0, Karim en met six.
    const buts = [...Array(6)].map(() => but("A", "k")).concat([...Array(6)].map(() => but("A", "p")));
    const h = historique({
      matchs: [match({ id: "cumul", le: lundi(0), soiree: "s", a: ["k", "p", "g"], b: ["z", "y"], gk: ["g"], buts })],
    });
    expect(badge(h, "k", "double").valeur).toBe(0);
    expect(badge(h, "k", "triple").valeur).toBe(0);
    expect(badge(h, "k", "victoire-large").valeur).toBe(0);
    expect(badge(h, "k", "ouvreur").valeur).toBe(0);
    expect(badge(h, "k", "but-de-la-victoire").valeur).toBe(0);
    expect(badge(h, "g", "clean-sheet").valeur).toBe(0);
    // Les cumuls, eux, la comptent.
    expect(badge(h, "k", "buteur").valeur).toBe(6);
    expect(badge(h, "k", "soiree-de-buteur")).toMatchObject({ valeur: 6, palier: 2 });
    expect(badge(h, "g", "muraille").valeur).toBe(1);
    expect(badge(h, "k", "centurion").valeur).toBe(1);
  });

  it("ne tient pas pour cumulé un gros score quand la soirée a plusieurs matchs", () => {
    const buts = [...Array(12)].map(() => but("A", "k"));
    const h = historique({
      matchs: [
        match({ id: "gros", le: lundi(0), soiree: "s", a: ["k"], b: ["z"], buts }),
        match({ id: "petit", le: lundi(0, 1), soiree: "s", a: ["k"], b: ["z"] }),
      ],
    });
    expect(badge(h, "k", "triple").valeur).toBe(1);
    expect(badge(h, "k", "victoire-large").valeur).toBe(1);
  });

  it("ne tient pas pour cumulé un match seul de moins de 12 buts", () => {
    const h = historique({
      matchs: [match({ id: "m", le: lundi(0), a: ["k"], b: ["z"], buts: [but("A", "k"), but("A", "k"), but("A", "k"), but("B", "z")] })],
    });
    expect(badge(h, "k", "triple").valeur).toBe(1);
  });

  it("« Correction » à cinq buts d'écart, pas à quatre", () => {
    const cinq = [...Array(5)].map(() => but("A", "k"));
    const h = historique({
      matchs: [
        match({ id: "large", le: lundi(0), a: ["k"], b: ["z"], buts: cinq }),
        match({ id: "juste", le: lundi(1), a: ["k"], b: ["z"], buts: cinq.slice(1) }),
      ],
    });
    expect(badge(h, "k", "victoire-large")).toMatchObject({ valeur: 1, matchId: "large" });
  });

  it("« Muraille » et « Cage inviolée » comptent aussi les matchs du dehors", () => {
    // Un gardien qui fait un tournoi extérieur voit ses buts et ses matchs
    // comptés : ses cages doivent l'être aussi, sinon la fiche se contredit
    // d'une ligne à l'autre.
    const h = historique({
      matchs: [
        match({ id: "m1", le: lundi(0), a: ["g"], b: ["z"], gk: ["g"], buts: [but("A", "g")] }),
        match({ id: "m2", le: lundi(1), a: ["g"], b: ["z"], gk: ["g"], buts: [but("B", "z")] }),
        match({ id: "x1", le: lundi(2), kind: "EXTERNAL", a: ["g"], gk: ["g"], buts: [but("A", "g")] }),
        match({ id: "x2", le: lundi(3), kind: "EXTERNAL", a: ["g"], gk: ["g"], buts: [but("B", null)] }),
      ],
    });
    expect(badge(h, "g", "muraille")).toMatchObject({ valeur: 4, palier: 1, matchId: "m1" });
    // m1 et x1 gagnés sans encaisser ; m2 et x2 encaissent.
    expect(badge(h, "g", "clean-sheet")).toMatchObject({ valeur: 2, matchId: "m1" });
    // Le joueur de champ du même camp n'est pas gardien.
    expect(badge(h, "z", "muraille").valeur).toBe(0);
  });
});

// ─── L'ordre des buts ─────────────────────────────────────────────────────

describe("ordre des buts", () => {
  const remontada = (extra: Partial<SpecMatch> = {}) =>
    match({
      id: "r",
      le: lundi(0),
      a: ["a1", "a2"],
      b: ["b1", "b2"],
      buts: [
        but("B", "b1"), but("B", "b2"),
        but("A", "a1"), but("A", "a2"), but("A", "a1"),
      ],
      ...extra,
    });

  it("une remontada : gagner après avoir été mené de deux buts", () => {
    const h = historique({ matchs: [remontada()] });
    expect(badge(h, "a1", "remontada")).toMatchObject({ valeur: 1, palier: 1, matchId: "r" });
    expect(badge(h, "a2", "remontada").valeur).toBe(1);
    expect(badge(h, "b1", "remontada").valeur).toBe(0);
  });

  it("ne la lit pas sur une feuille dont un but n'a pas de minute", () => {
    const m = remontada();
    m.events[4].minute = null;
    expect(badge(historique({ matchs: [m] }), "a1", "remontada").valeur).toBe(0);
  });

  it("ne la lit pas sur un match corrigé", () => {
    const h = historique({ matchs: [remontada({ corrige: true })] });
    expect(badge(h, "a1", "remontada").valeur).toBe(0);
    expect(badge(h, "a2", "but-de-la-victoire").valeur).toBe(0);
  });

  it("trie les buts par minute, puis par heure de saisie", () => {
    // Saisis dans le désordre : le but de la 2e minute a été tapé après.
    const m = match({
      id: "m", le: lundi(0), a: ["a1"], b: ["b1"],
      buts: [but("A", "a1", { min: 5 }), but("B", "b1", { min: 2 })],
    });
    const lecture = lireOrdreDesButs(m)!;
    expect(lecture.ouvreur).toBe("b1");
    expect(lecture.retard).toEqual({ A: 1, B: 0 });
  });

  it("le but de la victoire est le (l + 1)-ième du vainqueur", () => {
    // 3–1 : le deuxième but de A donne l'avance pour de bon.
    const m = match({
      id: "m", le: lundi(0), a: ["a1", "a2"], b: ["b1"],
      buts: [but("A", "a1"), but("B", "b1"), but("A", "a2"), but("A", "a1")],
    });
    const h = historique({ matchs: [m] });
    expect(badge(h, "a2", "but-de-la-victoire")).toMatchObject({ valeur: 1, matchId: "m" });
    expect(badge(h, "a1", "but-de-la-victoire").valeur).toBe(0);
    expect(badge(h, "a1", "ouvreur").valeur).toBe(1);
  });

  it("personne sur un nul, ni sur un CSC décisif ou d'ouverture", () => {
    expect(
      lireOrdreDesButs(match({ id: "n", le: lundi(0), a: ["a"], b: ["b"], buts: [but("A", "a"), but("B", "b")] })),
    ).toMatchObject({ decisif: null, ouvreur: "a" });
    const csc = lireOrdreDesButs(
      match({ id: "c", le: lundi(0), a: ["a"], b: ["b"], buts: [but("A", "b", { csc: true })] }),
    )!;
    expect(csc.ouvreur).toBeNull();
    expect(csc.decisif).toBeNull();
  });

  it("refuse une feuille dont le score rejoué ne tombe pas sur le score final", () => {
    const m = match({ id: "m", le: lundi(0), a: ["a"], b: ["b"], buts: [but("A", "a")] });
    m.scoreA = 2;
    expect(lireOrdreDesButs(m)).toBeNull();
  });
});

// ─── Soirées ──────────────────────────────────────────────────────────────

describe("soirées", () => {
  it("« Soirée de feu » additionne les matchs de la soirée et se date au match du 3e but", () => {
    const h = historique({
      matchs: [
        match({ id: "m1", le: lundi(0), soiree: "s", a: ["k"], b: ["z"], buts: [but("A", "k"), but("A", "k")] }),
        match({ id: "m2", le: lundi(0, 1), soiree: "s", a: ["k"], b: ["z"], buts: [but("A", "k")] }),
        match({ id: "m3", le: lundi(1), soiree: "t", a: ["k"], b: ["z"], buts: [but("A", "k"), but("A", "k")] }),
      ],
    });
    expect(badge(h, "k", "soiree-de-buteur")).toMatchObject({ valeur: 3, palier: 1, matchId: "m2" });
  });

  it("regroupe par jour du club les matchs sans soirée, et les rattache à la soirée du même jour", () => {
    const h = historique({
      matchs: [
        match({ id: "m1", le: lundi(0), soiree: "s", a: ["p"], b: ["z"] }),
        match({ id: "m2", le: lundi(0, 2), a: ["p"], b: ["z"] }), // même lundi, sans soirée
        match({ id: "m3", le: lundi(1), a: ["p"], b: ["z"] }),
        match({ id: "m4", le: lundi(1, 1), a: ["p"], b: ["z"] }),
      ],
    });
    expect(badge(h, "p", "habitue").valeur).toBe(2);
    expect(badge(h, "p", "centurion").valeur).toBe(4);
  });

  it("« Roi du lundi » : le camp majoritaire du joueur gagne la soirée", () => {
    // A gagne deux matchs sur trois. p est A partout, q B deux fois sur
    // trois, r moitié-moitié : r n'a pas de camp ce soir-là.
    const h = historique({
      matchs: [
        match({ id: "m1", le: lundi(0), soiree: "s", a: ["p", "r"], b: ["q"], buts: [but("A", "p")] }),
        match({ id: "m2", le: lundi(0, 1), soiree: "s", a: ["p", "q"], b: ["r"], buts: [but("A", "p")] }),
        match({ id: "m3", le: lundi(0, 2), soiree: "s", a: ["p"], b: ["q", "z"], buts: [but("B", "q")] }),
      ],
    });
    expect(badge(h, "p", "roi-du-lundi").valeur).toBe(1);
    expect(badge(h, "q", "roi-du-lundi").valeur).toBe(0);
    expect(badge(h, "r", "roi-du-lundi").valeur).toBe(0);
  });

  it("« Roi du lundi » se date au dernier match de la cinquième soirée gagnée", () => {
    const matchs = [0, 1, 2, 3, 4].flatMap((n) => [
      match({ id: `s${n}a`, le: lundi(n), soiree: `s${n}`, a: ["p"], b: ["z"], buts: [but("A", "p")] }),
      match({ id: `s${n}b`, le: lundi(n, 1), soiree: `s${n}`, a: ["p"], b: ["z"] }),
    ]);
    const b = badge(historique({ matchs }), "p", "roi-du-lundi");
    expect(b).toMatchObject({ valeur: 5, palier: 1, matchId: "s4b", obtenuLe: lundi(4, 1).toISOString() });
  });

  it("« Buteur en série » : les soirées qu'il a jouées, cassée par une soirée sans but", () => {
    const soir = (n: number, buteur: boolean, joueurs = ["k"]) =>
      match({ id: `m${n}`, le: lundi(n), soiree: `s${n}`, a: joueurs, b: ["z"], buts: buteur ? [but("A", "k")] : [] });
    const h = historique({
      matchs: [
        soir(0, true),
        soir(1, true),
        soir(2, false, ["x"]), // il n'y était pas : ne casse rien
        soir(3, true),
        soir(4, false), // il y était, sans marquer : cassée
        soir(5, true),
      ],
    });
    expect(badge(h, "k", "buteur-en-serie")).toMatchObject({ valeur: 3, palier: 1, matchId: "m3" });
    expect(serie(h, "k", "buteur")).toMatchObject({ enCours: 1, record: 3 });
  });

  it("« Toujours là » : une soirée manquée casse la série, l'en-cours tombe à 0", () => {
    const soir = (n: number, joueurs: string[]) =>
      match({ id: `m${n}`, le: lundi(n), soiree: `s${n}`, a: joueurs, b: ["z"] });
    const h = historique({
      matchs: [soir(0, ["p"]), soir(1, ["p"]), soir(2, ["p"]), soir(3, ["x"]), soir(4, ["p"]), soir(5, ["x"])],
    });
    expect(badge(h, "p", "lundis-d-affilee")).toMatchObject({ valeur: 3, palier: 1, matchId: "m2" });
    expect(serie(h, "p", "lundis")).toMatchObject({ enCours: 0, record: 3 });
    expect(serie(h, "z", "lundis")).toMatchObject({ enCours: 6, record: 6 });
  });

  it("« Toujours là » saute les soirées annulées et celles sans match terminé", () => {
    const h = historique({
      matchs: [
        match({ id: "m0", le: lundi(0), soiree: "s0", a: ["p"], b: ["z"] }),
        match({ id: "m1", le: lundi(1), soiree: "s1", a: ["p"], b: ["z"] }),
        // Soirée annulée où un match a quand même été terminé, sans lui.
        match({ id: "m2", le: lundi(2), soiree: "s2", a: ["x"], b: ["z"] }),
        // Soirée jamais terminée : feuille restée en direct.
        match({ id: "m3", le: lundi(3), soiree: "s3", status: "LIVE", a: ["x"], b: ["z"] }),
        match({ id: "m4", le: lundi(4), soiree: "s4", a: ["p"], b: ["z"] }),
      ],
      annulees: ["s2"],
    });
    expect(badge(h, "p", "lundis-d-affilee")).toMatchObject({ valeur: 3, palier: 1, matchId: "m4" });
    expect(serie(h, "p", "lundis").enCours).toBe(3);
  });
});

// ─── Séries par match ─────────────────────────────────────────────────────

describe("séries", () => {
  const suite = (resultats: ("W" | "D" | "L")[]) =>
    historique({
      matchs: resultats.map((r, i) =>
        match({
          id: `m${i}`, le: lundi(i), a: ["p"], b: ["z"],
          buts: r === "W" ? [but("A", "p")] : r === "L" ? [but("B", "z")] : [],
        }),
      ),
    });

  it("série de victoires : un nul la casse, le record reste", () => {
    const h = suite(["W", "W", "W", "D", "W"]);
    expect(serie(h, "p", "victoires")).toMatchObject({ enCours: 1, record: 3 });
    expect(badge(h, "p", "serie-victoires")).toMatchObject({ palier: 1, valeur: 3, matchId: "m2" });
  });

  it("invincible : les nuls prolongent, une défaite casse", () => {
    const h = suite(["W", "D", "D", "W", "D", "L", "W"]);
    expect(serie(h, "p", "invincible")).toMatchObject({ enCours: 1, record: 5 });
    expect(badge(h, "p", "invincible")).toMatchObject({ palier: 1, matchId: "m4" });
  });

  it("une série en cours tombe à 0 quand la dernière occurrence la casse", () => {
    const h = suite(["W", "W", "L"]);
    expect(serie(h, "p", "victoires")).toMatchObject({ enCours: 0, record: 2 });
    expect(serie(h, "p", "invincible")).toMatchObject({ enCours: 0, record: 2 });
  });
});

// ─── Homme du match, votes, titres, Élo, duo ──────────────────────────────

describe("distinctions", () => {
  it("compte les titres d'homme du match", () => {
    const h = historique({
      matchs: [0, 1, 2].map((i) => match({ id: `m${i}`, le: lundi(i), a: ["p"], b: ["z"], mvp: "p" })),
    });
    expect(badge(h, "p", "homme-du-match")).toMatchObject({ valeur: 3, palier: 2, matiere: "argent", matchId: "m2" });
  });

  it("« Électeur » : les votes du compte lié, dans les 72 heures, sur des matchs terminés", () => {
    const matchs = [...Array(12)].map((_, i) => match({ id: `m${i}`, le: lundi(i), a: ["x"], b: ["z"] }));
    matchs.push(match({ id: "annule", le: lundi(20), status: "CANCELED", a: ["x"], b: ["z"] }));
    const votes: VoteHistorique[] = [
      ...[...Array(10)].map((_, i) => ({ voterId: "u-p", matchId: `m${i}`, createdAt: new Date(lundi(i).getTime() + 3600_000) })),
      // Trop tard : quatre jours après.
      { voterId: "u-p", matchId: "m10", createdAt: new Date(lundi(10).getTime() + 96 * 3600_000) },
      { voterId: "u-p", matchId: "annule", createdAt: lundi(20) },
    ];
    const h = historique({
      matchs,
      votes,
      joueurs: ["x", "z"].map((id) => joueur(id)).concat(joueur("p", { userId: "u-p" })),
    });
    expect(badge(h, "p", "electeur")).toMatchObject({ valeur: 10, palier: 1, matchId: "m9" });
  });

  it("« Électeur » : une soirée saisie après coup se vote le soir de la saisie", () => {
    // Le lundi se joue, le jeudi se saisit, et c'est le jeudi soir qu'on
    // vote. Ancrée sur la date de jeu, la fenêtre rejetait tous ces votes :
    // un club qui saisit toujours après coup n'aurait jamais eu « Électeur ».
    const troisJours = 3 * 24 * 3600_000;
    const matchs = [...Array(10)].map((_, i) =>
      match({ id: `m${i}`, le: lundi(i), cree: new Date(lundi(i).getTime() + troisJours), a: ["x"], b: ["z"] }),
    );
    const votes: VoteHistorique[] = matchs.map((m, i) => ({
      voterId: "u-p",
      matchId: m.id,
      createdAt: new Date(lundi(i).getTime() + troisJours + 3600_000),
    }));
    const h = historique({
      matchs,
      votes,
      joueurs: ["x", "z"].map((id) => joueur(id)).concat(joueur("p", { userId: "u-p" })),
    });
    expect(badge(h, "p", "electeur")).toMatchObject({ valeur: 10, palier: 1 });
  });

  it("« Électeur » : ni la rafale sur de vieilles feuilles, ni un match daté dans le futur", () => {
    const rafale = lundi(30);
    const matchs = [...Array(12)].map((_, i) => match({ id: `m${i}`, le: lundi(i), a: ["x"], b: ["z"] }));
    // Date mal tapée, saisie aujourd'hui : sans borne basse, tous les votes
    // du club auraient compté.
    matchs.push(match({ id: "futur", le: new Date("2028-03-06T18:00:00Z"), cree: rafale, a: ["x"], b: ["z"] }));
    const h = historique({
      matchs,
      votes: matchs.map((m) => ({ voterId: "u-p", matchId: m.id, createdAt: rafale })),
      joueurs: ["x", "z"].map((id) => joueur(id)).concat(joueur("p", { userId: "u-p" })),
    });
    expect(badge(h, "p", "electeur").valeur).toBe(0);
  });

  it("« Palmarès » : les titres des saisons closes, départagés comme getSeasonHonours", () => {
    const saisons: SaisonHistorique[] = [
      { id: "s1", name: "2025", isActive: false, startsAt: lundi(0), endsAt: lundi(10) },
      { id: "s2", name: "2026", isActive: true, startsAt: lundi(11), endsAt: null },
    ];
    const h = historique({
      saisons,
      matchs: [
        // Saison close : k et p à égalité de buts, k à 100 % de victoires et
        // p à 50 % → k meilleur buteur. p passeur. q homme du match.
        match({ id: "a", le: lundi(1), saison: "s1", a: ["k", "p"], b: ["q"], buts: [but("A", "k", { passe: "p" })], mvp: "q" }),
        match({
          id: "b", le: lundi(2), saison: "s1", a: ["q"], b: ["p", "z"],
          buts: [but("B", "p"), but("A", "z", { csc: true }), but("A", "z", { csc: true })],
        }),
        // Saison active : rien ne compte encore.
        match({ id: "c", le: lundi(12), saison: "s2", a: ["z"], b: ["q"], buts: [but("A", "z"), but("A", "z")], mvp: "z" }),
      ],
    });
    const titres = (id: string) => badge(h, id, "titre-saison");
    expect(titres("k")).toMatchObject({ valeur: 1, palier: 1, obtenuLe: lundi(10).toISOString(), matchId: null });
    expect(titres("p").valeur).toBe(1);
    expect(titres("q").valeur).toBe(1);
    expect(titres("z").valeur).toBe(0);
  });

  it("« Cote » : l'Élo de carrière, daté au match qui passe 1100", () => {
    const matchs = [...Array(10)].map((_, i) =>
      match({ id: `m${i}`, le: lundi(i), a: ["x", "y"], b: ["z", "w"], buts: [...Array(5)].map(() => but("A", "x")) }),
    );
    const hist = computeElo(matchs.map((m) => ({ teamA: ["x", "y"], teamB: ["z", "w"], scoreA: m.scoreA, scoreB: m.scoreB })))
      .get("x")!;
    const i = hist.findIndex((c) => c >= 1100);
    const b = badge(historique({ matchs }), "x", "elo");
    expect(b).toMatchObject({ palier: 1, matchId: `m${i}`, valeur: Math.round(Math.max(...hist)) });
    expect(badge(historique({ matchs }), "z", "elo")).toMatchObject({ palier: 0, valeur: 1000 });
  });

  it("« Duo de feu » : cinq buts du même passeur au même buteur, pour les deux", () => {
    const buts = [
      ...[...Array(5)].map(() => but("A", "k", { passe: "p" })),
      but("A", "p", { passe: "k" }), // l'autre sens est un autre duo
    ];
    const h = historique({ matchs: [match({ id: "m", le: lundi(0), soiree: "s", a: ["k", "p"], b: ["z"], buts }), match({ id: "n", le: lundi(0, 1), soiree: "s", a: ["k"], b: ["z"] })] });
    expect(badge(h, "k", "duo")).toMatchObject({ valeur: 5, palier: 1, matchId: "m" });
    expect(badge(h, "p", "duo")).toMatchObject({ valeur: 5, palier: 1 });
  });
});

// ─── Expérience ───────────────────────────────────────────────────────────

describe("expérience", () => {
  it("additionne les sources du barème et le bonus des paliers", () => {
    // p : un match, une victoire 2–0, un but, une passe, homme du match.
    const h = historique({
      matchs: [
        match({
          id: "m", le: lundi(0), a: ["p", "q"], b: ["r", "s"], mvp: "p",
          buts: [but("A", "p", { passe: "q" }), but("A", "q", { passe: "p" })],
        }),
      ],
    });
    const s = calcul(h).parJoueur.get("p")!;
    // Paliers : premiers pas (or, 100), premier but, première passe, homme
    // du match, première victoire, ouverture, but décisif (bronze, 25 × 6).
    expect(s.xpDetail).toEqual([
      { source: "Matchs joués", xp: 10 },
      { source: "Victoires", xp: 15 },
      { source: "Buts", xp: 8 },
      { source: "Passes décisives", xp: 5 },
      { source: "Homme du match", xp: 20 },
      { source: "Soirées", xp: 5 },
      { source: "Succès", xp: 250 },
    ]);
    expect(s.niveau).toMatchObject({ niveau: 3, titre: "Titulaire", xp: 313, xpNiveau: 300, xpSuivant: 600 });
  });

  it("donne 5 par nul", () => {
    const h = historique({ matchs: [match({ id: "m", le: lundi(0), a: ["p"], b: ["z"] })] });
    expect(calcul(h).parJoueur.get("p")!.xpDetail.find((d) => d.source === "Nuls")!.xp).toBe(5);
  });
});

// ─── Le club ──────────────────────────────────────────────────────────────

describe("le club", () => {
  const joueurs = [joueur("a"), joueur("b"), joueur("c"), joueur("d"), joueur("g", { isGuest: true }), joueur("v", { isArchived: true })];

  it("exclut les invités du fil et des niveaux, mais leur calcule leurs succès", () => {
    const h = historique({
      joueurs,
      matchs: [match({ id: "m", le: lundi(36), a: ["a", "g", "v"], b: ["b"], buts: [but("A", "g")] })],
    });
    const r = calcul(h);
    expect(r.parJoueur.get("g")!.badges.find((b) => b.id === "buteur")!.palier).toBe(1);
    expect(r.club.fil.some((d) => d.playerId === "g")).toBe(false);
    expect(r.club.niveaux.map((n) => n.playerId)).toEqual(["a", "b"]);
    // Le récap du match, lui, dit tout ce qui s'y est passé.
    expect(r.deblocagesDuMatch("m").some((d) => d.playerId === "g" && d.badgeId === "buteur")).toBe(true);
    expect(r.deblocagesDuMatch("inconnu")).toEqual([]);
  });

  it("trie les niveaux par XP puis par nom", () => {
    const h = historique({
      joueurs,
      matchs: [match({ id: "m", le: lundi(0), a: ["c", "a"], b: ["b"], buts: [but("A", "c")] })],
    });
    const niveaux = calcul(h).club.niveaux;
    expect(niveaux.map((n) => n.playerId)).toEqual(["c", "a", "b"]);
    expect(niveaux[0].xp).toBeGreaterThan(niveaux[1].xp);
  });

  it("garde 30 jours de fil, le plus récent d'abord, 20 événements au plus", () => {
    const beaucoup = [...Array(25)].map((_, i) => joueur(`j${String(i).padStart(2, "0")}`));
    const h = historique({
      joueurs: beaucoup,
      matchs: [
        match({ id: "vieux", le: new Date("2026-08-01T18:00:00Z"), a: ["j00"], b: ["j01"] }),
        ...beaucoup.slice(2).map((j, i) =>
          match({ id: `r${i}`, le: new Date(Date.UTC(2026, 8, 1 + i, 18)), a: [j.id], b: [] }),
        ),
      ],
    });
    const fil = calcul(h).club.fil;
    expect(fil).toHaveLength(20);
    expect(fil.some((d) => d.matchId === "vieux")).toBe(false);
    const dates = fil.map((d) => d.le);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("coupe le fil aux événements, pas aux lignes : un palier franchi par tout le club n'efface pas le mois", () => {
    // Le premier lundi de la saison, vingt-quatre joueurs franchissent le
    // même palier le même soir. Coupé à vingt déblocages, le fil ne montrait
    // plus rien d'autre — les écrans n'en font pourtant qu'UNE ligne.
    const foule = [...Array(24)].map((_, i) => joueur(`f${String(i).padStart(2, "0")}`));
    const h = historique({
      joueurs: [joueur("a"), joueur("b"), ...foule],
      matchs: [
        match({ id: "j1", le: new Date("2026-09-01T18:00:00Z"), a: ["a"], b: ["b"] }),
        match({
          id: "j2",
          le: new Date("2026-09-07T18:00:00Z"),
          a: foule.slice(0, 12).map((j) => j.id),
          b: foule.slice(12).map((j) => j.id),
        }),
      ],
    });
    const fil = calcul(h).club.fil;
    expect(fil.filter((d) => d.matchId === "j2")).toHaveLength(24);
    // Le soir d'avant est toujours là, et son groupe voyage d'un bloc.
    expect(fil.filter((d) => d.matchId === "j1")).toHaveLength(2);
    expect(fil.slice(-2).every((d) => d.matchId === "j1")).toBe(true);
  });

  it("ignore ce qui est daté dans le futur : ni dans le fil, ni comme dernière soirée", () => {
    const h = historique({
      matchs: [
        match({ id: "s1", le: new Date("2026-09-07T18:00:00Z"), soiree: "soir1", a: ["a"], b: ["b"], buts: [but("A", "a")] }),
        match({ id: "s2a", le: new Date("2026-09-14T18:00:00Z"), soiree: "soir2", a: ["b"], b: ["a"], buts: [but("A", "b")] }),
        match({ id: "s2b", le: new Date("2026-09-14T18:15:00Z"), soiree: "soir2", a: ["b"], b: ["a"], buts: [but("A", "b")] }),
        // Date mal tapée : 2028 pour 2026. Elle ne doit ni tenir le fil, ni
        // passer pour « la dernière soirée ».
        match({ id: "fantome", le: new Date("2028-03-06T18:00:00Z"), soiree: "soir3", a: ["c"], b: ["d"] }),
      ],
    });
    const r = calcul(h);
    expect(r.club.fil.some((d) => d.matchId === "fantome")).toBe(false);
    // La dernière soirée, c'est celle du 14 : b y prend la tête à a.
    expect(r.club.evolutions).toEqual({ a: -1, b: 1 });
  });

  it("départage deux joueurs du même nom par leur identifiant", () => {
    // Deux Karim qui franchissent le même palier le même soir : sans
    // départage, l'ordre suivait celui de la base, qui change tout seul.
    const deux = [joueur("k1", { name: "Karim" }), joueur("k2", { name: "Karim" })];
    const matchs = [match({ id: "m", le: new Date("2026-09-14T18:00:00Z"), a: ["k1"], b: ["k2"] })];
    const rendu = (joueurs: JoueurHistorique[]) => {
      const r = calcul(historique({ matchs, joueurs }));
      return {
        fil: r.club.fil.map((d) => `${d.playerId}/${d.badgeId}`),
        match: r.deblocagesDuMatch("m").map((d) => `${d.playerId}/${d.badgeId}`),
      };
    };
    const premier = rendu(deux);
    expect(premier).toEqual(rendu([...deux].reverse()));
    expect(premier.fil).toEqual(["k1/premiers-pas", "k2/premiers-pas"]);
  });

  it("« Raretés » : le palier le plus haut détenu au club, et qui le tient", () => {
    const cinq = [...Array(5)].map(() => but("A", "a"));
    const h = historique({
      joueurs,
      matchs: [
        match({ id: "m1", le: lundi(0), a: ["a", "b", "g"], b: ["c", "d"] }),
        match({ id: "m2", le: lundi(1), a: ["a"], b: ["c"], buts: cinq }),
        match({ id: "m3", le: lundi(2), a: ["b", "g"], b: ["d"], buts: [but("A", "b"), but("A", "g")] }),
      ],
    });
    const rares = calcul(h).club.raretes;
    const buteur = rares.find((x) => x.badgeId === "buteur")!;
    // a est à cinq buts (palier d'argent), b à un seul : c'est l'argent qui
    // se raconte, et a est seul à le tenir. L'invité ne compte pas.
    expect(buteur).toMatchObject({ palier: 2, matiere: "argent", libelle: "5 buts", total: 4 });
    expect(buteur.detenteurs.map((j) => j.playerId)).toEqual(["a"]);
    // Cinq lignes au plus, du moins détenu au plus détenu.
    expect(rares.length).toBeLessThanOrEqual(5);
    const detenus = rares.map((x) => x.detenteurs.length);
    expect([...detenus].sort((x, y) => x - y)).toEqual(detenus);
    // Ce que tout le club a n'est pas rare.
    expect(rares.some((x) => x.badgeId === "premiers-pas")).toBe(false);
  });

  it("« Raretés » : rien quand plus de la moitié du club détient tout ce qu'il y a", () => {
    const h = historique({
      joueurs: [joueur("a"), joueur("b"), joueur("c")],
      matchs: [match({ id: "m", le: lundi(0), a: ["a", "b"], b: ["c"] })],
    });
    expect(calcul(h).club.raretes).toEqual([]);
  });

  it("mesure la rareté parmi les joueurs du club qui ont joué, sans invités", () => {
    const h = historique({
      joueurs,
      matchs: [match({ id: "m", le: lundi(0), a: ["a", "g"], b: ["b", "c"], buts: [but("A", "a"), but("B", "b"), but("A", "g")] })],
    });
    const b = badge(h, "a", "buteur");
    expect(b.rarete).toBe(0.667); // a et b sur a, b, c — d n'a jamais joué
    expect(badge(h, "c", "premiers-pas").rarete).toBe(1);
  });

  it("masque les familles que le club ne suit pas, sauf si le joueur y a déjà un palier", () => {
    const h = historique({
      reglages: { trackAssists: false, motmMode: "OFF" },
      matchs: [
        match({ id: "m", le: lundi(0), a: ["k", "p"], b: ["z"], buts: [but("A", "k", { passe: "p" })] }),
      ],
    });
    const ids = (id: string) => calcul(h).parJoueur.get(id)!.badges.map((b) => b.id);
    expect(ids("k")).not.toContain("passeur");
    expect(ids("k")).not.toContain("duo");
    expect(ids("k")).not.toContain("homme-du-match");
    expect(ids("k")).not.toContain("electeur");
    // p a une passe d'avant le changement de réglage : elle reste à lui.
    expect(ids("p")).toContain("passeur");
    const admin = historique({ reglages: { motmMode: "ADMIN" }, matchs: [match({ id: "m", le: lundi(0), a: ["k"], b: ["z"] })] });
    const idsAdmin = calcul(admin).parJoueur.get("k")!.badges.map((b) => b.id);
    expect(idsAdmin).toContain("homme-du-match");
    expect(idsAdmin).not.toContain("electeur");
  });
});

// ─── Classement ───────────────────────────────────────────────────────────

describe("classement", () => {
  const saisons: SaisonHistorique[] = [
    { id: "vieille", name: "2025", isActive: false, startsAt: lundi(0), endsAt: lundi(9) },
    { id: "s", name: "2026", isActive: true, startsAt: lundi(10), endsAt: null },
  ];
  // Soirée 1 : A (a, b) bat B (c, d), but de a. Soirée 2 : B gagne deux
  // fois, c marque les deux ; e arrive ce soir-là.
  const matchs = [
    match({ id: "old", le: lundi(1), saison: "vieille", a: ["d"], b: ["a"], buts: [but("A", "d"), but("A", "d")] }),
    match({ id: "s1", le: lundi(10), soiree: "soir1", saison: "s", a: ["a", "b"], b: ["c", "d"], buts: [but("A", "a")] }),
    match({ id: "s2a", le: lundi(11), soiree: "soir2", saison: "s", a: ["a", "b"], b: ["c", "d", "e"], buts: [but("B", "c")] }),
    match({ id: "s2b", le: lundi(11, 1), soiree: "soir2", saison: "s", a: ["a", "b"], b: ["c", "d", "e"], buts: [but("B", "c")] }),
  ];

  it("rend le rang, les points au barème du club et le joueur juste devant", () => {
    const h = historique({ saisons, matchs, reglages: { pointsWin: 2 } });
    const a = calcul(h).parJoueur.get("a")!.classement;
    // Après : c (4 pts, 2 buts), d (4), e (4, arrivé), a (2), b (2).
    expect(a).toMatchObject({ rang: 4, total: 5, points: 2, devant: { nom: "e", points: 4 } });
    expect(calcul(h).parJoueur.get("c")!.classement).toMatchObject({ rang: 1, devant: null });
  });

  it("mesure les places gagnées depuis avant la dernière soirée", () => {
    const r = calcul(historique({ saisons, matchs }));
    // Avant : a, b (3 pts), puis c, d (0). Après : c, d, e, a, b.
    expect(r.club.evolutions).toEqual({ c: 2, d: 2, a: -3, b: -3 });
    expect(r.parJoueur.get("c")!.classement.evolution).toBe(2);
    // e n'avait pas de place avant : pas d'évolution à annoncer.
    expect(r.parJoueur.get("e")!.classement.evolution).toBeNull();
  });

  it("n'a pas d'évolution quand la saison n'a qu'une soirée", () => {
    const r = calcul(historique({ saisons, matchs: matchs.slice(0, 2) }));
    expect(r.club.evolutions).toEqual({});
    expect(r.parJoueur.get("a")!.classement).toMatchObject({ rang: 1, evolution: null });
  });

  it("prend tout l'historique quand aucune saison n'est active, comme l'accueil", () => {
    const r = calcul(historique({ matchs }));
    // d : la victoire de la vieille saison + les deux de la soirée 2.
    expect(r.parJoueur.get("d")!.classement).toMatchObject({ rang: 1, points: 9 });
  });

  it("laisse sans rang un joueur hors du tableau", () => {
    const h = historique({ saisons, matchs, joueurs: ["a", "b", "c", "d", "e"].map((id) => joueur(id)).concat(joueur("x")) });
    expect(calcul(h).parJoueur.get("x")!.classement).toMatchObject({ rang: null, points: 0, evolution: null, devant: null, total: 5 });
  });
});

// ─── La famille la plus proche ────────────────────────────────────────────

describe("prochain", () => {
  it("mesure une série depuis son en-cours, pas depuis son record", () => {
    // Quatre victoires, puis une défaite : record 4 sur 5, mais en cours 0.
    // Buteur : 3 sur 5. C'est lui le plus proche.
    const res = ["W", "W", "W", "W", "L"];
    const h = historique({
      matchs: res.map((r, i) =>
        match({
          id: `x${i}`, le: lundi(i), kind: "EXTERNAL", a: ["p"],
          buts: r === "W" ? (i < 3 ? [but("A", "p")] : [but("A", null)]) : [but("B", null)],
        }),
      ),
    });
    const s = calcul(h).parJoueur.get("p")!;
    expect(s.prochain?.id).toBe("buteur");
    expect(s.prochain).toMatchObject({ valeur: 3, prochain: 5 });
  });

  it("propose le premier match à qui n'a pas encore joué", () => {
    const h = historique({ matchs: [], joueurs: [joueur("n")] });
    expect(calcul(h).parJoueur.get("n")!.prochain?.id).toBe("premiers-pas");
  });

  it("ne propose jamais une famille terminée", () => {
    const h = historique({ matchs: [match({ id: "m", le: lundi(0), a: ["p"], b: ["z"] })] });
    const s = calcul(h).parJoueur.get("p")!;
    expect(s.prochain?.id).not.toBe("premiers-pas");
    expect(s.badges.find((b) => b.id === "premiers-pas")).toMatchObject({ prochain: null, matiere: "or" });
  });
});
