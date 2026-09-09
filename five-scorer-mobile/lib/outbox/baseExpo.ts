// L'implémentation de `Base` sur expo-sqlite — celle qui tourne sur le
// téléphone.
//
// expo-sqlite est « Included in Expo Go » (§3.3 de MOBILE.md) : ce fichier
// marche donc dès le QR code, sans development build. Il n'est volontairement
// pas testé par Vitest — le module natif n'existe pas dans un conteneur — et
// c'est précisément pour ça que « baseNode.ts » existe : la logique testée est
// au-dessus de l'interface, pas dedans. Ce fichier-ci doit rester assez mince
// pour se relire d'un coup d'œil.

import * as SQLite from "expo-sqlite";
import type { Base, Ligne, Resultat, Valeur } from "./base";
import { appliquerSchema } from "./base";
import { SCHEMA } from "../../db/schema";

/// Le nom du fichier sur le téléphone. Un seul pour toute l'app, tous clubs
/// confondus : le club est une colonne, pas une base — comme dans Dexie, où
/// `clubId` est un index et non un magasin séparé.
export const NOM_BASE = "five-scorer.db";

/// Enveloppe une base (ou une transaction) d'expo-sqlite.
///
/// `SQLite.Transaction` hérite de `SQLiteDatabase` : la même enveloppe sert
/// donc aux deux, et le rappel de `transaction()` reçoit une `Base` branchée
/// sur la connexion de la transaction. C'est ce détail qui compte : écrire par
/// l'ancienne enveloppe pendant une transaction exclusive sortirait de la
/// transaction sans rien dire.
export class BaseExpo implements Base {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  async script(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async executer(sql: string, params: Valeur[] = []): Promise<Resultat> {
    const r = await this.db.runAsync(sql, params as SQLite.SQLiteBindParams);
    return { dernierId: r.lastInsertRowId, modifiees: r.changes };
  }

  async lire<T = Ligne>(sql: string, params: Valeur[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params as SQLite.SQLiteBindParams);
  }

  async premier<T = Ligne>(sql: string, params: Valeur[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, params as SQLite.SQLiteBindParams);
  }

  async transaction<T>(fn: (base: Base) => Promise<T>): Promise<T> {
    // `withExclusiveTransactionAsync` ne rend rien : on récupère la valeur par
    // la fermeture. Si le rappel lève, expo-sqlite annule la transaction et
    // relaie l'erreur — `resultat` reste alors intact, et on ne le lit pas.
    let resultat!: T;
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      resultat = await fn(new BaseExpo(txn));
    });
    return resultat;
  }
}

/// Ouvre la base de l'app et lui applique le schéma.
///
/// À appeler une fois au démarrage. Le schéma est tout entier en
/// « CREATE ... IF NOT EXISTS » : le rejouer à chaque ouverture ne coûte rien
/// et repose `synchronous = NORMAL`, qui ne survit pas à la fermeture de la
/// connexion.
export async function ouvrirBase(nom = NOM_BASE): Promise<BaseExpo> {
  const db = await SQLite.openDatabaseAsync(nom);
  const base = new BaseExpo(db);
  await appliquerSchema(base, SCHEMA);
  return base;
}
