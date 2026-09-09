// Les actions local-first d'un match, portées de « five-scorer/lib/localMatch.ts »
// (707 lignes, 41 appels Dexie, 9 transactions).
//
// Chaque mutation fait deux choses, et dans cet ordre :
//   1. elle écrit la base locale — l'écran se rafraîchit tout de suite ;
//   2. elle enfile une opération que le drain rejouera contre le serveur.
//
// **Aucune fonction de ce fichier ne touche le réseau.** C'est le travail de
// « lib/outbox/sync.ts ». La saisie du lundi soir reste instantanée, et elle
// reste juste sans réseau : c'est la promesse de toute l'application.
//
// Ce qui ne change pas du web, parce que c'est ce qui a coûté des soirées :
//
//   - **Le but et son opération partent dans la MÊME transaction.** Les deux,
//     ou aucun des deux. Un événement écrit sans son opération, c'est un but
//     qui n'arrive jamais au serveur ; une opération sans son événement, c'est
//     un score qui saute à l'écran. Le test qui compte est celui-là.
//   - **Rien ne s'écrit dans un match terminé.** Le serveur le refuse, et un
//     refus bloque en cascade toute la file du match (§ « bloquerChaine »).
//   - **La minute se déduit du coup d'envoi, et vaut `null` sur une feuille
//     rétro** — sinon le premier but d'un match d'hier s'inscrit à la
//     1 440ᵉ minute.
//   - **Le garde anti-équipe-vide** de `movePlayerTeam` : un tap de trop en
//     mode correction vidait un camp, et les stats inscrivaient une défaite à
//     dix joueurs pour un match que personne n'avait perdu.
//   - **Les invités créés hors-ligne** voyagent dans le payload de création :
//     ils doivent exister côté serveur avant les compos.
//
// Ce qui change, et pourquoi :
//
//   - **Rien n'est global.** Dexie vivait dans un singleton (`getDb()`) ; ici
//     tout entre par `creerMatchLocal(deps)`, comme `creerDrain` à l'étape 7 et
//     `creerAppel` à l'étape 8. C'est ce qui permet d'ouvrir deux fois la même
//     base dans un test, et de vérifier ce qui a réellement été écrit sur le
//     disque plutôt que ce qu'on croit avoir écrit.
//   - **L'horloge et le générateur d'identifiants sont injectables.** Sans ça,
//     le test de la minute rétro dépendrait de l'heure qu'il est.
//   - **`db.transaction("rw", tables…, fn)` devient `base.transaction(fn)`** :
//     SQLite verrouille la base, pas des tables. La transaction est exclusive
//     (`BEGIN IMMEDIATE` / `withExclusiveTransactionAsync`), ce qui est plus
//     strict que Dexie — jamais moins.
//   - **Les noms des fonctions restent ceux du web** (`createMatch`,
//     `addEvent`, …), y compris les deux déjà françaises
//     (`ajouterJoueurAuMatch`, `joueursAbsentsDuMatch`). La correspondance avec
//     le fichier source doit rester lisible ligne à ligne : c'est ce qui rend
//     une divergence détectable à la relecture.

import type { Base } from "../outbox/base";
import { enfiler } from "../outbox/outbox";
import type {
  LocalClub,
  LocalEvent,
  LocalEventType,
  LocalMatch,
  OutboxOp,
} from "../outbox/types";
import { newId } from "../noyau/ids";
import { RETRO_APRES_MS } from "../noyau/retro";
import {
  compterCoequipiers,
  compterOpsDuMatch,
  ecrireClub,
  ecrireEvenement,
  ecrireJoueur,
  ecrireMatch,
  ecrireParticipant,
  lireClub,
  lireClubParSlug,
  lireDernierBut,
  lireEvenement,
  lireEvenements,
  lireJoueur,
  lireJoueurs,
  lireMatch,
  lireMatchEnCours,
  lireParticipant,
  lireParticipants,
  lireVivier,
  majButeur,
  majEquipe,
  majFinDeMatch,
  majPasseur,
  majScore,
  pKey,
  supprimerEvenement,
} from "./tables";

export type Dependances = {
  base: Base;
  /// Injectable pour les tests : la minute d'un but se déduit de l'heure, et
  /// un test qui dépend de l'heure qu'il est ne prouve rien.
  maintenant?: () => Date;
  /// Le générateur d'identifiants. `newId()` (cuid2) par défaut — le même que
  /// côté web, c'est lui qui rend le rejeu idempotent.
  nouvelId?: () => string;
};

export type CreateMatchInput = {
  clubId: string;
  matchDayId?: string | null;
  seasonId?: string | null;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId?: string | null;
  teamAName: string;
  teamBName: string;
  teamA: { playerId: string; isGk: boolean }[];
  teamB: { playerId: string; isGk: boolean }[];
  /// Quand le match a été joué (ISO). Absent = maintenant. Une date passée
  /// crée une feuille rétro : pas d'horloge, pas de minutes (cf. lib/noyau/retro).
  playedAt?: string | null;
};

/// Un match programmé côté serveur, qu'on démarre sur l'appareil.
export type ScheduledMatchSeed = {
  id: string;
  clubId: string;
  matchDayId?: string | null;
  seasonId?: string | null;
  kind: "INTERNAL" | "EXTERNAL";
  opponentId?: string | null;
  teamAName: string;
  teamBName: string;
  teamA: { playerId: string; isGk: boolean }[];
  teamB: { playerId: string; isGk: boolean }[];
};

export type AddEventInput = {
  type: LocalEventType;
  /// Équipe créditée. Pour un GOAL d'un joueur, l'équipe du joueur ; pour un
  /// OWN_GOAL, l'équipe adverse (celle qui en profite).
  team: "A" | "B";
  playerId?: string | null;
  assistPlayerId?: string | null;
  minute?: number | null;
};

/// Un joueur de la feuille, avec son compte de la soirée.
export type LivePlayer = {
  id: string;
  name: string;
  photo?: string | null;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  isGk: boolean;
};

/// Ce qu'une fiche d'effectif apporte au cache local.
///
/// **Écart assumé au web** : `photo` n'existe pas dans l'entrée de `saveRoster`
/// côté web, donc le cache Dexie n'a jamais de visage. L'endpoint mobile de
/// l'effectif (étape 9) les envoie, et `getLocalMatch` les relit — la feuille
/// doit montrer les visages au bord du terrain, sans réseau (§3.3). Le champ
/// est optionnel : à entrée identique, le comportement est identique.
export type FicheEffectif = {
  id: string;
  name: string;
  nickname?: string | null;
  photo?: string | null;
  skill: number;
  isGk: boolean;
  isGuest: boolean;
  isArchived?: boolean;
};

function scoreDelta(type: LocalEventType): number {
  return type === "GOAL" || type === "OWN_GOAL" ? 1 : 0;
}

export type MatchLocal = ReturnType<typeof creerMatchLocal>;

export function creerMatchLocal(deps: Dependances) {
  const base = deps.base;
  const maintenant = deps.maintenant ?? (() => new Date());
  const nouvelId = deps.nouvelId ?? newId;

  /// Enfile une opération. Toujours appelée DANS la transaction de la mutation
  /// qui l'accompagne, et avec la base de cette transaction : l'écriture
  /// métier et l'opération à rejouer tombent ensemble, ou pas du tout.
  const enqueue = (b: Base, op: OutboxOp) =>
    enfiler(b, op, maintenant().toISOString());

  // --- Cache roster --------------------------------------------------------

  /// Met en cache l'effectif du club, tel que le serveur l'a rendu.
  ///
  /// Remplacement complet de chaque fiche, comme le `bulkPut` de Dexie : une
  /// fiche renvoyée sans surnom perd son surnom, c'est le serveur qui a
  /// raison. Une seule transaction pour tout le lot — quatorze fiches, un seul
  /// verrou.
  async function saveRoster(
    clubId: string,
    players: FicheEffectif[],
  ): Promise<void> {
    await base.transaction(async (b) => {
      for (const p of players) {
        await ecrireJoueur(b, {
          ...p,
          clubId,
          nickname: p.nickname ?? null,
          photo: p.photo ?? null,
          isArchived: Boolean(p.isArchived),
        });
      }
    });
  }

  /// Un invité créé au bord du terrain, sans réseau. Il n'existe QUE sur
  /// l'appareil jusqu'à ce que le match qui l'embarque parte : c'est le
  /// payload de `createMatch` (champ `guests`) qui le fait exister côté
  /// serveur, avec le même identifiant.
  async function addLocalGuest(clubId: string, name: string): Promise<string> {
    const id = nouvelId();
    await ecrireJoueur(base, {
      id,
      clubId,
      name,
      nickname: null,
      photo: null,
      skill: 3,
      isGk: false,
      isGuest: true,
      isArchived: false,
    });
    return id;
  }

  // --- Cache du club -------------------------------------------------------

  /// Enregistre les réglages du club à chaque visite EN LIGNE. C'est ce qui
  /// permet à la coquille de match de se rendre hors-ligne, pour un match créé
  /// hors-ligne, sans jamais toucher au serveur.
  async function saveClubSettings(
    club: Omit<LocalClub, "savedAt">,
  ): Promise<void> {
    await ecrireClub(base, { ...club, savedAt: maintenant().toISOString() });
  }

  function getLocalClub(clubId: string): Promise<LocalClub | undefined> {
    return lireClub(base, clubId);
  }

  function getLocalClubBySlug(slug: string): Promise<LocalClub | undefined> {
    return lireClubParSlug(base, slug);
  }

  /// Le match en cours du club, s'il y en a un dans la mémoire locale. C'est
  /// LE chemin de reprise du lundi soir : l'app tuée, rouverte, le match
  /// retrouvé — sans serveur.
  function getLiveMatchOfClub(clubId: string): Promise<LocalMatch | undefined> {
    return lireMatchEnCours(base, clubId);
  }

  /// Nombre d'opérations encore à envoyer pour un match. Zéro = le serveur
  /// sait tout, on peut lui faire confiance pour le récap complet.
  function pendingOpsForMatch(matchId: string): Promise<number> {
    return compterOpsDuMatch(base, matchId);
  }

  // --- Cycle de vie du match -----------------------------------------------

  async function createMatch(input: CreateMatchInput): Promise<string> {
    const id = nouvelId();
    const playedAt = input.playedAt ?? maintenant().toISOString();

    await base.transaction(async (b) => {
      await ecrireMatch(b, {
        id,
        clubId: input.clubId,
        matchDayId: input.matchDayId ?? null,
        seasonId: input.seasonId ?? null,
        kind: input.kind,
        opponentId: input.opponentId ?? null,
        playedAt,
        teamAName: input.teamAName,
        teamBName: input.teamBName,
        scoreA: 0,
        scoreB: 0,
        status: "LIVE",
        mvpId: null,
      });

      const parts = [
        ...input.teamA.map((p) => ({ team: "A" as const, ...p })),
        ...input.teamB.map((p) => ({ team: "B" as const, ...p })),
      ].map((p) => ({
        key: pKey(id, p.playerId),
        matchId: id,
        playerId: p.playerId,
        team: p.team,
        isGk: p.isGk,
      }));
      for (const p of parts) await ecrireParticipant(b, p);

      // Les invités créés hors-ligne doivent exister côté serveur avant les
      // compos — on les embarque dans le payload de création.
      const fiches = await lireJoueurs(
        b,
        parts.map((p) => p.playerId),
      );
      const guests = parts
        .map((p) => fiches.get(p.playerId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.isGuest))
        .map((p) => ({ id: p.id, name: p.name }));

      await enqueue(b, {
        kind: "createMatch",
        clubId: input.clubId,
        matchId: id,
        payload: {
          id,
          playedAt,
          matchDayId: input.matchDayId ?? null,
          seasonId: input.seasonId ?? null,
          matchKind: input.kind,
          opponentId: input.opponentId ?? null,
          teamAName: input.teamAName,
          teamBName: input.teamBName,
          teamA: input.teamA,
          teamB: input.teamB,
          guests,
        },
      });
    });

    return id;
  }

  /// Démarre en local un match programmé côté serveur : on écrit le MÊME
  /// identifiant puis on enfile l'op `createMatch` — l'API est un upsert
  /// idempotent qui bascule le match SCHEDULED → LIVE. Le live fonctionne
  /// ensuite exactement comme un match créé sur l'appareil.
  async function launchScheduledMatch(seed: ScheduledMatchSeed): Promise<string> {
    const playedAt = maintenant().toISOString();

    await base.transaction(async (b) => {
      const existing = await lireMatch(b, seed.id);
      if (existing) return; // déjà lancé sur cet appareil

      await ecrireMatch(b, {
        id: seed.id,
        clubId: seed.clubId,
        matchDayId: seed.matchDayId ?? null,
        seasonId: seed.seasonId ?? null,
        kind: seed.kind,
        opponentId: seed.opponentId ?? null,
        playedAt,
        teamAName: seed.teamAName,
        teamBName: seed.teamBName,
        scoreA: 0,
        scoreB: 0,
        status: "LIVE",
        mvpId: null,
      });

      const parts = [
        ...seed.teamA.map((p) => ({ team: "A" as const, ...p })),
        ...seed.teamB.map((p) => ({ team: "B" as const, ...p })),
      ];
      for (const p of parts) {
        await ecrireParticipant(b, {
          key: pKey(seed.id, p.playerId),
          matchId: seed.id,
          playerId: p.playerId,
          team: p.team,
          isGk: p.isGk,
        });
      }

      await enqueue(b, {
        kind: "createMatch",
        clubId: seed.clubId,
        matchId: seed.id,
        payload: {
          id: seed.id,
          playedAt,
          matchDayId: seed.matchDayId ?? null,
          seasonId: seed.seasonId ?? null,
          matchKind: seed.kind,
          opponentId: seed.opponentId ?? null,
          teamAName: seed.teamAName,
          teamBName: seed.teamBName,
          teamA: seed.teamA,
          teamB: seed.teamB,
          guests: [],
        },
      });
    });

    return seed.id;
  }

  async function addEvent(
    matchId: string,
    input: AddEventInput,
  ): Promise<string> {
    const eventId = nouvelId();
    const createdAt = maintenant().toISOString();

    await base.transaction(async (b) => {
      const match = await lireMatch(b, matchId);
      if (!match) throw new Error("Match introuvable");
      if (match.status === "FINISHED") throw new Error("Match terminé");

      if (input.playerId) {
        const part = await lireParticipant(b, pKey(matchId, input.playerId));
        if (!part && match.kind === "INTERNAL") {
          throw new Error("Joueur non inscrit à ce match");
        }
      }

      // La minute se déduit du temps écoulé depuis le coup d'envoi — sauf
      // sur une feuille saisie après coup, qui n'a pas d'horloge : le premier
      // but d'un match d'hier s'y serait inscrit à la 1 440e minute, et la
      // chronologie du récap l'aurait affiché tel quel.
      const ecoule = maintenant().getTime() - new Date(match.playedAt).getTime();
      const minute =
        input.minute !== undefined && input.minute !== null
          ? input.minute
          : ecoule < 0 || ecoule > RETRO_APRES_MS
            ? null
            : Math.max(0, Math.floor(ecoule / 60000));

      const event: LocalEvent = {
        id: eventId,
        matchId,
        type: input.type,
        team: input.team,
        playerId: input.playerId ?? null,
        assistPlayerId: input.assistPlayerId ?? null,
        minute,
        createdAt,
      };
      await ecrireEvenement(b, event);

      const d = scoreDelta(input.type);
      if (d) {
        await majScore(
          b,
          matchId,
          input.team === "A" ? match.scoreA + d : match.scoreA,
          input.team === "B" ? match.scoreB + d : match.scoreB,
        );
      }

      await enqueue(b, {
        kind: "addEvent",
        clubId: match.clubId,
        matchId,
        payload: {
          id: eventId,
          type: input.type,
          team: input.team,
          playerId: input.playerId ?? null,
          assistPlayerId: input.assistPlayerId ?? null,
          minute,
          createdAt,
        },
      });
    });

    return eventId;
  }

  /// Annule un événement précis (tap sur la chronologie).
  function removeEvent(matchId: string, eventId: string): Promise<boolean> {
    return base.transaction(async (b) => {
      const ev = await lireEvenement(b, eventId);
      if (!ev || ev.matchId !== matchId) return false;
      await supprimerEvenement(b, eventId);

      const d = scoreDelta(ev.type);
      const match = await lireMatch(b, matchId);
      if (d && match) {
        await majScore(
          b,
          matchId,
          ev.team === "A" ? Math.max(0, match.scoreA - d) : match.scoreA,
          ev.team === "B" ? Math.max(0, match.scoreB - d) : match.scoreB,
        );
      }

      await enqueue(b, {
        kind: "removeEvent",
        clubId: match?.clubId ?? "",
        matchId,
        payload: { eventId },
      });
      return true;
    });
  }

  /// Attache (ou retire) une passe décisive à un but déjà saisi — le but part
  /// instantanément au tap, la passe se choisit après sans bloquer la saisie.
  async function setEventAssist(
    matchId: string,
    eventId: string,
    assistPlayerId: string | null,
  ): Promise<boolean> {
    let ecrit = true;
    await base.transaction(async (b) => {
      const ev = await lireEvenement(b, eventId);
      if (!ev || ev.matchId !== matchId || ev.type !== "GOAL") {
        ecrit = false;
        return;
      }
      const match = await lireMatch(b, matchId);
      await majPasseur(b, eventId, assistPlayerId);
      await enqueue(b, {
        kind: "setAssist",
        clubId: match?.clubId ?? "",
        matchId,
        payload: { eventId, assistPlayerId },
      });
    });
    return ecrit;
  }

  /// Désigne (ou retire) l'auteur d'un contre son camp déjà saisi.
  ///
  /// Le csc est le seul but que personne ne revendique : sur le terrain, l'aveu
  /// met dix secondes à venir et le nom fait débat. Le score, lui, est
  /// immédiat. On écrit donc le but au premier tap avec un buteur nul, et on
  /// n'attache le nom qu'après — par une mise à jour de champ, pour que
  /// l'événement garde son identifiant et que la file hors-ligne reste
  /// rejouable.
  async function setEventScorer(
    matchId: string,
    eventId: string,
    scorerPlayerId: string | null,
  ): Promise<boolean> {
    let ecrit = true;
    await base.transaction(async (b) => {
      const ev = await lireEvenement(b, eventId);
      // L'événement a pu être annulé entre-temps depuis la chronologie. Sortir
      // en silence faisait croire à l'utilisateur que le nom avait été pris.
      if (!ev || ev.matchId !== matchId || ev.type !== "OWN_GOAL") {
        ecrit = false;
        return;
      }
      const match = await lireMatch(b, matchId);
      await majButeur(b, eventId, scorerPlayerId);
      await enqueue(b, {
        kind: "setScorer",
        clubId: match?.clubId ?? "",
        matchId,
        payload: { eventId, scorerPlayerId },
      });
    });
    return ecrit;
  }

  /// Fait changer un joueur de camp pendant le match.
  ///
  /// L'erreur de composition se voit au coup d'envoi, pas avant : deux copains
  /// dans la même équipe, un gardien manquant. Sans ce geste il fallait
  /// terminer le match et tout ressaisir. Les buts déjà marqués gardent leur
  /// équipe d'origine — ils ont bien été marqués pour ce camp-là.
  async function movePlayerTeam(
    matchId: string,
    playerId: string,
    team: "A" | "B",
  ): Promise<void> {
    await base.transaction(async (b) => {
      const match = await lireMatch(b, matchId);
      if (!match) throw new Error("Match introuvable");
      if (match.status === "FINISHED") throw new Error("Match terminé");
      // Sur un match contre un adversaire extérieur, l'équipe B n'est pas une
      // équipe du club : y envoyer un joueur le retire de l'écran sans retour.
      if (match.kind === "EXTERNAL" && team === "B") {
        throw new Error("Pas d'équipe B à composer sur ce match");
      }
      const part = await lireParticipant(b, pKey(matchId, playerId));
      if (!part) throw new Error("Joueur non inscrit à ce match");
      if (part.team === team) return; // déjà du bon côté
      // Un tap de trop en mode correction et la colonne d'origine se vide : le
      // match se terminait alors avec tout le monde du même côté, et
      // lib/stats.ts inscrivait une défaite à dix joueurs pour un match que
      // personne n'avait perdu.
      const restants = await compterCoequipiers(b, matchId, part.team, playerId);
      if (restants === 0) {
        throw new Error("Il faut au moins un joueur de chaque côté");
      }
      await majEquipe(b, pKey(matchId, playerId), team);
      await enqueue(b, {
        kind: "movePlayer",
        clubId: match.clubId,
        matchId,
        payload: { playerId, team },
      });
    });
  }

  /// Inscrit un joueur arrivé après le coup d'envoi.
  ///
  /// Le retardataire est une certitude dans un club qui joue tous les lundis.
  /// Il n'avait aucune place : `addEvent` refusait ses buts (« Joueur non
  /// inscrit à ce match ») et la seule issue était de terminer le match et de
  /// tout ressaisir.
  async function ajouterJoueurAuMatch(
    matchId: string,
    playerId: string,
    team: "A" | "B",
  ): Promise<void> {
    await base.transaction(async (b) => {
      const match = await lireMatch(b, matchId);
      if (!match) throw new Error("Match introuvable");
      if (match.status === "FINISHED") throw new Error("Match terminé");
      const deja = await lireParticipant(b, pKey(matchId, playerId));
      if (deja) return; // déjà de la partie
      const fiche = await lireJoueur(b, playerId);
      // Il entre comme joueur de champ : le rôle de gardien d'un soir est une
      // décision distincte, qui se prend sur la compo de la soirée.
      await ecrireParticipant(b, {
        key: pKey(matchId, playerId),
        matchId,
        playerId,
        team,
        isGk: false,
      });
      await enqueue(b, {
        kind: "addParticipant",
        clubId: match.clubId,
        matchId,
        payload: {
          playerId,
          team,
          isGk: false,
          ...(fiche?.isGuest ? { guest: { id: fiche.id, name: fiche.name } } : {}),
        },
      });
    });
  }

  /// Le vivier du club, hors des joueurs déjà inscrits à ce match — ceux qu'on
  /// peut faire entrer en cours de route.
  async function joueursAbsentsDuMatch(
    matchId: string,
  ): Promise<{ id: string; name: string }[]> {
    const match = await lireMatch(base, matchId);
    if (!match) return [];
    const parts = await lireParticipants(base, matchId);
    const dedans = new Set(parts.map((p) => p.playerId));
    const vivier = await lireVivier(base, match.clubId);
    return vivier
      .filter((p) => !dedans.has(p.id) && !p.isArchived)
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /// Annule le dernier but d'un joueur (geste rapide « − » sur sa tuile).
  async function undoLastGoalOf(
    matchId: string,
    playerId: string,
  ): Promise<string | null> {
    const last = await lireDernierBut(base, matchId, playerId);
    if (!last) return null;
    const ok = await removeEvent(matchId, last.id);
    return ok ? last.id : null;
  }

  async function finishMatch(
    matchId: string,
    mvpId: string | null,
    durationMin?: number | null,
  ): Promise<void> {
    await base.transaction(async (b) => {
      const match = await lireMatch(b, matchId);
      if (!match) throw new Error("Match introuvable");
      await majFinDeMatch(b, matchId, mvpId);
      await enqueue(b, {
        kind: "finishMatch",
        clubId: match.clubId,
        matchId,
        payload: { mvpId, durationMin: durationMin ?? null },
      });
    });
  }

  // --- Sélecteurs ----------------------------------------------------------

  /// La feuille de match complète, telle que l'écran « jouer » la consomme :
  /// le match, les deux camps avec leurs compteurs, la chronologie nommée.
  ///
  /// **Hors transaction, comme côté web.** La tentation était d'envelopper les
  /// trois lectures pour qu'elles voient le même instant ; ce serait un
  /// `BEGIN IMMEDIATE`, donc un verrou d'ÉCRITURE pris à chaque re-rendu de
  /// l'écran de match — le drain de l'outbox attendrait derrière chaque
  /// affichage. Le web lisait déjà en `Promise.all` sans transaction : un
  /// affichage peut être en retard d'un but, il ne peut pas être faux, et
  /// l'écriture suivante rafraîchit tout.
  async function getLocalMatch(matchId: string) {
    const match = await lireMatch(base, matchId);
    if (!match) return null;
    const [parts, events] = await Promise.all([
      lireParticipants(base, matchId),
      lireEvenements(base, matchId),
    ]);

    const tally = new Map<
      string,
      { goals: number; assists: number; yellow: number; red: number }
    >();
    const bump = (
      id: string | null | undefined,
      key: "goals" | "assists" | "yellow" | "red",
    ) => {
      if (!id) return;
      const t = tally.get(id) ?? { goals: 0, assists: 0, yellow: 0, red: 0 };
      t[key]++;
      tally.set(id, t);
    };
    for (const e of events) {
      if (e.type === "GOAL") bump(e.playerId, "goals");
      if (e.type === "GOAL") bump(e.assistPlayerId, "assists");
      if (e.type === "YELLOW_CARD") bump(e.playerId, "yellow");
      if (e.type === "RED_CARD") bump(e.playerId, "red");
    }

    const ids = Array.from(new Set(parts.map((p) => p.playerId)));
    const rosterById = await lireJoueurs(base, ids);

    const toLive = (team: "A" | "B"): LivePlayer[] =>
      parts
        .filter((p) => p.team === team)
        .map((p) => {
          const t = tally.get(p.playerId);
          return {
            id: p.playerId,
            name: rosterById.get(p.playerId)?.name ?? "?",
            photo: rosterById.get(p.playerId)?.photo ?? null,
            goals: t?.goals ?? 0,
            assists: t?.assists ?? 0,
            yellow: t?.yellow ?? 0,
            red: t?.red ?? 0,
            isGk: p.isGk,
          };
        });

    const enrichedEvents = events.map((e) => ({
      ...e,
      playerName: e.playerId ? (rosterById.get(e.playerId)?.name ?? "?") : null,
      assistName: e.assistPlayerId
        ? (rosterById.get(e.assistPlayerId)?.name ?? null)
        : null,
    }));

    return {
      match: match satisfies LocalMatch,
      teamA: toLive("A"),
      teamB: toLive("B"),
      events: enrichedEvents,
    };
  }

  return {
    saveRoster,
    addLocalGuest,
    saveClubSettings,
    getLocalClub,
    getLocalClubBySlug,
    getLiveMatchOfClub,
    pendingOpsForMatch,
    createMatch,
    launchScheduledMatch,
    addEvent,
    removeEvent,
    setEventAssist,
    setEventScorer,
    movePlayerTeam,
    ajouterJoueurAuMatch,
    joueursAbsentsDuMatch,
    undoLastGoalOf,
    finishMatch,
    getLocalMatch,
  };
}
