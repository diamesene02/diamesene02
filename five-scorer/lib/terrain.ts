import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";

// La caisse du terrain d'une soirée : son prix, et qui a payé sa part.
//
// Deux appelants : la route que l'app appelle, et les actions serveur du site
// (`setFieldCost` et `setRsvpPaid`, app/actions/payments.ts). Les gardes
// diffèrent — `requireClub` d'un côté, `getClubApiContext` de l'autre —, pas
// les règles : un prix borné différemment selon l'appareil, c'est une caisse
// qui ne tombe pas juste. `marquerPaye` corrige deux défauts de l'ancienne
// version du site, dits au-dessus d'elle.
//
// Le droit d'écrire (`canManage`, « Réservé aux admins. ») se vérifie AVANT,
// chez l'appelant.

/// Plafond : 100 000 € en centimes — personne ne loue un terrain plus cher.
export const PRIX_TERRAIN_MAX_CENTS = 100000_00;

export type ResultatCaisse = { ok: true } | { ok: false; status: number; error: string };

/// Le prix du terrain de la soirée, en centimes. `null` = pas de suivi.
export async function ecrirePrixTerrain(
  clubId: string,
  matchDayId: string,
  prixCents: number | null,
): Promise<ResultatCaisse> {
  if (!idsValides(matchDayId)) {
    return { ok: false, status: 400, error: "Identifiant invalide." };
  }

  let valeur: number | null = null;
  if (prixCents !== null) {
    if (typeof prixCents !== "number" || !Number.isFinite(prixCents)) {
      return { ok: false, status: 400, error: "Montant invalide." };
    }
    valeur = Math.min(Math.max(Math.round(prixCents), 0), PRIX_TERRAIN_MAX_CENTS);
  }

  const ecrit = await prisma.matchDay
    .update({
      where: { id: matchDayId, clubId },
      data: { fieldCostCents: valeur },
    })
    .catch(() => null);
  if (!ecrit) return { ok: false, status: 404, error: "Soirée introuvable." };
  return { ok: true };
}

/// Coche ou décoche « a payé sa part » sur la réponse d'un joueur.
///
/// La case vit sur la réponse du joueur à la soirée (`Rsvp.hasPaid`). Deux
/// écarts avec le simple `updateMany` qu'on écrit d'instinct, tous deux
/// voulus :
///
/// - **Un abonné qui n'a rien répondu peut payer.** Il est compté présent
///   d'office (lib/presences.ts), donc il figure parmi ceux qui paient — mais
///   il n'a pas de ligne de réponse, et le site répondait « Pas de réponse
///   de ce joueur. » : la caisse d'un club d'habitués ne se cochait presque
///   jamais. On lui écrit sa présence, datée de la création de la soirée —
///   l'instant où un abonné s'engage —, ce qui ne change rien à son rang.
/// - **Cocher ne fait pas reculer dans la file.** `respondedAt` est un
///   `@updatedAt` : toute écriture sur la ligne le repousse à maintenant, et
///   c'est lui qui départage les présents quand la soirée est pleine. Payer
///   sa part ne doit pas envoyer un titulaire sur la liste d'attente ; on
///   réécrit donc la date telle qu'elle était.
///
/// Un joueur qui n'est ni répondant ni abonné est un refus dit (409), jamais
/// un « c'est fait » sur une ligne qui n'existe pas.
export async function marquerPaye(
  clubId: string,
  matchDayId: string,
  playerId: string,
  paye: boolean,
): Promise<ResultatCaisse> {
  if (!idsValides(matchDayId, playerId)) {
    return { ok: false, status: 400, error: "Identifiant invalide." };
  }
  if (typeof paye !== "boolean") {
    return { ok: false, status: 400, error: "« paye » doit être vrai ou faux." };
  }

  const [soiree, reponse] = await Promise.all([
    prisma.matchDay.findFirst({
      where: { id: matchDayId, clubId },
      select: { id: true, createdAt: true },
    }),
    prisma.rsvp.findUnique({
      where: { matchDayId_playerId: { matchDayId, playerId } },
      select: { id: true, respondedAt: true },
    }),
  ]);
  if (!soiree) return { ok: false, status: 404, error: "Soirée introuvable." };

  if (reponse) {
    await prisma.rsvp.update({
      where: { id: reponse.id },
      data: { hasPaid: paye, respondedAt: reponse.respondedAt },
    });
    return { ok: true };
  }

  const joueur = await prisma.player.findFirst({
    where: { id: playerId, clubId, isArchived: false },
    select: { abonne: true },
  });
  if (!joueur?.abonne) {
    return { ok: false, status: 409, error: "Pas de réponse de ce joueur." };
  }
  // Décocher un abonné qui n'a jamais payé : c'est déjà l'état demandé.
  if (!paye) return { ok: true };

  await prisma.rsvp.upsert({
    where: { matchDayId_playerId: { matchDayId, playerId } },
    create: {
      matchDayId,
      playerId,
      status: "IN",
      hasPaid: true,
      respondedAt: soiree.createdAt,
    },
    update: { hasPaid: true },
  });
  return { ok: true };
}
