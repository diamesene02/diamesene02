import { prisma } from "@/lib/prisma";
import type { MatchKind, Prisma } from "@prisma/client";
import { cleJour, fenetreDuJour } from "./jour";

export { matchVerrouille } from "./matchStatus";

/// Au-delà de six semaines on se tait — le score, plus personne ne l'a en
/// tête. Posée une seule fois ici et appelée par les TROIS endroits qui
/// décident si une soirée jouée sans feuille est encore réclamée :
/// `app/api/clubs/[clubId]/saison/route.ts` (l'API que lit l'app),
/// `app/c/[slug]/saison/page.tsx` (le calendrier du site) et
/// `app/c/[slug]/page.tsx` (le bandeau de l'accueil). Sans ce partage,
/// la fenêtre se recopie et finit par diverger (article III).
///
/// Ce commentaire a dit « les deux endroits » du 16 au 18 septembre 2026,
/// alors que le bandeau de l'accueil recopiait `42 * 86_400_000` en dur — la
/// tâche 8 du lot 0001 avait rassemblé trois appelants et manqué le
/// quatrième. `/analyser` l'a trouvé le 17 ; le lot 0007 l'a rapatrié.
export const SIX_SEMAINES_MS = 42 * 86400_000;

export function rattrapable(dateMs: number, maintenant: number): boolean {
  return maintenant - dateMs < SIX_SEMAINES_MS;
}

// La feuille d'un match, c'est MatchParticipant — pas "être du club" (spec
// 0001, Q6). Trois portes du serveur (buteur/passeur d'un événement, homme
// du match) vérifiaient seulement l'appartenance au club, jamais que le
// joueur avait vraiment participé à CE match précis : un membre pouvait donc
// créditer un but, une passe ou un MVP à quiconque du club, même absent de
// la soirée. Les deux fonctions ci-dessous portent cette vérification, pour
// qu'elle vive à un seul endroit plutôt que dupliquée dans chaque route.

/// Vérifie que les joueurs référencés par un événement (buteur, passeur, ou
/// auteur d'un contre son camp) sont recevables sur CE match : toujours dans
/// le club, et — seulement si le match est INTERNAL — bien sur SA feuille.
///
/// Sur un match EXTERNAL, la compo n'est pas toujours saisie (match amical) :
/// la couche locale (lib/localMatch.ts, addEvent) n'exige la feuille que pour
/// un INTERNAL. Le serveur ne doit pas devenir plus strict qu'elle, sous
/// peine de rejeter à la synchronisation des écritures déjà acceptées hors
/// ligne.
export async function joueursValidesPourEvenement(
  matchId: string,
  clubId: string,
  matchKind: MatchKind,
  playerIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = [...new Set(playerIds)];
  if (ids.length === 0) return { ok: true };

  const owned = await prisma.player.count({
    where: { id: { in: ids }, clubId },
  });
  if (owned !== ids.length) {
    return { ok: false, error: "Joueur hors du club" };
  }

  if (matchKind === "INTERNAL") {
    const surFeuille = await prisma.matchParticipant.count({
      where: { matchId, playerId: { in: ids } },
    });
    if (surFeuille !== ids.length) {
      return { ok: false, error: "Joueur hors de la feuille de ce match" };
    }
  }

  return { ok: true };
}

/// Une soirée (MatchDay) ne se rattache qu'à un match du MÊME club — sinon un
/// membre pourrait rattacher son match au calendrier d'un autre club (spec
/// 0001, APRES-15/APRES-D3 : `matchDayId` ne s'écrivait qu'à la création,
/// jamais après coup ; ce garde accompagne l'ouverture de cette écriture dans
/// updateMatchDetails).
export async function matchDayAppartientAuClub(
  matchDayId: string,
  clubId: string,
): Promise<boolean> {
  const count = await prisma.matchDay.count({
    where: { id: matchDayId, clubId },
  });
  return count > 0;
}

/// Le client global ou une transaction en cours. Le POST des matchs travaille
/// dans un `$transaction`, et une règle qui ne saurait pas y entrer se ferait
/// doubler par sa propre écriture : elle lirait les soirées hors de la
/// transaction qui est en train d'écrire le match.
///
/// `Prisma.TransactionClient` est un `Omit` du client complet — le client
/// global lui est donc assignable, et les deux appelants passent sans cast.
type LecteurSoirees = Pick<Prisma.TransactionClient, "matchDay">;

/// **La règle du lot 0007 : un match rejoint la soirée de son jour.**
///
/// Rend l'identifiant de la soirée à laquelle un match joué à `quand`
/// appartient, ou `null` s'il n'y en a pas — et `null` n'est pas un échec,
/// c'est une réponse : un match du dimanche n'a pas de lundi à rejoindre, et
/// il a raison de rester isolé.
///
/// Trois décisions, toutes prises dans `spec.md` :
///
/// - **Le jour, pas une fenêtre glissante.** Le produit a déjà essayé les
///   douze heures glissantes : le mardi à 7 h, la soirée du lundi
///   s'affichait encore comme la prochaine et le match du jour venait s'y
///   rattacher. La fenêtre est celle de `fenetreDuJour` — la même que celle
///   que les écrans utilisent pour chercher un orphelin, sans quoi un match
///   de 23:50 laisserait sa soirée réclamée à jamais.
/// - **Une soirée annulée ne prend pas de match.** C'est ce que le site fait
///   déjà partout où il cherche une soirée ; la règle le fait explicitement,
///   parce que la route qui sert l'accueil de l'app, elle, ne filtre pas.
/// - **Deux soirées le même jour → `null`.** Rien en base ne l'interdit
///   (aucune contrainte d'unicité sur club + date) ; une règle qui choisirait
///   au hasard entre deux soirées serait pire que pas de règle. Le match
///   reste isolé, et les écrans proposeront de le ranger.
///
/// Ce que cette fonction ne fait PAS : décider si on a le droit d'écrire.
/// Elle répond à une question de calendrier, rien d'autre.
export async function soireeDuJour(
  db: LecteurSoirees,
  clubId: string,
  quand: Date,
): Promise<string | null> {
  const { debut, fin } = fenetreDuJour(quand);
  const soirees = await db.matchDay.findMany({
    where: { clubId, canceledAt: null, date: { gte: debut, lt: fin } },
    select: { id: true },
    take: 2,
  });
  return soirees.length === 1 ? soirees[0].id : null;
}

/// Ce qu'un écran doit proposer pour une soirée passée qui n'a pas de
/// résultat. Trois réponses, et une seule fabrique une feuille.
export type Reclamation =
  | { quoi: "rien" }
  | { quoi: "saisir" }
  | { quoi: "rattacher"; matchId: string };

/// Les matchs qui n'appartiennent à aucune soirée, rangés par jour du club.
///
/// **Une seule requête pour un calendrier entier** : les trois écrans qui
/// réclament affichent des dizaines de soirées, et poser la question une fois
/// par ligne coûterait autant de requêtes.
///
/// `LIVE` compte autant que `FINISHED` : une feuille restée ouverte n'est pas
/// « aucun match », c'est un match qu'on a oublié de siffler. L'ignorer
/// ferait proposer une seconde feuille par-dessus la première.
export async function orphelinsParJour(
  db: Pick<Prisma.TransactionClient, "match">,
  clubId: string,
  bornes: { debut: Date; fin: Date },
): Promise<Map<string, string>> {
  const matchs = await db.match.findMany({
    where: {
      clubId,
      matchDayId: null,
      status: { in: ["LIVE", "FINISHED"] },
      playedAt: { gte: bornes.debut, lt: bornes.fin },
    },
    select: { id: true, playedAt: true },
    orderBy: { playedAt: "asc" },
  });
  const parJour = new Map<string, string>();
  // Le premier du jour suffit : l'écran propose de ranger la soirée, pas de
  // faire l'inventaire. Ranger le premier fait disparaître la réclamation, et
  // le suivant se voit au tour d'après.
  for (const m of matchs) {
    const cle = cleJour(m.playedAt);
    if (!parJour.has(cle)) parJour.set(cle, m.id);
  }
  return parJour;
}

/// **Ce qu'un écran doit dire d'une soirée passée** — la question unique qui
/// remplace les trois versions divergentes du calendrier de l'app, du
/// calendrier du site et du bandeau de l'accueil.
///
/// L'ordre des refus compte :
///
/// 1. une soirée **annulée** ne réclame rien — elle n'a pas eu lieu ;
/// 2. une soirée qui a **déjà un match** (ouvert ou terminé) n'a rien à
///    réclamer. C'est ce qui garde « On rejoue » possible : la question n'est
///    pas « cette soirée a-t-elle un résultat ? » mais « y a-t-il quelque
///    chose à ranger ? » — le deuxième match d'un lundi n'est pas un doublon ;
/// 3. au-delà de **six semaines** on se tait (`rattrapable`) — le score, plus
///    personne ne l'a en tête ;
/// 4. s'il existe un match **de ce jour-là sans soirée**, on propose de le
///    RATTACHER. Jamais une feuille vierge : elle fabriquerait un doublon, et
///    le vrai match, lui, est déjà là ;
/// 5. sinon seulement, on propose de saisir.
///
/// `orphelins` vient de `orphelinsParJour`, qui utilise la même
/// `fenetreDuJour` que `soireeDuJour`. C'est ce qui garantit que la règle et
/// la question regardent la même fenêtre : sans ça, un match joué à 23:50 et
/// daté du mardi laisserait la soirée du lundi réclamée pour toujours.
export function soireeReclame(
  soiree: { date: Date; canceledAt: Date | null; matchsActifs: number },
  orphelins: Map<string, string>,
  maintenant: number,
): Reclamation {
  if (soiree.canceledAt) return { quoi: "rien" };
  if (soiree.matchsActifs > 0) return { quoi: "rien" };
  if (!rattrapable(soiree.date.getTime(), maintenant)) return { quoi: "rien" };
  const orphelin = orphelins.get(cleJour(soiree.date));
  return orphelin ? { quoi: "rattacher", matchId: orphelin } : { quoi: "saisir" };
}

/// Longueur maximale d'un nom d'équipe saisi par un membre (APRES-21) — posée
/// une seule fois ici et appelée par les TROIS endroits qui écrivent un nom
/// d'équipe : `scheduleMatch` (app/actions/schedule.ts, à la création),
/// `updateMatchDetails` (app/actions/matches.ts, à la correction depuis le
/// site) et le PATCH de `matches/[matchId]/route.ts` (à la correction depuis
/// l'app). Sans ce partage, la limite se pose une troisième fois par
/// copier-coller et finit par diverger — exactement le risque que
/// plan.md avait signalé.
export const NOM_EQUIPE_MAX = 40;

/// `undefined` pour "rien à écrire" (vide/absent), sinon la valeur coupée à
/// NOM_EQUIPE_MAX après trim.
export function nomEquipeTronque(
  nom: string | null | undefined,
): string | undefined {
  const t = nom?.trim();
  return t ? t.slice(0, NOM_EQUIPE_MAX) : undefined;
}

/// L'homme du match est toujours l'un de nos joueurs, désigné après coup :
/// contrairement au but/passe ci-dessus, aucune exception EXTERNAL de ce
/// genre n'existe côté client pour lui — la feuille se vérifie dans tous les
/// cas, INTERNAL ou EXTERNAL.
export async function joueurSurLaFeuille(
  matchId: string,
  playerId: string,
): Promise<boolean> {
  const count = await prisma.matchParticipant.count({
    where: { matchId, playerId },
  });
  return count > 0;
}

// Annuler ou effacer, en un seul geste — décidé par ce qu'il y a à perdre,
// pas par le statut du match (spec 0006).
//
// La spec 0001 disait déjà « rien dans l'app ne supprime ». Le site ne
// tenait pas cette promesse : « Supprimer » effaçait tout match terminé ou
// annulé, sans trace, sans corbeille (buts, compo, votes, convocations
// partaient avec).
//
// Le critère : un match sans participant, sans événement et sans réponse à
// une convocation n'a RIEN à perdre — le supprimer est sans effet secondaire,
// exactement l'article I au sens strict (rien n'a été saisi). Dès qu'il y a
// quelque chose, le geste devient une annulation : le match reste visible,
// marqué, et sort de tout calcul qui ne compte que les matchs FINISHED
// (classement, Élo, forme, records — vérifié : ils filtrent déjà
// positivement sur ce statut, aucun d'eux n'a besoin d'être touché).
//
// Appelé par l'action serveur du site ET par la route que l'app utilise :
// même fonction, mêmes deux issues, pour ne pas répéter cette logique deux
// fois et la voir diverger un jour.
export type ResultatRetrait =
  | { ok: true; geste: "supprime" }
  | { ok: true; geste: "annule" }
  | { ok: false; error: string };

export async function annulerOuSupprimerMatch(
  clubId: string,
  matchId: string,
  raison?: string,
): Promise<ResultatRetrait> {
  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: {
      id: true,
      status: true,
      _count: { select: { participants: true, events: true, rsvps: true } },
    },
  });
  if (!match) return { ok: false, error: "Match introuvable." };

  const rien =
    match._count.participants === 0 &&
    match._count.events === 0 &&
    match._count.rsvps === 0;

  if (rien) {
    // Rien à perdre : l'effacement reste ce qu'il est. `.catch` n'avale plus
    // l'échec (APRES-26) — un vrai refus doit se voir, pas une redirection
    // qui ment.
    try {
      await prisma.match.delete({ where: { id: matchId, clubId } });
    } catch {
      return { ok: false, error: "La suppression a échoué. Réessaie." };
    }
    return { ok: true, geste: "supprime" };
  }

  const cancelReason = raison?.trim()?.slice(0, 120) || null;
  try {
    await prisma.match.update({
      where: { id: matchId, clubId },
      data: { status: "CANCELED", canceledAt: new Date(), cancelReason },
    });
  } catch {
    return { ok: false, error: "L'annulation a échoué. Réessaie." };
  }
  return { ok: true, geste: "annule" };
}

// Rétablir, symétrique d'annuler (spec 0001, Q8 + critère d'acceptation :
// « un match annulé peut être rétabli, et revient dans les stats »).
//
// `lib/stats.ts` ne lit que les matchs FINISHED (loadFinishedMatches) : un
// retour à FINISHED suffit donc à remettre un match dans tous les chiffres
// du club, sans le moindre recalcul à écrire ici — la fonction n'a qu'à
// reposer le statut ET effacer les traces de l'annulation, sous peine de
// laisser un match FINISHED avec un canceledAt non nul (une incohérence
// pire que l'absence de la fonctionnalité).
export async function retablirMatch(
  clubId: string,
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const match = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: { id: true, status: true },
  });
  if (!match) return { ok: false, error: "Match introuvable." };

  if (match.status !== "CANCELED") {
    return { ok: false, error: "Ce match n'est pas annulé." };
  }

  try {
    await prisma.match.update({
      where: { id: matchId },
      data: { status: "FINISHED", canceledAt: null, cancelReason: null },
    });
  } catch {
    return { ok: false, error: "Le rétablissement a échoué. Réessaie." };
  }
  return { ok: true };
}
