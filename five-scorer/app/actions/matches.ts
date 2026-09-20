"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idsValides, estIdOuVide } from "@/lib/ids";
import { requireClub } from "@/lib/guard";
import {
  annulerOuSupprimerMatch,
  joueurSurLaFeuille,
  matchDayAppartientAuClub,
  nomEquipeTronque,
  retablirMatch,
  type ResultatRetrait,
} from "@/lib/matches";

/// « Supprimer » — le mot reste, le geste réel dépend de ce qu'il y a à
/// perdre (spec 0006). Un match sans participant, sans événement, sans
/// réponse à une convocation s'efface pour de vrai. Dès qu'il y a quelque
/// chose, il s'annule à la place : reste visible, sort du classement.
///
/// Ne redirige plus systématiquement : une annulation garde le match sur sa
/// propre page (il existe toujours), seule une vraie suppression envoie vers
/// la liste. C'est à l'appelant de le faire — cette fonction dit ce qui
/// s'est passé, elle ne décide plus où atterrir.
export async function retirerMatch(
  slug: string,
  matchId: string,
  raison?: string,
): Promise<ResultatRetrait> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const res = await annulerOuSupprimerMatch(ctx.club.id, matchId, raison);
  if (res.ok) {
    revalidatePath(`/c/${slug}`);
    revalidatePath(`/c/${slug}/matches`);
    revalidatePath(`/c/${slug}/matches/${matchId}`);
  }
  return res;
}

/// Rétablir un match annulé — symétrique de `retirerMatch` ci-dessus (spec
/// 0001, Q8 + critère d'acceptation « un match annulé peut être rétabli, et
/// revient dans les stats »). `retablirMatch` (lib/matches.ts) refuse déjà
/// un match qui n'est pas CANCELED : cette action n'ajoute que le contrôle
/// d'identité/droits et la revalidation, comme `retirerMatch`.
export async function retablirMatchAction(
  slug: string,
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const res = await retablirMatch(ctx.club.id, matchId);
  if (res.ok) {
    revalidatePath(`/c/${slug}`);
    revalidatePath(`/c/${slug}/matches`);
    revalidatePath(`/c/${slug}/matches/${matchId}`);
  }
  return res;
}

export type EditMatchInput = {
  teamAName?: string;
  teamBName?: string;
  playedAt?: string;
  mvpId?: string | null;
  notes?: string | null;
  seasonId?: string | null;
  // Rattacher après coup un match à sa vraie soirée (spec 0001,
  // APRES-15/APRES-D3) : jusqu'ici `matchDayId` ne s'écrivait qu'à la
  // création (scheduleMatch), jamais à la correction.
  matchDayId?: string | null;
};

/// Ranger un match dans sa soirée — ou l'en sortir.
///
/// **Ouvert à qui peut scorer**, et c'est tout l'objet de cette fonction
/// (spec 0007, tranché le 17 septembre 2026). Jusqu'ici le seul chemin était
/// `updateMatchDetails`, réservé aux admins : le marqueur du lundi soir
/// pouvait fabriquer un match sans soirée et ne pouvait pas le réparer — un
/// cul-de-sac, que l'article V interdit. Celui qui a le droit de créer un
/// match a le droit de dire à quel lundi il appartient.
///
/// Ce qui ne s'ouvre PAS : le reste du formulaire d'édition. La date, la
/// saison, l'homme du match et les noms d'équipe restent `canManage`. C'est
/// une porte étroite, pas une ouverture du formulaire.
///
/// `null` détache — « Aucune — match isolé ». C'est un choix humain, et le
/// serveur ne repassera jamais dessus : le repli de `soireeDuJour` ne joue
/// qu'à la création.
export async function rattacherMatch(
  slug: string,
  matchId: string,
  matchDayId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!idsValides(matchId) || !estIdOuVide(matchDayId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Non autorisé." };

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId: ctx.club.id },
    select: { id: true },
  });
  if (!match) return { ok: false, error: "Match introuvable." };

  if (matchDayId && !(await matchDayAppartientAuClub(matchDayId, ctx.club.id))) {
    return { ok: false, error: "Soirée inconnue." };
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { matchDayId: matchDayId ?? null },
  });

  revalidatePath(`/c/${slug}`);
  revalidatePath(`/c/${slug}/saison`);
  revalidatePath(`/c/${slug}/matches/${matchId}`);
  if (matchDayId) revalidatePath(`/c/${slug}/sessions/${matchDayId}`);
  return { ok: true };
}

export async function updateMatchDetails(
  slug: string,
  matchId: string,
  input: EditMatchInput,
): Promise<{ ok: boolean; error?: string }> {
  // Identifiants venus du client : refuser tout ce qui n'est pas une
  // chaîne, sinon un objet passe pour un filtre Prisma (cf. lib/ids.ts).
  if (!idsValides(matchId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  // mvpId et seasonId partent eux aussi dans un `where` Prisma plus bas :
  // sans ce contrôle, un objet passé à leur place (`{ in: [...] }`) filtrerait
  // toutes les fiches libres du club d'un coup (cf. lib/ids.ts, TRANS-22).
  if (
    !estIdOuVide(input.mvpId) ||
    !estIdOuVide(input.seasonId) ||
    !estIdOuVide(input.matchDayId)
  ) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId: ctx.club.id },
  });
  if (!match) return { ok: false, error: "Match introuvable." };

  if (input.mvpId) {
    const ok = await prisma.player.count({
      where: { id: input.mvpId, clubId: ctx.club.id },
    });
    if (!ok) return { ok: false, error: "MVP hors du club." };
    // Un homme du match est toujours l'un de nos joueurs, désigné après
    // coup : pas seulement du club, mais bien sur LA FEUILLE de CE match
    // précis (spec 0001, Q6) — aucune exception EXTERNAL ici, contrairement
    // au but/passe (lib/matches.ts, joueursValidesPourEvenement).
    if (!(await joueurSurLaFeuille(matchId, input.mvpId))) {
      return { ok: false, error: "MVP hors de la feuille de ce match." };
    }
  }
  if (input.seasonId) {
    const ok = await prisma.season.count({
      where: { id: input.seasonId, clubId: ctx.club.id },
    });
    if (!ok) return { ok: false, error: "Saison inconnue." };
  }
  if (input.matchDayId) {
    // Même schéma que la vérification de saison ci-dessus : sans elle, un
    // membre pourrait rattacher ce match au calendrier d'un autre club.
    if (!(await matchDayAppartientAuClub(input.matchDayId, ctx.club.id))) {
      return { ok: false, error: "Soirée inconnue." };
    }
  }
  const playedAt = input.playedAt ? new Date(input.playedAt) : undefined;
  if (playedAt && Number.isNaN(playedAt.getTime())) {
    return { ok: false, error: "Date invalide." };
  }

  // Même limite qu'à la création (scheduleMatch, app/actions/schedule.ts) —
  // posée une seule fois dans nomEquipeTronque (APRES-21).
  const teamAName = nomEquipeTronque(input.teamAName);
  const teamBName = nomEquipeTronque(input.teamBName);

  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(teamAName ? { teamAName } : {}),
      ...(teamBName ? { teamBName } : {}),
      ...(playedAt ? { playedAt } : {}),
      ...(input.mvpId !== undefined ? { mvpId: input.mvpId } : {}),
      // Une désignation manuelle (mvpId non nul) fige le résultat contre le
      // recomptage de voteMotm (spec 0001, Q6). Un retrait explicite
      // (mvpId: null) relève le verrou plutôt que de le laisser fermé sur
      // rien : la spec ne tranche pas ce cas, mais rouvrir le vote quand
      // plus personne n'est désigné est le seul comportement qui a du sens.
      ...(input.mvpId !== undefined
        ? { motmLocked: input.mvpId !== null }
        : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.seasonId !== undefined ? { seasonId: input.seasonId } : {}),
      ...(input.matchDayId !== undefined
        ? { matchDayId: input.matchDayId }
        : {}),
    },
  });
  revalidatePath(`/c/${slug}/matches/${matchId}`);
  return { ok: true };
}

/// « Abandonner ce match » — depuis la feuille en direct, tant qu'aucun but
/// n'est marqué.
///
/// Un coup d'envoi donné par erreur (le mauvais jour, un tap de trop) n'avait
/// que deux issues : « Terminer », qui inscrivait un 0–0 dans les stats de
/// douze joueurs, ou une feuille laissée ouverte qui masquait ensuite le coup
/// d'envoi de l'accueil. Le geste est ouvert à qui peut scorer, comme le coup
/// d'envoi lui-même — mais seulement sur un match EN COURS et SANS BUT :
/// au-delà, il y a quelque chose à perdre, et le retrait reste l'affaire d'un
/// admin (`retirerMatch`). Le match passe par `annulerOuSupprimerMatch`, la
/// même règle que partout : effacé s'il n'a rien, annulé sinon (il reste
/// visible, hors des stats, et un admin peut le rétablir).
///
/// Un match que le serveur ne connaît pas (créé hors ligne, jamais envoyé)
/// n'est pas une erreur : il n'y a rien à retirer ici.
export async function abandonnerMatch(
  slug: string,
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!idsValides(matchId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Non autorisé." };

  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId: ctx.club.id },
    select: {
      status: true,
      _count: { select: { events: { where: { type: { in: ["GOAL", "OWN_GOAL"] } } } } },
    },
  });
  if (!match) return { ok: true };
  if (match.status !== "LIVE") {
    return { ok: false, error: "Ce match n'est plus en cours." };
  }
  if (match._count.events > 0 && !ctx.canManage) {
    return {
      ok: false,
      error: "Des buts sont déjà enregistrés : termine le match, un admin pourra l'annuler.",
    };
  }

  const res = await annulerOuSupprimerMatch(ctx.club.id, matchId, "Abandonné");
  if (!res.ok) return res;
  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}
