"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";
import { requireClub } from "@/lib/guard";

export async function deleteMatch(
  slug: string,
  matchId: string,
): Promise<{ ok: false; error: string } | never> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  await prisma.match
    .delete({ where: { id: matchId, clubId: ctx.club.id } })
    .catch(() => null);
  revalidatePath(`/c/${slug}`);
  redirect(`/c/${slug}/matches`);
}

export type EditMatchInput = {
  teamAName?: string;
  teamBName?: string;
  playedAt?: string;
  mvpId?: string | null;
  notes?: string | null;
  seasonId?: string | null;
};

export async function updateMatchDetails(
  slug: string,
  matchId: string,
  input: EditMatchInput,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId: ctx.club.id },
  });
  if (!match) return { ok: false, error: "Match introuvable." };

  if (input.mvpId) {
    const ok = await prisma.player.count({
      where: { id: input.mvpId, clubId: ctx.club.id },
    });
    if (!ok) return { ok: false, error: "MVP hors du club." };
  }
  if (input.seasonId) {
    const ok = await prisma.season.count({
      where: { id: input.seasonId, clubId: ctx.club.id },
    });
    if (!ok) return { ok: false, error: "Saison inconnue." };
  }
  const playedAt = input.playedAt ? new Date(input.playedAt) : undefined;
  if (playedAt && Number.isNaN(playedAt.getTime())) {
    return { ok: false, error: "Date invalide." };
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(input.teamAName?.trim() ? { teamAName: input.teamAName.trim() } : {}),
      ...(input.teamBName?.trim() ? { teamBName: input.teamBName.trim() } : {}),
      ...(playedAt ? { playedAt } : {}),
      ...(input.mvpId !== undefined ? { mvpId: input.mvpId } : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.seasonId !== undefined ? { seasonId: input.seasonId } : {}),
    },
  });
  revalidatePath(`/c/${slug}/matches/${matchId}`);
  return { ok: true };
}
