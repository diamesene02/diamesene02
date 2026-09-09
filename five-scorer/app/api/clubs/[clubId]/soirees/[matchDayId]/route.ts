import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { calculerPresences, phraseEtat } from "@/lib/presences";
import { getLeaderboard } from "@/lib/stats";
import { points, trierParPoints } from "@/lib/classement";
import { buteursDuCamp, motDeLaSoiree } from "@/lib/soiree";
import { nomsChasubles } from "@/lib/color";
import { lettre } from "@/lib/ini";
import { heure, jourLong, minuit } from "@/lib/dates";

export const dynamic = "force-dynamic";

/// La fiche d'une soirée — l'écran-pivot du lundi.
///
/// Avant : qui vient, quelles équipes, qui a payé le terrain. Après : le
/// bilan, le mot à coller dans le groupe, les matchs, les cracks du soir.
///
/// Tout arrive fait : les libellés, les comptes, les listes de buteurs, le
/// mot. `lib/dates.ts` est réservé au serveur, et l'`Intl` d'un Android
/// d'entrée de gamme n'est pas fiable en français — l'app ne doit rien avoir
/// à formater.
///
/// Aucun calcul n'est refait : `calculerPresences`, `phraseEtat`,
/// `getLeaderboard`, `trierParPoints`, `motDeLaSoiree` et `nomsChasubles`
/// sont ceux du site.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string; matchDayId: string }> },
) {
  const { clubId, matchDayId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const md = await prisma.matchDay.findFirst({
    where: { id: matchDayId, clubId },
    select: {
      id: true,
      date: true,
      title: true,
      location: true,
      notes: true,
      canceledAt: true,
      createdAt: true,
      fieldCostCents: true,
      teamAName: true,
      teamBName: true,
      rsvps: { select: { playerId: true, status: true, respondedAt: true, hasPaid: true } },
      lineup: { select: { playerId: true, team: true } },
      matches: {
        orderBy: { playedAt: "asc" },
        select: {
          id: true,
          status: true,
          kind: true,
          playedAt: true,
          teamAName: true,
          teamBName: true,
          scoreA: true,
          scoreB: true,
          opponent: { select: { name: true } },
          events: {
            where: { type: { in: ["GOAL", "OWN_GOAL"] } },
            select: { team: true, type: true, player: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!md) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const [joueurs, monJoueur] = await Promise.all([
    prisma.player.findMany({
      where: { clubId, isArchived: false },
      select: { id: true, name: true, photo: true, skill: true, isGk: true, isGuest: true, abonne: true },
    }),
    prisma.player.findFirst({ where: { clubId, userId: ctx.user.id }, select: { id: true } }),
  ]);

  // --- Présences ------------------------------------------------------------
  const reponses = new Map(
    md.rsvps.map((r) => [r.playerId, { statut: r.status, le: r.respondedAt, paye: r.hasPaid }]),
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
    creeeLe: md.createdAt,
    minJoueurs: ctx.club.minJoueurs,
    capacite: ctx.club.capaciteSoiree,
    annulee: md.canceledAt != null,
  });

  const campDe = new Map(md.lineup.map((l) => [l.playerId, l.team as "A" | "B"]));
  const parId = new Map(joueurs.map((j) => [j.id, j]));

  const libelles: Record<string, { libelle: string; ton: string }> = {
    IN: { libelle: "Présent", ton: "in" },
    MAYBE: { libelle: "Peut-être", ton: "maybe" },
    OUT: { libelle: "Absent", ton: "out" },
  };

  const lignesPresence = joueurs
    .map((j) => {
      const ligne = presences.lignes.get(j.id);
      const statut = ligne?.statut ?? null;
      const enAttente = presences.attente.includes(j.id);
      const l = statut ? libelles[statut] : null;
      return {
        playerId: j.id,
        nom: j.name,
        photo: j.photo,
        moi: j.id === monJoueur?.id,
        statut,
        libelle: enAttente ? "En attente" : (l?.libelle ?? "—"),
        ton: enAttente ? "attente" : (l?.ton ?? "none"),
        viaAbonnement: ligne?.source === "abonnement",
        enAttente,
        camp: campDe.get(j.id) ?? null,
        titulaire: presences.titulaires.includes(j.id),
      };
    })
    // Moi d'abord, puis les titulaires, puis présents / peut-être / absents.
    .sort((x, y) => {
      const rang = (l: typeof x) =>
        l.moi ? 0 : l.titulaire ? 1 : l.statut === "IN" ? 2 : l.statut === "MAYBE" ? 3 : l.statut === "OUT" ? 4 : 5;
      return rang(x) - rang(y) || x.nom.localeCompare(y.nom);
    });

  // --- Le terrain -----------------------------------------------------------
  const euros = (c: number) =>
    (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace(".", ",")) + " €";
  const nbTitulaires = presences.titulaires.length;
  const prixCents = md.fieldCostCents ?? null;
  const partCents = prixCents && nbTitulaires > 0 ? Math.ceil(prixCents / nbTitulaires) : null;
  // Les titulaires seulement : un remplaçant ne paie pas sa place manquée.
  const payeurs = presences.titulaires.map((pid) => ({
    playerId: pid,
    nom: parId.get(pid)?.name ?? "?",
    aPaye: reponses.get(pid)?.paye ?? false,
  }));
  const encaisseCents = partCents ? payeurs.filter((p) => p.aPaye).length * partCents : 0;

  // --- Bilan et matchs ------------------------------------------------------
  const nomsClub = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  const nomA = md.teamAName ?? md.matches[0]?.teamAName ?? nomsClub.a;
  const nomB = md.teamBName ?? md.matches[0]?.teamBName ?? nomsClub.b;

  const internes = md.matches.filter((m) => m.kind === "INTERNAL");
  const termines = internes.filter((m) => m.status === "FINISHED");
  const enDirect = md.matches.filter((m) => m.status === "LIVE");

  let victoiresA = 0;
  let victoiresB = 0;
  let nuls = 0;
  for (const m of termines) {
    if (m.scoreA > m.scoreB) victoiresA++;
    else if (m.scoreB > m.scoreA) victoiresB++;
    else nuls++;
  }
  const buts = termines.reduce((n, m) => n + m.scoreA + m.scoreB, 0);

  const classementSoir =
    termines.length > 0
      ? (await getLeaderboard({ clubId, matchDayId })).filter((r) => r.matchesPlayed > 0)
      : [];
  const buteurDuSoir = [...classementSoir].filter((r) => r.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  const mvpDuSoir = [...classementSoir].filter((r) => r.mvpCount > 0).sort((a, b) => b.mvpCount - a.mvpCount)[0];

  const adverse = (m: (typeof md.matches)[number]) =>
    m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;

  const matchs = [...enDirect, ...md.matches.filter((m) => m.status !== "LIVE")].map((m) => {
    const bA = buteursDuCamp(m.events, "A");
    const bB = buteursDuCamp(m.events, "B");
    return {
      id: m.id,
      statut: m.status,
      direct: m.status === "LIVE",
      aVenir: m.status === "SCHEDULED",
      nomA: m.teamAName,
      nomB: adverse(m),
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      etat: m.status === "LIVE" ? "En direct" : m.status === "SCHEDULED" ? "À venir" : "Terminé",
      heure: heure(m.playedAt),
      buteursA: bA,
      buteursB: bB,
      pied: [bA, bB].filter(Boolean).join("  —  ") || null,
    };
  });

  const accorde = (n: number) => `match${n > 1 ? "s" : ""} gagné${n > 1 ? "s" : ""}`;

  return NextResponse.json({
    id: md.id,
    date: md.date.toISOString(),
    dateLabel: jourLong(md.date),
    heure: heure(md.date),
    lieu: md.location,
    libelle: md.title,
    notes: md.notes,
    sousTitre: [heure(md.date), md.location, md.title].filter(Boolean).join(" · "),

    annulee: md.canceledAt != null,
    passee: md.date.getTime() < minuit(new Date()),
    commencee: md.matches.length > 0,
    soireeFinie: enDirect.length === 0,
    peutGerer: ctx.canManage,
    peutScorer: ctx.canScore,

    chasubles: {
      a: { nom: nomA, lettre: lettre(nomA), couleur: ctx.club.colorA },
      b: { nom: nomB, lettre: lettre(nomB), couleur: ctx.club.colorB },
    },

    presences: {
      titre: monJoueur ? "Ma réponse" : "Présences",
      monPlayerId: monJoueur?.id ?? null,
      maReponse: monJoueur ? (reponses.get(monJoueur.id)?.statut ?? null) : null,
      compte: `${presences.titulaires.length} présent${presences.titulaires.length > 1 ? "s" : ""} · ${presences.absents.length} absent${presences.absents.length > 1 ? "s" : ""}`,
      phrase: phraseEtat(presences.etat),
      nbPresents: presences.titulaires.length,
      nbAttente: presences.attente.length,
      nbPeutEtre: presences.peutEtre.length,
      nbAbsents: presences.absents.length,
      lignes: lignesPresence,
    },

    compo: {
      faite: md.lineup.length > 0,
      nomA,
      nomB,
      joueurs: joueurs.map((j) => ({
        playerId: j.id,
        nom: j.name,
        photo: j.photo,
        niveau: j.skill,
        gardien: j.isGk,
        camp: campDe.get(j.id) ?? null,
      })),
    },

    terrain: {
      visible: ctx.canManage || prixCents != null,
      prixCents,
      prix: prixCents ? euros(prixCents) : null,
      partCents,
      part: partCents ? euros(partCents) : null,
      resume: prixCents && partCents ? `${euros(prixCents)} · ${euros(partCents)} chacun` : null,
      encaisseCents,
      encaisse: euros(encaisseCents),
      pourcentage: prixCents ? Math.min(100, Math.round((encaisseCents / prixCents) * 100)) : 0,
      payeurs,
    },

    bilan:
      termines.length > 0
        ? {
            enCours: enDirect.length > 0,
            victoiresA,
            victoiresB,
            nuls,
            uniteA: accorde(victoiresA),
            uniteB: accorde(victoiresB),
            resume: `${termines.length} match${termines.length > 1 ? "s" : ""} joué${termines.length > 1 ? "s" : ""} · ${nuls} nul${nuls > 1 ? "s" : ""} · ${buts} but${buts > 1 ? "s" : ""}`,
            buts,
            buteur: buteurDuSoir ? { nom: buteurDuSoir.name, buts: buteurDuSoir.goals } : null,
            mvp: mvpDuSoir ? { nom: mvpDuSoir.name } : null,
          }
        : null,

    mot: motDeLaSoiree({
      date: md.date,
      lieu: md.location,
      nomA,
      nomB,
      victoiresA,
      victoiresB,
      nuls,
      matchs: termines.map((m) => ({
        nomA: m.teamAName,
        nomB: adverse(m),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        buteursA: buteursDuCamp(m.events, "A"),
        buteursB: buteursDuCamp(m.events, "B"),
      })),
      buts,
      meilleurButeur: buteurDuSoir ? { nom: buteurDuSoir.name, buts: buteurDuSoir.goals } : null,
      hommeDuMatch: mvpDuSoir ? { nom: mvpDuSoir.name } : null,
    }),

    matchs,

    cracks: trierParPoints(classementSoir, ctx.club.pointsWin, ctx.club.pointsDraw)
      .slice(0, 10)
      .map((r, i) => ({
        rang: i + 1,
        playerId: r.playerId,
        nom: r.name,
        photo: r.photo,
        invite: r.isGuest,
        matchs: r.matchesPlayed,
        victoires: r.wins,
        nuls: r.draws,
        defaites: r.losses,
        buts: r.goals,
        points: points(r, ctx.club.pointsWin, ctx.club.pointsDraw),
      })),
  });
}
