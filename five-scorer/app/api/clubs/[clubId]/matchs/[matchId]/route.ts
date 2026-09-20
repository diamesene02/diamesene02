import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { lettre, ini } from "@/lib/ini";
import { estRetro } from "@/lib/retro";
import { estId } from "@/lib/ids";
import { soireeDuJour } from "@/lib/matches";
import { dateComplete, heure, jourAbrege, jourCourt, jourLong, memeJour } from "@/lib/dates";

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
  // Identifiant venu du client → `estId` avant tout `where` Prisma.
  if (!estId(matchId)) {
    return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
  }

  const m = await prisma.match.findFirst({
    where: { id: matchId, clubId },
    select: {
      id: true,
      status: true,
      kind: true,
      playedAt: true,
      scheduledAt: true,
      venue: true,
      isHome: true,
      seasonId: true,
      matchDayId: true,
      opponentId: true,
      teamAName: true,
      teamBName: true,
      scoreA: true,
      scoreB: true,
      durationMin: true,
      opponent: { select: { name: true } },
      season: { select: { id: true, name: true } },
      matchDay: { select: { id: true, date: true, title: true } },
      mvp: { select: { id: true, name: true, photo: true } },
      motmLocked: true,
      correctedAt: true,
      correctedBy: { select: { name: true } },
      participants: {
        select: {
          team: true,
          isGk: true,
          player: {
            select: {
              id: true,
              name: true,
              photo: true,
              nickname: true,
              skill: true,
              isGk: true,
              isGuest: true,
              isArchived: true,
            },
          },
        },
      },
      rsvps: { select: { playerId: true, status: true } },
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
  // Pas le mot « introuvable » seul : l'app le lit comme « ce club n'est
  // plus accessible » (lib/appel.ts). Un match supprimé n'est pas un club
  // perdu.
  if (!m) return NextResponse.json({ error: "Match introuvable." }, { status: 404 });

  const nomA = m.teamAName;
  const nomB = m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;

  // Les buts dans l'ordre du MATCH, pas dans celui de la saisie : bon ordre
  // pendant le match, faux dès qu'on rattrape un but oublié. Un but sans
  // minute — ajouté après coup depuis /corriger, où l'on n'invente jamais une
  // minute (spec 0001, Q5) — va à la fin ; entre eux, l'ordre de saisie
  // départage. C'est le tri du récap du site (components/RecapView.tsx) : les
  // deux écrans racontaient le même match dans deux ordres différents.
  const buts = m.events
    .filter((e) => e.type === "GOAL" || e.type === "OWN_GOAL")
    .map((e, i) => ({ e, i }))
    .sort((x, y) => (x.e.minute ?? Infinity) - (y.e.minute ?? Infinity) || x.i - y.i)
    .map((x) => x.e);

  /// Le nom qu'une ligne de but affiche. Un csc peut rester sans auteur : le
  /// score part au premier tap et personne n'est obligé d'avouer. Un but de
  /// l'adversaire d'un match externe n'a pas de buteur chez nous : c'est
  /// l'adversaire qui a marqué, pas « ? ».
  const nomDuBut = (e: (typeof buts)[number]) =>
    e.player
      ? e.type === "OWN_GOAL"
        ? `${e.player.name} (csc)`
        : e.player.name
      : e.type === "OWN_GOAL"
        ? `csc de ${e.team === "A" ? nomB : nomA}`
        : m.kind === "EXTERNAL" && e.team === "B"
          ? nomB
          : "?";

  /// Les buteurs d'un camp, groupés avec leurs minutes : « Bilal 2′, 5′ ».
  const buteursDe = (camp: "A" | "B") => {
    const par = new Map<string, (number | null)[]>();
    for (const e of buts) {
      if (e.team !== camp) continue;
      const nom = nomDuBut(e);
      par.set(nom, [...(par.get(nom) ?? []), e.minute]);
    }
    return [...par].map(([nom, minutes]) => ({ nom, minutes }));
  };

  // Le bilan de la saison entre CES deux chasubles : « 9-2-3 ». Les mêmes
  // noms d'équipe, pas tous les matchs internes de la saison — et rien tant
  // qu'il n'y a qu'un match : « 1-0-0 » sous le seul match joué ne dit rien
  // de plus que le score. C'est la règle du récap du site.
  let bilanA: string | null = null;
  let bilanB: string | null = null;
  if (m.kind === "INTERNAL") {
    const memesEquipes = await prisma.match.findMany({
      where: {
        clubId,
        seasonId: m.seasonId,
        kind: "INTERNAL",
        status: "FINISHED",
        teamAName: m.teamAName,
        teamBName: m.teamBName,
      },
      select: { scoreA: true, scoreB: true },
    });
    let v = 0;
    let n = 0;
    let d = 0;
    for (const x of memesEquipes) {
      if (x.scoreA > x.scoreB) v++;
      else if (x.scoreB > x.scoreA) d++;
      else n++;
    }
    if (memesEquipes.length > 1) {
      bilanA = `${v}-${n}-${d}`;
      bilanB = `${d}-${n}-${v}`;
    }
  }

  const compte = (types: string[], camp: "A" | "B") =>
    m.events.filter((e) => types.includes(e.type) && e.team === camp).length;

  const statistiques: { libelle: string; a: number; b: number; accent?: "or" }[] = [
    { libelle: "Buts", a: m.scoreA, b: m.scoreB },
  ];
  if (ctx.club.trackAssists) {
    const passes = (camp: "A" | "B") =>
      m.events.filter((e) => e.team === camp && e.type === "GOAL" && e.assistPlayer).length;
    statistiques.push({ libelle: "Passes décisives", a: passes("A"), b: passes("B") });
  }
  // Un contre son camp est CRÉDITÉ à l'équipe adverse (`team` = le camp qui
  // prend le point). Le chiffre se range du côté de l'équipe qui l'a COMMIS :
  // compter par équipe créditée affichait « 1 » sous le camp qui n'y était
  // pour rien.
  statistiques.push({
    libelle: "Contre son camp",
    a: compte(["OWN_GOAL"], "B"),
    b: compte(["OWN_GOAL"], "A"),
  });
  // Une seule ligne pour les cartons, jaunes et rouges ensemble, comme le
  // récap du site : deux lignes à « 0 – 0 » sur un match propre, c'était du
  // bruit.
  if (ctx.club.trackCards) {
    statistiques.push({
      libelle: "Cartons",
      a: compte(["YELLOW_CARD", "RED_CARD"], "A"),
      b: compte(["YELLOW_CARD", "RED_CARD"], "B"),
      accent: "or",
    });
  }

  // La chronologie, du plus récent au plus ancien, avec le score courant —
  // calculé APRÈS le tri, sans quoi un but rattrapé portait le score du
  // moment où on l'a saisi. Un but sans minute au milieu d'un match qui en a
  // se signale comme tel ; sur une feuille rétro, où aucun but n'a de minute,
  // le repère ne dirait rien.
  const chronoMinutee = buts.some((b) => b.minute != null);
  let ca = 0;
  let cb = 0;
  const chronologie = buts
    .map((e) => {
      if (e.team === "A") ca++;
      else cb++;
      return {
        id: e.id,
        minute: e.minute,
        apresCoup: e.minute == null && chronoMinutee,
        camp: e.team as "A" | "B",
        nom: nomDuBut(e),
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

  const [freres, matchEnCours, saisonActive, soireeARanger, convocation] = await Promise.all([
    // Le rang du match dans sa soirée : « Soirée du 7 sept. · Match 2 ».
    m.matchDay
      ? prisma.match.findMany({
          where: { matchDayId: m.matchDay.id, status: { in: ["LIVE", "FINISHED"] } },
          orderBy: { playedAt: "asc" },
          select: { id: true },
        })
      : Promise.resolve([]),
    // Pas de « on rejoue » tant qu'un match tourne : deux matchs LIVE, c'est
    // deux tableaux pour un seul terrain.
    m.status === "FINISHED"
      ? prisma.match.findFirst({ where: { clubId, status: "LIVE" }, select: { id: true } })
      : Promise.resolve(null),
    m.status === "FINISHED"
      ? prisma.season.findFirst({
          where: { clubId, isActive: true },
          orderBy: { startsAt: "desc" },
          select: { id: true },
        })
      : Promise.resolve(null),
    // Un match sans soirée, un jour où une soirée existe : on propose de le
    // ranger. C'est là qu'atterrissent les écrans qui réclamaient une
    // feuille (spec 0007). Même règle que le serveur à la création.
    m.matchDayId === null && m.status !== "CANCELED"
      ? soireeDuJour(prisma, clubId, m.playedAt).then((id) =>
          id
            ? prisma.matchDay.findUnique({ where: { id }, select: { id: true, date: true } })
            : null,
        )
      : Promise.resolve(null),
    // La convocation d'un match programmé : qui est là ? Le vivier sans les
    // invités ni les archivés, comme la page du site.
    m.status === "SCHEDULED"
      ? prisma.player
          .findMany({
            where: { clubId, isArchived: false, isGuest: false },
            orderBy: { name: "asc" },
            select: { id: true, name: true, photo: true, userId: true },
          })
          .then((vivier) => {
          const statutDe = new Map(m.rsvps.map((r) => [r.playerId, r.status]));
          const moi = vivier.find((p) => p.userId === ctx.user.id) ?? null;
          const quand = m.scheduledAt ?? m.playedAt;
          return {
            quand: quand.toISOString(),
            jourLong: jourLong(quand),
            heure: heure(quand),
            lieu: m.venue,
            domicile: m.isHome,
            presents: m.rsvps.filter((r) => r.status === "IN").length,
            monPlayerId: moi?.id ?? null,
            maReponse: moi ? (statutDe.get(moi.id) ?? null) : null,
            lignes: vivier.map((p) => ({
              playerId: p.id,
              nom: p.name,
              photo: p.photo,
              moi: p.id === moi?.id,
              statut: statutDe.get(p.id) ?? null,
            })),
          };
        })
      : Promise.resolve(null),
  ]);

  const rang = freres.findIndex((x) => x.id === m.id) + 1;

  // « On rejoue — mêmes équipes » : le geste le plus fréquent d'une soirée.
  // Rejouer, c'est créer un match AUJOURD'HUI : il n'hérite ni de la saison ni
  // de la soirée d'un vieux récap — sauf quand on rattrape une soirée passée,
  // où « le match suivant » est le deuxième de CETTE soirée-là. Les joueurs
  // archivés depuis ne sont pas reconduits. Mêmes conditions que la page du
  // site (app/c/[slug]/matches/[id]/page.tsx).
  const rejouables = m.participants.filter((p) => !p.player.isArchived);
  const rattrapage = estRetro(m.playedAt) && m.matchDayId != null;
  const rejouer =
    m.status === "FINISHED" && ctx.canScore && !matchEnCours && rejouables.length > 0
      ? {
          libelle: rattrapage ? "Saisir le match suivant" : "On rejoue — mêmes équipes",
          rattrapage,
          genre: m.kind,
          adversaireId: m.opponentId,
          nomA: m.teamAName,
          nomB: m.teamBName,
          soireeId: rattrapage
            ? m.matchDayId
            : m.matchDay && memeJour(m.matchDay.date, new Date())
              ? m.matchDay.id
              : null,
          saisonId: rattrapage ? m.seasonId : (saisonActive?.id ?? null),
          // En rattrapage, le match suivant se date une demi-heure après
          // celui-ci — jamais dans le futur. Sinon il se joue maintenant.
          joueLe: rattrapage
            ? new Date(Math.min(m.playedAt.getTime() + 30 * 60_000, Date.now())).toISOString()
            : null,
          // Pas `photo` : ce sont les mêmes participants que `effectifs`,
          // plus haut dans CETTE réponse, qui porte déjà leur visage. Les
          // recopier ici doublait le poids d'un récap (70 Ko de data-URI pour
          // sept joueurs), quatre à huit fois par soirée.
          joueurs: rejouables.map((p) => ({
            playerId: p.player.id,
            nom: p.player.name,
            surnom: p.player.nickname,
            niveau: p.player.skill,
            estGardien: p.player.isGk,
            gardienCeMatch: p.isGk,
            invite: p.player.isGuest,
            camp: p.team as "A" | "B",
          })),
        }
      : null;

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
    // « Corrigé le 19 sept. 2026 à 17:32 par … » (APRES-13) — préformaté
    // ici, dans le fuseau du club, avec la date complète du site : le
    // téléphone ne recalcule rien, il dessine.
    corrige: m.correctedAt
      ? `Corrigé le ${dateComplete(m.correctedAt)} à ${heure(m.correctedAt)}${m.correctedBy ? ` par ${m.correctedBy.name}` : ""}`
      : null,

    // La légende de la barre : « Soirée du 7 sept. · Match 2 », sinon le jour
    // du match, « mer. 2 sept. », en minuscules comme sur le site.
    contexte: m.matchDay
      ? `Soirée du ${jourCourt(m.matchDay.date)}${rang > 0 ? ` · Match ${rang}` : ""}`
      : null,
    dateCourte: jourCourt(m.playedAt),
    dateLongue: jourAbrege(m.playedAt).toLowerCase(),
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
          designeParCapitaine: m.motmLocked,
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

    // Champs ajoutés le 19 septembre 2026. Une app plus ancienne les ignore.
    genre: m.kind,
    rejouer,
    // Le bouton « Ranger le match ici » s'ouvre à qui peut scorer — c'est au
    // PATCH `matches/[matchId]` { matchDayId } qu'il envoie, la porte étroite
    // déjà ouverte par le lot 0007.
    soireeARanger: soireeARanger
      ? { id: soireeARanger.id, libelle: `Soirée du ${jourLong(soireeARanger.date)}` }
      : null,
    convocation,
  });
}
