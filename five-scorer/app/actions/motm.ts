"use server";

import { revalidatePath } from "next/cache";
import { idsValides } from "@/lib/ids";
import { requireClub } from "@/lib/guard";
import { voterHommeDuMatch } from "@/lib/motm";

/// Vote d'homme du match d'un membre. Le mvpId du match est recalculé à
/// chaque vote (pluralité ; égalité départagée par ordre alphabétique) — pas
/// d'étape de clôture, le résultat est vivant.
///
/// La règle vit dans `lib/motm.ts`, partagée avec la route que l'app appelle
/// (`app/api/clubs/[clubId]/matchs/[matchId]/vote`). Ici il ne reste que la
/// garde du site et la revalidation.
export async function voteMotm(
  slug: string,
  matchId: string,
  playerId: string,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId, playerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  const r = await voterHommeDuMatch({
    clubId: ctx.club.id,
    motmMode: ctx.club.motmMode,
    votantId: ctx.user.id,
    matchId,
    playerId,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/c/${slug}/matches/${matchId}`);
  return { ok: true };
}
