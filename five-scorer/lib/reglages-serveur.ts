import "server-only";

import { prisma } from "@/lib/prisma";
import { isValidHex } from "@/lib/color";
import type { MotmMode, SportFormat } from "@prisma/client";

/// Les réglages du club, écrits en un seul endroit.
///
/// Vit ici et non dans `app/actions/club.ts` parce que DEUX appelants les
/// écrivent : la server action du site et la route `PATCH .../reglages` que
/// l'app mobile appelle. Une seconde copie des bornes aurait divergé — et une
/// borne qui diverge, c'est un club à 40 joueurs par soirée d'un côté et 30 de
/// l'autre, sans que rien ne le dise.
///
/// La garde d'accès est du ressort de l'appelant : cette fonction prend un
/// `clubId` et n'en vérifie pas les droits.

export type ClubSettingsInput = {
  name?: string;
  /// Couleurs des chasubles — l'identité visuelle du club.
  colorA?: string;
  colorB?: string;
  format?: SportFormat;
  matchDurationMin?: number;
  minJoueurs?: number;
  capaciteSoiree?: number;
  pointsWin?: number;
  pointsDraw?: number;
  trackAssists?: boolean;
  trackCards?: boolean;
  motmMode?: MotmMode;
  membersCanScore?: boolean;
  isPublic?: boolean;
};

const FORMATS: SportFormat[] = ["FIVE", "FUTSAL", "SEVEN", "ELEVEN", "OTHER"];
const MOTM_MODES: MotmMode[] = ["VOTE", "ADMIN", "OFF"];

export async function ecrireReglages(
  clubId: string,
  input: ClubSettingsInput,
): Promise<{ ok: boolean; error?: string }> {
  const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(n)));

  const name = input.name?.trim();
  if (name !== undefined && name.length < 2) {
    return { ok: false, error: "Nom trop court." };
  }

  await prisma.$transaction(async (tx) => {
    if (name) {
      await tx.organization.update({
        where: { id: clubId },
        data: { name },
      });
    }
    await tx.club.update({
      where: { id: clubId },
      data: {
        ...(input.format && FORMATS.includes(input.format)
          ? { format: input.format }
          : {}),
        ...(input.minJoueurs !== undefined
          ? { minJoueurs: clamp(input.minJoueurs, 2, 30) }
          : {}),
        // 0 = pas de liste d'attente : un club qui prend tout le monde et
        // s'arrange sur place doit pouvoir le dire.
        ...(input.capaciteSoiree !== undefined
          ? { capaciteSoiree: clamp(input.capaciteSoiree, 0, 40) }
          : {}),
        ...(input.matchDurationMin !== undefined
          ? { matchDurationMin: clamp(input.matchDurationMin, 1, 120) }
          : {}),
        ...(input.pointsWin !== undefined
          ? { pointsWin: clamp(input.pointsWin, 1, 10) }
          : {}),
        ...(input.pointsDraw !== undefined
          ? { pointsDraw: clamp(input.pointsDraw, 0, 5) }
          : {}),
        ...(input.trackAssists !== undefined
          ? { trackAssists: input.trackAssists }
          : {}),
        ...(input.trackCards !== undefined
          ? { trackCards: input.trackCards }
          : {}),
        ...(input.motmMode && MOTM_MODES.includes(input.motmMode)
          ? { motmMode: input.motmMode }
          : {}),
        ...(input.membersCanScore !== undefined
          ? { membersCanScore: input.membersCanScore }
          : {}),
        ...(input.colorA && isValidHex(input.colorA)
          ? { colorA: input.colorA.trim().toUpperCase() }
          : {}),
        ...(input.colorB && isValidHex(input.colorB)
          ? { colorB: input.colorB.trim().toUpperCase() }
          : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      },
    });
  });
  return { ok: true };
}
