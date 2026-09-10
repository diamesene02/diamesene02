// Prendre ou choisir une photo de joueur, et n'en garder que ce qui passe.
//
// Trois modules du SDK 57, tous présents dans Expo Go : expo-image-picker
// (57.0.16), expo-image-manipulator (57.0.16), expo-file-system (57.0.6).
// Aucun module natif hors SDK, donc la même chaîne tourne en développement
// dans Expo Go et dans le build natif.

import { ImageManipulator, SaveFormat, type ImageRef } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";

import { COTE, carreCentre, encoderSousPlafond } from "./contrat";

export type Source = "photothèque" | "appareil";

/// Le recadrage carré est confié au système.
///
/// `allowsEditing` ouvre l'éditeur d'iOS (carré d'office) ou celui d'Android
/// (`aspect: [1, 1]`). Trois problèmes tombent d'un coup : le cadrage est
/// choisi par la personne au lieu d'être deviné, l'image ressort DÉJÀ REDRESSÉE
/// (l'éditeur applique l'orientation EXIF et n'en réécrit pas), et un HEIC
/// d'iPhone ressort décodé. Sans cet éditeur, il faudrait lire `exif.Orientation`
/// et tourner à la main — c'est la panne classique du visage couché.
///
/// `quality: 0.9` borne le fichier intermédiaire : c'est ce que l'éditeur écrit
/// dans le cache avant qu'on y touche. À 1, un cliché de 12 Mpx laisse une
/// dizaine de mégaoctets sur le disque pour rien.
const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
  // Jamais `base64: true` ici : ce serait faire traverser le pont JS à
  // plusieurs mégaoctets de texte avant même d'avoir réduit quoi que ce soit.
  base64: false,
  exif: false,
  // iOS transcode le HEIC en JPEG à la lecture plutôt que de le passer tel quel.
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

export async function choisirPhoto(
  source: Source = "photothèque",
): Promise<string | null> {
  const permission =
    source === "appareil"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      source === "appareil"
        ? "L'accès à l'appareil photo est refusé. Tu peux l'autoriser dans les Réglages."
        : "L'accès aux photos est refusé. Tu peux l'autoriser dans les Réglages.",
    );
  }

  const res =
    source === "appareil"
      ? await ImagePicker.launchCameraAsync(OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  if (res.canceled) return null;
  const choisie = res.assets[0];
  if (!choisie) return null;

  try {
    return await preparer(choisie.uri, choisie.width, choisie.height);
  } finally {
    // La copie faite par le sélecteur ne sert plus : le cache d'une app qui
    // grossit à chaque photo finit par se faire vider par le système au pire
    // moment.
    jeter(choisie.uri);
  }
}

/// Réduire une image à un carré de 256 px, en JPEG, sous le plafond serveur.
///
/// Exportée pour être appelable sans sélecteur — c'est ce que fait le test.
/// `largeur` et `hauteur` sont celles de l'image d'origine : quand l'image
/// n'est pas carrée, on découpe le carré du milieu AVANT de réduire. Sans ce
/// découpage, `resize({width, height})` écrase la photo dans un carré — les
/// visages s'aplatissent.
///
/// Les deux dimensions sont OBLIGATOIRES. Elles avaient une valeur par défaut
/// de 0, et un appel qui les omettait sautait le découpage sans rien dire :
/// exactement le défaut que ce découpage existe pour éviter. Un paramètre
/// qu'on peut oublier n'est pas un garde-fou.
export async function preparer(
  uri: string,
  largeur: number,
  hauteur: number,
): Promise<string> {
  if (!(largeur > 0) || !(hauteur > 0)) {
    throw new Error("Dimensions de l'image inconnues.");
  }
  const contexte = ImageManipulator.manipulate(uri);
  if (largeur !== hauteur) {
    contexte.crop(carreCentre(largeur, hauteur));
  }
  contexte.resize({ width: COTE, height: COTE });

  let image: ImageRef | null = null;
  const brouillons: string[] = [];
  try {
    // Une seule décomposition de l'original : `renderAsync` rend une image de
    // 256 px, et c'est ELLE qu'on ré-encode si la qualité doit descendre.
    // Repartir de l'URI à chaque essai ferait redécoder les 12 Mpx trois fois.
    image = await contexte.renderAsync();
    const rendue = image;
    return await encoderSousPlafond(async (compress) => {
      const r = await rendue.saveAsync({
        compress,
        format: SaveFormat.JPEG,
        base64: true,
      });
      brouillons.push(r.uri);
      if (!r.base64) throw new Error("Cette image n'a pas pu être lue.");
      return r.base64;
    });
  } finally {
    // `release()` rend le bitmap natif tout de suite au lieu d'attendre le
    // ramasse-miettes JS. Sur une photo de 12 Mpx, c'est 48 Mo (4032 × 3024 ×
    // 4 octets) qu'on ne laisse pas traîner — c'est là que les Android
    // d'entrée de gamme tombent.
    image?.release();
    contexte.release();
    for (const f of brouillons) jeter(f);
  }
}

function jeter(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Un fichier de cache qu'on n'arrive pas à supprimer n'est pas une panne.
  }
}
