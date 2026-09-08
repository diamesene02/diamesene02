"use client";

import { useRef, useState } from "react";

/// Choisir une photo de joueur.
///
/// L'image est réduite ICI, sur le téléphone : carré de 256 px, JPEG à 82 %,
/// une vingtaine de kilo-octets. Ce qui part sur le réseau est donc toujours
/// petit, quelle que soit la photo choisie — un cliché d'iPhone en fait
/// quatre mille fois plus.
///
/// Le cadrage est un carré centré sur le milieu de l'image, comme le fait un
/// trombinoscope : personne ne veut recadrer quinze photos à la main.
export async function reduireEnCarre(fichier: File, cote = 256): Promise<string> {
  const bitmap = await createImageBitmap(fichier);
  const taille = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - taille) / 2;
  const sy = (bitmap.height - taille) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = cote;
  canvas.height = cote;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossible de préparer l'image");
  ctx.drawImage(bitmap, sx, sy, taille, taille, 0, 0, cote, cote);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function PhotoJoueur({
  nom,
  photo,
  onChange,
  disabled,
}: {
  nom: string;
  photo: string | null;
  /// `null` = retirer la photo.
  onChange: (photo: string | null) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function choisir(f: File | undefined) {
    if (!f) return;
    setErreur(null);
    setOccupe(true);
    try {
      const url = await reduireEnCarre(f);
      onChange(url);
    } catch {
      setErreur("Cette image n'a pas pu être lue.");
    } finally {
      setOccupe(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="photo-choix">
      <button
        type="button"
        className="photo-apercu"
        onClick={() => input.current?.click()}
        disabled={disabled || occupe}
        aria-label={photo ? `Changer la photo de ${nom}` : `Ajouter une photo de ${nom}`}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" />
        ) : (
          <span className="vide" aria-hidden>
            +
          </span>
        )}
      </button>
      <div className="photo-actions">
        <button
          type="button"
          className="verre"
          onClick={() => input.current?.click()}
          disabled={disabled || occupe}
        >
          {occupe ? "…" : photo ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {photo && (
          <button
            type="button"
            className="verre"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Retirer
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void choisir(e.target.files?.[0])}
      />
      {erreur && (
        <p className="text-[15px]" style={{ color: "var(--bad)" }}>
          {erreur}
        </p>
      )}
    </div>
  );
}
