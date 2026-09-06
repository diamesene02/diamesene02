"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";
import { requireClub } from "@/lib/guard";
import type { RsvpStatus } from "@prisma/client";

/// Créer une session (soirée five) — ouvert à qui peut scorer : dans un
/// groupe pickup, n'importe quel membre organise.
export async function createMatchDay(
  slug: string,
  input: { date: string; title?: string; location?: string },
): Promise<{ ok: boolean; error?: string; matchDayId?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Non autorisé." };
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Date invalide." };
  }
  const season = await prisma.season.findFirst({
    where: { clubId: ctx.club.id, isActive: true },
    orderBy: { startsAt: "desc" },
  });
  const md = await prisma.matchDay.create({
    data: {
      clubId: ctx.club.id,
      seasonId: season?.id ?? null,
      date,
      title: input.title?.trim().slice(0, 80) || null,
      location: input.location?.trim().slice(0, 120) || null,
    },
  });
  revalidatePath(`/c/${slug}`);
  return { ok: true, matchDayId: md.id };
}

export async function deleteMatchDay(
  slug: string,
  matchDayId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchDayId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  await prisma.matchDay
    .delete({ where: { id: matchDayId, clubId: ctx.club.id } })
    .catch(() => null);
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

const RSVP_STATUSES: RsvpStatus[] = ["IN", "OUT", "MAYBE"];

/// RSVP : un membre répond pour son propre profil joueur ; un admin peut
/// répondre pour n'importe qui (gérer les habitués sans compte).
export async function setRsvp(
  slug: string,
  matchDayId: string,
  playerId: string,
  status: RsvpStatus,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchDayId, playerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!RSVP_STATUSES.includes(status)) {
    return { ok: false, error: "Statut invalide." };
  }
  const [md, player] = await Promise.all([
    prisma.matchDay.findFirst({
      where: { id: matchDayId, clubId: ctx.club.id },
      select: { id: true },
    }),
    prisma.player.findFirst({
      where: { id: playerId, clubId: ctx.club.id },
      select: { id: true, userId: true },
    }),
  ]);
  if (!md || !player) return { ok: false, error: "Introuvable." };
  const isSelf = player.userId === ctx.user.id;
  if (!isSelf && !ctx.canManage) {
    return { ok: false, error: "Tu ne peux répondre que pour toi." };
  }
  await prisma.rsvp.upsert({
    where: { matchDayId_playerId: { matchDayId, playerId } },
    create: { matchDayId, playerId, status },
    update: { status },
  });
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}
