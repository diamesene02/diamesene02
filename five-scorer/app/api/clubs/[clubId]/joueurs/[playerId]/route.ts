import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { getGardiens, getPlayerDetail, getTropheesJoueur } from "@/lib/stats";
import { trierParPoints } from "@/lib/classement";
import { nomsChasubles } from "@/lib/color";
import { ini } from "@/lib/ini";
import { idsValides } from "@/lib/ids";
import { sanitize, type PlayerInput } from "@/lib/roster-serveur";
import { jourCourt } from "@/lib/dates";

export const dynamic = "force-dynamic";

/// La carte d'identité d'un joueur.
///
/// Tout arrive fait : le sous-titre assemblé, les libellés, les chiffres. Un
/// 404 aussi bien pour un club qu'on ne connaît pas que pour un joueur qui
/// n'y appartient pas — répondre « interdit » confirmerait une devinette.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  const { clubId, playerId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const detail = await getPlayerDetail(clubId, playerId);
  if (!detail) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const saison = await prisma.season.findFirst({
    where: { clubId, isActive: true },
    select: { id: true },
  });

  const [participations, gardiens, trophees, classement] = await Promise.all([
    // La chasuble habituelle : la majorité de ses apparitions cette saison.
    prisma.matchParticipant.findMany({
      where: {
        playerId,
        match: { clubId, status: "FINISHED", seasonId: saison?.id ?? undefined },
      },
      select: { initialTeam: true },
    }),
    // Toutes saisons, comme le reste de la fiche : le bilan, les paliers et
    // les trophées sont des carrières. Le limiter à la saison en cours faisait
    // disparaître la carte « Dans les buts » d'un gardien qui n'a pas encore
    // gardé depuis septembre.
    getGardiens({ clubId }),
    getTropheesJoueur(clubId, playerId),
    // Le rang au tableau, dans l'ordre du tableau — pas celui des buteurs.
    (async () => {
      const { getLeaderboard } = await import("@/lib/stats");
      return getLeaderboard({ clubId, seasonId: saison?.id ?? null });
    })(),
  ]);

  const a = participations.filter((p) => p.initialTeam === "A").length;
  const b = participations.filter((p) => p.initialTeam === "B").length;
  // Égalité → « A », comme le web : il faut bien trancher, et l'écusson doit
  // avoir une couleur.
  const camp = participations.length === 0 ? null : b > a ? "B" : "A";

  const noms = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  // « 2e du tableau » veut dire deuxième AU TABLEAU — celui que l'app affiche,
  // trié aux points. `getLeaderboard` rend l'ordre des buteurs ; s'en servir
  // ici donnait un rang que la page du classement contredisait deux écrans
  // plus loin. Et on ne compte que ceux qui ont joué : un inscrit qui n'est
  // jamais venu ne fait reculer personne.
  const rang =
    trierParPoints(
      classement.filter((r) => r.matchesPlayed > 0),
      ctx.club.pointsWin,
      ctx.club.pointsDraw,
    ).findIndex((r) => r.playerId === playerId) + 1;

  const p = detail.player;
  const sousTitre = [
    camp ? (camp === "A" ? noms.a : noms.b) : null,
    `Niveau ${p.skill}`,
    p.isGk ? "gardien" : null,
    p.isGuest ? "invité" : null,
    rang > 0 ? `${rang}${rang === 1 ? "er" : "e"} du tableau` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const gk = gardiens.find((g) => g.playerId === playerId) ?? null;

  return NextResponse.json({
    joueur: {
      id: p.id,
      nom: p.name,
      surnom: p.nickname,
      photo: p.photo,
      initiales: ini(p.name),
      niveau: p.skill,
      estGardien: p.isGk,
      estInvite: p.isGuest,
      abonne: p.abonne,
      estMoi: p.userId === ctx.user.id,
      camp,
      badge: p.isGk ? "G" : String(p.skill),
      sousTitre,
      couleur: camp === "B" ? ctx.club.colorB : ctx.club.colorA,
    },
    chasubles: { a: ctx.club.colorA, b: ctx.club.colorB },
    passesSuivies: ctx.club.trackAssists,
    droits: {
      peutModifier: ctx.canManage,
      peutReglerAbonnement: ctx.canManage || p.userId === ctx.user.id,
    },
    bilan:
      detail.allTime && detail.allTime.matchesPlayed > 0
        ? {
            matchs: detail.allTime.matchesPlayed,
            buts: detail.allTime.goals,
            passes: detail.allTime.assists,
            hommeDuMatch: detail.allTime.mvpCount,
            pctVictoires: detail.allTime.winPct,
            victoires: detail.allTime.wins,
            nuls: detail.allTime.draws,
            defaites: detail.allTime.losses,
            butsParMatch: detail.allTime.goalsPerMatch,
            // `getLeaderboard` rend la forme la plus RÉCENTE en premier ; on
            // la retourne pour la lire de gauche à droite, la dernière à
            // droite — c'est de là que part la série, et c'est ce que fait la
            // page des stats. La fiche du site, elle, l'affichait à l'envers.
            forme: [...detail.allTime.form].reverse(),
            serie: detail.allTime.streak,
            elo: detail.allTime.elo,
            eloTendance: detail.allTime.eloTrend,
          }
        : null,
    gardien: gk
      ? {
          matchs: gk.matchs,
          butsEncaisses: gk.encaisses,
          moyenne: gk.moyenne,
          cleanSheets: gk.cleanSheets,
          pctVictoires: gk.pctVictoires,
        }
      : null,
    paliers: trophees.paliers.map((p) => ({
      cle: p.cle,
      titre: p.titre,
      actuel: p.actuel,
      objectif: p.objectif,
      // Le texte est assemblé ici pour que « encore 3 buts » et « encore 1
      // but » sortent pareil des deux côtés : le pluriel est une règle du
      // club, pas une affaire d'écran.
      reste: p.objectif - p.actuel,
      libelle: `encore ${p.objectif - p.actuel} ${
        p.objectif - p.actuel > 1 ? p.nom : p.nomSingulier
      } pour ${p.objectif}`,
      part: Math.min(1, p.actuel / p.objectif),
    })),
    trophees: trophees.obtenus.map((t) => ({
      cle: t.cle,
      nom: t.nom,
      detail: t.detail,
      quand: t.date ? jourCourt(t.date) : null,
    })),
    parSaison: detail.bySeason.map((s) => ({
      saisonId: s.seasonId,
      saison: s.seasonName,
      matchs: s.row.matchesPlayed,
      buts: s.row.goals,
      victoires: s.row.wins,
      pctVictoires: s.row.winPct,
    })),
    // La ligne d'un dernier match arrive prête à peindre : la date courte, les
    // deux moitiés du libellé et les deux scores séparés. L'app n'a pas à
    // découper « Blanc vs Noir » ni « 3-2 » — c'est le genre de calcul qui
    // finit par diverger d'un écran à l'autre.
    derniersMatchs: detail.recentMatches.map((m) => {
      const [sa, sb] = m.score.split("-").map((n) => Number(n) || 0);
      const [gauche, droite] = m.label.includes(" vs ")
        ? m.label.split(" vs ")
        : [m.label, ""];
      return {
        id: m.id,
        date: jourCourt(new Date(m.playedAt)),
        gauche,
        droite,
        scoreA: sa,
        scoreB: sb,
        resultat: m.result,
        buts: m.goals,
        homme: m.wasMvp,
      };
    }),
  });
}

/// Modifier une fiche, ou l'archiver.
///
/// Archiver n'est PAS supprimer : le joueur sort de la liste de ceux qui
/// viennent lundi, ses matchs, ses buts et ses votes restent au club. Rien
/// dans l'app ne supprime un joueur — un classement de saison ne doit pas se
/// réécrire parce que quelqu'un a déménagé.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clubId: string; playerId: string }> },
) {
  const { clubId, playerId } = await params;
  if (!idsValides(playerId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!ctx.canManage) {
    return NextResponse.json({ error: "Réservé aux admins." }, { status: 403 });
  }

  const corps = (await req.json().catch(() => null)) as
    | (PlayerInput & { archive?: unknown })
    | null;
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const joueur = await prisma.player.findFirst({
    where: { id: playerId, clubId },
    select: { id: true },
  });
  if (!joueur) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });

  const { archive, ...fiche } = corps;
  const data = sanitize(fiche);
  // Un nom vide passerait inaperçu : `sanitize` le laisse tomber, et la fiche
  // garderait l'ancien. Ce n'est pas ce qu'on a tapé.
  if (fiche.name !== undefined && !data.name) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }
  const photoRefusee = fiche.photo != null && data.photo == null;

  await prisma.player.update({
    where: { id: playerId },
    data: {
      ...data,
      ...(typeof archive === "boolean" ? { isArchived: archive } : null),
    },
  });

  return NextResponse.json({
    ok: true,
    ...(photoRefusee
      ? { avertissement: "La photo n'a pas pu être enregistrée : format ou taille refusés." }
      : null),
  });
}
