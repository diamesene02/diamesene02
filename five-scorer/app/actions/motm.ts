"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";
import { requireClub } from "@/lib/guard";

/// Vote MVP d'un membre. Le mvpId du match est recalculé à chaque vote
/// (pluralité ; égalité départagée par ordre alphabétique) — pas d'étape de
/// clôture, le résultat est vivant.
export async function voteMotm(
  slug: string,
  matchId: string,
  playerId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId, playerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (ctx.club.motmMode !== "VOTE") {
    return { ok: false, error: "Le vote MVP n'est pas activé." };
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId: ctx.club.id },
    select: { id: true, status: true },
  });
  if (!match) return { ok: false, error: "Match introuvable." };
  if (match.status !== "FINISHED") {
    return { ok: false, error: "Le vote ouvre à la fin du match." };
  }

  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_playerId: { matchId, playerId } },
  });
  if (!participant) {
    return { ok: false, error: "Ce joueur n'a pas joué ce match." };
  }

  await prisma.motmVote.upsert({
    where: { matchId_voterId: { matchId, voterId: ctx.user.id } },
    create: { matchId, voterId: ctx.user.id, playerId },
    update: { playerId },
  });

  // Recompte → mvpId.
  const votes = await prisma.motmVote.groupBy({
    by: ["playerId"],
    where: { matchId },
    _count: { _all: true },
  });
  if (votes.length > 0) {
    const players = await prisma.player.findMany({
      where: { id: { in: votes.map((v) => v.playerId) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(players.map((p) => [p.id, p.name]));
    const top = [...votes].sort(
      (a, b) =>
        b._count._all - a._count._all ||
        (nameOf.get(a.playerId) ?? "").localeCompare(
          nameOf.get(b.playerId) ?? "",
        ),
    )[0];
    await prisma.match.update({
      where: { id: matchId },
      data: { mvpId: top.playerId },
    });
  }

  revalidatePath(`/c/${slug}/matches/${matchId}`);
  return { ok: true };
}
