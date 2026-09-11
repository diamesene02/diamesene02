// La couche d'accès à la base locale, réduite à ce dont on a besoin.
//
// Le drain de l'outbox (« sync.ts ») ne parle jamais à expo-sqlite
// directement : il parle à cette interface. Deux implémentations la servent —
// « baseExpo.ts » sur le téléphone, « baseNode.ts » dans les tests, sur le
// SQLite embarqué dans Node. C'est ce qui permet de rejouer une soirée entière
// de saisie, serveur en panne et processus tué au milieu, dans un conteneur
// sans téléphone.
//
// L'interface est volontairement pauvre : quatre méthodes, du SQL en clair.
// Un ORM aurait ajouté une couche à porter par-dessus une couche déjà portée,
// et « db/schema.sql » est déjà la source unique du schéma.

/// Ce qu'une requête accepte comme paramètre. SQLite ne connaît que ces
/// quatre formes ; les booléens deviennent 0/1 à l'écriture (voir « db/schema.sql »,
/// où chaque booléen porte un CHECK IN (0, 1)).
export type Valeur = string | number | null | Uint8Array;

/// Une ligne telle que SQLite la rend : colonnes en serpent_minuscule.
/// La conversion vers les noms TypeScript vit dans « outbox.ts », à un seul
/// endroit — la règle 2 de l'entête de « db/schema.sql ».
export type Ligne = Record<string, Valeur>;

export type Resultat = {
  /// L'identifiant de la dernière ligne insérée. C'est lui, et lui seul, qui
  /// ordonne la file : il ne recule jamais, contrairement à l'horloge du
  /// téléphone.
  dernierId: number;
  /// Le nombre de lignes touchées. Le blocage en cascade s'en sert pour dire
  /// combien d'opérations il a mises de côté.
  modifiees: number;
};

import { PALIERS } from "../../db/paliers";
import { appliquerPaliers, cible, type Palier } from "./migrations";

export interface Base {
  /// Un script entier, plusieurs instructions, sans paramètre : le schéma et
  /// ses PRAGMA. Une méthode à part parce que `runAsync` d'expo-sqlite refuse
  /// les instructions multiples — c'est `execAsync` qui les prend.
  script(sql: string): Promise<void>;
  /// INSERT / UPDATE / DELETE.
  executer(sql: string, params?: Valeur[]): Promise<Resultat>;
  /// SELECT, toutes les lignes.
  lire<T = Ligne>(sql: string, params?: Valeur[]): Promise<T[]>;
  /// SELECT, la première ligne ou `null`.
  premier<T = Ligne>(sql: string, params?: Valeur[]): Promise<T | null>;
  /// Une transaction exclusive. Le rappel reçoit la base à utiliser — sur
  /// expo-sqlite c'est un objet distinct, et écrire par-dessus l'ancien
  /// sortirait silencieusement de la transaction.
  ///
  /// Exclusive, pas « ordinaire » : la doc d'Expo précise que
  /// `withTransactionAsync` embarque toute requête lancée pendant qu'elle est
  /// active, y compris celles d'un autre écran. Un but écrit ses deux tables ;
  /// il ne doit pas embarquer la lecture d'à côté.
  transaction<T>(fn: (base: Base) => Promise<T>): Promise<T>;
}

/// Applique le schéma à une base, neuve ou déjà remplie, puis la fait monter.
///
/// À appeler à CHAQUE ouverture, pas seulement à la première : le DDL est tout
/// entier en `CREATE ... IF NOT EXISTS`, et les PRAGMA de tête doivent être
/// reposés. `journal_mode = WAL` est persistant, `synchronous = NORMAL` ne
/// l'est pas — il retombe à FULL à chaque nouvelle connexion.
///
/// **L'ordre n'est pas négociable.** Les PRAGMA d'abord, HORS transaction :
/// `journal_mode = WAL` ne peut pas s'exécuter dans une transaction, SQLite le
/// refuse. Ils sont en tête du script, donc ils passent avec lui. L'échelle des
/// paliers vient après, chaque palier dans sa propre transaction.
///
/// **Deux chemins, un seul schéma.** Une base NEUVE naît du script et se pose
/// directement à la cible : elle n'a aucun palier à monter, elle est déjà à
/// jour par construction. Une base EXISTANTE — toutes celles installées avant
/// ce lot, à la version 0 — traverse l'échelle. Les deux doivent arriver au
/// même schéma, sinon les téléphones du club divergent selon leur date
/// d'installation, et le défaut ne se verrait qu'à la première requête qui
/// touche la différence. C'est ce que vérifie le test de convergence de
/// `lib/outbox/migrations.test.ts`.
export async function appliquerSchema(
  base: Base,
  schema: string,
  paliers: Palier[] = PALIERS,
): Promise<void> {
  // Lu AVANT de poser le schéma : après, la base n'est plus vide et la
  // question ne se pose plus.
  //
  // On cherche une table DU SCHÉMA, pas « une table, n'importe laquelle ».
  // `outbox.id` est un INTEGER PRIMARY KEY AUTOINCREMENT — le mot est
  // indispensable, l'en-tête de `db/schema.sql` explique pourquoi — et
  // AUTOINCREMENT crée `sqlite_sequence`, une table interne qui SURVIT au DROP
  // de toutes les autres. Une sonde générique déclarait donc « existante » une
  // base entièrement vidée, et la faisait entrer dans l'échelle au palier 0
  // sur un schéma qu'on venait de recréer à la cible.
  const neuve = !(await base.premier(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'outbox'",
  ));

  await base.script(schema);

  if (neuve) {
    const v = cible(paliers);
    if (v > 0) await base.script(`PRAGMA user_version = ${v};`);
    return;
  }

  await appliquerPaliers(base, paliers);
}
