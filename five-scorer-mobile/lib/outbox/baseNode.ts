// L'implémentation de `Base` sur le SQLite embarqué dans Node.
//
// **Elle ne part JAMAIS dans l'app** : rien sous « app/ » ne l'importe, et
// Metro ne suit que ce qui est importé. Elle existe pour les tests, et c'est
// tout — mais ce n'est pas peu : c'est elle qui permet de rejouer cinquante
// opérations, serveur en panne et processus tué au milieu, dans un conteneur
// où il n'y a ni téléphone ni simulateur.
//
// Le moteur est le même que celui d'expo-sqlite sur l'appareil (SQLite 3.51.2
// dans le Node de ce dépôt, relevé le 9 septembre). Ce n'est donc pas une
// imitation du comportement de la base : c'est la base.
//
// `node:sqlite` est SYNCHRONE ; l'interface est asynchrone parce
// qu'expo-sqlite l'est. Les méthodes rendent donc des promesses déjà
// résolues. Aucune ne peut « prendre du retard » : c'est un écart de fidélité
// assumé, et il joue dans le bon sens — un test qui passe ici sur une
// séquence d'écritures passera a fortiori sur une base qui sérialise.

import { DatabaseSync } from "node:sqlite";
import type { Base, Ligne, Resultat, Valeur } from "./base";

/// Les paramètres tels que `node:sqlite` les accepte : il refuse `undefined`,
/// et n'a pas la tolérance d'expo-sqlite sur les booléens.
function parametres(params: Valeur[] | undefined): Valeur[] {
  return (params ?? []).map((v) => (v === undefined ? null : v));
}

/// `node:sqlite` rend les INTEGER en `number` tant qu'ils tiennent dans un
/// entier sûr, mais `lastInsertRowid` arrive en `bigint`. On normalise ici
/// plutôt que chez l'appelant, qui n'a pas à connaître le moteur.
function nombre(v: number | bigint): number {
  return typeof v === "bigint" ? Number(v) : v;
}

export class BaseNode implements Base {
  constructor(private readonly db: DatabaseSync) {}

  /// Ouvre une base sur disque (ou « :memory: »). Le chemin sur disque est ce
  /// qui rend le test de reprise après crash honnête : deux instances
  /// successives voient la même file.
  static ouvrir(chemin = ":memory:"): BaseNode {
    return new BaseNode(new DatabaseSync(chemin));
  }

  async script(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async executer(sql: string, params?: Valeur[]): Promise<Resultat> {
    const r = this.db.prepare(sql).run(...parametres(params));
    return { dernierId: nombre(r.lastInsertRowid), modifiees: nombre(r.changes) };
  }

  async lire<T = Ligne>(sql: string, params?: Valeur[]): Promise<T[]> {
    return this.db.prepare(sql).all(...parametres(params)) as T[];
  }

  async premier<T = Ligne>(sql: string, params?: Valeur[]): Promise<T | null> {
    const r = this.db.prepare(sql).get(...parametres(params));
    return (r ?? null) as T | null;
  }

  /// BEGIN IMMEDIATE, pas BEGIN : c'est l'équivalent le plus proche de
  /// `withExclusiveTransactionAsync` — le verrou d'écriture est pris tout de
  /// suite, pas à la première écriture, donc deux transactions concurrentes
  /// ne peuvent pas se découvrir en conflit à mi-chemin.
  async transaction<T>(fn: (base: Base) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = await fn(this);
      this.db.exec("COMMIT");
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  fermer(): void {
    this.db.close();
  }
}
