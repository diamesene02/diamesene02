"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { idsValides } from "@/lib/ids";
import { type EntreeJoueur, nettoyerJoueur } from "@/lib/joueur";
import { rattacherJoueur } from "@/lib/rattachement";

/// Le type et la règle de nettoyage vivent dans `lib/joueur.ts` : les routes
/// d'API du mobile écrivent les mêmes fiches, et un fichier `"use server"` ne
/// s'importe pas depuis une route. `PlayerInput` reste exporté sous son nom —
/// c'est celui qu'utilisent les écrans du site.
export type PlayerInput = EntreeJoueur;

const sanitize = nettoyerJoueur;

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
///
/// La règle elle-même vit dans `lib/rattachement.ts` : l'app mobile la
/// revendique par HTTP, et un fichier `"use server"` ne s'importe pas depuis
/// une route. Ici ne restent que le slug, la garde du site et le cache.
export async function linkPlayerToUser(
  slug: string,
  playerId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  const res = await rattacherJoueur({
    clubId: ctx.club.id,
    playerId,
    userId,
    acteurId: ctx.user.id,
    canManage: ctx.canManage,
  });
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath(`/c/${slug}/players`);
  return { ok: true };
}
