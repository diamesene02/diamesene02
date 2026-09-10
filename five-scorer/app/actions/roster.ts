"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { idsValides } from "@/lib/ids";
import {
  lierJoueurAuCompte,
  sanitize,
  type PlayerInput,
} from "@/lib/roster-serveur";

export type { PlayerInput } from "@/lib/roster-serveur";

/// S'abonner aux lundis, ou s'en désabonner.
///
/// Séparé de `updatePlayer`, qui est réservé aux admins : c'est une décision
/// PERSONNELLE. Chacun doit pouvoir dire « je viens tous les lundis » pour
/// lui-même sans passer par le capitaine — sinon on retombe sur une seule
/// personne qui gère les quinze, ce que ce réglage sert justement à éviter.
export async function setAbonnement(
  slug: string,
  playerId: string,
  abonne: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!idsValides(playerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  const ctx = await requireClub(slug);
  const joueur = await prisma.player.findFirst({
    where: { id: playerId, clubId: ctx.club.id },
    select: { id: true, userId: true },
  });
  if (!joueur) return { ok: false, error: "Joueur introuvable." };
  if (joueur.userId !== ctx.user.id && !ctx.canManage) {
    return { ok: false, error: "Tu ne peux régler que ton propre abonnement." };
  }
  await prisma.player.update({ where: { id: playerId }, data: { abonne } });
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/players/${playerId}`);
  return { ok: true };
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
  const res = await lierJoueurAuCompte({
    clubId: ctx.club.id,
    playerId,
    userId,
    moi: ctx.user.id,
    peutGerer: ctx.canManage,
  });
  if (!res.ok) return res;

  revalidatePath(`/c/${slug}/players`);
  return { ok: true };
}
