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

/// Applique le schéma à une base, neuve ou déjà remplie.
///
/// À appeler à CHAQUE ouverture, pas seulement à la première : le DDL est tout
/// entier en `CREATE ... IF NOT EXISTS`, et les PRAGMA de tête doivent être
/// reposés. `journal_mode = WAL` est persistant, `synchronous = NORMAL` ne
/// l'est pas — il retombe à FULL à chaque nouvelle connexion.
export async function appliquerSchema(base: Base, schema: string): Promise<void> {
  await base.script(schema);
}
