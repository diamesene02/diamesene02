"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";
import { requireClub } from "@/lib/guard";

export async function createOpponent(
  slug: string,
  name: string,
): Promise<{ ok: boolean; error?: string; opponentId?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Non autorisé." };
  const trimmed = name.trim().slice(0, 60);
  if (trimmed.length < 2) return { ok: false, error: "Nom trop court." };
  const opponent = await prisma.opponent.upsert({
    where: { clubId_name: { clubId: ctx.club.id, name: trimmed } },
    create: { clubId: ctx.club.id, name: trimmed },
    update: {},
  });
  revalidatePath(`/c/${slug}`);
  return { ok: true, opponentId: opponent.id };
}

export async function deleteOpponent(
  slug: string,
  opponentId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(opponentId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  await prisma.opponent
    .delete({ where: { id: opponentId, clubId: ctx.club.id } })
    .catch(() => null);
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}
