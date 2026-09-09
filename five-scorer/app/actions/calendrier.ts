"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { idsValides } from "@/lib/ids";
import {
  poserCalendrier,
  type EntreeCalendrier,
  type ResultatCalendrier,
} from "@/lib/calendrier-serveur";

// Le calendrier d'une saison, créé d'un bloc.
//
// Un club qui joue tous les lundis de septembre à juillet devait créer ses
// quarante-quatre soirées une par une, date tapée au clavier. Personne ne le
// fait — d'où la feuille de match absente au coup d'envoi, faite debout au bord
// du terrain pendant que dix personnes attendent.

export type { ResultatCalendrier } from "@/lib/calendrier-serveur";

/// Crée (ou complète) une saison et ses soirées.
///
/// Le corps vit dans `lib/calendrier-serveur.ts` : la route mobile
/// `POST /api/clubs/[clubId]/saison/calendrier` en a besoin aussi, et deux
/// copies de cette transaction auraient divergé au premier correctif.
export async function creerCalendrier(
  slug: string,
  input: EntreeCalendrier,
): Promise<ResultatCalendrier> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const res = await poserCalendrier(ctx.club.id, input);
  if (res.ok) revalidatePath(`/c/${slug}`, "layout");
  return res;
}

/// Annule une soirée sans la supprimer.
///
/// Le calendrier étant généré pour toute la saison, une suppression pure serait
/// rejouée à la prochaine génération. L'annulation, elle, tient.
export async function annulerSoiree(
  slug: string,
  matchDayId: string,
  raison?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!idsValides(matchDayId)) return { ok: false, error: "Identifiant invalide." };
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const maj = await prisma.matchDay.updateMany({
    where: { id: matchDayId, clubId: ctx.club.id },
    data: {
      canceledAt: new Date(),
      cancelReason: raison?.trim()?.slice(0, 120) || null,
    },
  });
  if (maj.count === 0) return { ok: false, error: "Soirée introuvable." };
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}

export async function retablirSoiree(
  slug: string,
  matchDayId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!idsValides(matchDayId)) return { ok: false, error: "Identifiant invalide." };
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const maj = await prisma.matchDay.updateMany({
    where: { id: matchDayId, clubId: ctx.club.id },
    data: { canceledAt: null, cancelReason: null },
  });
  if (maj.count === 0) return { ok: false, error: "Soirée introuvable." };
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}
