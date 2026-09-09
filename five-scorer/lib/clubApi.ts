import "server-only";

import { themeTokens } from "./theme";
import { nomsChasubles } from "./color";
import type { Club, Organization } from "@prisma/client";

/// La forme d'un club telle que l'app mobile la reçoit.
///
/// Écrite ici plutôt que dans chaque route parce qu'elle est servie par deux
/// endpoints — `/api/me` (tous mes clubs, à la connexion) et
/// `/api/clubs/[clubId]` (un seul, pour rafraîchir le cache local). Deux
/// copies auraient divergé au premier réglage ajouté, et le bogue se serait
/// vu sur un téléphone, une semaine plus tard, sans rien dans les journaux.
export type ClubPourMobile = ReturnType<typeof serialiserClub>;

export function serialiserClub(
  org: Pick<Organization, "slug" | "name">,
  club: Club,
  role: string,
  joueur: { id: string; name: string; photo: string | null } | null,
) {
  const canManage = role === "owner" || role === "admin";
  const noms = nomsChasubles(club.colorA, club.colorB);
  return {
    id: club.id,
    slug: org.slug,
    nom: org.name,
    role,
    // Les mêmes droits que ceux calculés par lib/guard.ts pour le web :
    // l'app mobile ne doit pas les recalculer, elle divergerait.
    peutGerer: canManage,
    peutScorer: canManage || club.membersCanScore,
    couleurA: club.colorA,
    couleurB: club.colorB,
    nomChasubleA: noms.a,
    nomChasubleB: noms.b,
    theme: {
      sombre: themeTokens(club.colorA, club.colorB, "dark"),
      clair: themeTokens(club.colorA, club.colorB, "light"),
    },
    // Les réglages dont la feuille de match a besoin au bord du terrain,
    // donc à garder en local : elle doit fonctionner sans réseau.
    reglages: {
      format: club.format,
      dureeMatchMin: club.matchDurationMin,
      pointsVictoire: club.pointsWin,
      pointsNul: club.pointsDraw,
      suitPasses: club.trackAssists,
      suitCartons: club.trackCards,
      modeHommeDuMatch: club.motmMode,
      minJoueurs: club.minJoueurs,
      capaciteSoiree: club.capaciteSoiree,
    },
    monJoueur: joueur
      ? { id: joueur.id, nom: joueur.name, photo: joueur.photo }
      : null,
  };
}
