// La bannière qu'on a fermée, retenue sur le téléphone.
//
// Le site écrit `fs-banniere-<soirée>` dans le localStorage : fermée pour
// CETTE soirée, elle revient pour la suivante. L'app la gardait en mémoire
// d'écran, et elle réapparaissait à chaque ouverture — un ✕ qui ne tient pas
// apprend qu'il ne sert à rien.
//
// Un petit fichier JSON dans Documents, comme lib/succes-vus.ts : rien à
// envoyer au serveur, rien à attendre de la base. On ne garde que les
// dernières soirées : au-delà, elles sont passées et leur bannière ne
// reviendra pas.
//
// Rien ici ne lève. Un fichier illisible vaut « rien de fermé » : la
// bannière revient, ce qui est un moindre mal.

import { File, Paths } from "expo-file-system";

const GARDE = 20;

function fichier(): File {
  return new File(Paths.document, "accueil-bannieres-fermees.json");
}

export async function lireBannieresFermees(): Promise<string[]> {
  try {
    const f = fichier();
    if (!f.exists) return [];
    const v: unknown = JSON.parse(await f.text());
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function fermerBanniere(soireeId: string): Promise<void> {
  try {
    const avant = (await lireBannieresFermees()).filter((x) => x !== soireeId);
    fichier().write(JSON.stringify([...avant, soireeId].slice(-GARDE)));
  } catch {
    // avalée, exprès : au pire, la bannière revient une fois.
  }
}
