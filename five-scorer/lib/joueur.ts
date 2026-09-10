/// Ce qu'on accepte d'écrire dans une fiche joueur, et à quelles conditions.
///
/// La règle vivait dans `app/actions/roster.ts`, donc dans un fichier
/// `"use server"` qu'une route d'API n'a pas à importer. Elle est ici pour
/// qu'il n'en existe qu'une : le site et l'app mobile n'ont pas à tomber
/// d'accord sur la taille d'une photo ou sur le plafond du niveau, ils lisent
/// le même code.
///
/// Aucun changement de comportement au passage : les bornes, les coupes et le
/// traitement du `null` sont ceux du site depuis l'origine.

export type EntreeJoueur = {
  name?: string;
  nickname?: string | null;
  skill?: number;
  isGk?: boolean;
  isGuest?: boolean;
  /// Data-URL JPEG carrée, réduite sur l'appareil (cf. PhotoJoueur).
  /// `null` retire la photo.
  photo?: string | null;
  /// « Je viens tous les lundis » (cf. lib/presences).
  abonne?: boolean;
};

/// La photo arrive du client : on ne la croit pas sur parole.
///
/// Seul un JPEG en data-URL est accepté, et sous 200 ko — le composant en
/// produit une vingtaine. Sans ce plafond, n'importe qui pourrait pousser
/// plusieurs mégaoctets dans une colonne texte à chaque enregistrement de
/// fiche, et la lire ensuite sur toutes les pages du club.
export const PHOTO_MAX = 200_000;

export function photoValide(v: string): boolean {
  return v.startsWith("data:image/jpeg;base64,") && v.length <= PHOTO_MAX;
}

/// Ne garde que les champs présents, et ramène chacun dans ses bornes.
///
/// Un champ absent reste absent — c'est ce qui rend la fonction utilisable
/// telle quelle pour une modification partielle : `{ abonne: true }` ne doit
/// pas effacer le surnom.
export function nettoyerJoueur(input: EntreeJoueur) {
  const name = input.name?.trim().slice(0, 60);
  return {
    ...(name ? { name } : {}),
    ...(input.nickname !== undefined
      ? { nickname: input.nickname?.trim().slice(0, 40) || null }
      : {}),
    ...(input.skill !== undefined
      ? { skill: Math.min(5, Math.max(1, Math.round(input.skill))) }
      : {}),
    ...(input.isGk !== undefined ? { isGk: input.isGk } : {}),
    ...(input.isGuest !== undefined ? { isGuest: input.isGuest } : {}),
    ...(input.photo !== undefined
      ? { photo: input.photo && photoValide(input.photo) ? input.photo : null }
      : {}),
    ...(input.abonne !== undefined ? { abonne: input.abonne } : {}),
  };
}

/// Le corps JSON d'une fiche, tel que l'app mobile l'envoie, traduit vers les
/// noms du schéma.
///
/// L'app parle français (`nom`, `niveau`, `gardien`) comme tous les autres
/// endpoints ajoutés pour elle ; la base parle anglais. La traduction est ici
/// plutôt que dans chaque route, et elle est stricte : un champ d'un type
/// inattendu est **ignoré**, jamais deviné. Un `niveau: "3"` venu d'un champ de
/// saisie ne doit pas s'écrire, sinon `Math.round` en ferait `NaN` et Prisma
/// refuserait toute la requête avec un message que personne ne relie au
/// formulaire.
export function entreeDepuisCorps(corps: unknown): EntreeJoueur {
  const c = (corps ?? {}) as Record<string, unknown>;
  return {
    ...(typeof c.nom === "string" ? { name: c.nom } : {}),
    ...(typeof c.surnom === "string" || c.surnom === null
      ? { nickname: c.surnom as string | null }
      : {}),
    ...(typeof c.niveau === "number" && Number.isFinite(c.niveau)
      ? { skill: c.niveau }
      : {}),
    ...(typeof c.gardien === "boolean" ? { isGk: c.gardien } : {}),
    ...(typeof c.invite === "boolean" ? { isGuest: c.invite } : {}),
    ...(typeof c.photo === "string" || c.photo === null
      ? { photo: c.photo as string | null }
      : {}),
    ...(typeof c.abonne === "boolean" ? { abonne: c.abonne } : {}),
  };
}
