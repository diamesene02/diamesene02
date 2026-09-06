"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";

/// Plafond : 100 000 € en centimes — personne ne loue un terrain plus cher.
const MAX_COST_CENTS = 100000_00;

/// Prix du terrain de la soirée (en centimes). null = pas de suivi.
export async function setFieldCost(
  slug: string,
  matchDayId: string,
  costCents: number | null
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  let value: number | null = null;
  if (costCents !== null) {
    if (!Number.isFinite(costCents)) {
      return { ok: false, error: "Montant invalide." };
    }
    value = Math.min(Math.max(Math.round(costCents), 0), MAX_COST_CENTS);
  }

  const updated = await prisma.matchDay
    .update({
      where: { id: matchDayId, clubId: ctx.club.id },
      data: { fieldCostCents: value },
    })
    .catch(() => null);
  if (!updated) return { ok: false, error: "Session introuvable." };

  revalidatePath(`/c/${slug}/sessions/${matchDayId}`);
  return { ok: true };
}

/// Coche/décoche "a payé sa part" sur le RSVP d'un joueur de la soirée.
export async function setRsvpPaid(
  slug: string,
  matchDayId: string,
  playerId: string,
  paid: boolean
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const md = await prisma.matchDay.findFirst({
    where: { id: matchDayId, clubId: ctx.club.id },
    select: { id: true },
  });
  if (!md) return { ok: false, error: "Session introuvable." };

  const res = await prisma.rsvp.updateMany({
    where: { matchDayId, playerId },
    data: { hasPaid: paid },
  });
  if (res.count === 0) {
    return { ok: false, error: "Pas de réponse de ce joueur." };
  }

  revalidatePath(`/c/${slug}/sessions/${matchDayId}`);
  return { ok: true };
}
