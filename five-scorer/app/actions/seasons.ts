"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";
import { requireClub } from "@/lib/guard";

export async function createSeason(
  slug: string,
  name: string,
): Promise<{ ok: boolean; error?: string; seasonId?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const trimmed = name.trim().slice(0, 60);
  if (trimmed.length < 2) return { ok: false, error: "Nom trop court." };

  const season = await prisma.$transaction(async (tx) => {
    // Une seule saison active à la fois : la nouvelle prend le relais.
    await tx.season.updateMany({
      where: { clubId: ctx.club.id, isActive: true },
      data: { isActive: false, endsAt: new Date() },
    });
    return tx.season.create({
      data: { clubId: ctx.club.id, name: trimmed },
    });
  });
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true, seasonId: season.id };
}

export async function closeSeason(
  slug: string,
  seasonId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(seasonId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const res = await prisma.season.updateMany({
    where: { id: seasonId, clubId: ctx.club.id },
    data: { isActive: false, endsAt: new Date() },
  });
  if (res.count === 0) return { ok: false, error: "Saison introuvable." };
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}

export async function reopenSeason(
  slug: string,
  seasonId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(seasonId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  await prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      where: { clubId: ctx.club.id, isActive: true },
      data: { isActive: false, endsAt: new Date() },
    });
    await tx.season.updateMany({
      where: { id: seasonId, clubId: ctx.club.id },
      data: { isActive: true, endsAt: null },
    });
  });
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}
