import { NextResponse } from "next/server";
import { getClubApiContext } from "@/lib/guard";
import { rattacherJoueur, STATUT_RATTACHEMENT } from "@/lib/rattachement";

export const dynamic = "force-dynamic";

/// « Ce joueur, c'est moi. »
///
/// Le jumeau HTTP de `linkPlayerToUser`. Sans lui, un membre qui ouvre
/// l'effectif depuis son téléphone voit son propre nom dans la liste sans
/// pouvoir le revendiquer — donc sans pouvoir répondre présent, ni se voir
/// proposer sa propre fiche. Il fallait ressortir le site sur un ordinateur
/// pour un geste qu'on fait une fois, le premier soir.
///
/// Un endpoint à part, et non un champ du PATCH de la fiche : ce PATCH est
/// réservé aux gérants, alors que revendiquer son profil est une décision
/// personnelle — la même séparation que pour l'abonnement, et pour la même
/// raison. Les mélanger obligerait à être admin pour dire qui on est.
///
/// **On ne revendique que POUR SOI.** Le site laisse un admin rattacher un
/// compte tiers à une fiche, et `rattacherJoueur` porte cette règle ; cette
/// route ne l'expose pas. L'écran n'offre qu'un bouton, « c'est moi », et il
/// n'envoie jamais d'identifiant de compte — accepter un `userId` dans le
/// corps ouvrirait, à qui gère, la prise du profil d'un coéquipier : la
/// transaction délie d'abord la fiche du demandeur, puis pose son compte sur
/// celle qu'il désigne. Le coéquipier perdrait la sienne sans un mot.
///
/// `canManage: false` est passé exprès. Avec un `userId` qui vaut toujours le
/// compte connecté, il ne retire aucun droit légitime : il n'autorise que la
/// revendication d'une fiche libre ou déjà sienne, et c'est tout ce que le
/// bouton promet.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  const { clubId, playerId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const res = await rattacherJoueur({
    clubId,
    playerId,
    userId: ctx.user.id,
    acteurId: ctx.user.id,
    canManage: false,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, motif: res.motif },
      { status: STATUT_RATTACHEMENT[res.motif] },
    );
  }

  return NextResponse.json({ ok: true, joueurId: playerId });
}
