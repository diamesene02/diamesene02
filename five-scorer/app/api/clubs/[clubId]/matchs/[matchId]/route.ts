import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { lettre, ini } from "@/lib/ini";
import { estRetro } from "@/lib/retro";
import { heure, jourAbrege, jourMoisLong } from "@/lib/dates";

export const dynamic = "force-dynamic";

/// La fiche d'un match — le récap.
///
/// Tout arrive groupé, trié et formaté dans le fuseau du club. Le téléphone
/// ne recalcule rien : il dessine.
///
/// Les statistiques sont déjà filtrées par les réglages : ce que le club ne
/// compte pas n'arrive pas. Mieux vaut une carte plus courte qu'une ligne
/// « 0 passe décisive » sur un club qui ne les suit pas.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string; matchId: string }> },
) {
  const { clubId, matchId } = await params;
  const ctx = await getClubApiContext(clubId);
  if (!ctx) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const m = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: {
      id: true,
      status: true,
      kind: true,
      playedAt: true,
      seasonId: true,
      teamAName: true,
      teamBName: true,
      scoreA: true,
      scoreB: true,
      durationMin: true,
      opponent: { select: { name: true } },
      season: { select: { id: true, name: true } },
      matchDay: { select: { id: true, date: true, title: true } },
      mvp: { select: { id: true, name: true, photo: true } },
      participants: {
        select: {
          team: true,
          isGk: true,
          player: { select: { id: true, name: true, photo: true } },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          team: true,
          minute: true,
          createdAt: true,
          player: { select: { id: true, name: true } },
          assistPlayer: { select: { name: true } },
        },
      },
      motmVotes: { select: { playerId: true, voterId: true } },
    },
  });
  if (!m) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const nomA = m.teamAName;
  const nomB = m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;

  const buts = m.events.filter((e) => e.type === "GOAL" || e.type === "OWN_GOAL");

  /// Les buteurs d'un camp, groupés avec leurs minutes : « Bilal 2′, 5′ ».
  const buteursDe = (camp: "A" | "B") => {
    const par = new Map<string, (number | null)[]>();
    for (const e of buts) {
      if (e.team !== camp) continue;
      const nom = e.player
        ? e.type === "OWN_GOAL"
          ? `${e.player.name} (csc)`
          : e.player.name
        : e.type === "OWN_GOAL"
          ? `csc de ${camp === "A" ? nomB : nomA}`
          : "?";
      par.set(nom, [...(par.get(nom) ?? []), e.minute]);
    }
    return [...par].map(([nom, minutes]) => ({ nom, minutes }));
  };

  // Le bilan entre les deux chasubles sur la saison : « 2-2-2 ».
  let bilanA: string | null = null;
  let bilanB: string | null = null;
  if (m.kind === "INTERNAL" && m.seasonId) {
    const saison = await prisma.match.findMany({
      where: { clubId, seasonId: m.seasonId, kind: "INTERNAL", status: "FINISHED" },
      select: { scoreA: true, scoreB: true },
    });
    let v = 0;
    let n = 0;
    let d = 0;
    for (const x of saison) {
      if (x.scoreA > x.scoreB) v++;
      else if (x.scoreB > x.scoreA) d++;
      else n++;
    }
    bilanA = `${v}-${n}-${d}`;
    bilanB = `${d}-${n}-${v}`;
  }

  const compte = (t: string, camp: "A" | "B") =>
    m.events.filter((e) => e.type === t && e.team === camp).length;

  const statistiques: { libelle: string; a: number; b: number; accent?: "or" }[] = [
    { libelle: "Buts", a: m.scoreA, b: m.scoreB },
  ];
  if (ctx.club.trackAssists) {
    const passes = (camp: "A" | "B") =>
      m.events.filter((e) => e.team === camp && e.type === "GOAL" && e.assistPlayer).length;
    statistiques.push({ libelle: "Passes décisives", a: passes("A"), b: passes("B") });
  }
  statistiques.push({ libelle: "Contre son camp", a: compte("OWN_GOAL", "A"), b: compte("OWN_GOAL", "B") });
  if (ctx.club.trackCards) {
    statistiques.push({
      libelle: "Cartons jaunes",
      a: compte("YELLOW_CARD", "A"),
      b: compte("YELLOW_CARD", "B"),
      accent: "or",
    });
    statistiques.push({
      libelle: "Cartons rouges",
      a: compte("RED_CARD", "A"),
      b: compte("RED_CARD", "B"),
      accent: "or",
    });
  }

  // La chronologie, du plus récent au plus ancien, avec le score courant.
  let ca = 0;
  let cb = 0;
  const chronologie = buts
    .map((e) => {
      if (e.team === "A") ca++;
      else cb++;
      return {
        id: e.id,
        minute: e.minute,
        camp: e.team as "A" | "B",
        nom: e.player
          ? e.type === "OWN_GOAL"
            ? `${e.player.name} (csc)`
            : e.player.name
          : e.type === "OWN_GOAL"
            ? `csc de ${e.team === "A" ? nomB : nomA}`
            : "?",
        passeur: ctx.club.trackAssists ? (e.assistPlayer?.name ?? null) : null,
        scoreA: ca,
        scoreB: cb,
      };
    })
    .reverse();

  const butsDe = new Map<string, number>();
  for (const e of buts) {
    if (e.type === "GOAL" && e.player) {
      butsDe.set(e.player.id, (butsDe.get(e.player.id) ?? 0) + 1);
    }
  }

  const effectifs = (["A", "B"] as const).map((camp) => ({
    camp,
    joueurs: m.participants
      .filter((p) => p.team === camp)
      .map((p) => ({
        playerId: p.player.id,
        nom: p.player.name,
        initiales: ini(p.player.name),
        photo: p.player.photo,
        buts: butsDe.get(p.player.id) ?? 0,
        // Le gardien DU MATCH, pas celui du club : on tourne dans les cages.
        gardien: p.isGk,
      }))
      .sort((x, y) => Number(y.gardien) - Number(x.gardien) || y.buts - x.buts || x.nom.localeCompare(y.nom)),
  }));

  const voix = new Map<string, number>();
  for (const v of m.motmVotes) voix.set(v.playerId, (voix.get(v.playerId) ?? 0) + 1);
  const campDe = new Map(m.participants.map((p) => [p.player.id, p.team as "A" | "B"]));

  return NextResponse.json({
    id: m.id,
    statut:
      m.status === "SCHEDULED"
        ? "PROGRAMME"
        : m.status === "CANCELED"
          ? "ANNULE"
          : m.status === "LIVE"
            ? "EN_DIRECT"
            : "TERMINE",
    retro: estRetro(m.playedAt),

    contexte: m.matchDay ? `Soirée du ${jourMoisLong(m.matchDay.date)}` : null,
    dateCourte: jourMoisLong(m.playedAt),
    dateLongue: jourAbrege(m.playedAt),
    heure: heure(m.playedAt),
    joueLe: m.playedAt.toISOString(),
    soireeId: m.matchDay?.id ?? null,
    saison: m.season ? { id: m.season.id, nom: m.season.name } : null,
    dureeMin: m.durationMin,

    scoreA: m.scoreA,
    scoreB: m.scoreB,
    camps: [
      { camp: "A" as const, nom: nomA, lettre: lettre(nomA), bilan: bilanA, buteurs: buteursDe("A") },
      { camp: "B" as const, nom: nomB, lettre: lettre(nomB), bilan: bilanB, buteurs: buteursDe("B") },
    ],
    chasubles: { a: ctx.club.colorA, b: ctx.club.colorB },

    statistiques,
    chronologie,
    effectifs,

    homme: m.mvp
      ? {
          playerId: m.mvp.id,
          nom: m.mvp.name,
          photo: m.mvp.photo,
          camp: campDe.get(m.mvp.id) ?? null,
          buts: butsDe.get(m.mvp.id) ?? 0,
          votes: m.motmVotes.length
            ? { pour: voix.get(m.mvp.id) ?? 0, total: m.motmVotes.length }
            : null,
        }
      : null,

    vote:
      ctx.club.motmMode === "VOTE" && m.status === "FINISHED"
        ? {
            monVote:
              m.motmVotes.find((v) => v.voterId === ctx.user.id)?.playerId ?? null,
            candidats: m.participants
              .map((p) => ({
                playerId: p.player.id,
                nom: p.player.name,
                photo: p.player.photo,
                voix: voix.get(p.player.id) ?? 0,
              }))
              .sort((x, y) => y.voix - x.voix || x.nom.localeCompare(y.nom)),
          }
        : null,

    droits: { peutSaisir: ctx.canScore, peutGerer: ctx.canManage },
  });
}
