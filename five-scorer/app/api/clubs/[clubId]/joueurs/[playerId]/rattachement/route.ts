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
/// Le corps est facultatif : sans `userId`, c'est le compte connecté qui
/// revendique. Un gérant peut lier quelqu'un d'autre en l'envoyant, comme sur
/// le site.
///
/// **Ce pouvoir du gérant a été retiré une fois, puis rendu.** Retiré parce
/// qu'il permet de poser son compte sur la fiche d'un coéquipier : la
/// transaction délie d'abord la sienne, et l'autre perd la sienne sans un mot.
/// Rendu parce qu'il est le SEUL recours quand quelqu'un s'est trompé de
/// fiche : rien, nulle part, ne délie un profil — les deux seuls `userId:
/// null` du dépôt (`app/actions/club.ts`, `membres/[memberId]`) sont des
/// exclusions du club. Sans l'arbitrage du gérant, une revendication ratée le
/// premier soir ne se répare qu'en expulsant la personne.
///
/// Ce qui manque n'est donc pas une garde de plus, c'est une TRACE : qui a
/// rattaché quoi, et quand. Question ouverte de la spec produit.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  const { clubId, playerId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const corps = (await req.json().catch(() => null)) as { userId?: unknown } | null;
  // Un `userId` d'un autre type que chaîne n'est PAS remplacé en douce par
  // celui du compte connecté : il serait alors possible d'obtenir un
  // rattachement à soi-même en croyant en demander un autre, et le refus est
  // justement ce qui protège `idsValides` en aval.
  if (corps?.userId !== undefined && typeof corps.userId !== "string") {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const userId = corps?.userId ?? ctx.user.id;

  const res = await rattacherJoueur({
    clubId,
    playerId,
    userId,
    acteurId: ctx.user.id,
    canManage: ctx.canManage,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, motif: res.motif },
      { status: STATUT_RATTACHEMENT[res.motif] },
    );
  }

  return NextResponse.json({ ok: true, joueurId: playerId });
}
