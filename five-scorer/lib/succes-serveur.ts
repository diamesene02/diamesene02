import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  calculerSucces,
  type Historique,
  type MatchHistorique,
  type ResultatSucces,
} from "@/lib/succes";

/// Les succès d'un club, chargés et calculés une fois par requête serveur.
///
/// ─── L'API des pages du site ─────────────────────────────────────────────
///
///   import { succesDuClub } from "@/lib/succes-serveur";
///
///   const succes = await succesDuClub(club.id);
///   succes.parJoueur.get(playerId)   // SuccesJoueur | undefined
///   succes.club                      // SuccesClub : niveaux, fil, évolutions
///   succes.deblocagesDuMatch(matchId) // DeblocageJoueur[] : paliers franchis
///                                     // pendant CE match, invités compris
///   succes.joueurDuCompte(userId)    // playerId lié au compte, ou null
///
/// Les formes (`SuccesJoueur`, `Badge`, `Deblocage`, `SuccesClub`…) sont
/// exportées par `@/lib/succes`, qui est pur : un composant client peut en
/// importer les TYPES sans tirer Prisma.
///
/// À savoir avant de dessiner :
///   - `parJoueur` contient TOUS les joueurs du club, invités et archivés
///     compris ; un joueur qui n'a jamais joué a ses badges à zéro ;
///   - `badges` suit l'ordre du catalogue (`FAMILLES`) et omet les familles
///     que le club ne suit pas (passes et duo sans `trackAssists`, homme du
///     match en mode OFF, électeur hors mode VOTE) — sauf si le joueur y a
///     déjà un palier ;
///   - `club.niveaux` omet invités, archivés et joueurs à 0 XP ;
///   - `club.fil` : 30 derniers jours, sans invités, le plus récent d'abord.
///     Il est coupé à 20 ÉVÉNEMENTS (une famille, un palier, un jour), pas à
///     20 lignes : les déblocages d'un même événement arrivent ENSEMBLE, à
///     la suite, pour que l'écran les regroupe en une ligne sans perdre le
///     reste du mois ;
///   - `club.raretes` : les cinq succès les plus rares du club, au palier le
///     plus haut que quelqu'un y détient, avec ses détenteurs (une famille
///     que plus de la moitié du club tient n'y est pas). C'est l'onglet
///     « Raretés » tel quel — ne le recalcule pas à côté ;
///   - `classement` : le tableau de l'accueil (saison active, ou tout
///     l'historique sans saison active). `evolution` vaut 0 quand rien n'a
///     bougé — ne l'affiche pas — et null sans dernière soirée ou pour qui
///     n'avait pas de place avant elle ;
///   - `matchId` d'un déblocage : le match où le compteur a franchi le seuil.
///     Pour une famille de soirée, c'est son premier match de la soirée
///     (Habitué, Toujours là) ou le dernier match de la soirée (Roi du
///     lundi) ; null pour un titre de saison, daté à la clôture ;
///   - les dates sont des chaînes ISO ; formate-les avec `lib/dates.ts`.
///
/// Aucun contrôle d'accès ici : la page appelle `requireClub` (ou la route
/// `getClubApiContext`) AVANT, comme pour `getLeaderboard`.
///
/// `cache()` : la fiche, l'accueil et le récap d'une même requête peuvent
/// tous l'appeler, l'historique n'est chargé qu'une fois. Rien n'est gardé
/// d'une requête à l'autre : une feuille corrigée se voit au rafraîchissement
/// suivant, sans étiquette de cache à invalider sur les trois chemins
/// d'écriture (actions, routes de l'app, file hors ligne).
///
/// ─── Les routes de l'app ─────────────────────────────────────────────────
///
///   GET /api/clubs/[clubId]/succes[?joueur=<playerId>]  → SuccesJoueur
///   GET /api/clubs/[clubId]/succes/club                 → SuccesClub
///   GET /api/clubs/[clubId]/succes/match/[matchId]      → { deblocages }
///
/// Elles appellent la même fonction : un seul calcul, deux vitrines.

export type SuccesDuClub = ResultatSucces & {
  joueurDuCompte: (userId: string) => string | null;
};

type LigneParticipant = {
  matchId: string;
  playerId: string;
  initialTeam: "A" | "B";
  isGk: boolean;
};

type LigneEvenement = MatchHistorique["events"][number] & { matchId: string };

/// L'historique compact du club.
///
/// Huit requêtes lancées ENSEMBLE plutôt qu'un `include` : Prisma 5 résout
/// un `include` en requêtes enchaînées (match, puis participants, puis
/// événements), chacune attendant la précédente — trois trajets vers la base
/// au lieu d'un. Et jamais `player.photo` : vingt kilo-octets par joueur,
/// pour un calcul qui n'affiche aucun visage.
///
/// Participants et événements passent en SQL direct (paramétré, `$queryRaw`
/// en gabarit) : ce sont 90 % des lignes — 8 000 et 3 000 sur trois saisons
/// — et `findMany` les traite trois fois plus lentement que la même requête
/// brute. Mesuré le 19 septembre 2026 sur un club synthétique de 792 matchs
/// en base locale : 110 à 160 ms contre 40 ms pour les participants, 90
/// contre 41 pour les événements. Le prix : si une migration renomme une de
/// ces colonnes, `tsc` ne le verra pas, la page lèvera au premier
/// chargement.
export const chargerHistorique = cache(async (clubId: string): Promise<Historique> => {
  const matchTermine = { clubId, status: "FINISHED" as const };
  const [club, matchs, participants, evenements, joueurs, saisons, annulees, votes] =
    await Promise.all([
      prisma.club.findUnique({
        where: { id: clubId },
        select: { pointsWin: true, pointsDraw: true, trackAssists: true, motmMode: true },
      }),
      prisma.match.findMany({
        where: matchTermine,
        select: {
          id: true,
          playedAt: true,
          createdAt: true,
          matchDayId: true,
          seasonId: true,
          kind: true,
          status: true,
          scoreA: true,
          scoreB: true,
          mvpId: true,
          correctedAt: true,
        },
      }),
      prisma.$queryRaw<LigneParticipant[]>`
        SELECT p."matchId", p."playerId", p."initialTeam", p."isGk"
        FROM "match_participant" p
        JOIN "match" m ON m."id" = p."matchId"
        WHERE m."clubId" = ${clubId} AND m."status" = 'FINISHED'`,
      prisma.$queryRaw<LigneEvenement[]>`
        SELECT e."id", e."matchId", e."type", e."team", e."playerId",
               e."assistPlayerId", e."minute", e."createdAt"
        FROM "match_event" e
        JOIN "match" m ON m."id" = e."matchId"
        WHERE m."clubId" = ${clubId} AND m."status" = 'FINISHED'
          AND e."type" <> 'HALF_TIME'`,
      // `orderBy` : sans lui, Postgres rend les lignes dans l'ordre du tas,
      // qui change dès qu'un joueur est mis à jour (une photo, un surnom).
      // Deux joueurs qui portent le MÊME nom et franchissent le même palier
      // le même soir s'échangeaient alors leur place d'un rafraîchissement à
      // l'autre. Le moteur départage aussi par identifiant ; les deux
      // ensemble ne coûtent rien.
      prisma.player.findMany({
        where: { clubId },
        orderBy: { id: "asc" },
        select: { id: true, name: true, isGuest: true, isArchived: true, userId: true },
      }),
      prisma.season.findMany({
        where: { clubId },
        select: { id: true, name: true, isActive: true, startsAt: true, endsAt: true },
      }),
      prisma.matchDay.findMany({
        where: { clubId, canceledAt: { not: null } },
        select: { id: true },
      }),
      prisma.motmVote.findMany({
        where: { match: matchTermine },
        select: { voterId: true, matchId: true, createdAt: true },
      }),
    ]);

  // Les lignes filles rejoignent leur match. Une ligne dont le match manque
  // (terminé entre deux requêtes de la vague) est simplement ignorée : elle
  // sera là au prochain chargement.
  const parId = new Map<string, MatchHistorique>();
  for (const m of matchs) parId.set(m.id, { ...m, participants: [], events: [] });
  for (const { matchId, ...p } of participants) parId.get(matchId)?.participants.push(p);
  for (const { matchId, ...e } of evenements) parId.get(matchId)?.events.push(e);

  return {
    // Un club introuvable n'a aucun match : les réglages par défaut du
    // schéma suffisent à rendre un résultat vide plutôt qu'une erreur.
    reglages: club ?? { pointsWin: 3, pointsDraw: 1, trackAssists: true, motmMode: "VOTE" },
    matchs: [...parId.values()],
    joueurs,
    saisons,
    soireesAnnulees: annulees.map((s) => s.id),
    votes,
  };
});

/// Les succès de tout le club (voir l'en-tête pour l'usage).
export const succesDuClub = cache(async (clubId: string): Promise<SuccesDuClub> => {
  const historique = await chargerHistorique(clubId);
  const resultat = calculerSucces(historique, new Date());
  const comptes = new Map<string, string>();
  for (const j of historique.joueurs) if (j.userId) comptes.set(j.userId, j.id);
  return { ...resultat, joueurDuCompte: (userId) => comptes.get(userId) ?? null };
});
