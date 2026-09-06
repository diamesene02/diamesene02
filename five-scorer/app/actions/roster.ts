"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";

export type PlayerInput = {
  name?: string;
  nickname?: string | null;
  skill?: number;
  isGk?: boolean;
  isGuest?: boolean;
};

function sanitize(input: PlayerInput) {
  const name = input.name?.trim().slice(0, 60);
  return {
    ...(name ? { name } : {}),
    ...(input.nickname !== undefined
      ? { nickname: input.nickname?.trim().slice(0, 40) || null }
      : {}),
    ...(input.skill !== undefined
      ? { skill: Math.min(5, Math.max(1, Math.round(input.skill))) }
      : {}),
    ...(input.isGk !== undefined ? { isGk: input.isGk } : {}),
    ...(input.isGuest !== undefined ? { isGuest: input.isGuest } : {}),
  };
}

export async function addPlayer(
  slug: string,
  input: PlayerInput
): Promise<{ ok: boolean; error?: string; playerId?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const data = sanitize(input);
  if (!data.name) return { ok: false, error: "Nom requis." };
  const player = await prisma.player.create({
    data: { clubId: ctx.club.id, ...data, name: data.name },
  });
  revalidatePath(`/c/${slug}/players`);
  return { ok: true, playerId: player.id };
}

export async function updatePlayer(
  slug: string,
  playerId: string,
  input: PlayerInput
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const found = await prisma.player.findFirst({
    where: { id: playerId, clubId: ctx.club.id },
  });
  if (!found) return { ok: false, error: "Joueur introuvable." };
  await prisma.player.update({
    where: { id: playerId },
    data: sanitize(input),
  });
  revalidatePath(`/c/${slug}/players`);
  return { ok: true };
}

export async function setPlayerArchived(
  slug: string,
  playerId: string,
  archived: boolean
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const res = await prisma.player.updateMany({
    where: { id: playerId, clubId: ctx.club.id },
    data: { isArchived: archived },
  });
  if (res.count === 0) return { ok: false, error: "Joueur introuvable." };
  revalidatePath(`/c/${slug}/players`);
  return { ok: true };
}

/// Un membre revendique un profil joueur existant (ou l'admin lie pour lui).
export async function linkPlayerToUser(
  slug: string,
  playerId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  const isSelf = userId === ctx.user.id;
  if (!isSelf && !ctx.canManage) {
    return { ok: false, error: "Réservé aux admins." };
  }
  const isMember = await prisma.member.findFirst({
    where: { organizationId: ctx.club.id, userId },
  });
  if (!isMember) return { ok: false, error: "Pas membre du club." };

  await prisma.$transaction(async (tx) => {
    // Un compte = un seul profil joueur par club.
    await tx.player.updateMany({
      where: { clubId: ctx.club.id, userId },
      data: { userId: null },
    });
    await tx.player.update({
      where: { id: playerId },
      data: { userId, isGuest: false },
    });
  });
  revalidatePath(`/c/${slug}/players`);
  return { ok: true };
}
