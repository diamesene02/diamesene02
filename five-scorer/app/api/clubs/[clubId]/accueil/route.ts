import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";
import { calculerPresences, phraseEtat } from "@/lib/presences";
import { minuit } from "@/lib/dates";
import { points, trierParPoints } from "@/lib/classement";

export const dynamic = "force-dynamic";

/// Tout ce que l'accueil du club affiche, en un seul aller-retour.
///
/// La page web fait une quinzaine de requêtes en parallèle, ce qui est le bon
/// choix sur un serveur. Sur un téléphone au bord d'un terrain, chaque
/// aller-retour se paie en secondes et en batterie, et l'accueil est l'écran
/// qu'on ouvre le plus souvent. On rend donc les trois choses qui le
/// composent — la prochaine soirée, les matchs du jour, le classement — d'un
/// coup, dans la forme où l'app les affiche.
///
/// Les calculs ne sont pas refaits ici : `getLeaderboard` et
/// `calculerPresences` sont les mêmes fonctions que celles du site. Deux
/// implémentations du classement, ce serait deux classements.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const ctx = await getClubApiContext(clubId);
  // 404 plutôt que 403 : répondre « interdit » confirmerait l'existence du
  // club à qui devine un identifiant.
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const saison = await prisma.season.findFirst({
    where: { clubId, isActive: true },
    select: { id: true, name: true },
  });

  const [prochaine, matchsDuJour, classement, monJoueur] = await Promise.all([
    // La prochaine soirée, avec de quoi calculer les présences.
    prisma.matchDay.findFirst({
      where: { clubId, date: { gte: new Date(minuit(new Date())) } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        title: true,
        canceledAt: true,
        createdAt: true,
        rsvps: { select: { playerId: true, status: true, respondedAt: true } },
        lineup: { select: { playerId: true } },
      },
    }),
    // Les matchs du jour : c'est la soirée en cours, celle qu'on est en train
    // de jouer. Les matchs en direct passent devant, puis les plus récents.
    prisma.match.findMany({
      where: { clubId, playedAt: { gte: new Date(minuit(new Date())) } },
      orderBy: { playedAt: "desc" },
      take: 12,
      select: {
        id: true,
        playedAt: true,
        status: true,
        teamAName: true,
        teamBName: true,
        scoreA: true,
        scoreB: true,
        durationMin: true,
      },
    }),
    getLeaderboard({ clubId, seasonId: saison?.id ?? null }),
    prisma.player.findFirst({
      where: { clubId, userId: ctx.user.id },
      select: { id: true },
    }),
  ]);

  let soiree = null;
  if (prochaine) {
    // Les abonnés comptent présents sans avoir rien dit — c'est la règle du
    // club, et elle vit dans `lib/presences.ts`, pas ici.
    const joueurs = await prisma.player.findMany({
      where: { clubId, isArchived: false },
      select: { id: true, abonne: true },
    });
    const reponses = new Map(
      prochaine.rsvps.map((r) => [r.playerId, { statut: r.status, le: r.respondedAt }]),
    );
    const presences = calculerPresences({
      entrees: joueurs.map((j) => {
        const r = reponses.get(j.id);
        return {
          playerId: j.id,
          abonne: j.abonne,
          reponse: r?.statut ?? null,
          repondueLe: r?.le ?? null,
        };
      }),
      creeeLe: prochaine.createdAt,
      minJoueurs: ctx.club.minJoueurs,
      capacite: ctx.club.capaciteSoiree,
      annulee: prochaine.canceledAt != null,
    });
    soiree = {
      id: prochaine.id,
      date: prochaine.date.toISOString(),
      libelle: prochaine.title,
      annulee: prochaine.canceledAt != null,
      phrase: phraseEtat(presences.etat),
      presents: presences.titulaires.length,
      attente: presences.attente.length,
      // La compo préparée à l'avance. Le club décide ses équipes trois ou
      // quatre jours avant, sur WhatsApp : savoir si c'est fait est la
      // question qui déclenche l'alerte de l'accueil.
      compoFaite: prochaine.lineup.length > 0,
      maReponse: monJoueur ? (reponses.get(monJoueur.id)?.statut ?? null) : null,
    };
  }

  return NextResponse.json({
    saison: saison ? { id: saison.id, nom: saison.name } : null,
    soiree,
    matchs: matchsDuJour.map((m) => ({
      id: m.id,
      joueLe: m.playedAt.toISOString(),
      statut: m.status,
      nomA: m.teamAName,
      nomB: m.teamBName,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      dureeMin: m.durationMin,
    })),
    // `getLeaderboard` rend les lignes triées par buts — c'est l'ordre du
    // classement des buteurs, pas celui du tableau. Le tableau se trie aux
    // points, comme sur le site, avec le barème du club.
    classement: trierParPoints(
      classement,
      ctx.club.pointsWin,
      ctx.club.pointsDraw,
    ).map((r, i) => ({
      rang: i + 1,
      playerId: r.playerId,
      nom: r.name,
      photo: r.photo,
      matchs: r.matchesPlayed,
      victoires: r.wins,
      nuls: r.draws,
      defaites: r.losses,
      buts: r.goals,
      points: points(r, ctx.club.pointsWin, ctx.club.pointsDraw),
    })),
  });
}
