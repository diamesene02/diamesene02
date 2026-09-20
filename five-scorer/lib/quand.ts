/// Le temps qui reste avant une soirée, dit comme on le dit.
///
/// Les écrans affichaient tous la date absolue : « lun. 21 », « Lundi 21
/// septembre ». Le samedi, il fallait compter soi-même que c'était dans deux
/// jours. On le dit donc — « Ce soir », « Demain », « Dans 2 jours » — et on
/// se tait au-delà d'une semaine, où la date seule redevient la bonne
/// information.
///
/// Tout se compte en JOURS CIVILS du fuseau du club (`lib/jour.ts`), jamais en
/// tranches de 24 heures : à 23 h 30 le samedi, la soirée du lundi 19 h est
/// « dans 2 jours », pas « demain ».
///
/// Pas de `server-only` ici : le module se teste, et les formulaires client
/// peuvent l'appeler.

import { FUSEAU, cleJour, minuit } from "./jour";

const JOUR_MS = 86_400_000;

/// Écart en jours civils entre deux instants : 0 = même jour, 1 = lendemain.
export function ecartJours(d: Date, maintenant: Date): number {
  const a = Date.parse(`${cleJour(d)}T00:00:00Z`);
  const b = Date.parse(`${cleJour(maintenant)}T00:00:00Z`);
  return Math.round((a - b) / JOUR_MS);
}

/// Heure et minute dans le fuseau du club.
function heureMinute(d: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSEAU,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const val = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { h: val("hour"), m: val("minute") };
}

/// « Ce soir », « Demain », « Dans 3 jours », « Hier » — ou null quand la
/// date absolue dit mieux les choses (au-delà de six jours, ou plus loin
/// dans le passé qu'hier).
export function quandRelatif(d: Date, maintenant: Date): string | null {
  const n = ecartJours(d, maintenant);
  if (n === 0) return heureMinute(d).h >= 17 ? "Ce soir" : "Aujourd'hui";
  if (n === 1) return "Demain";
  if (n >= 2 && n <= 6) return `Dans ${n} jours`;
  if (n === -1) return "Hier";
  return null;
}

/// L'instant `h:m` du jour civil `cle` (« 2026-09-21 »), à l'heure de Paris.
function aLHeure(cle: string, h: number, m: number): Date {
  // Midi UTC tombe toujours le même jour civil à Paris.
  const base = minuit(new Date(`${cle}T12:00:00Z`)) + (h * 60 + m) * 60_000;
  // Un jour de changement d'heure, minuit + 19 h ne fait pas 19 h : on
  // rattrape l'écart constaté.
  const lu = heureMinute(new Date(base));
  const ecart = h * 60 + m - (lu.h * 60 + lu.m);
  return new Date(base + ecart * 60_000);
}

/// La date à proposer pour une nouvelle soirée : le prochain jour de jeu du
/// club, à son heure habituelle, qui n'a pas déjà sa soirée.
///
/// « Demain 19 h » était proposé quel que soit le club : un club du lundi
/// corrigeait la date à chaque fois. Le modèle est la dernière soirée
/// programmée — son jour de la semaine et son heure. Les jours déjà pris sont
/// sautés : un club qui a posé sa saison n'ouvre « Programmer une soirée » que
/// pour une date hors calendrier, pas pour doubler le lundi qui vient.
export function prochaineDateDeJeu(input: {
  modele: Date | null;
  /// Jours civils (`cleJour`) qui ont déjà une soirée.
  prises: Iterable<string>;
  maintenant: Date;
}): Date {
  const { modele, maintenant } = input;
  const prises = new Set(input.prises);
  const demain = new Date(
    Date.parse(`${cleJour(maintenant)}T12:00:00Z`) + JOUR_MS,
  );
  if (!modele) return aLHeure(cleJour(demain), 19, 0);

  const jourModele = new Date(`${cleJour(modele)}T12:00:00Z`).getUTCDay();
  const { h, m } = heureMinute(modele);
  const depart = Date.parse(`${cleJour(maintenant)}T12:00:00Z`);
  // Neuf semaines : au-delà, le calendrier est plein et « demain » n'est pas
  // pire qu'une date lointaine.
  for (let i = 0; i < 63; i++) {
    const jour = new Date(depart + i * JOUR_MS);
    if (jour.getUTCDay() !== jourModele) continue;
    const cle = jour.toISOString().slice(0, 10);
    if (prises.has(cle)) continue;
    const candidat = aLHeure(cle, h, m);
    if (candidat.getTime() > maintenant.getTime()) return candidat;
  }
  return aLHeure(cleJour(demain), h, m);
}
