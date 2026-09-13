import { prisma } from "@/lib/prisma";

export { matchVerrouille } from "./matchStatus";

// Annuler ou effacer, en un seul geste — décidé par ce qu'il y a à perdre,
// pas par le statut du match (spec 0006).
//
// La spec 0001 disait déjà « rien dans l'app ne supprime ». Le site ne
// tenait pas cette promesse : « Supprimer » effaçait tout match terminé ou
// annulé, sans trace, sans corbeille (buts, compo, votes, convocations
// partaient avec).
//
// Le critère : un match sans participant, sans événement et sans réponse à
// une convocation n'a RIEN à perdre — le supprimer est sans effet secondaire,
// exactement l'article I au sens strict (rien n'a été saisi). Dès qu'il y a
// quelque chose, le geste devient une annulation : le match reste visible,
// marqué, et sort de tout calcul qui ne compte que les matchs FINISHED
// (classement, Élo, forme, records — vérifié : ils filtrent déjà
// positivement sur ce statut, aucun d'eux n'a besoin d'être touché).
//
// Appelé par l'action serveur du site ET par la route que l'app utilise :
// même fonction, mêmes deux issues, pour ne pas répéter cette logique deux
// fois et la voir diverger un jour.
export type ResultatRetrait =
  | { ok: true; geste: "supprime" }
  | { ok: true; geste: "annule" }
  | { ok: false; error: string };

export async function annulerOuSupprimerMatch(
  clubId: string,
  matchId: string,
  raison?: string,
): Promise<ResultatRetrait> {
  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: {
      id: true,
      status: true,
      _count: { select: { participants: true, events: true, rsvps: true } },
    },
  });
  if (!match) return { ok: false, error: "Match introuvable." };

  const rien =
    match._count.participants === 0 &&
    match._count.events === 0 &&
    match._count.rsvps === 0;

  if (rien) {
    // Rien à perdre : l'effacement reste ce qu'il est. `.catch` n'avale plus
    // l'échec (APRES-26) — un vrai refus doit se voir, pas une redirection
    // qui ment.
    try {
      await prisma.match.delete({ where: { id: matchId, clubId } });
    } catch {
      return { ok: false, error: "La suppression a échoué. Réessaie." };
    }
    return { ok: true, geste: "supprime" };
  }

  const cancelReason = raison?.trim()?.slice(0, 120) || null;
  try {
    await prisma.match.update({
      where: { id: matchId, clubId },
      data: { status: "CANCELED", canceledAt: new Date(), cancelReason },
    });
  } catch {
    return { ok: false, error: "L'annulation a échoué. Réessaie." };
  }
  return { ok: true, geste: "annule" };
}
