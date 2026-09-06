"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { idsValides } from "@/lib/ids";

// Le calendrier d'une saison, créé d'un bloc.
//
// Un club qui joue tous les lundis de septembre à juillet devait créer ses
// quarante-quatre soirées une par une, date tapée au clavier. Personne ne le
// fait — d'où la feuille de match absente au coup d'envoi, faite debout au bord
// du terrain pendant que dix personnes attendent.

const MAX_SOIREES = 120; // une saison hebdomadaire en compte ~44

export type ResultatCalendrier = {
  ok: boolean;
  error?: string;
  crees?: number;
  ignores?: number;
  seasonId?: string;
};

/// Crée (ou complète) une saison et ses soirées.
///
/// Idempotent par date : une soirée existant déjà au même jour est laissée
/// telle quelle. Relancer le calendrier après avoir ajouté quelques semaines
/// ne duplique donc rien, et ne touche pas aux compos déjà préparées.
export async function creerCalendrier(
  slug: string,
  input: {
    nomSaison: string;
    /// Dates ISO, calculées côté client dans le fuseau de la personne.
    dates: string[];
    titre?: string;
    lieu?: string;
    /// Rattacher à une saison existante plutôt que d'en créer une.
    seasonId?: string | null;
  },
): Promise<ResultatCalendrier> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const nom = input.nomSaison?.trim();
  if (!nom || nom.length < 2) return { ok: false, error: "Nom de saison trop court." };

  if (input.seasonId != null && !idsValides(input.seasonId)) {
    return { ok: false, error: "Saison invalide." };
  }

  const dates = (input.dates ?? [])
    .map((s) => new Date(s))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return { ok: false, error: "Aucune date à créer." };
  if (dates.length > MAX_SOIREES) {
    return { ok: false, error: `Trop de dates (${dates.length}).` };
  }

  const titre = input.titre?.trim() || null;
  const lieu = input.lieu?.trim() || null;

  const { seasonId, crees, ignores } = await prisma.$transaction(async (tx) => {
    let seasonId = input.seasonId ?? null;
    if (seasonId) {
      // Re-vérifiée contre le club : l'identifiant vient du client.
      const s = await tx.season.findFirst({
        where: { id: seasonId, clubId: ctx.club.id },
        select: { id: true },
      });
      if (!s) throw new Error("saison_hors_club");
    } else {
      // Une seule saison active à la fois : les précédentes se referment.
      await tx.season.updateMany({
        where: { clubId: ctx.club.id, isActive: true },
        data: { isActive: false },
      });
      const s = await tx.season.create({
        data: {
          clubId: ctx.club.id,
          name: nom,
          startsAt: dates[0],
          endsAt: dates[dates.length - 1],
          isActive: true,
        },
        select: { id: true },
      });
      seasonId = s.id;
    }

    // Les soirées déjà présentes sur ces journées ne sont pas retouchées : une
    // compo préparée ne doit jamais être écrasée par une régénération.
    const bornes = { gte: dates[0], lte: dates[dates.length - 1] };
    const existantes = await tx.matchDay.findMany({
      where: { clubId: ctx.club.id, date: bornes },
      select: { date: true },
    });
    const prises = new Set(existantes.map((m) => jourCle(m.date)));

    const aCreer = dates.filter((d) => !prises.has(jourCle(d)));
    if (aCreer.length > 0) {
      await tx.matchDay.createMany({
        data: aCreer.map((date) => ({
          clubId: ctx.club.id,
          seasonId,
          date,
          title: titre,
          location: lieu,
        })),
      });
    }
    return {
      seasonId: seasonId!,
      crees: aCreer.length,
      ignores: dates.length - aCreer.length,
    };
  });

  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true, crees, ignores, seasonId };
}

/// Deux soirées le même jour n'ont pas de sens : la clé de comparaison est le
/// jour civil, pas l'horodatage.
function jourCle(d: Date): string {
  return d.toISOString().slice(0, 10);
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
