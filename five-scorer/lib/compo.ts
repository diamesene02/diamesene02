import { prisma } from "@/lib/prisma";
import { idsValides } from "@/lib/ids";

// L'écriture de la composition préparée d'une soirée, en UN seul endroit.
//
// Deux appelants : l'action serveur du site (`app/actions/compo.ts`, qui garde
// par `requireClub(slug)`) et la route que l'app appelle
// (`app/api/clubs/[clubId]/matchdays/[matchDayId]/lineup`, qui garde par
// `getClubApiContext(clubId)`). Les gardes diffèrent — pas les règles.
//
// Pourquoi ce fichier existe : si chacun refaisait ses vérifications, « un
// joueur ne peut pas être dans les deux camps » finirait par n'être vrai que
// d'un côté. Le dépôt a déjà payé ça ailleurs (l'idempotence est écrite
// différemment dans chacune des cinq routes d'écriture de match).

export type JoueurCompo = { playerId: string; team: "A" | "B"; isGk?: boolean };

export type EntreeCompo = {
  joueurs: JoueurCompo[];
  teamAName?: string;
  teamBName?: string;
};

export type ResultatCompo = { ok: true } | { ok: false; error: string };

// Le gardien du soir (qui a les gants ce lundi-là) : `estGardienDuSoir`,
// dans lib/gardien.ts. Il y vit seul pour rester importable depuis l'écran
// de compo, qui est un composant client et n'a rien à faire de Prisma.

/// Écrit la compo d'une soirée. **Remplace l'ensemble** : ce n'est pas une
/// modification partielle, c'est la liste entière qui vaut.
///
/// C'est ce qui rend le dernier-arrivé-gagne honnête quand deux téléphones
/// composent hors ligne (spec 0005) : il n'existe aucun état bâtard où la
/// moitié d'une compo se mélangerait à la moitié d'une autre.
///
/// Le droit d'écrire se vérifie AVANT, chez l'appelant. Ici on ne vérifie que
/// ce qui touche aux données : identifiants, camps, doublons, appartenance.
export async function ecrireCompo(
  clubId: string,
  matchDayId: string,
  input: EntreeCompo,
): Promise<ResultatCompo> {
  if (!idsValides(matchDayId)) {
    return { ok: false, error: "Identifiant invalide." };
  }

  const joueurs = input.joueurs ?? [];
  if (!idsValides(...joueurs.map((j) => j.playerId))) {
    return { ok: false, error: "Identifiant de joueur invalide." };
  }
  if (joueurs.some((j) => j.team !== "A" && j.team !== "B")) {
    return { ok: false, error: "Équipe invalide." };
  }
  const ids = joueurs.map((j) => j.playerId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Un joueur ne peut pas être dans les deux équipes." };
  }

  const soiree = await prisma.matchDay.findFirst({
    // Le clubId est DANS le filtre : une soirée d'un autre club doit être
    // introuvable, pas lue puis rejetée.
    where: { id: matchDayId, clubId },
    select: { id: true, canceledAt: true },
  });
  if (!soiree) return { ok: false, error: "Soirée introuvable." };
  if (soiree.canceledAt) {
    return { ok: false, error: "Cette soirée est annulée." };
  }

  // Tous les joueurs doivent appartenir au club — l'identifiant vient du client.
  if (ids.length > 0) {
    const aNous = await prisma.player.count({
      where: { id: { in: ids }, clubId },
    });
    if (aNous !== ids.length) {
      return { ok: false, error: "Joueur hors du club." };
    }
  }

  // 40 caractères, comme `scheduleMatch`. La longueur se pose ici pour tout le
  // monde : la poser dans chaque appelant, c'est la poser trois fois et se
  // tromper deux.
  const nom = (v: string | undefined) => {
    const t = v?.trim();
    return t && t.length > 0 ? t.slice(0, 40) : null;
  };

  await prisma.$transaction([
    prisma.matchDayLineup.deleteMany({ where: { matchDayId } }),
    prisma.matchDayLineup.createMany({
      data: joueurs.map((j) => ({
        matchDayId,
        playerId: j.playerId,
        team: j.team,
        isGk: Boolean(j.isGk),
      })),
    }),
    prisma.matchDay.update({
      where: { id: matchDayId },
      data: { teamAName: nom(input.teamAName), teamBName: nom(input.teamBName) },
    }),
  ]);

  return { ok: true };
}

export type ResultatReprise =
  | { ok: true; reprises: number }
  | { ok: false; status: number; error: string };

/// « Compo précédente » : reprend la composition de la dernière soirée déjà
/// préparée, comme point de départ. Les équipes tournent d'une semaine à
/// l'autre, mais on part rarement d'une page blanche.
///
/// La soirée précédente est la plus récente AVANT celle-ci qui a une compo,
/// les joueurs archivés depuis ne sont pas reconduits, et la reprise remplace
/// l'ensemble — noms d'équipes compris. Deux appelants : la route que l'app
/// appelle, et l'action serveur du site (`reprendreCompoPrecedente`,
/// app/actions/compo.ts), qui n'en garde que `requireClub` + `canScore` et la
/// revalidation.
///
/// Le droit d'écrire (`canScore`) se vérifie AVANT, chez l'appelant.
export async function reprendreCompo(
  clubId: string,
  matchDayId: string,
): Promise<ResultatReprise> {
  if (!idsValides(matchDayId)) {
    return { ok: false, status: 400, error: "Identifiant invalide." };
  }

  const soiree = await prisma.matchDay.findFirst({
    where: { id: matchDayId, clubId },
    select: { id: true, date: true, canceledAt: true },
  });
  if (!soiree) return { ok: false, status: 404, error: "Soirée introuvable." };
  // Le MÊME refus que `ecrireCompo`, avec les mêmes mots : deux portes vers
  // `matchDayLineup`, une seule règle. Un écran ouvert avant l'annulation
  // (ou un appel direct) écrivait encore la compo de la semaine d'avant sur
  // une soirée annulée, noms d'équipes compris.
  if (soiree.canceledAt) {
    return { ok: false, status: 409, error: "Cette soirée est annulée." };
  }

  const precedente = await prisma.matchDay.findFirst({
    where: {
      clubId,
      date: { lt: soiree.date },
      lineup: { some: {} },
      // Un lundi annulé n'a jamais eu lieu : sa compo n'est pas « la
      // précédente », même si elle avait été préparée avant l'annulation.
      canceledAt: null,
    },
    orderBy: { date: "desc" },
    select: {
      teamAName: true,
      teamBName: true,
      lineup: {
        select: { playerId: true, team: true, isGk: true },
        where: { player: { isArchived: false } },
      },
    },
  });
  if (!precedente || precedente.lineup.length === 0) {
    return { ok: false, status: 409, error: "Aucune compo précédente à reprendre." };
  }

  await prisma.$transaction([
    prisma.matchDayLineup.deleteMany({ where: { matchDayId } }),
    prisma.matchDayLineup.createMany({
      data: precedente.lineup.map((l) => ({ matchDayId, ...l })),
    }),
    prisma.matchDay.update({
      where: { id: matchDayId },
      data: {
        teamAName: precedente.teamAName,
        teamBName: precedente.teamBName,
      },
    }),
  ]);

  return { ok: true, reprises: precedente.lineup.length };
}
