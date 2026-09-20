// Ce que la carte « Ma saison » raconte, tiré des données du moteur des
// succès (lib/succes.ts). Pur : ni Prisma ni `server-only` — rien ici ne lit
// la base, tout se vérifie à la main.

import { matiereDuPalier, type Badge, type MatchHistorique, type Serie } from "@/lib/succes";
import { NOMS_MATIERES, type IconeSucces } from "@/lib/succes-icones";
import { quantite, resteAvantPalier } from "@/components/succes/textes";

/// « 1er », « 2e »
export const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

const pluriel = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`;

// ─── La série en cours la plus parlante ───────────────────────────────────

type RegleSerie = {
  icone: IconeSucces;
  /// En dessous, ce n'est pas une série : deux présences d'affilée, c'est
  /// l'ordinaire d'un habitué.
  min: number;
  /// Le premier palier de la famille : la série se mesure à lui, pour que
  /// « 4 sans défaite » ne passe pas devant « 3 victoires d'affilée ».
  repere: number;
  dire: (n: number) => string;
};

const SERIES: Record<Serie["id"], RegleSerie> = {
  victoires: { icone: "eclair", min: 2, repere: 3, dire: (n) => `${n} victoires d'affilée` },
  buteur: { icone: "serie", min: 2, repere: 3, dire: (n) => `${n} soirées d'affilée avec un but` },
  invincible: { icone: "bouclier", min: 3, repere: 5, dire: (n) => `${n} matchs sans défaite` },
  lundis: { icone: "calendrier", min: 3, repere: 3, dire: (n) => `${n} soirées d'affilée sans en manquer` },
};

/// L'ordre départage deux séries de même poids : la victoire se raconte
/// mieux que la présence.
const ORDRE_SERIES: Serie["id"][] = ["victoires", "buteur", "invincible", "lundis"];

export type SeriePhare = { id: Serie["id"]; icone: IconeSucces; titre: string; sous: string };

export function seriePhare(series: readonly Serie[]): SeriePhare | null {
  const par = new Map(series.map((s) => [s.id, s]));
  let choix: Serie | null = null;
  let meilleur = 0;
  for (const id of ORDRE_SERIES) {
    const s = par.get(id);
    if (!s) continue;
    const r = SERIES[id];
    if (s.enCours < r.min) continue;
    // Tant qu'il n'y a pas eu de nul, « sans défaite » répète les victoires
    // d'affilée avec un chiffre identique : une seule ligne suffit.
    if (id === "invincible" && s.enCours <= (par.get("victoires")?.enCours ?? 0)) continue;
    const poids = s.enCours / r.repere;
    if (poids > meilleur) {
      meilleur = poids;
      choix = s;
    }
  }
  if (!choix) return null;
  const r = SERIES[choix.id];
  return {
    id: choix.id,
    icone: r.icone,
    titre: r.dire(choix.enCours),
    sous: choix.enCours >= choix.record ? "c'est ton record" : `record ${choix.record}`,
  };
}

// ─── Le prochain palier ───────────────────────────────────────────────────

/// Les familles qui retiennent une SÉRIE : leur prochain palier se gagne avec
/// la série en cours, pas avec le record — celui qui vient de perdre repart
/// de zéro, et « encore 1 » lui mentirait.
const SERIE_DE_FAMILLE: Partial<Record<string, Serie["id"]>> = {
  "serie-victoires": "victoires",
  invincible: "invincible",
  "buteur-en-serie": "buteur",
  "lundis-d-affilee": "lundis",
};

/// La cote de départ de l'Élo (lib/succes.ts, ELO_BASE, non exportée) : la
/// barre d'un palier de cote part d'elle, sinon un nouveau venu serait déjà à
/// 91 % d'une cote de 1100.
const ELO_DEPART = 1000;

export type Palier = { titre: string; sous: string; part: number };

/// « Buteur argent », « encore 2 buts », et la part du chemin faite.
export function prochainPalier(b: Badge, series: readonly Serie[]): Palier | null {
  if (b.prochain == null) return null;
  const titre =
    b.paliers.length > 1
      ? `${b.nom} ${NOMS_MATIERES[matiereDuPalier(b.palier + 1, b.paliers.length)].toLowerCase()}`
      : b.nom;
  const idSerie = SERIE_DE_FAMILLE[b.id];
  const enCours = idSerie ? series.find((s) => s.id === idSerie)?.enCours : undefined;
  if (enCours !== undefined) {
    return {
      titre,
      sous: `encore ${quantite(b.id, Math.max(1, b.prochain - enCours))}`,
      part: enCours / b.prochain,
    };
  }
  const sous = resteAvantPalier(b) ?? "";
  if (b.id === "elo") {
    return { titre, sous, part: Math.max(0, b.valeur - ELO_DEPART) / (b.prochain - ELO_DEPART) };
  }
  return { titre, sous, part: b.valeur / b.prochain };
}

// ─── Ce que le joueur a fait à la dernière soirée ─────────────────────────

export type Bilan = {
  matchs: number;
  v: number;
  n: number;
  d: number;
  buts: number;
  passes: number;
  hdm: number;
};

/// Le bilan d'un joueur sur une poignée de matchs terminés (une soirée).
/// `null` s'il n'en a joué aucun.
export function bilanDuJoueur(
  matchs: readonly Pick<MatchHistorique, "scoreA" | "scoreB" | "mvpId" | "participants" | "events">[],
  playerId: string,
): Bilan | null {
  const b: Bilan = { matchs: 0, v: 0, n: 0, d: 0, buts: 0, passes: 0, hdm: 0 };
  for (const m of matchs) {
    const moi = m.participants.find((p) => p.playerId === playerId);
    if (!moi) continue;
    b.matchs++;
    const pour = moi.initialTeam === "A" ? m.scoreA : m.scoreB;
    const contre = moi.initialTeam === "A" ? m.scoreB : m.scoreA;
    if (pour > contre) b.v++;
    else if (pour === contre) b.n++;
    else b.d++;
    for (const e of m.events) {
      if (e.type !== "GOAL") continue;
      if (e.playerId === playerId) b.buts++;
      if (e.assistPlayerId === playerId) b.passes++;
    }
    if (m.mvpId === playerId) b.hdm++;
  }
  return b.matchs > 0 ? b : null;
}

/// « 2 victoires, 1 nul » et « 3 matchs · 2 buts · homme du match ».
export function phraseBilan(b: Bilan, avecPasses: boolean): { resultats: string; detail: string } {
  const resultats = [
    b.v > 0 && pluriel(b.v, "victoire", "victoires"),
    b.n > 0 && pluriel(b.n, "nul", "nuls"),
    b.d > 0 && pluriel(b.d, "défaite", "défaites"),
  ]
    .filter(Boolean)
    .join(", ");
  const detail = [
    pluriel(b.matchs, "match", "matchs"),
    b.buts > 0 && pluriel(b.buts, "but", "buts"),
    avecPasses && b.passes > 0 && pluriel(b.passes, "passe", "passes"),
    b.hdm === 1 && "homme du match",
    b.hdm > 1 && `${b.hdm} fois homme du match`,
  ]
    .filter(Boolean)
    .join(" · ");
  return { resultats, detail };
}
