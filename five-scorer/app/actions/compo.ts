"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { idsValides } from "@/lib/ids";

// La composition préparée d'une soirée.
//
// Le club connaît ses équipes trois à quatre jours avant de jouer. Jusqu'ici
// elles n'avaient nulle part où être écrites : il fallait attendre le coup
// d'envoi et composer au bord du terrain. Elles vivent sur la SOIRÉE, pas sur
// un match — une soirée enchaîne quatre à huit matchs avec les deux mêmes
// équipes, et chacun en hérite.

export type JoueurCompo = { playerId: string; team: "A" | "B"; isGk?: boolean };

export async function enregistrerCompo(
  slug: string,
  matchDayId: string,
  input: {
    joueurs: JoueurCompo[];
    teamAName?: string;
    teamBName?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!idsValides(matchDayId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Droits insuffisants." };

  const joueurs = input.joueurs ?? [];
  if (!idsValides(...joueurs.map((j) => j.playerId))) {
    return { ok: false, error: "Identifiant de joueur invalide." };
  }
  if (joueurs.some((j) => j.team !== "A" && j.team !== "B")) {
    return { ok: false, error: "Équipe invalide." };
  }
  const ids = joueurs.map((j) => j.playerId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Un joueur ne peut pas être dans les deux équipes." };
  }

  const soiree = await prisma.matchDay.findFirst({
    where: { id: matchDayId, clubId: ctx.club.id },
    select: { id: true },
  });
  if (!soiree) return { ok: false, error: "Soirée introuvable." };

  // Tous les joueurs doivent appartenir au club — l'identifiant vient du client.
  if (ids.length > 0) {
    const aNous = await prisma.player.count({
      where: { id: { in: ids }, clubId: ctx.club.id },
    });
    if (aNous !== ids.length) {
      return { ok: false, error: "Joueur hors du club." };
    }
  }

  const nom = (v: string | undefined) => {
    const t = v?.trim();
    return t && t.length > 0 ? t.slice(0, 40) : null;
  };

  await prisma.$transaction([
    prisma.matchDayLineup.deleteMany({ where: { matchDayId } }),
    prisma.matchDayLineup.createMany({
      data: joueurs.map((j) => ({
        matchDayId,
        playerId: j.playerId,
        team: j.team,
        isGk: Boolean(j.isGk),
      })),
    }),
    prisma.matchDay.update({
      where: { id: matchDayId },
      data: {
        teamAName: nom(input.teamAName),
        teamBName: nom(input.teamBName),
      },
    }),
  ]);

  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}

/// Reprend la composition de la dernière soirée déjà préparée, comme point de
/// départ. Les équipes tournent d'une semaine à l'autre, mais on part rarement
/// d'une page blanche — et c'est le geste qui coûtait le plus de temps.
export async function reprendreCompoPrecedente(
  slug: string,
  matchDayId: string,
): Promise<{ ok: boolean; error?: string; reprises?: number }> {
  if (!idsValides(matchDayId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Droits insuffisants." };

  const soiree = await prisma.matchDay.findFirst({
    where: { id: matchDayId, clubId: ctx.club.id },
    select: { id: true, date: true },
  });
  if (!soiree) return { ok: false, error: "Soirée introuvable." };

  const precedente = await prisma.matchDay.findFirst({
    where: {
      clubId: ctx.club.id,
      date: { lt: soiree.date },
      lineup: { some: {} },
    },
    orderBy: { date: "desc" },
    select: {
      teamAName: true,
      teamBName: true,
      lineup: {
        select: { playerId: true, team: true, isGk: true },
        // Les joueurs archivés depuis ne sont pas reconduits.
        where: { player: { isArchived: false } },
      },
    },
  });
  if (!precedente || precedente.lineup.length === 0) {
    return { ok: false, error: "Aucune compo précédente à reprendre." };
  }

  await prisma.$transaction([
    prisma.matchDayLineup.deleteMany({ where: { matchDayId } }),
    prisma.matchDayLineup.createMany({
      data: precedente.lineup.map((l) => ({ matchDayId, ...l })),
    }),
    prisma.matchDay.update({
      where: { id: matchDayId },
      data: {
        teamAName: precedente.teamAName,
        teamBName: precedente.teamBName,
      },
    }),
  ]);

  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true, reprises: precedente.lineup.length };
}
