import { NextResponse } from "next/server";
import { getClubApiContext } from "@/lib/guard";
import { idsValides } from "@/lib/ids";
import { lierJoueurAuCompte } from "@/lib/roster-serveur";

export const dynamic = "force-dynamic";

/// « C'est moi ».
///
/// Le geste qui manque le plus à un nouveau membre : il rejoint le club par un
/// lien, et son historique de joueur est déjà là — quinze matchs sous son
/// prénom, créés par le capitaine avant qu'il n'ait un compte. Sans ce bouton,
/// il repart de zéro à côté de sa propre fiche.
///
/// SOI-MÊME, et personne d'autre.
///
/// La route acceptait un `utilisateurId` dans le corps, pour couvrir « l'admin
/// lie pour un habitué ». Mauvais calcul : `lierJoueurAuCompte` ne refuse un
/// profil déjà pris qu'à qui ne gère PAS le club — sur le site, c'est
/// l'affichage qui masque le bouton, pas la règle. Un capitaine visant mal
/// aurait donc pris le profil d'un coéquipier, et la transaction aurait délié
/// le sien au passage. Deux personnes dépossédées, aucun dialogue.
///
/// Ce cas-là reste sur le site, où il se fait à froid. Ici, on ne revendique
/// que sa propre fiche.
///
/// Les règles — un invité ne se revendique pas, un compte n'a qu'un seul
/// profil par club, la course entre deux revendications simultanées — vivent
/// dans `lib/roster-serveur.ts`, avec celles du site.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  const { clubId, playerId } = await params;
  if (!idsValides(playerId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const res = await lierJoueurAuCompte({
    clubId,
    playerId,
    userId: ctx.user.id,
    moi: ctx.user.id,
    // `false` même pour un admin : le passe-droit ne sert qu'à écraser le
    // profil d'un autre, et ce n'est pas ce qu'on fait depuis un téléphone.
    peutGerer: false,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
