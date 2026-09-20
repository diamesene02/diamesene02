import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClubApiContext } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";
import { calculerPresences, phraseEtat } from "@/lib/presences";
import { fenetreDuJour } from "@/lib/jour";
import { nomsChasubles } from "@/lib/color";
import { points, trierParPoints } from "@/lib/classement";
import { estRetro } from "@/lib/retro";
import { orphelinsParJour, soireeReclame, SIX_SEMAINES_MS } from "@/lib/matches";
import {
  heure,
  jourAbrege,
  jourCourt,
  jourEtNumero,
  jourLong,
  jourSemaineLong,
  memeJour,
  minuit,
} from "@/lib/dates";

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
///
/// Les dates arrivent aussi ÉCRITES (« Lun. 21 sept. », « 20:00 ») : le moteur
/// JavaScript du téléphone ne connaît pas toujours le fuseau du club, et un
/// Android d'entrée de gamme formate mal le français. Les ISO restent là pour
/// les calculs.
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

  const maintenant = new Date();
  const { debut: debutDuJour, fin: finDuJour } = fenetreDuJour(maintenant);

  // Le détail d'un joueur de compo : c'est ce que le coup d'envoi en un tap
  // doit pouvoir écrire dans le miroir local sans repasser par l'effectif.
  //
  // Pas `photo` : ce sont les MÊMES joueurs que ceux du classement de cette
  // réponse, qui porte déjà leur visage. Les envoyer deux fois doublait le
  // poids de l'écran le plus ouvert de l'app — 70 Ko de data-URI recopiés à
  // chaque tirer-pour-rafraîchir, au gymnase, en 4G. C'est la règle déjà
  // écrite dans lib/succes-serveur.ts, et le site ne les envoie pas non plus
  // (app/c/[slug]/page.tsx, le lineup du RematchButton).
  const joueurCompo = {
    select: {
      id: true,
      name: true,
      nickname: true,
      skill: true,
      isGk: true,
      isGuest: true,
      isArchived: true,
    },
  } as const;

  const [
    prochaine,
    matchsDuJour,
    classement,
    monJoueur,
    suivante,
    programmes,
    dernierFini,
    enDirect,
    derniereCompo,
    soireesSansResultat,
    orphelins,
  ] = await Promise.all([
    // La prochaine soirée, avec de quoi calculer les présences. Une soirée
    // annulée n'est pas la prochaine soirée — c'est la règle du site, et
    // sans elle un lundi annulé masquait le suivant et le rappel « aucune
    // soirée au calendrier ».
    prisma.matchDay.findFirst({
      where: { clubId, canceledAt: null, date: { gte: debutDuJour } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        title: true,
        location: true,
        canceledAt: true,
        createdAt: true,
        teamAName: true,
        teamBName: true,
        rsvps: { select: { playerId: true, status: true, respondedAt: true } },
        // Les archivés depuis ne sont jamais reconduits.
        lineup: {
          where: { player: { isArchived: false } },
          select: { playerId: true, team: true, isGk: true, player: joueurCompo },
        },
      },
    }),
    // Les matchs du jour : c'est la soirée en cours, celle qu'on est en train
    // de jouer. Les matchs en direct passent devant, puis les plus récents.
    //
    // Joués ou en cours seulement : un match PROGRAMMÉ n'a pas de score, et un
    // match ANNULÉ ne s'est pas joué — les deux s'affichaient « Terminé 0–0 ».
    prisma.match.findMany({
      where: { clubId, status: { in: ["LIVE", "FINISHED"] }, playedAt: { gte: debutDuJour } },
      orderBy: { playedAt: "desc" },
      take: 12,
      select: {
        id: true,
        playedAt: true,
        status: true,
        kind: true,
        teamAName: true,
        teamBName: true,
        scoreA: true,
        scoreB: true,
        durationMin: true,
        opponent: { select: { name: true } },
      },
    }),
    getLeaderboard({ clubId, seasonId: saison?.id ?? null }),
    prisma.player.findFirst({
      where: { clubId, userId: ctx.user.id },
      select: { id: true },
    }),
    // « À venir » : la prochaine soirée APRÈS aujourd'hui, avec sa compo. Celle
    // du jour vit dans « Ce soir ». Une soirée annulée n'est pas la prochaine.
    // L'app ne regardait que les matchs du jour : la soirée de lundi, compo
    // faite, n'y apparaissait jamais (« Rien de programmé »).
    prisma.matchDay.findFirst({
      where: { clubId, canceledAt: null, date: { gte: finDuJour } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        title: true,
        location: true,
        teamAName: true,
        teamBName: true,
        rsvps: { select: { playerId: true, status: true } },
        lineup: { where: { player: { isArchived: false } }, select: { team: true } },
      },
    }),
    // Les matchs programmés à l'avance, comme sur le site : ils n'ont pas
    // commencé, ou viennent de passer leur heure sans être lancés.
    prisma.match.findMany({
      where: {
        clubId,
        status: "SCHEDULED",
        scheduledAt: { gte: new Date(Date.now() - 2 * 3600_000) },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: {
        id: true,
        scheduledAt: true,
        playedAt: true,
        kind: true,
        venue: true,
        isHome: true,
        teamAName: true,
        teamBName: true,
        matchDayId: true,
        opponent: { select: { name: true } },
        _count: { select: { rsvps: { where: { status: "IN" } } } },
      },
    }),
    // Le dernier match terminé avant aujourd'hui désigne la dernière soirée
    // jouée — l'onglet daté du site. Sans lui, du mardi au dimanche, l'accueil
    // de l'app ne montrait aucun match.
    prisma.match.findFirst({
      where: { clubId, status: "FINISHED", playedAt: { lt: debutDuJour } },
      orderBy: { playedAt: "desc" },
      select: {
        matchDayId: true,
        playedAt: true,
        matchDay: { select: { date: true } },
      },
    }),
    // Le match en cours CÔTÉ SERVEUR, quelle que soit sa date. Un match reste
    // LIVE tant que personne n'a sifflé la fin — et une soirée se termine
    // rarement par un tap sur « Terminer ». Le lendemain, ce match n'était ni
    // « de ce soir » ni terminé : il n'apparaissait nulle part, tout en
    // bloquant le coup d'envoi suivant.
    prisma.match.findFirst({
      where: { clubId, status: "LIVE" },
      orderBy: { playedAt: "desc" },
      select: {
        id: true,
        playedAt: true,
        kind: true,
        matchDayId: true,
        teamAName: true,
        teamBName: true,
        scoreA: true,
        scoreB: true,
        opponent: { select: { name: true } },
      },
    }),
    // La dernière composition réellement jouée : à l'heure du match, si la
    // feuille n'est pas préparée, la meilleure hypothèse est « comme la
    // dernière fois ».
    prisma.match.findFirst({
      where: { clubId, status: "FINISHED", kind: "INTERNAL" },
      orderBy: { playedAt: "desc" },
      select: {
        teamAName: true,
        teamBName: true,
        participants: { select: { team: true, isGk: true, player: joueurCompo } },
      },
    }),
    // Les soirées passées dont personne n'a fait la feuille — la requête de
    // l'accueil du site, fenêtre de six semaines comprise (lib/matches.ts).
    prisma.matchDay.findMany({
      where: {
        clubId,
        canceledAt: null,
        date: {
          lt: debutDuJour,
          gte: new Date(debutDuJour.getTime() - SIX_SEMAINES_MS),
        },
        // Un match seulement PROGRAMMÉ ne compte pas pour un résultat.
        matches: { none: { status: { in: ["LIVE", "FINISHED"] } } },
      },
      orderBy: { date: "desc" },
      take: 3,
      select: { id: true, date: true },
    }),
    orphelinsParJour(prisma, clubId, {
      debut: new Date(debutDuJour.getTime() - SIX_SEMAINES_MS),
      fin: maintenant,
    }),
  ]);

  // La dernière soirée : les matchs de sa soirée, sinon tous ceux de ce
  // jour-là — un club sans calendrier a quand même joué.
  const matchsDerniere = dernierFini
    ? await prisma.match.findMany({
        where: dernierFini.matchDayId
          ? { clubId, matchDayId: dernierFini.matchDayId, status: "FINISHED" }
          : {
              clubId,
              status: "FINISHED",
              playedAt: {
                gte: fenetreDuJour(dernierFini.playedAt).debut,
                lt: fenetreDuJour(dernierFini.playedAt).fin,
              },
            },
        orderBy: { playedAt: "asc" },
        take: 12,
        select: {
          id: true,
          playedAt: true,
          status: true,
          kind: true,
          teamAName: true,
          teamBName: true,
          scoreA: true,
          scoreB: true,
          durationMin: true,
          opponent: { select: { name: true } },
        },
      })
    : [];

  const nomsClub = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  /// Le camp B d'un match : l'adversaire quand il y en a un, la chasuble sinon.
  const adverse = (m: {
    kind: "INTERNAL" | "EXTERNAL";
    teamBName: string;
    opponent: { name: string } | null;
  }) => (m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName);

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
    const maLigne = monJoueur ? presences.lignes.get(monJoueur.id) : undefined;
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
      // Champs ajoutés le 19 septembre 2026.
      lieu: prochaine.location,
      heure: heure(prochaine.date),
      jourAbrege: jourAbrege(prochaine.date),
      jourLong: jourLong(prochaine.date),
      // En JOURS CIVILS du club, pas en millisecondes : à 19 h pour une
      // soirée à 20 h, un arrondi sur l'écart annonçait « Demain » au-dessus
      // de la date du jour même. 0 = aujourd'hui.
      joursAvant: Math.round((minuit(prochaine.date) - minuit(maintenant)) / 86_400_000),
      ceSoir: memeJour(prochaine.date, maintenant),
      etat: presences.etat.statut,
      // Ma présence RETENUE, abonnement compris : `maReponse` ne dit que la
      // réponse explicite, et un abonné qui n'a rien dit se voyait proposer
      // « Touche pour répondre » alors qu'il est compté présent.
      maPresence: maLigne
        ? { statut: maLigne.statut, viaAbonnement: maLigne.source === "abonnement" }
        : null,
    };
  }

  const ligneMatch = (m: (typeof matchsDuJour)[number]) => ({
    id: m.id,
    joueLe: m.playedAt.toISOString(),
    statut: m.status,
    nomA: m.teamAName,
    nomB: adverse(m),
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    dureeMin: m.durationMin,
    heure: heure(m.playedAt),
  });

  // ── Le coup d'envoi en un tap ─────────────────────────────────────────────
  // D'où vient la compo, dans l'ordre — la règle de l'accueil du site :
  //   1. celle PRÉPARÉE pour la prochaine soirée — le club connaît ses équipes
  //      trois à quatre jours avant, c'est la seule source qui soit juste ;
  //   2. à défaut, celle du dernier match interne joué, annoncée comme telle.
  // La compo et le rattachement sont deux questions : on prend la compo dès
  // qu'elle est préparée, même la veille, mais on ne RATTACHE le match à la
  // soirée que si elle a lieu aujourd'hui.
  type JoueurPret = {
    playerId: string;
    nom: string;
    surnom: string | null;
    niveau: number;
    estGardien: boolean;
    gardienCeMatch: boolean;
    invite: boolean;
    camp: "A" | "B";
  };
  const versJoueur = (l: {
    team: string;
    isGk: boolean;
    player: {
      id: string;
      name: string;
      nickname: string | null;
      skill: number;
      isGk: boolean;
      isGuest: boolean;
    };
  }): JoueurPret => ({
    playerId: l.player.id,
    nom: l.player.name,
    surnom: l.player.nickname,
    niveau: l.player.skill,
    estGardien: l.player.isGk,
    gardienCeMatch: l.isGk,
    invite: l.player.isGuest,
    camp: l.team as "A" | "B",
  });
  const compoSoiree = (prochaine?.lineup ?? []).map(versJoueur);
  const compoDernier = (derniereCompo?.participants ?? [])
    .filter((p) => !p.player.isArchived)
    .map(versJoueur);
  const sourcePreparee = compoSoiree.length > 0;
  const compoPrete = sourcePreparee ? compoSoiree : compoDernier;
  const compoA = compoPrete.filter((p) => p.camp === "A").length;
  const compoB = compoPrete.filter((p) => p.camp === "B").length;
  const nomCoupA = sourcePreparee
    ? (prochaine?.teamAName ?? nomsClub.a)
    : (derniereCompo?.teamAName ?? nomsClub.a);
  const nomCoupB = sourcePreparee
    ? (prochaine?.teamBName ?? nomsClub.b)
    : (derniereCompo?.teamBName ?? nomsClub.b);
  const joursAvant = prochaine
    ? Math.round((minuit(prochaine.date) - minuit(maintenant)) / 86_400_000)
    : null;
  // « ce soir », « demain », ou le jour nommé : le bouton dit de quelle soirée
  // vient la compo qu'il s'apprête à utiliser.
  const quand =
    joursAvant == null || joursAvant <= 0
      ? "ce soir"
      : joursAvant === 1
        ? "demain"
        : jourSemaineLong(prochaine!.date);
  // Réservé à qui peut scorer : le bouton crée un match, et un membre simple
  // se verrait proposer un geste que la file d'envoi lui refuserait. L'app le
  // cachait déjà dans ce cas (lib/api.ts) ; la garde vit maintenant des deux
  // côtés. `chasubleDe` reste calculé pour tout le monde — c'est l'anneau des
  // avatars du tableau, pas un droit.
  const coupDEnvoi =
    ctx.canScore && compoA > 0 && compoB > 0
      ? {
          nomA: nomCoupA,
          nomB: nomCoupB,
          source: sourcePreparee ? ("preparee" as const) : ("derniere" as const),
          quand,
          // Seulement si la soirée a lieu aujourd'hui : un match lancé mardi
          // avec la compo de lundi prochain n'appartient pas à lundi prochain.
          soireeId: prochaine && memeJour(prochaine.date, maintenant) ? prochaine.id : null,
          saisonId: saison?.id ?? null,
          compoA,
          compoB,
          indice: `${nomCoupA} ${compoA} vs ${compoB} ${nomCoupB} — ${
            sourcePreparee ? `la compo préparée pour ${quand}` : "la compo de la dernière fois"
          }`,
          joueurs: compoPrete,
        }
      : null;
  // La chasuble de chacun dans la dernière compo connue : c'est l'anneau de
  // son avatar dans le tableau.
  const chasubleDe = new Map(compoPrete.map((p) => [p.playerId, p.camp]));

  // Le nom court : « FC Lundi Soir » devient « Lundi Soir ». C'est le camp A
  // d'un match externe à l'accueil du site.
  const clubCourt = ctx.org.name.replace(/^(FC|AS|US|SC|Five)\s+/i, "");

  return NextResponse.json({
    saison: saison ? { id: saison.id, nom: saison.name } : null,
    soiree,
    matchs: matchsDuJour.map(ligneMatch),
    // Champs ajoutés le 19 septembre 2026. Une app plus ancienne les ignore.
    derniere:
      dernierFini && matchsDerniere.length > 0
        ? {
            date: (dernierFini.matchDay?.date ?? dernierFini.playedAt).toISOString(),
            soireeId: dernierFini.matchDayId,
            matchs: matchsDerniere.map(ligneMatch),
            // « Lundi 7 » pour l'onglet, « 7 sept. » pour « Soirée du … ».
            onglet: jourEtNumero(dernierFini.matchDay?.date ?? dernierFini.playedAt),
            jourCourt: jourCourt(dernierFini.matchDay?.date ?? dernierFini.playedAt),
          }
        : null,
    aVenir: {
      soiree: suivante
        ? {
            id: suivante.id,
            date: suivante.date.toISOString(),
            libelle: suivante.title,
            lieu: suivante.location,
            nomA: suivante.teamAName ?? nomsClub.a,
            nomB: suivante.teamBName ?? nomsClub.b,
            compoA: suivante.lineup.filter((l) => l.team === "A").length,
            compoB: suivante.lineup.filter((l) => l.team === "B").length,
            reponses: suivante.rsvps.length,
            // Pour le bouton « Je serai là » : la réponse explicite, comme le
            // site. `soiree.maReponse` ne parle que de la soirée du dessus.
            maReponse: monJoueur
              ? (suivante.rsvps.find((r) => r.playerId === monJoueur.id)?.status ?? null)
              : null,
            heure: heure(suivante.date),
            jourLong: jourLong(suivante.date),
          }
        : null,
      matchs: programmes.map((m) => {
        const externe = m.kind === "EXTERNAL" && m.opponent != null;
        const q = m.scheduledAt ?? m.playedAt;
        return {
          id: m.id,
          quand: q.toISOString(),
          nomA: m.teamAName,
          nomB: externe ? m.opponent!.name : m.teamBName,
          externe,
          lieu: m.venue,
          presents: m._count.rsvps,
          soireeId: m.matchDayId,
          domicile: m.isHome,
          // Programmé pour aujourd'hui : il va dans « Ce soir », pas dans
          // « À venir ».
          ceSoir: m.scheduledAt != null && m.scheduledAt < finDuJour,
          heure: heure(q),
          jourAbrege: jourAbrege(q),
        };
      }),
    },
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
      camp: chasubleDe.get(r.playerId) ?? null,
    })),

    enDirect: enDirect
      ? {
          id: enDirect.id,
          joueLe: enDirect.playedAt.toISOString(),
          scoreA: enDirect.scoreA,
          scoreB: enDirect.scoreB,
          nomA: enDirect.teamAName,
          nomB: adverse(enDirect),
          soireeId: enDirect.matchDayId,
          // Plus de six heures : c'est une feuille qu'on a oublié de fermer,
          // pas le match de ce soir (lib/retro.ts).
          retro: estRetro(enDirect.playedAt),
          jourLong: jourLong(enDirect.playedAt),
        }
      : null,
    // Les soirées passées sans résultat. Avant de réclamer une feuille, on
    // regarde s'il existe déjà un match de ce jour-là sans soirée : si oui,
    // on propose de le RANGER — jamais une feuille vierge, qui fabriquerait
    // un doublon (spec 0007).
    sansResultat: soireesSansResultat.flatMap((s) => {
      const r = soireeReclame(
        { date: s.date, canceledAt: null, matchsActifs: 0 },
        orphelins,
        maintenant.getTime(),
      );
      if (r.quoi === "rien") return [];
      return [
        {
          soireeId: s.id,
          date: s.date.toISOString(),
          jourLong: jourLong(s.date),
          rangerMatchId: r.quoi === "rattacher" ? r.matchId : null,
        },
      ];
    }),
    coupDEnvoi,
    clubCourt,
  });
}
