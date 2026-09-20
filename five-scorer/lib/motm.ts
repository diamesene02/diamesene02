import { prisma } from "./prisma";
import { idsValides } from "./ids";

// spec 0001, Q6 : `updateMatchDetails` écrit `mvpId` sans jamais regarder si
// le club est en mode vote, et `voteMotm` recomptait à chaque voix en
// écrasant silencieusement ce choix — un admin qui désignait l'homme du
// match à la main le voyait disparaître au premier vote suivant. Match
// gagne donc `motmLocked` (posé par `updateMatchDetails` dès qu'une
// désignation manuelle non nulle est écrite) ; ce prédicat porte la
// vérification côté vote, pour qu'elle vive à un seul endroit.
export function verifierMotmDeverouille(
  motmLocked: boolean,
): { ok: true } | { ok: false; error: string } {
  if (motmLocked) {
    return {
      ok: false,
      error:
        "L'homme du match a été désigné par le capitaine ; le vote est fermé.",
    };
  }
  return { ok: true };
}

export type ResultatVote =
  | { ok: true; mvpId: string }
  | { ok: false; status: number; error: string };

/// Le vote d'un membre pour l'homme du match, et le recompte qui le suit.
///
/// Deux portes y mènent : l'action serveur du site (`voteMotm`, garde
/// `requireClub`) et la route que l'app appelle (garde `getClubApiContext`).
/// Les gardes diffèrent, pas la règle : si chacune recomptait à sa façon, un
/// même lundi aurait deux hommes du match selon l'appareil qui a voté en
/// dernier.
///
/// La règle : pluralité, égalité départagée par ordre alphabétique, pas
/// d'étape de clôture — le résultat est vivant. L'ordre des refus est celui
/// que le site a toujours eu : mode du club, match, verrou du capitaine, fin
/// du match, feuille.
///
/// Les codes suivent ceux de `lib/matchEvents.ts` : l'app en a besoin pour
/// distinguer « réessaie » de « ce n'est pas possible ».
export async function voterHommeDuMatch(entree: {
  clubId: string;
  motmMode: string;
  votantId: string;
  matchId: string;
  playerId: string;
}): Promise<ResultatVote> {
  const { clubId, motmMode, votantId, matchId, playerId } = entree;
  if (!idsValides(matchId, playerId)) {
    return { ok: false, status: 400, error: "Identifiant invalide." };
  }
  if (motmMode !== "VOTE") {
    return { ok: false, status: 409, error: "Le vote MVP n'est pas activé." };
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { id: true, status: true, motmLocked: true },
  });
  if (!match) return { ok: false, status: 404, error: "Match introuvable." };
  const verrou = verifierMotmDeverouille(match.motmLocked);
  if (!verrou.ok) return { ok: false, status: 409, error: verrou.error };
  if (match.status !== "FINISHED") {
    return { ok: false, status: 409, error: "Le vote ouvre à la fin du match." };
  }

  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_playerId: { matchId, playerId } },
  });
  if (!participant) {
    return { ok: false, status: 400, error: "Ce joueur n'a pas joué ce match." };
  }

  await prisma.motmVote.upsert({
    where: { matchId_voterId: { matchId, voterId: votantId } },
    create: { matchId, voterId: votantId, playerId },
    update: { playerId },
  });

  // Recompte → mvpId. Il y a au moins la voix qu'on vient de poser.
  const votes = await prisma.motmVote.groupBy({
    by: ["playerId"],
    where: { matchId },
    _count: { _all: true },
  });
  const joueurs = await prisma.player.findMany({
    where: { id: { in: votes.map((v) => v.playerId) } },
    select: { id: true, name: true },
  });
  const nomDe = new Map(joueurs.map((p) => [p.id, p.name]));
  const premier = [...votes].sort(
    (a, b) =>
      b._count._all - a._count._all ||
      (nomDe.get(a.playerId) ?? "").localeCompare(nomDe.get(b.playerId) ?? ""),
  )[0];
  await prisma.match.update({
    where: { id: matchId },
    data: { mvpId: premier.playerId },
  });

  return { ok: true, mvpId: premier.playerId };
}
