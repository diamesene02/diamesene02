// Le contrat photo, côté app — pur, sans Expo ni React Native.
//
// Ce que le serveur accepte tient en deux lignes (five-scorer/app/actions/
// roster.ts) : une data-URL JPEG, sous 200 000 caractères. Tout le reste de
// la chaîne (photothèque, recadrage, réduction, encodage) sert uniquement à
// produire une chaîne qui passe ces deux lignes. On les recopie ici pour
// pouvoir refuser AVANT le réseau, et un test vérifie que la copie n'a pas
// divergé de l'original.

export const PHOTO_PREFIXE = "data:image/jpeg;base64,";
export const PHOTO_MAX = 200_000;

/// Copie conforme de `photoValide` (five-scorer/app/actions/roster.ts).
export function photoValide(v: string): boolean {
  return v.startsWith(PHOTO_PREFIXE) && v.length <= PHOTO_MAX;
}

/// Combien d'octets de JPEG tiennent sous le plafond de CARACTÈRES.
///
/// base64 écrit 4 caractères pour 3 octets : la photo grossit d'un tiers en
/// route. 200 000 caractères, moins les 23 du préfixe, laissent donc 149 982
/// octets de JPEG — et pas 200 000. C'est le piège de ce plafond.
export const OCTETS_MAX = Math.floor((PHOTO_MAX - PHOTO_PREFIXE.length) / 4) * 3;

/// Le format du trombinoscope : carré de 256 px, JPEG à 82 %.
/// Mêmes valeurs que le web (components/ios/PhotoJoueur.tsx), pour que les
/// deux moitiés du club aient des vignettes identiques.
export const COTE = 256;
export const QUALITE = 0.82;

/// Le carré centré sur le milieu de l'image, comme `reduireEnCarre` du web.
/// Personne ne veut recadrer quinze photos à la main.
export function carreCentre(
  largeur: number,
  hauteur: number,
): { originX: number; originY: number; width: number; height: number } {
  const cote = Math.min(largeur, hauteur);
  return {
    originX: Math.floor((largeur - cote) / 2),
    originY: Math.floor((hauteur - cote) / 2),
    width: cote,
    height: cote,
  };
}

export function enDataUrl(base64: string): string {
  return PHOTO_PREFIXE + base64;
}

/// Encoder jusqu'à passer sous le plafond.
///
/// À 256 px, 0,82 suffit toujours (une dizaine de kilo-octets). La boucle
/// existe pour le cas qu'on n'a pas prévu — une photo de bruit pur, un
/// encodeur bavard — parce qu'un dépassement silencieux, côté serveur, ne
/// renvoie pas d'erreur : `sanitize` remplace la photo par `null` et la fiche
/// revient sans photo, sans que personne comprenne pourquoi.
///
/// `encoder` reçoit une qualité et rend du base64 (pas la data-URL).
export async function encoderSousPlafond(
  encoder: (qualite: number) => Promise<string>,
  qualites: readonly number[] = [QUALITE, 0.6, 0.45],
): Promise<string> {
  let dernier = 0;
  for (const q of qualites) {
    const url = enDataUrl(await encoder(q));
    if (photoValide(url)) return url;
    dernier = url.length;
  }
  throw new Error(
    `Photo trop lourde : ${dernier} caractères pour ${PHOTO_MAX} permis.`,
  );
}

/// Lire l'en-tête d'un JPEG : est-ce bien un JPEG, et de quelles dimensions ?
///
/// Sert au test — on ne croit pas l'encodeur sur parole, on relit ce qui part.
export function mesurerJpeg(
  octets: Uint8Array,
): { largeur: number; hauteur: number } | null {
  if (octets[0] !== 0xff || octets[1] !== 0xd8) return null; // pas de SOI
  let i = 2;
  while (i + 9 < octets.length) {
    if (octets[i] !== 0xff) {
      i++;
      continue;
    }
    const marqueur = octets[i + 1];
    // Marqueurs sans charge utile : on avance de deux octets.
    if (marqueur === 0xd8 || marqueur === 0x01 || marqueur === 0xff) {
      i += 2;
      continue;
    }
    if (marqueur >= 0xd0 && marqueur <= 0xd7) {
      i += 2;
      continue;
    }
    const taille = (octets[i + 2] << 8) | octets[i + 3];
    // SOF0..SOF15 portent les dimensions ; c4/c8/cc sont DHT/JPG/DAC.
    if (
      marqueur >= 0xc0 &&
      marqueur <= 0xcf &&
      marqueur !== 0xc4 &&
      marqueur !== 0xc8 &&
      marqueur !== 0xcc
    ) {
      return {
        hauteur: (octets[i + 5] << 8) | octets[i + 6],
        largeur: (octets[i + 7] << 8) | octets[i + 8],
      };
    }
    i += 2 + taille;
  }
  return null;
}
