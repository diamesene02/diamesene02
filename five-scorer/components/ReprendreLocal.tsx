"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getLiveMatchOfClub } from "@/lib/localMatch";
import Icon from "@/components/Icon";

// L'accueil est une page serveur : il ne connaît que les matchs que le
// serveur a reçus. Un match lancé hors-ligne, ou dont l'onglet a été tué par
// le téléphone, n'y apparaissait nulle part — il était en mémoire, mais
// inaccessible par quelque chemin que ce soit. Ce bloc lit Dexie.
export default function ReprendreLocal({
  slug,
  clubId,
}: {
  slug: string;
  clubId: string;
}) {
  const live = useLiveQuery(() => getLiveMatchOfClub(clubId), [clubId]);
  if (!live) return null;
  return (
    <a href={`/c/${slug}/play?m=${live.id}`} className="rappel">
      <span className="rappel-corps">
        <span className="rappel-titre">
          Match en cours sur ce téléphone — {live.teamAName} {live.scoreA} :{" "}
          {live.scoreB} {live.teamBName}
        </span>
        <span className="rappel-aide">Reprendre là où tu en étais</span>
      </span>
      <Icon name="chevron" size={16} />
    </a>
  );
}
