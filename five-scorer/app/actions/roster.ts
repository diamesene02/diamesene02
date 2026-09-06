"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { idsValides } from "@/lib/ids";

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
  input: PlayerInput,
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
  input: PlayerInput,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(playerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

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
  archived: boolean,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(playerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

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
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Les types TypeScript ne survivent pas à la compilation : un appelant peut
  // envoyer un objet là où le code attend une chaîne, et Prisma l'interprète
  // comme un filtre. Sans ce contrôle, `{ in: [...] }` en guise d'identifiant
  // faisait porter l'écriture sur tous les profils libres du club d'un coup.
  if (!idsValides(playerId, userId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  const isSelf = userId === ctx.user.id;
  if (!isSelf && !ctx.canManage) {
    return { ok: false, error: "Réservé aux admins." };
  }
  const isMember = await prisma.member.findFirst({
    where: { organizationId: ctx.club.id, userId },
  });
  if (!isMember) return { ok: false, error: "Pas membre du club." };

  // Le playerId vient du client : il doit être rattaché à CE club, sinon un
  // membre peut délier le profil d'un joueur d'un club dont il n'est même pas
  // membre. Les garde-fous n'existaient que dans l'affichage du trombinoscope,
  // c'est-à-dire nulle part du point de vue du serveur.
  const cible = await prisma.player.findFirst({
    where: { id: playerId, clubId: ctx.club.id },
    select: { id: true, userId: true, isGuest: true, isArchived: true },
  });
  if (!cible) return { ok: false, error: "Joueur introuvable dans ce club." };
  if (cible.isArchived) {
    return { ok: false, error: "Ce joueur est archivé." };
  }
  if (cible.isGuest) {
    return { ok: false, error: "Un invité ne peut pas être revendiqué." };
  }
  // Profil déjà rattaché à quelqu'un d'autre : seul un admin peut trancher.
  if (cible.userId && cible.userId !== userId && !ctx.canManage) {
    return { ok: false, error: "Ce profil est déjà pris par un autre compte." };
  }

  // L'échec doit être une EXCEPTION, pas une valeur de retour : renvoyer un
  // compte laissait la transaction se terminer normalement, donc COMMITTER le
  // déliement qui la précède. Le compte perdait son profil pendant que
  // l'interface annonçait qu'il ne s'était rien passé.
  const conflit = await prisma
    .$transaction(async (tx) => {
      // Un compte = un seul profil joueur par club.
      await tx.player.updateMany({
        where: { clubId: ctx.club.id, userId },
        data: { userId: null },
      });
      // updateMany plutôt qu'update : le filtre clubId reste appliqué au
      // moment de l'écriture, et le compte retourné confirme qu'une ligne —
      // et une seule — a bougé.
      const res = await tx.player.updateMany({
        where: {
          id: playerId,
          clubId: ctx.club.id,
          // Course entre deux revendications simultanées : on n'écrase que si
          // le profil est encore libre, ou déjà celui de ce compte, ou si un
          // admin opère.
          ...(ctx.canManage ? {} : { OR: [{ userId: null }, { userId }] }),
        },
        data: { userId, isGuest: false },
      });
      if (res.count !== 1) throw new Error("link_conflict");
      return null;
    })
    .catch((e: Error) => {
      if (e.message === "link_conflict") return "conflit";
      throw e;
    });
  if (conflit) {
    return {
      ok: false,
      error: "Ce profil vient d'être pris par un autre compte.",
    };
  }

  revalidatePath(`/c/${slug}/players`);
  return { ok: true };
}
