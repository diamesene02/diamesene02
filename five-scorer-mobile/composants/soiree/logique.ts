// Les règles des écrans de soirée, sans une ligne de React ni d'Expo.
//
// Ce que le site calcule dans ses composants (components/CompoSoiree.tsx,
// sessions/[id]/SessionRsvpAdmin.tsx, lib/convocation.ts, lib/quand.ts), l'app
// doit le calculer À L'IDENTIQUE : un capitaine qui prépare sa compo sur le
// site le jeudi et la relit sur l'app le lundi ne doit voir ni un autre
// placement, ni un autre compte, ni un autre message sur le groupe. D'où ce
// fichier à part, qui se teste sous Node.

import { joursEntre } from "../../lib/datesRelatives";

export type Camp = "A" | "B";
export type Statut = "IN" | "MAYBE" | "OUT";

// --- Les dates ---------------------------------------------------------------

/// « Ce soir », « Demain », « Dans 3 jours », « Hier » — ou `null` quand la
/// date absolue dit mieux les choses. La règle de `quandRelatif` du site
/// (lib/quand.ts), comptée en jours civils du téléphone.
export function quandRelatif(date: Date | string, maintenant: Date = new Date()): string | null {
  const d = date instanceof Date ? date : new Date(date);
  const n = joursEntre(d, maintenant);
  if (n === 0) return d.getHours() >= 17 ? "Ce soir" : "Aujourd'hui";
  if (n === 1) return "Demain";
  if (n >= 2 && n <= 6) return `Dans ${n} jours`;
  if (n === -1) return "Hier";
  return null;
}

/// « 2026-09-21 » dans le fuseau du téléphone : la clé d'un jour civil.
export function cleLocale(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/// La date à proposer pour une nouvelle soirée : le prochain jour de jeu du
/// club, à son heure habituelle, qui n'a pas déjà sa soirée — la règle de
/// `prochaineDateDeJeu` du site. Le modèle est la dernière soirée
/// programmée ; sans modèle, demain à 19 h.
///
/// L'app proposait « le prochain lundi à 20 h » quel que soit le club : un
/// club du jeudi corrigeait la date à chaque fois, et un club qui a posé sa
/// saison se voyait proposer un lundi déjà pris.
export function prochaineDateDeJeu(input: {
  modele: Date | null;
  /// Clés `cleLocale` des jours qui ont déjà une soirée.
  prises: Iterable<string>;
  maintenant: Date;
}): Date {
  const { modele, maintenant } = input;
  const prises = new Set(input.prises);
  const aLHeure = (jour: Date, h: number, m: number) => {
    const d = new Date(jour);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const demain = new Date(maintenant);
  demain.setDate(demain.getDate() + 1);
  if (!modele) return aLHeure(demain, 19, 0);

  const h = modele.getHours();
  const m = modele.getMinutes();
  // Neuf semaines : au-delà, le calendrier est plein et « demain » n'est pas
  // pire qu'une date lointaine.
  for (let i = 0; i < 63; i++) {
    const jour = new Date(maintenant);
    jour.setDate(jour.getDate() + i);
    if (jour.getDay() !== modele.getDay()) continue;
    if (prises.has(cleLocale(jour))) continue;
    const candidat = aLHeure(jour, h, m);
    if (candidat.getTime() > maintenant.getTime()) return candidat;
  }
  return aLHeure(demain, h, m);
}

// --- L'argent ----------------------------------------------------------------

/// « 48 € », « 5,33 € » : l'écriture de la route soirée (`euros`), pour que
/// ce que l'app recalcule après un tap se lise comme ce que le serveur rend.
export function euros(cents: number): string {
  return (
    (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",")) + " €"
  );
}

/// Ce qu'on tape dans le champ du prix, en centimes. Vide : on retire le
/// suivi (`null`). Illisible ou négatif : `"invalide"`, jamais un zéro
/// silencieux.
export function lireMontant(texte: string): number | null | "invalide" {
  const brut = texte.trim().replace(/\s|€/g, "").replace(",", ".");
  if (brut === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(brut)) return "invalide";
  const cents = Math.round(Number.parseFloat(brut) * 100);
  return Number.isFinite(cents) && cents >= 0 ? cents : "invalide";
}

/// La part de chacun et l'encaissé, recalculés après un « payé » touché —
/// la règle de la route : la part arrondie au centime supérieur, entre ceux
/// qui jouent.
export function caisse(prixCents: number | null, payeurs: { aPaye: boolean }[]) {
  const part = prixCents != null && payeurs.length > 0 ? Math.ceil(prixCents / payeurs.length) : null;
  const encaisse = part ? payeurs.filter((p) => p.aPaye).length * part : 0;
  const pourcentage = prixCents ? Math.min(100, Math.round((encaisse / prixCents) * 100)) : 0;
  return { part, encaisse: prixCents != null ? Math.min(encaisse, prixCents) : encaisse, pourcentage };
}

// --- Les présences -----------------------------------------------------------

/// Tap d'un gérant sur un joueur : présent → peut-être → absent → présent.
/// Il part du statut RETENU : un abonné sans réponse est déjà présent, le
/// « passer » présent ne changerait rien à l'écran (SessionRsvpAdmin.tsx).
export function statutSuivant(s: Statut | null): Statut {
  if (s === "IN") return "MAYBE";
  if (s === "MAYBE") return "OUT";
  return "IN";
}

export type LignePresence = { statut: Statut | null; enAttente: boolean };

/// « 8 présents · 1 en attente · 2 peut-être · 0 absent » : présents et
/// absents toujours, le reste seulement quand il y en a.
export function compteDesPresences(lignes: LignePresence[]): string {
  const presents = lignes.filter((l) => l.statut === "IN" && !l.enAttente).length;
  const attente = lignes.filter((l) => l.statut === "IN" && l.enAttente).length;
  const peutEtre = lignes.filter((l) => l.statut === "MAYBE").length;
  const absents = lignes.filter((l) => l.statut === "OUT").length;
  return [
    `${presents} présent${presents > 1 ? "s" : ""}`,
    attente > 0 ? `${attente} en attente` : null,
    peutEtre > 0 ? `${peutEtre} peut-être` : null,
    `${absents} absent${absents > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/// Le libellé de la ligne qui déplie la liste : « et 8 autres présents »
/// quand tous les cachés viennent, « et 8 sans réponse » quand aucun n'a
/// répondu, « et 8 autres » sinon.
export function libelleAutres(caches: LignePresence[]): string {
  const n = caches.length;
  const s = n > 1 ? "s" : "";
  if (caches.every((l) => l.statut === "IN" && !l.enAttente)) return `et ${n} autre${s} présent${s}`;
  if (caches.every((l) => l.statut === null)) return `et ${n} sans réponse`;
  return `et ${n} autre${s}`;
}

// --- La composition ----------------------------------------------------------

/// Où poser n joueurs dans une moitié de terrain, en % de la hauteur totale
/// (0 = ligne de but, 50 = rond central) — le `placer` du site, à l'unité
/// près : les deux écrans doivent montrer la même équipe au même endroit.
export function placer(n: number, avecGk: boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (n === 0) return out;
  if (avecGk) out.push({ x: 50, y: 10 });
  const reste = avecGk ? n - 1 : n;
  if (reste === 0) return out;
  const lignes = reste <= 3 ? 1 : reste <= 6 ? 2 : 3;
  const YS: Record<string, number[]> = {
    gk1: [32],
    gk2: [24, 40],
    gk3: [21, 31, 41],
    nogk1: [26],
    nogk2: [15, 37],
    nogk3: [11, 26, 41],
  };
  const ys = YS[`${avecGk ? "gk" : "nogk"}${lignes}`];
  const base = Math.floor(reste / lignes);
  const extra = reste % lignes;
  for (let l = 0; l < lignes; l++) {
    const k = base + (l >= lignes - extra ? 1 : 0);
    const pas = k <= 1 ? 0 : k === 2 ? 40 : k === 3 ? 30 : 66 / (k - 1);
    for (let i = 0; i < k; i++) {
      out.push({ x: 50 + (i - (k - 1) / 2) * pas, y: ys[l] });
    }
  }
  return out;
}

/// « Farid, Lucas et Diame » — `Intl.ListFormat` n'est pas garanti dans le
/// moteur JavaScript du téléphone.
export function enumerer(noms: string[]): string {
  if (noms.length <= 1) return noms.join("");
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/// Les mises en garde qui comptent au bord du terrain, dites avant d'y être.
/// Elles ne BLOQUENT rien : une compo à sept contre six est parfois voulue.
export function alertesCompo(input: {
  equipeA: { nom: string; gardien: boolean; presence: Statut | null }[];
  equipeB: { nom: string; gardien: boolean; presence: Statut | null }[];
  nomA: string;
  nomB: string;
}): string[] {
  const { equipeA, equipeB, nomA, nomB } = input;
  const retenus = equipeA.length + equipeB.length;
  if (retenus === 0) return [];
  const a: string[] = [];
  if (equipeA.length !== equipeB.length) {
    a.push(`Effectif déséquilibré : ${equipeA.length} contre ${equipeB.length}.`);
  }
  if (equipeA.length === 0 || equipeB.length === 0) a.push("Une équipe est vide.");
  const sans = [
    equipeA.length > 0 && !equipeA.some((j) => j.gardien) ? nomA : null,
    equipeB.length > 0 && !equipeB.some((j) => j.gardien) ? nomB : null,
  ].filter((x): x is string => Boolean(x));
  if (sans.length > 0) a.push(`Pas de gardien chez ${sans.join(" et ")}.`);
  // Placé, mais il a dit qu'il ne venait pas : l'équipe jouera à un de moins.
  const absents = [...equipeA, ...equipeB].filter((j) => j.presence === "OUT");
  if (absents.length > 0) {
    a.push(
      `${enumerer(absents.map((j) => j.nom))} ${absents.length > 1 ? "ont" : "a"} dit absent.`,
    );
  }
  return a;
}

/// Vrai quand la compo à l'écran diffère de celle du serveur : c'est ce qui
/// décide du bouton (« Enregistrer la compo » ou la suite) et de la question
/// posée avant de quitter l'écran.
export function compoModifiee(
  ecran: { camps: Record<string, Camp | null>; gardiens: Record<string, boolean>; nomA: string; nomB: string },
  serveur: {
    joueurs: { playerId: string; camp: Camp | null; gardienSoiree: boolean }[];
    nomA: string;
    nomB: string;
  },
): boolean {
  if (ecran.nomA.trim() !== serveur.nomA.trim() || ecran.nomB.trim() !== serveur.nomB.trim()) {
    return true;
  }
  return serveur.joueurs.some((j) => {
    const camp = ecran.camps[j.playerId] ?? null;
    if (camp !== j.camp) return true;
    // Le gardien ne compte que pour un joueur placé : basculer « G » sur
    // quelqu'un qu'on retire ensuite ne laisse rien à enregistrer.
    return camp != null && Boolean(ecran.gardiens[j.playerId]) !== j.gardienSoiree;
  });
}

// --- Le partage ----------------------------------------------------------------

export type EquipeConvoquee = { nom: string; joueurs: string[] };

/// La convocation, prête à coller sur le groupe — `texteConvocation` du site
/// (lib/convocation.ts), mot pour mot : le même message part de l'app et du
/// site. La date y reste absolue : le texte se lit encore le lendemain.
export function texteConvocation(input: {
  /// « Lundi 21 septembre · 19:00 · Five Renault »
  entete: string;
  /// « 8 présents · 4 places », ou null.
  etat: string | null;
  /// Vide tant que la compo n'est pas faite : le texte reste une convocation.
  equipes: EquipeConvoquee[];
  lien: string;
}): string {
  const l: string[] = [input.entete];
  if (input.etat) l.push(input.etat);
  const equipes = input.equipes.filter((e) => e.joueurs.length > 0);
  if (equipes.length > 0) {
    l.push("");
    for (const e of equipes) l.push(`${e.nom} (${e.joueurs.length}) : ${e.joueurs.join(", ")}`);
  }
  l.push("");
  l.push(`Réponds ici : ${input.lien}`);
  return l.join("\n");
}

/// Une promesse qui abandonne au bout de `ms` : l'écran n'attend pas un
/// serveur qui ne répond pas. Le message contient « timeout », que
/// `lib/erreurs.ts` traduit en « Le serveur met trop de temps à répondre ».
export function avecDelai<T>(promesse: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error("timeout")), ms);
    promesse.then(
      (v) => {
        clearTimeout(minuteur);
        resoudre(v);
      },
      (e) => {
        clearTimeout(minuteur);
        rejeter(e);
      },
    );
  });
}
