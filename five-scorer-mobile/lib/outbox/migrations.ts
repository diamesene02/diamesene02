// L'échelle qui fait monter une base existante, palier par palier.
//
// Pourquoi ce fichier existe : « appliquerSchema » posait le schéma et rien
// d'autre, sur un DDL tout entier en « CREATE TABLE IF NOT EXISTS ». Sur une
// base qui existe déjà, une table modifiée n'est PAS modifiée — en silence. Et
// cette base est celle qui contient la soirée non synchronisée.
//
// Tout ici parle à l'interface « Base », jamais à expo-sqlite ni à node:sqlite :
// la même échelle monte la base du téléphone et celle des tests.

import type { Base } from "./base";

export type Palier = { version: number; migration: string };

/// Le plus haut palier connu d'un jeu de paliers. C'est la CIBLE.
///
/// Calculée, jamais écrite à la main : une constante posée à côté finirait par
/// mentir sur le contenu de « db/paliers/ », et personne ne le verrait avant
/// qu'une migration ne parte pas.
export function cible(paliers: Palier[]): number {
  return paliers.reduce((m, p) => Math.max(m, p.version), 0);
}

/// La version d'une base. `0` pour toute base d'avant ce lot.
export async function versionDe(base: Base): Promise<number> {
  const l = await base.premier<{ user_version: number }>("PRAGMA user_version");
  return l?.user_version ?? 0;
}

/// Fait monter une base EXISTANTE jusqu'à la cible.
///
/// **Palier par palier, jamais en sautant à la cible.** Six mois sans ouvrir
/// l'app, ce sont deux ou trois paliers qui s'enchaînent — et chacun n'a été
/// éprouvé que contre le précédent. Un saut direct ne l'a jamais été.
///
/// **Chaque palier dans SA transaction.** Un palier coupé au milieu — l'app
/// tuée, la batterie morte — laisse la base sur le palier précédent, entière,
/// avec sa file. C'est la seule garantie qui compte : le fichier qu'on migre
/// est celui qui porte la soirée de lundi.
///
/// **Aucune migration descendante.** Si la base est PLUS HAUTE que la cible —
/// un TestFlight qui réinstalle un build antérieur, le cas le plus probable
/// d'un club qui vit sur des builds internes — il n'y a rien à appliquer, et
/// on n'y touche pas. La détection du cas et ce qu'on en dit à l'utilisateur
/// vivent dans « baseExpo.ts » et « composants/Noyau.tsx » : ici, on se
/// contente de ne rien casser.
export async function appliquerPaliers(base: Base, paliers: Palier[]): Promise<void> {
  const depart = await versionDe(base);
  const aMonter = paliers
    .filter((p) => p.version > depart)
    .sort((a, b) => a.version - b.version);

  for (const p of aMonter) {
    await base.transaction(async (b) => {
      // La version est RELUE dans la transaction, et pas seulement avant la
      // boucle. Deux ouvertures concurrentes — le bouton « Réessayer » de
      // `composants/Noyau.tsx` pendant qu'une première ouverture est encore en
      // vol — liraient toutes deux 0 hors transaction, puis appliqueraient le
      // même palier. Aujourd'hui c'est un PRAGMA idempotent ; demain, avec un
      // `ALTER TABLE … ADD COLUMN`, c'est « duplicate column name » et une app
      // qui ne s'ouvre plus.
      //
      // Et c'est ici, pas dans le banc d'essai, que ça se joue :
      // `withExclusiveTransactionAsync` d'expo-sqlite ouvre un simple `BEGIN`
      // sur une CONNEXION DISTINCTE (node_modules/expo-sqlite), là où
      // `lib/outbox/baseNode.ts` prend un `BEGIN IMMEDIATE`. Le verrou
      // d'écriture n'est donc pas pris au même moment sur le téléphone et dans
      // les tests.
      if ((await versionDe(b)) >= p.version) return;
      await b.script(p.migration);
    });
  }
}
