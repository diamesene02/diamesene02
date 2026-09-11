// Ce qu'on garde d'un plantage, et combien de temps.
//
// Ce fichier ne connaît NI Expo NI React Native : il est testable dans un
// conteneur, comme `lib/photo/contrat.ts` l'est à côté de `lib/photo/choisir.ts`.
// L'écriture sur le disque vit dans « lib/plantages/fichier.ts », qui ne
// contient aucune règle — seulement des appels.

export type Plantage = {
  /// Quand. En ISO, parce que c'est la seule forme qui se relit à l'œil et se
  /// trie à la comparaison de chaînes.
  quand: string;
  /// Où — le nom de l'écran, pas le composant React. « la feuille de match »
  /// veut dire quelque chose pour Ibrahima ; « MatchScreen » non.
  ou: string;
  message: string;
  /// La pile, coupée. Elle sert à retrouver le fichier fautif, pas à faire de
  /// l'archéologie : au-delà de quelques cadres c'est du bruit qui remplit le
  /// fichier.
  pile: string | null;
};

/// Le nombre de plantages qu'on garde. Au-delà, les plus anciens tombent.
///
/// Vingt, parce que ce fichier n'est pas un journal : c'est ce qu'on lit quand
/// quelqu'un dit « ça a planté hier ». Un an d'historique ne servirait qu'à
/// rendre le fichier illisible — et à garder sur le téléphone des traces dont
/// personne n'a plus l'usage.
export const GARDES = 20;

/// Le nombre de cadres de pile qu'on garde par plantage.
const CADRES = 8;

export function construirePlantage(
  erreur: unknown,
  ou: string,
  maintenant: string,
): Plantage {
  const e = erreur instanceof Error ? erreur : null;
  return {
    quand: maintenant,
    ou,
    message: e ? e.message : String(erreur),
    pile: e?.stack ? e.stack.split("\n").slice(0, CADRES).join("\n") : null,
  };
}

/// Ajoute un plantage à la liste et rend la liste bornée, le plus RÉCENT en
/// premier.
///
/// Le plus récent en premier parce que c'est celui qu'on vient chercher : on
/// ouvre ce fichier après un plantage, pas avant.
export function ajouter(liste: Plantage[], neuf: Plantage): Plantage[] {
  return [neuf, ...liste].slice(0, GARDES);
}

/// Relit une liste depuis le texte du fichier.
///
/// **Une ligne illisible est ignorée, pas fatale.** Un fichier tronqué par une
/// coupure d'écriture ne doit pas empêcher de lire les dix-neuf plantages qui
/// le précèdent — c'est exactement le cas où l'on vient le consulter.
export function relire(texte: string): Plantage[] {
  const liste: Plantage[] = [];
  for (const ligne of texte.split("\n")) {
    if (!ligne.trim()) continue;
    try {
      const o = JSON.parse(ligne) as Plantage;
      if (typeof o?.quand === "string" && typeof o?.message === "string") liste.push(o);
    } catch {
      // ignorée, exprès
    }
  }
  return liste;
}

export function ecrire(liste: Plantage[]): string {
  return liste.map((p) => JSON.stringify(p)).join("\n") + "\n";
}
