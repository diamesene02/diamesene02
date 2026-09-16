"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClub, type ClubContext } from "@/lib/guard";
import { estId, estIdOuVide, idsValides } from "@/lib/ids";
import {
  creerEvenementMatch,
  deplacerJoueurMatch,
  modifierEvenementMatch,
  supprimerEvenementMatch,
} from "@/lib/matchEvents";

// Les gestes de l'écran /corriger (spec 0001). Chacun passe par les fonctions
// partagées de lib/matchEvents.ts — les mêmes que l'app mobile appelle par
// ses routes — qui posent correctedAt/correctedById sur un match verrouillé.
//
// Réseau exigé (Q4) : une action serveur ne se met jamais en file. Si le
// réseau manque, l'appel échoue côté navigateur et le formulaire le dit.
//
// Seul un match FINISHED se corrige ici : un CANCELED se rétablit d'abord,
// un LIVE se corrige sur sa feuille. Les fonctions partagées laisseraient un
// admin écrire dans un CANCELED (c'est la garde de l'API) ; cet écran-ci
// est plus strict, et le dit.

type Resultat = { ok: true } | { ok: false; error: string };

async function ouvrir(
  slug: string,
  matchId: string,
): Promise<{ ok: false; error: string } | { ok: true; ctx: ClubContext }> {
  const ctx = await requireClub(slug);
  if (!ctx.canManage) return { ok: false, error: "Réservé aux admins." };
  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId: ctx.club.id },
    select: { status: true },
  });
  if (!match) return { ok: false, error: "Match introuvable." };
  if (match.status === "CANCELED") {
    return { ok: false, error: "Un match annulé ne se corrige pas : rétablis-le d'abord." };
  }
  if (match.status !== "FINISHED") {
    return { ok: false, error: "Seul un match terminé se corrige ici." };
  }
  return { ok: true, ctx };
}

function rafraichir(slug: string, matchId: string) {
  revalidatePath(`/c/${slug}/matches/${matchId}`);
  revalidatePath(`/c/${slug}/matches/${matchId}/corriger`);
}

/// Ajouter un but oublié — jamais de minute (Q5) : on ne demande pas une
/// minute qu'on inventerait, le but se place en fin de chronologie, marqué.
export async function ajouterButCorrection(
  slug: string,
  matchId: string,
  input: {
    type: "GOAL" | "OWN_GOAL";
    team: "A" | "B";
    playerId: string | null;
    assistPlayerId: string | null;
  },
): Promise<Resultat> {
  if (!idsValides(matchId)) return { ok: false, error: "Identifiant invalide." };
  if (!estIdOuVide(input.playerId) || !estIdOuVide(input.assistPlayerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  if (input.type !== "GOAL" && input.type !== "OWN_GOAL") {
    return { ok: false, error: "Type invalide." };
  }
  if (input.team !== "A" && input.team !== "B") {
    return { ok: false, error: "Équipe invalide." };
  }
  const o = await ouvrir(slug, matchId);
  if (!o.ok) return o;

  const res = await creerEvenementMatch({
    clubId: o.ctx.club.id,
    matchId,
    canManage: true,
    userId: o.ctx.user.id,
    type: input.type,
    team: input.team,
    playerId: input.playerId,
    assistPlayerId: input.type === "GOAL" ? input.assistPlayerId : null,
    minute: null,
  });
  if (!res.ok) return { ok: false, error: res.error };
  rafraichir(slug, matchId);
  return { ok: true };
}

/// Retirer un événement (but, csc, carton) qui n'a pas eu lieu.
export async function retirerEvenementCorrection(
  slug: string,
  matchId: string,
  eventId: string,
): Promise<Resultat> {
  if (!idsValides(matchId, eventId)) return { ok: false, error: "Identifiant invalide." };
  const o = await ouvrir(slug, matchId);
  if (!o.ok) return o;

  const res = await supprimerEvenementMatch({
    clubId: o.ctx.club.id,
    matchId,
    canManage: true,
    userId: o.ctx.user.id,
    eventId,
  });
  if (!res.ok) return { ok: false, error: res.error };
  rafraichir(slug, matchId);
  return { ok: true };
}

/// Changer (ou retirer) le passeur d'un but, ou l'auteur d'un contre son
/// camp. Le buteur d'un but NORMAL ne se change pas en place : retirer, puis
/// ré-ajouter — c'est un écart assumé du plan, qui garde recomputeScore et
/// la chronologie honnêtes.
export async function changerJoueurEvenementCorrection(
  slug: string,
  matchId: string,
  eventId: string,
  champ: "passeur" | "buteurCsc",
  playerId: string | null,
): Promise<Resultat> {
  if (!idsValides(matchId, eventId) || !estIdOuVide(playerId)) {
    return { ok: false, error: "Identifiant invalide." };
  }
  const o = await ouvrir(slug, matchId);
  if (!o.ok) return o;

  const res = await modifierEvenementMatch({
    clubId: o.ctx.club.id,
    matchId,
    canManage: true,
    userId: o.ctx.user.id,
    eventId,
    setsScorer: champ === "buteurCsc",
    scorerPlayerId: champ === "buteurCsc" ? playerId : undefined,
    assistPlayerId: champ === "passeur" ? playerId : undefined,
  });
  if (!res.ok) return { ok: false, error: res.error };
  rafraichir(slug, matchId);
  return { ok: true };
}

/// Recomposer : faire changer un joueur de camp, après coup.
export async function deplacerJoueurCorrection(
  slug: string,
  matchId: string,
  playerId: string,
  team: "A" | "B",
): Promise<Resultat> {
  if (!idsValides(matchId) || !estId(playerId)) return { ok: false, error: "Identifiant invalide." };
  if (team !== "A" && team !== "B") return { ok: false, error: "Équipe invalide." };
  const o = await ouvrir(slug, matchId);
  if (!o.ok) return o;

  const res = await deplacerJoueurMatch({
    clubId: o.ctx.club.id,
    matchId,
    canManage: true,
    userId: o.ctx.user.id,
    playerId,
    team,
  });
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.applique) return { ok: false, error: "Ce joueur n'est pas sur la feuille de ce match." };
  rafraichir(slug, matchId);
  return { ok: true };
}
