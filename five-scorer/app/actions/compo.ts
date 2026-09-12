"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { ecrireCompo, type JoueurCompo } from "@/lib/compo";
import { idsValides } from "@/lib/ids";

// Réexporté : les composants du site l'importaient déjà d'ici.
export type { JoueurCompo };

// La composition préparée d'une soirée.
//
// Le club connaît ses équipes trois à quatre jours avant de jouer. Jusqu'ici
// elles n'avaient nulle part où être écrites : il fallait attendre le coup
// d'envoi et composer au bord du terrain. Elles vivent sur la SOIRÉE, pas sur
// un match — une soirée enchaîne quatre à huit matchs avec les deux mêmes
// équipes, et chacun en hérite.

export async function enregistrerCompo(
  slug: string,
  matchDayId: string,
  input: {
    joueurs: JoueurCompo[];
    teamAName?: string;
    teamBName?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Droits insuffisants." };

  // Les RÈGLES vivent dans lib/compo.ts, partagées avec la route que l'app
  // appelle. Ici il ne reste que la garde du site et la revalidation.
  const r = await ecrireCompo(ctx.club.id, matchDayId, input);
  if (!r.ok) return r;

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
