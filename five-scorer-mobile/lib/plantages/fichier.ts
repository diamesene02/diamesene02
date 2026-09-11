// L'écriture des plantages sur le disque du téléphone.
//
// **Ce fichier ne contient AUCUNE règle** — elles sont toutes dans
// « lib/plantages/contrat.ts », qui est testé. Ici il n'y a que des appels à
// expo-file-system, exactement comme « baseExpo.ts » n'est qu'un branchement
// sur expo-sqlite : le module natif n'existe pas dans un conteneur, donc tout
// ce qui vit ici est intestable, donc il doit rester assez mince pour se
// relire d'un coup d'œil.
//
// Rien ne part nulle part. Le rapport reste sur le téléphone (spec 0004, Q5 —
// constitution, article VI). Ibrahima apprendra les plantages par les joueurs,
// comme aujourd'hui, mais avec une trace exploitable au lieu d'un récit.

import { Directory, File, Paths } from "expo-file-system";
import { ajouter, construirePlantage, ecrire, relire, type Plantage } from "./contrat";

const NOM = "plantages.jsonl";

function fichier(): File {
  return new File(Paths.document, NOM);
}

export async function lirePlantages(): Promise<Plantage[]> {
  try {
    const f = fichier();
    if (!f.exists) return [];
    return relire(await f.text());
  } catch {
    // Lire des plantages ne doit jamais en provoquer un.
    return [];
  }
}

/// Ajoute un plantage au fichier. **N'échoue jamais** : elle est appelée depuis
/// un écran d'erreur, et une exception ici remplacerait le message par un écran
/// blanc — c'est-à-dire qu'elle transformerait un plantage rattrapé en plantage
/// définitif.
export async function enregistrerPlantage(erreur: unknown, ou: string): Promise<void> {
  try {
    const liste = await lirePlantages();
    const neuf = construirePlantage(erreur, ou, new Date().toISOString());
    const f = fichier();
    if (!(Paths.document as Directory).exists) return;
    f.write(ecrire(ajouter(liste, neuf)));
  } catch {
    // avalée, exprès
  }
}
