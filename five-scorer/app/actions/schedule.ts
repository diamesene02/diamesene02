"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";
import { requireClub } from "@/lib/guard";
import type { RsvpStatus } from "@prisma/client";

/// Programmer un match à l'avance : le match naît SCHEDULED, les membres
/// répondent à la convocation, et le jour J on compose les équipes avec les
/// présents avant de basculer en LIVE (via lib/localMatch.launchScheduledMatch).
export async function scheduleMatch(
  slug: string,
  input: {
    scheduledAt: string;
    kind: "INTERNAL" | "EXTERNAL";
    opponentId?: string | null;
    venue?: string;
    teamAName?: string;
    teamBName?: string;
    matchDayId?: string | null;
  },
): Promise<{ ok: boolean; error?: string; matchId?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Non autorisé." };

  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: "Date invalide." };
  }

  const external = input.kind === "EXTERNAL";
  let opponentName: string | null = null;
  if (external) {
    if (!input.opponentId) {
      return { ok: false, error: "Choisis l'équipe adverse." };
    }
    const opponent = await prisma.opponent.findFirst({
      where: { id: input.opponentId, clubId: ctx.club.id },
      select: { name: true },
    });
    if (!opponent) return { ok: false, error: "Adversaire introuvable." };
    opponentName = opponent.name;
  }

  // Rattachement optionnel à une session — ignoré si elle n'est pas au club.
  let matchDayId: string | null = null;
  if (input.matchDayId) {
    const md = await prisma.matchDay.findFirst({
      where: { id: input.matchDayId, clubId: ctx.club.id },
      select: { id: true },
    });
    matchDayId = md?.id ?? null;
  }

  const season = await prisma.season.findFirst({
    where: { clubId: ctx.club.id, isActive: true },
    orderBy: { startsAt: "desc" },
    select: { id: true },
  });

  const match = await prisma.match.create({
    data: {
      clubId: ctx.club.id,
      seasonId: season?.id ?? null,
      matchDayId,
      kind: input.kind,
      opponentId: external ? input.opponentId : null,
      status: "SCHEDULED",
      scheduledAt,
      // playedAt = scheduledAt tant que le match n'est pas lancé : les tris
      // par date restent cohérents partout.
      playedAt: scheduledAt,
      venue: input.venue?.trim().slice(0, 120) || null,
      teamAName: external
        ? "Nous"
        : input.teamAName?.trim().slice(0, 40) || "Équipe A",
      teamBName: external
        ? (opponentName as string)
        : input.teamBName?.trim().slice(0, 40) || "Équipe B",
    },
  });

  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/matches`);
  return { ok: true, matchId: match.id };
}

export async function cancelScheduledMatch(
  slug: string,
  matchId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const { count } = await prisma.match.updateMany({
    where: { id: matchId, clubId: ctx.club.id, status: "SCHEDULED" },
    data: { status: "CANCELED" },
  });
  if (count === 0) {
    return { ok: false, error: "Seul un match programmé peut être annulé." };
  }

  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/matches`);
  revalidatePath(`/c/${slug}/matches/${matchId}`);
  return { ok: true };
}

const RSVP_STATUSES: RsvpStatus[] = ["IN", "OUT", "MAYBE"];

/// Convocation d'un match programmé : un membre répond pour son propre profil
/// joueur ; un admin peut répondre pour n'importe qui (mêmes règles que le
/// RSVP de session — voir app/actions/matchday.ts).
export async function setMatchRsvp(
  slug: string,
  matchId: string,
  playerId: string,
  status: RsvpStatus,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId, playerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!RSVP_STATUSES.includes(status)) {
    return { ok: false, error: "Statut invalide." };
  }
  const [match, player] = await Promise.all([
    prisma.match.findFirst({
      where: { id: matchId, clubId: ctx.club.id },
      select: { id: true, status: true },
    }),
    prisma.player.findFirst({
      where: { id: playerId, clubId: ctx.club.id },
      select: { id: true, userId: true },
    }),
  ]);
  if (!match || !player) return { ok: false, error: "Introuvable." };
  if (match.status !== "SCHEDULED") {
    return { ok: false, error: "Les convocations sont closes." };
  }
  const isSelf = player.userId === ctx.user.id;
  if (!isSelf && !ctx.canManage) {
    return { ok: false, error: "Tu ne peux répondre que pour toi." };
  }
  await prisma.rsvp.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId, status },
    update: { status },
  });
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/matches/${matchId}`);
  return { ok: true };
}
