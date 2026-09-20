"use server";

import { revalidatePath } from "next/cache";
import { requireClub } from "@/lib/guard";
import { ecrirePrixTerrain, marquerPaye } from "@/lib/terrain";

// La caisse de la soirée vue du site.
//
// Les RÈGLES vivent dans lib/terrain.ts, partagées avec les routes que l'app
// appelle. Ici il ne reste que la garde du site (`requireClub` + `canManage`)
// et la revalidation. Tant que les deux moitiés étaient écrites séparément,
// cocher « payé » ne faisait pas la même chose selon l'appareil : le site
// refusait un abonné qui n'avait rien répondu, et repoussait `respondedAt`
// (un `@updatedAt`), ce qui faisait reculer un titulaire dans la file des
// présents. L'app, elle, avait déjà les deux corrections.

/// Prix du terrain de la soirée (en centimes). null = pas de suivi.
export async function setFieldCost(
  slug: string,
  matchDayId: string,
  costCents: number | null,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const r = await ecrirePrixTerrain(ctx.club.id, matchDayId, costCents);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/c/${slug}/sessions/${matchDayId}`);
  return { ok: true };
}

/// Coche/décoche "a payé sa part" sur le RSVP d'un joueur de la soirée.
export async function setRsvpPaid(
  slug: string,
  matchDayId: string,
  playerId: string,
  paid: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const r = await marquerPaye(ctx.club.id, matchDayId, playerId, paid);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/c/${slug}/sessions/${matchDayId}`);
  return { ok: true };
}
