"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idsValides, estIdOuVide } from "@/lib/ids";
import { requireClub } from "@/lib/guard";
import {
  annulerOuSupprimerMatch,
  joueurSurLaFeuille,
  type ResultatRetrait,
} from "@/lib/matches";

/// « Supprimer » — le mot reste, le geste réel dépend de ce qu'il y a à
/// perdre (spec 0006). Un match sans participant, sans événement, sans
/// réponse à une convocation s'efface pour de vrai. Dès qu'il y a quelque
/// chose, il s'annule à la place : reste visible, sort du classement.
///
/// Ne redirige plus systématiquement : une annulation garde le match sur sa
/// propre page (il existe toujours), seule une vraie suppression envoie vers
/// la liste. C'est à l'appelant de le faire — cette fonction dit ce qui
/// s'est passé, elle ne décide plus où atterrir.
export async function retirerMatch(
  slug: string,
  matchId: string,
  raison?: string,
): Promise<ResultatRetrait> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const res = await annulerOuSupprimerMatch(ctx.club.id, matchId, raison);
  if (res.ok) {
    revalidatePath(`/c/${slug}`);
    revalidatePath(`/c/${slug}/matches`);
    revalidatePath(`/c/${slug}/matches/${matchId}`);
  }
  return res;
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
  // mvpId et seasonId partent eux aussi dans un `where` Prisma plus bas :
  // sans ce contrôle, un objet passé à leur place (`{ in: [...] }`) filtrerait
  // toutes les fiches libres du club d'un coup (cf. lib/ids.ts, TRANS-22).
  if (!estIdOuVide(input.mvpId) || !estIdOuVide(input.seasonId)) {
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
    // Un homme du match est toujours l'un de nos joueurs, désigné après
    // coup : pas seulement du club, mais bien sur LA FEUILLE de CE match
    // précis (spec 0001, Q6) — aucune exception EXTERNAL ici, contrairement
    // au but/passe (lib/matches.ts, joueursValidesPourEvenement).
    if (!(await joueurSurLaFeuille(matchId, input.mvpId))) {
      return { ok: false, error: "MVP hors de la feuille de ce match." };
    }
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
