import Link from "next/link";
import * as D from "@/lib/dates";
import { calculerPresences, phraseEtat, type Presences } from "@/lib/presences";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";
import { chargerHistorique, succesDuClub } from "@/lib/succes-serveur";
import type { SuccesJoueur } from "@/lib/succes";
import { ecartJours, quandRelatif } from "@/lib/quand";
import Icon from "@/components/Icon";
import RematchButton from "@/components/RematchButton";
import ReprendreLocal from "@/components/ReprendreLocal";
import Carte from "@/components/ios/Carte";
import Onglets from "@/components/ios/Onglets";
import Ecusson from "@/components/ios/Ecusson";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import LigneScore from "@/components/ios/LigneScore";
import AnnonceSucces from "@/components/succes/AnnonceSucces";
import { dateRelative } from "@/components/succes/textes";
import { nomsChasubles } from "@/lib/color";
import { ini, lettre } from "@/lib/ini";
import { estRetro } from "@/lib/retro";
import { orphelinsParJour, soireeReclame, SIX_SEMAINES_MS } from "@/lib/matches";
import EnteteCollante from "./_accueil/EnteteCollante";
import Banniere from "./_accueil/Banniere";
import BoutonPresence from "./_accueil/BoutonPresence";
import HorlogeDirect from "./_accueil/HorlogeDirect";
import Evolution from "./_accueil/Evolution";
import MaSaison from "./_accueil/MaSaison";
import ExploitsDuClub from "./_accueil/ExploitsDuClub";
import { bilanDuJoueur } from "./_accueil/ma-saison";
import "./_accueil/accueil.css";

export const dynamic = "force-dynamic";

// L'icône calendrier de la maquette, en tête de chaque onglet.
function IconeSoiree() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

// « 📅 Soirée du 7 sept. › » — la première ligne de chaque onglet. Sans
// lien quand les matchs n'appartiennent à aucune soirée du calendrier.
function LigneSoiree({ texte, href }: { texte: string; href?: string }) {
  const corps = (
    <>
      <IconeSoiree />
      <span className="texte">{texte}</span>
      {href && <span className="chev">›</span>}
    </>
  );
  return href ? (
    <Link href={href} className="accueil-soiree">
      {corps}
    </Link>
  ) : (
    <div className="accueil-soiree">{corps}</div>
  );
}

// Toutes les dates passent par lib/dates : rendues côté serveur, elles
// sortaient dans le fuseau du processus — UTC en production.
const heureFr = D.heure;
const jourCourt = D.jourCourt;
const ongletJour = D.jourEtNumero;
const jourLong = D.jourLong;
const jourAbrege = D.jourAbrege;
const minuit = D.minuit;

const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function ClubHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;
  const maintenant = new Date();

  // Les succès se chargent en parallèle de tout le reste (huit requêtes, un
  // calcul) et une seule fois par requête (cache). Ils ne sont qu'un plus :
  // s'ils échouent, l'accueil s'affiche sans eux plutôt que pas du tout.
  const succesP = succesDuClub(clubId).catch((e: unknown) => {
    console.error("Accueil : succès indisponibles", e);
    return null;
  });

  const debutDeCeJour = D.debutDuJour();

  // Les matchs sans soirée des six dernières semaines — la même fenêtre que
  // celle qui décide si une soirée est encore réclamée (spec 0007).
  const orphelins = await orphelinsParJour(prisma, clubId, {
    debut: new Date(debutDeCeJour.getTime() - SIX_SEMAINES_MS),
    fin: new Date(),
  });
  const finDeCeJour = new Date(debutDeCeJour.getTime() + 86_400_000);

  const activeSeason = await prisma.season.findFirst({
    where: { clubId, isActive: true },
    orderBy: { startsAt: "desc" },
  });

  const [
    feuillesOuvertes,
    prochainesSoirees,
    upcomingMatches,
    myPlayer,
    lastLineup,
    classement,
    vivier,
  ] = await Promise.all([
    // Toutes les feuilles ouvertes, pas seulement la plus récente : une
    // feuille oubliée un mercredi et le match qui se joue ce soir sont deux
    // choses différentes, et la seconde masquait la première.
    prisma.match.findMany({
      where: { clubId, status: "LIVE" },
      orderBy: { playedAt: "desc" },
      take: 5,
      include: { opponent: { select: { name: true } } },
    }),
    // Les deux prochaines soirées : celle du jour, s'il y en a une, et la
    // suivante — l'onglet « À venir » parle de la suivante quand la
    // première se joue ce soir.
    prisma.matchDay.findMany({
      where: {
        clubId,
        // Une soirée reste « en cours » jusqu'à la fin de sa journée, pas
        // douze heures glissantes : le mardi à 7 h, la soirée du lundi
        // s'affichait encore comme la prochaine, avec « ce soir » écrit
        // dessus et le match du jour qui venait s'y rattacher.
        date: { gte: debutDeCeJour },
        // Une soirée annulée n'est pas la prochaine soirée.
        canceledAt: null,
      },
      orderBy: { date: "asc" },
      take: 2,
      include: {
        rsvps: { select: { playerId: true, status: true, respondedAt: true } },
        lineup: {
          where: { player: { isArchived: false } },
          select: {
            team: true,
            isGk: true,
            player: {
              select: {
                id: true,
                name: true,
                nickname: true,
                skill: true,
                isGk: true,
                isGuest: true,
              },
            },
          },
        },
      },
    }),
    // Prochains matchs programmés (convocations en cours).
    prisma.match.findMany({
      where: {
        clubId,
        status: "SCHEDULED",
        scheduledAt: { gte: new Date(Date.now() - 2 * 3600_000) },
      },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      include: {
        opponent: { select: { name: true } },
        _count: { select: { rsvps: { where: { status: "IN" } } } },
      },
    }),
    prisma.player.findFirst({
      where: { clubId, userId: ctx.user.id },
      select: { id: true, abonne: true },
    }),
    // La dernière composition réellement jouée. C'est la matière du coup
    // d'envoi en un tap : à l'heure du match, la feuille n'est pas faite et
    // la meilleure hypothèse disponible est « comme la dernière fois ».
    prisma.match.findFirst({
      where: { clubId, status: "FINISHED", kind: "INTERNAL" },
      orderBy: { playedAt: "desc" },
      select: {
        teamAName: true,
        teamBName: true,
        participants: {
          select: {
            team: true,
            isGk: true,
            player: {
              select: {
                id: true,
                name: true,
                nickname: true,
                skill: true,
                isGk: true,
                isGuest: true,
                isArchived: true,
              },
            },
          },
        },
      },
    }),
    getLeaderboard({ clubId, seasonId: activeSeason?.id ?? null }),
    // Le vivier, pour savoir qui est abonné : sans lui, une soirée à laquelle
    // onze habitués viennent s'annonce « 1 présent ».
    prisma.player.findMany({
      where: { clubId, isArchived: false },
      select: { id: true, abonne: true },
    }),
  ]);

  // Une feuille ouverte depuis plus de six heures n'est plus « en direct » :
  // c'est une feuille oubliée (lib/retro). Elle ne fait pas exister l'onglet
  // « Ce soir » — le samedi, un match laissé ouvert le 9 ouvrait par défaut
  // un onglet vide, et cachait « À venir » derrière lui — ni ne bloque le
  // coup d'envoi du soir. Elle reste signalée par sa propre carte. Le seuil
  // est celui de cette carte : chaque feuille ouverte est à un endroit, et un
  // seul.
  const liveMatch = feuillesOuvertes.find((m) => !estRetro(m.playedAt)) ?? null;
  const feuillesOubliees = feuillesOuvertes.filter((m) => estRetro(m.playedAt));

  const nextMatchDay = prochainesSoirees[0] ?? null;
  const soireeDuJour =
    nextMatchDay && nextMatchDay.date < finDeCeJour ? nextMatchDay : null;
  const prochaineSoiree = soireeDuJour
    ? (prochainesSoirees[1] ?? null)
    : nextMatchDay;

  // « Ce soir » existe s'il se passe quelque chose aujourd'hui : une soirée
  // au calendrier, ou un match en direct — un match qui se joue est ce soir
  // par définition, calendrier ou pas.
  const ceSoirExiste = soireeDuJour != null || liveMatch != null;

  const [matchsCeSoirBruts, dernierFini, soireesSansResultat] = await Promise.all([
    ceSoirExiste
      ? prisma.match.findMany({
          where: {
            clubId,
            status: { in: ["FINISHED", "LIVE"] },
            OR: [
              ...(soireeDuJour ? [{ matchDayId: soireeDuJour.id }] : []),
              { playedAt: { gte: debutDeCeJour } },
              // Lancé à 23 h 30, il est encore en direct à minuit passé.
              ...(liveMatch ? [{ id: liveMatch.id }] : []),
            ],
          },
          orderBy: { playedAt: "asc" },
          include: { opponent: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // Le dernier match joué AVANT ce soir : c'est lui qui désigne la
    // dernière soirée jouée.
    prisma.match.findFirst({
      where: {
        clubId,
        status: "FINISHED",
        ...(ceSoirExiste ? { playedAt: { lt: debutDeCeJour } } : {}),
      },
      orderBy: { playedAt: "desc" },
      include: { matchDay: { select: { id: true, date: true } } },
    }),
    // Les soirées passées dont personne n'a fait la feuille.
    //
    // Le club joue tous les lundis. Quand le téléphone reste dans le sac —
    // ou que l'app n'est pas au rendez-vous — la soirée disparaît purement et
    // simplement : pas de buts, pas de victoires, pas d'Élo, et rien à
    // l'écran pour dire qu'il manque quelque chose. Six semaines de retard
    // sont rattrapables ; au-delà, plus personne ne se souvient du score.
    prisma.matchDay.findMany({
      where: {
        clubId,
        canceledAt: null,
        date: {
          lt: debutDeCeJour,
          // La fenêtre vit dans lib/matches.ts et s'appelle ; elle était
          // recopiée en dur ici, et le commentaire de la constante annonçait
          // « deux appelants » alors qu'il y en avait trois (spec 0007).
          gte: new Date(debutDeCeJour.getTime() - SIX_SEMAINES_MS),
        },
        // Un match seulement PROGRAMMÉ ne compte pas pour un résultat.
        matches: { none: { status: { in: ["LIVE", "FINISHED"] } } },
      },
      orderBy: { date: "desc" },
      take: 3,
      select: { id: true, date: true },
    }),
  ]);
  // Une feuille oubliée rattachée à la soirée du jour reste dans sa carte.
  const matchsCeSoir = matchsCeSoirBruts.filter(
    (m) => m.status !== "LIVE" || !estRetro(m.playedAt),
  );

  // La dernière soirée jouée : la soirée du calendrier à laquelle le dernier
  // match est rattaché, sinon tous les matchs de ce jour-là — un club qui
  // n'a pas encore posé son calendrier a quand même joué.
  const [matchsDerniereSoiree, succes] = await Promise.all([
    dernierFini
      ? prisma.match.findMany({
          where: dernierFini.matchDayId
            ? { matchDayId: dernierFini.matchDayId, status: "FINISHED" }
            : {
                clubId,
                status: "FINISHED",
                playedAt: {
                  gte: new Date(minuit(dernierFini.playedAt)),
                  lt: new Date(minuit(dernierFini.playedAt) + 86_400_000),
                },
              },
          orderBy: { playedAt: "asc" },
          include: { opponent: { select: { name: true } } },
        })
      : Promise.resolve([]),
    succesP,
  ]);
  const dateDerniereSoiree = dernierFini
    ? (dernierFini.matchDay?.date ?? dernierFini.playedAt)
    : null;

  // Les noms d'équipe par défaut se déduisent des chasubles du club : une
  // équipe nommée « Blanc » ne doit pas porter une barre noire.
  const nomsClub = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  // Le nom court : « FC Lundi Soir » devient « Lundi Soir ».
  const clubShort = ctx.org.name.replace(/^(FC|AS|US|SC|Five)\s+/i, "");

  // La soirée du jour, s'il y en a une — pour que le « Coup d'envoi » la
  // passe explicitement et que la compo préparée s'y raccroche.
  //
  // Ce calcul portait, jusqu'au 18 septembre 2026, une fenêtre glissante de
  // douze heures autour de l'instant présent : `Math.abs(soirée − maintenant)
  // < 12 h`. Elle ratait un match lancé à 06:30 pour une soirée de 19:00
  // (12 h 30 d'écart) et se calait sur `Date.now()` plutôt que sur la date du
  // match, ce qui la faisait mentir au rejeu d'une file hors-ligne. Surtout,
  // elle ne valait que pour ce bouton-ci : les deux liens voisins partaient
  // sans soirée, et l'app n'en avait aucune. La règle vit désormais dans le
  // serveur (`lib/matches.ts`, `soireeDuJour`), qui rattache par le JOUR — ce
  // qui reste ici n'est qu'un raccourci d'affichage, et il n'a plus besoin
  // d'être juste tout seul : si la soirée n'est pas passée, le serveur la
  // retrouvera (spec 0007).
  const soireeEnCours =
    nextMatchDay && D.memeJour(nextMatchDay.date, maintenant)
      ? nextMatchDay
      : null;

  // Le jour où l'on joue : celui d'une soirée du calendrier, ou n'importe
  // quel jour pour un club qui n'a rien au calendrier. Le grand « Coup
  // d'envoi » n'existe que ce jour-là. Affiché le samedi pour la soirée du
  // lundi, un tap distrait ouvrait une feuille en direct deux jours trop tôt
  // — et un 0–0 de plus dans les stats de tout le monde. Les autres jours,
  // on peut toujours lancer un match, mais par l'écran de composition.
  const jourDeJeu = soireeEnCours != null || nextMatchDay == null;
  // Les liens vers la composition emportent la soirée du jour : sa compo,
  // préparée trois jours avant, arrive toute faite. Jamais celle d'un autre
  // jour — le match s'y rangerait.
  const hrefNouveau = `/c/${slug}/matches/new${soireeEnCours ? `?md=${soireeEnCours.id}` : ""}`;

  // D'où vient la compo du coup d'envoi, dans l'ordre :
  //   1. celle PRÉPARÉE pour la soirée du jour — le club connaît ses équipes
  //      trois à quatre jours avant, c'est la seule source qui soit juste ;
  //   2. à défaut, celle du dernier match joué, clairement annoncée comme telle.
  // Les joueurs archivés depuis ne sont jamais reconduits.
  const compoSoiree = (soireeEnCours?.lineup ?? []).map((l) => ({
    id: l.player.id,
    name: l.player.name,
    nickname: l.player.nickname,
    skill: l.player.skill,
    estGardien: l.player.isGk,
    gardienCeMatch: l.isGk,
    isGuest: l.player.isGuest,
    team: l.team as "A" | "B",
  }));
  const compoDernierMatch = (lastLineup?.participants ?? [])
    .filter((p) => !p.player.isArchived)
    .map((p) => ({
      id: p.player.id,
      name: p.player.name,
      nickname: p.player.nickname,
      skill: p.player.skill,
      estGardien: p.player.isGk,
      gardienCeMatch: p.isGk,
      isGuest: p.player.isGuest,
      team: p.team as "A" | "B",
    }));

  const sourcePreparee = compoSoiree.length > 0;
  const compoPrete = sourcePreparee ? compoSoiree : compoDernierMatch;
  const compoA = compoPrete.filter((p) => p.team === "A").length;
  const compoB = compoPrete.filter((p) => p.team === "B").length;
  const coupDEnvoiPret = compoA > 0 && compoB > 0;
  const nomA = sourcePreparee
    ? (soireeEnCours?.teamAName ?? nomsClub.a)
    : (lastLineup?.teamAName ?? nomsClub.a);
  const nomB = sourcePreparee
    ? (soireeEnCours?.teamBName ?? nomsClub.b)
    : (lastLineup?.teamBName ?? nomsClub.b);

  // La chasuble de chacun dans la compo connue la plus récente — préparée
  // pour la prochaine soirée, sinon celle du dernier match : c'est l'anneau
  // de son avatar dans le tableau et dans le fil des exploits.
  const campRecent = nextMatchDay && nextMatchDay.lineup.length > 0
    ? nextMatchDay.lineup.map((l) => [l.player.id, l.team as "A" | "B"] as const)
    : compoDernierMatch.map((p) => [p.id, p.team] as const);
  const chasubleDe = new Map<string, "A" | "B">(campRecent);

  // La compo se décide trois à quatre jours avant. À partir de cinq jours, si
  // elle n'est pas faite, on le dit — c'est l'oubli qui coûtait le temps au
  // coup d'envoi, et c'est le seul moment où le rappel sert encore à quelque
  // chose.
  // Compté en JOURS CIVILS, pas en millisecondes : à 19 h pour une soirée à
  // 20 h, Math.ceil sur l'écart donnait 1 et le rappel annonçait « Demain »
  // au-dessus de la date du jour même.
  const joursAvant = nextMatchDay
    ? Math.round((minuit(nextMatchDay.date) - minuit(maintenant)) / 86_400_000)
    : null;
  const compoAFaire =
    nextMatchDay != null &&
    nextMatchDay.lineup.length === 0 &&
    joursAvant != null &&
    joursAvant <= 5 &&
    ctx.canScore;

  // ── Qui vient ──────────────────────────────────────────────────────────
  // L'état d'une soirée se calcule d'un seul endroit (lib/presences) : le
  // compte brut des « IN » ignorait les abonnés, et affichait « 1 présent »
  // pour une soirée à laquelle onze habitués venaient.
  type Soiree = (typeof prochainesSoirees)[number];
  const presencesDe = (md: Soiree): Presences =>
    calculerPresences({
      entrees: vivier.map((j) => {
        const r = md.rsvps.find((x) => x.playerId === j.id);
        return {
          playerId: j.id,
          reponse: r?.status ?? null,
          repondueLe: r?.respondedAt ?? null,
          abonne: j.abonne,
        };
      }),
      creeeLe: md.createdAt,
      minJoueurs: ctx.club.minJoueurs,
      capacite: ctx.club.capaciteSoiree,
      annulee: md.canceledAt != null,
    });
  // Ce que la bannière dit au joueur de SA place. Un abonné est compté
  // présent sans avoir répondu : « Touchez pour répondre » sous « 8
  // présents » lui laissait croire qu'il n'en faisait pas partie.
  const maPlace = (p: Presences) => {
    if (!myPlayer) return "Touche pour la soirée.";
    const l = p.lignes.get(myPlayer.id);
    if (!l?.statut) return "Touche pour répondre.";
    if (l.statut === "OUT") return "Tu as dit absent.";
    if (l.statut === "MAYBE") return "Tu as dit peut-être.";
    if (l.enAttente) return "Tu es sur la liste d'attente.";
    return l.source === "abonnement" ? "Tu es compté présent." : "Tu es inscrit.";
  };

  // « Ce soir 19:00 », « Demain 19:00 », « Lundi 19:00 » dans la semaine, la
  // date au-delà. Le samedi, « Lun. 21 sept. » obligeait à compter.
  const quandSoiree = (d: Date) => {
    const n = ecartJours(d, maintenant);
    const jour =
      n <= 1
        ? (quandRelatif(d, maintenant) ?? jourAbrege(d))
        : n <= 6
          ? capitale(D.jourSemaineLong(d))
          : jourAbrege(d);
    return `${jour} ${heureFr(d)}`;
  };

  // ── Les onglets de la carte des matchs ─────────────────────────────────
  const nomAdverse = (m: {
    kind: "INTERNAL" | "EXTERNAL";
    teamBName: string;
    opponent: { name: string } | null;
  }) => (m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName);

  // La prochaine soirée : écusson · heure et lieu · écusson, puis qui vient
  // et « Je serai là ». Dans « À venir », et dans « Ce soir » tant qu'aucun
  // match n'y est joué — le lundi après-midi, c'est ce qu'on vient voir.
  const blocSoiree = (md: Soiree) => {
    const p = presencesDe(md);
    const moi = myPlayer ? p.lignes.get(myPlayer.id) : undefined;
    const compoFaite = md.lineup.length > 0;
    const nA = md.teamAName ?? nomsClub.a;
    const nB = md.teamBName ?? nomsClub.b;
    const cA = md.lineup.filter((l) => l.team === "A").length;
    const cB = md.lineup.filter((l) => l.team === "B").length;
    // Les présents plutôt que les réponses : les abonnés comptent sans
    // répondre, et « 0 réponse » sous une bannière « 8 présents » se
    // contredisait (même choix que l'app).
    const presents = p.etat.statut === "annulee" ? 0 : p.etat.presents;
    return (
      <>
        <Link
          href={`/c/${slug}/sessions/${md.id}`}
          className="accueil-prochaine"
        >
          <span className="camp">
            <Ecusson camp="A" lettre={lettre(nA)} />
            <span className="nom">{nA}</span>
          </span>
          <span className="milieu">
            <span className="heure">{heureFr(md.date)}</span>
            {md.location && <span className="lieu">{md.location}</span>}
          </span>
          <span className="camp">
            <Ecusson camp="B" lettre={lettre(nB)} />
            <span className="nom">{nB}</span>
          </span>
        </Link>
        <div className="accueil-reponses">
          <span className="truncate">
            {presents} présent{presents > 1 ? "s" : ""} ·{" "}
            {/* « Blanc 5 contre 5 Noir » se faisait couper à côté du bouton
                de présence, et les deux noms sont déjà sous les écussons. */}
            {compoFaite ? `${cA} contre ${cB}` : "équipes à préparer"}
          </span>
          {myPlayer && (
            <BoutonPresence
              slug={slug}
              matchDayId={md.id}
              playerId={myPlayer.id}
              initial={md.rsvps.find((r) => r.playerId === myPlayer.id)?.status ?? null}
              abonne={myPlayer.abonne}
              enAttente={moi?.enAttente ?? false}
            />
          )}
        </div>
      </>
    );
  };

  // Les matchs programmés pour ce soir vont dans « Ce soir » ; les autres
  // dans « À venir ».
  const programmesCeSoir = ceSoirExiste
    ? upcomingMatches.filter(
        (m) => m.scheduledAt && m.scheduledAt < finDeCeJour,
      )
    : [];
  const programmesPlusTard = upcomingMatches.filter(
    (m) => !programmesCeSoir.includes(m),
  );

  const onglets: { id: string; label: string; contenu: React.ReactNode }[] = [];

  if (dernierFini && dateDerniereSoiree && matchsDerniereSoiree.length > 0) {
    onglets.push({
      id: "derniere",
      label: ongletJour(dateDerniereSoiree),
      contenu: (
        <>
          <LigneSoiree
            texte={`Soirée du ${jourCourt(dateDerniereSoiree)}`}
            href={
              dernierFini.matchDayId
                ? `/c/${slug}/sessions/${dernierFini.matchDayId}`
                : `/c/${slug}/matches`
            }
          />
          {matchsDerniereSoiree.map((m, i) => (
            <div key={m.id}>
              {i > 0 && <div className="filet" />}
              <LigneScore
                nomA={m.teamAName}
                nomB={nomAdverse(m)}
                scoreA={m.scoreA}
                scoreB={m.scoreB}
                etat="Terminé"
                heure={heureFr(m.playedAt)}
                href={`/c/${slug}/matches/${m.id}`}
              />
            </div>
          ))}
        </>
      ),
    });
  }

  if (ceSoirExiste) {
    const joues = matchsCeSoir.length;
    onglets.push({
      id: "ce-soir",
      label: "Ce soir",
      contenu: (
        <>
          {soireeDuJour && (
            <LigneSoiree
              texte={`Soirée du ${jourCourt(soireeDuJour.date)}`}
              href={`/c/${slug}/sessions/${soireeDuJour.id}`}
            />
          )}
          {matchsCeSoir.map((m, i) => (
            <div key={m.id}>
              {i > 0 && <div className="filet" />}
              {m.status === "LIVE" ? (
                <LigneScore
                  nomA={m.teamAName}
                  nomB={nomAdverse(m)}
                  scoreA={m.scoreA}
                  scoreB={m.scoreB}
                  etat="En direct"
                  direct
                  heure={<HorlogeDirect depuis={m.playedAt.toISOString()} />}
                  href={`/c/${slug}/matches/${m.id}/live`}
                  className="accueil-en-direct"
                />
              ) : (
                <LigneScore
                  nomA={m.teamAName}
                  nomB={nomAdverse(m)}
                  scoreA={m.scoreA}
                  scoreB={m.scoreB}
                  etat="Terminé"
                  heure={heureFr(m.playedAt)}
                  href={`/c/${slug}/matches/${m.id}`}
                />
              )}
            </div>
          ))}
          {programmesCeSoir.map((m, i) => (
            <div key={m.id}>
              {(joues > 0 || i > 0) && <div className="filet" />}
              <LigneScore
                nomA={m.teamAName}
                nomB={nomAdverse(m)}
                aVenir
                etat={`Match ${joues + i + 1}`}
                heure={m.scheduledAt ? heureFr(m.scheduledAt) : undefined}
                href={`/c/${slug}/matches/${m.id}`}
                className="accueil-a-venir"
              />
            </div>
          ))}
          {joues === 0 &&
            programmesCeSoir.length === 0 &&
            (soireeDuJour ? (
              blocSoiree(soireeDuJour)
            ) : (
              <p className="accueil-vide">Aucun match joué pour l&apos;instant.</p>
            ))}
        </>
      ),
    });
  }

  if (prochaineSoiree || programmesPlusTard.length > 0) {
    const md = prochaineSoiree;
    const relatif = md ? quandRelatif(md.date, maintenant) : null;
    onglets.push({
      id: "a-venir",
      label: "À venir",
      contenu: (
        <>
          {md && (
            <>
              <LigneSoiree
                texte={relatif ? `${relatif} · ${jourLong(md.date)}` : jourLong(md.date)}
                href={`/c/${slug}/sessions/${md.id}`}
              />
              {blocSoiree(md)}
            </>
          )}
          {programmesPlusTard.map((m, i) => {
            const quand = m.scheduledAt ?? m.playedAt;
            const externe = m.kind === "EXTERNAL" && m.opponent;
            return (
              <div key={m.id}>
                {(md || i > 0) && <div className="filet" />}
                <Link
                  href={`/c/${slug}/matches/${m.id}`}
                  className="accueil-prochaine match"
                >
                  <span className="camp">
                    <Ecusson
                      camp="A"
                      lettre={lettre(externe ? clubShort : m.teamAName)}
                    />
                    <span className="nom">
                      {externe ? clubShort : m.teamAName}
                    </span>
                  </span>
                  <span className="milieu">
                    <span className="quand">
                      {quandRelatif(quand, maintenant) ?? jourAbrege(quand)} ·{" "}
                      {heureFr(quand)}
                    </span>
                    <span className="lieu">
                      {externe
                        ? `Match externe · ${m.isHome ? "domicile" : "extérieur"}`
                        : "Match programmé"}
                      {" · "}
                      {m._count.rsvps} présent{m._count.rsvps > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="camp">
                    {externe ? (
                      <Ecusson
                        camp="club"
                        lettre={ini(m.opponent!.name)}
                        style={{ fontSize: 20 }}
                      />
                    ) : (
                      <Ecusson camp="B" lettre={lettre(m.teamBName)} />
                    )}
                    <span className="nom">
                      {externe ? m.opponent!.name : m.teamBName}
                    </span>
                  </span>
                </Link>
              </div>
            );
          })}
        </>
      ),
    });
  }

  const ongletInitial = ceSoirExiste
    ? "ce-soir"
    : onglets.some((o) => o.id === "a-venir")
      ? "a-venir"
      : onglets[0]?.id;

  // ── Le tableau : les six premiers, aux points du club ──────────────────
  const { pointsWin, pointsDraw } = ctx.club;
  const classementTrie = classement
    .map((r) => ({ ...r, pts: r.wins * pointsWin + r.draws * pointsDraw }))
    .sort(
      (x, y) =>
        y.pts - x.pts ||
        y.wins - x.wins ||
        y.goals - x.goals ||
        x.name.localeCompare(y.name),
    );
  const tableau = classementTrie.slice(0, 6);
  // Le joueur se cherche dans le tableau : sa ligne est marquée, et s'il est
  // au-delà du sixième, elle vient s'ajouter en bas, à sa vraie place.
  const monIndex = myPlayer
    ? classementTrie.findIndex((r) => r.playerId === myPlayer.id)
    : -1;
  const evolutions = succes?.club.evolutions ?? {};
  const rangeeTableau = (r: (typeof classementTrie)[number], rang: number) => (
    <Link
      key={r.playerId}
      href={`/c/${slug}/players/${r.playerId}`}
      className={`tableau-rangee${r.playerId === myPlayer?.id ? " moi" : ""}`}
      aria-current={r.playerId === myPlayer?.id ? "true" : undefined}
    >
      <span className="rang">
        {rang}
        <Evolution places={evolutions[r.playerId]} />
      </span>
      <AvatarAnneau
        nom={r.name}
        photo={r.photo}
        camp={chasubleDe.get(r.playerId) ?? null}
        taille={30}
      />
      <span>{r.name}</span>
      <span>{r.matchesPlayed}</span>
      <span>{r.wins}</span>
      <span>{r.draws}</span>
      <span>{r.losses}</span>
      <span>{r.goals}</span>
      <span>{r.pts}</span>
    </Link>
  );

  // ── Ma saison : le joueur connecté, s'il a déjà joué ───────────────────
  const moiSucces =
    myPlayer && succes ? succes.parJoueur.get(myPlayer.id) : undefined;
  // Ce que l'annonce reçoit : le plus haut palier de chaque famille (le plus
  // récent, les déblocages arrivent du plus récent au plus ancien). Avoir vu
  // « 10 buts » vaut avoir vu « 5 buts » (components/succes/vus.ts) : le reste
  // ne changerait rien à l'annonce, et partirait quand même au navigateur —
  // une soixantaine de lignes pour un habitué de trois saisons.
  let annoncables: SuccesJoueur["deblocages"] | null = null;
  if (moiSucces) {
    const parFamille = new Map<string, SuccesJoueur["deblocages"][number]>();
    for (const d of moiSucces.deblocages) {
      if (!parFamille.has(d.badgeId)) parFamille.set(d.badgeId, d);
    }
    annoncables = [...parFamille.values()];
  }
  let maSaison: React.ReactNode = null;
  if (myPlayer && moiSucces && moiSucces.niveau.xp > 0) {
    // Ce qu'il a fait à la dernière soirée : celle de ce soir dès qu'un
    // match y est terminé, sinon la précédente. L'historique est celui que
    // le moteur vient de charger (cache) : aucune requête de plus.
    const finisCeSoir = matchsCeSoir.filter((m) => m.status === "FINISHED");
    const soiree = finisCeSoir.length > 0 ? finisCeSoir : matchsDerniereSoiree;
    const ids = new Set(soiree.map((m) => m.id));
    const historique = await chargerHistorique(clubId);
    const b = bilanDuJoueur(
      historique.matchs.filter((m) => ids.has(m.id)),
      myPlayer.id,
    );
    const quand =
      finisCeSoir.length > 0
        ? "Ce soir"
        : dateDerniereSoiree
          ? capitale(dateRelative(dateDerniereSoiree.toISOString(), maintenant))
          : "";
    const voisin = (i: number) => {
      const r = classementTrie[i];
      return r
        ? {
            nom: r.name,
            points: r.pts,
            victoires: r.wins,
            buts: r.goals,
            camp: chasubleDe.get(r.playerId) ?? null,
          }
        : null;
    };
    maSaison = (
      <MaSaison
        slug={slug}
        playerId={myPlayer.id}
        succes={moiSucces}
        rang={monIndex >= 0 ? monIndex + 1 : null}
        total={classementTrie.length}
        moi={voisin(monIndex) ?? { nom: moiSucces.joueur.nom, points: 0, victoires: 0, buts: 0 }}
        evolution={evolutions[myPlayer.id] ?? null}
        devant={monIndex > 0 ? voisin(monIndex - 1) : null}
        derriere={monIndex >= 0 ? voisin(monIndex + 1) : null}
        bilan={b && quand ? { quand, bilan: b } : null}
        avecPasses={ctx.club.trackAssists}
      />
    );
  }

  // ── La bannière : ce soir, sinon la prochaine soirée ───────────────────
  const soireeBanniere = soireeDuJour ?? prochaineSoiree;
  const presencesBanniere = soireeBanniere ? presencesDe(soireeBanniere) : null;
  const joursBanniere = soireeBanniere ? ecartJours(soireeBanniere.date, maintenant) : 0;

  return (
    <main className="ecran">
      <EnteteCollante />

      {/* Les succès neufs du joueur connecté — une fois par appareil, jamais
          au premier passage (components/succes/vus.ts). Monté ici et sur sa
          fiche seulement : dans le layout, il s'ouvrirait en double. */}
      {myPlayer && annoncables && (
        <AnnonceSucces
          clubId={clubId}
          playerId={myPlayer.id}
          slug={slug}
          deblocages={annoncables}
        />
      )}

      {soireeBanniere && presencesBanniere && (
        <Banniere
          cle={soireeBanniere.id}
          href={`/c/${slug}/sessions/${soireeBanniere.id}`}
          titre={`${quandSoiree(soireeBanniere.date)}${soireeBanniere.location ? ` — ${soireeBanniere.location}` : ""}.`}
          aide={[
            joursBanniere >= 2 && joursBanniere <= 6 ? `Dans ${joursBanniere} jours` : null,
            phraseEtat(presencesBanniere.etat),
            maPlace(presencesBanniere),
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      )}

      {/* Le rappel qui règle la douleur d'origine : « à l'heure du match on
          oublie de faire la feuille de match ». La compo se décide trois à
          quatre jours avant ; à cinq jours, si elle n'est pas là, on le dit —
          avant le lundi, pas au coup d'envoi. */}
      {compoAFaire && nextMatchDay && (
        <Link
          href={`/c/${slug}/sessions/${nextMatchDay.id}`}
          className="rappel mt-[18px]"
        >
          <span className="rappel-pastille" />
          <span className="rappel-corps">
            <span className="rappel-titre">
              {joursAvant != null && joursAvant <= 0
                ? "C'est aujourd'hui"
                : joursAvant === 1
                  ? "Demain"
                  : `Dans ${joursAvant} jours`}{" "}
              — les équipes ne sont pas faites
            </span>
            <span className="rappel-aide">
              {jourLong(nextMatchDay.date)}
              {nextMatchDay.location ? ` · ${nextMatchDay.location}` : ""} —
              préparer la compo maintenant
            </span>
          </span>
          <Icon name="chevron" size={16} />
        </Link>
      )}

      {/* Aucun calendrier : la cause racine de tout le reste. Le jour de jeu
          se choisit en posant la saison — « tous les lundis » était faux pour
          un club du jeudi. */}
      {!nextMatchDay && ctx.canManage && (
        <Link href={`/c/${slug}/saison`} className="rappel mt-[18px]">
          <span className="rappel-pastille" style={{ background: "var(--i3)" }} />
          <span className="rappel-corps">
            <span className="rappel-titre">Aucune soirée au calendrier</span>
            <span className="rappel-aide">
              Pose la saison d&apos;un coup — une soirée par semaine, fériés exclus
            </span>
          </span>
          <Icon name="chevron" size={16} />
        </Link>
      )}

      {/* Le match en cours que le SERVEUR ne connaît pas encore (lancé hors-
          ligne, ou onglet tué) : il est dans Dexie, et c'est ici qu'on le
          retrouve. Pas quand le serveur a déjà une feuille ouverte : ce serait
          la même, annoncée deux fois. */}
      {feuillesOuvertes.length === 0 && (
        <ReprendreLocal slug={slug} clubId={clubId} />
      )}

      {/* La feuille qu'on a oublié de fermer.
          Un match reste LIVE tant que personne n'a sifflé la fin — et une
          soirée se termine rarement par un tap sur « Terminer » : on range le
          téléphone, on rentre. Le lendemain ce match n'apparaissait NULLE PART
          sur l'accueil (il n'est ni de ce soir, ni terminé), tout en gardant
          ses buts hors des statistiques. Il fallait le dire. */}
      {ctx.canScore && feuillesOubliees.length > 0 && (
        <section className="accueil-rattrapage">
          <div className="titre">
            {feuillesOubliees.length > 1
              ? `${feuillesOubliees.length} feuilles restées ouvertes`
              : "Feuille restée ouverte"}
          </div>
          {feuillesOubliees.map((m) => (
            <Link
              key={m.id}
              href={`/c/${slug}/matches/${m.id}/live`}
              className="rangee"
            >
              <span className="quand">
                {quandRelatif(m.playedAt, maintenant) ?? jourLong(m.playedAt)} ·{" "}
                {m.scoreA}–{m.scoreB}
              </span>
              <span className="acte">Terminer</span>
              <Icon name="chevron" size={16} />
            </Link>
          ))}
        </section>
      )}

      {/* Le rattrapage : une soirée jouée n'a pas de feuille. Le geste est
          le même que le coup d'envoi, la date en plus. */}
      {ctx.canScore && soireesSansResultat.length > 0 && (
        <section className="accueil-rattrapage">
          <div className="titre">
            {soireesSansResultat.length > 1
              ? `${soireesSansResultat.length} soirées sans résultat`
              : "Une soirée sans résultat"}
          </div>
          {soireesSansResultat.map((s) => {
            // Avant de réclamer une feuille, on regarde s'il existe déjà un
            // match de ce jour-là sans soirée. Si oui, le lien mène au MATCH
            // pour le ranger — jamais à une feuille vierge, qui en
            // fabriquerait un second (spec 0007).
            const r = soireeReclame(
              { date: s.date, canceledAt: null, matchsActifs: 0 },
              orphelins,
              Date.now(),
            );
            const ranger = r.quoi === "rattacher";
            return (
              <Link
                key={s.id}
                href={
                  ranger
                    ? `/c/${slug}/matches/${r.matchId}`
                    : `/c/${slug}/matches/new?md=${s.id}&joue=1`
                }
                className="rangee"
              >
                <span className="quand">{jourLong(s.date)}</span>
                <span className="acte">
                  {ranger ? "Ranger le match" : "Saisir la feuille"}
                </span>
                <Icon name="chevron" size={16} />
              </Link>
            );
          })}
        </section>
      )}

      {/* LA CARTE DES MATCHS : dernière soirée · ce soir · à venir. Seuls
          les onglets qui ont quelque chose à montrer existent. */}
      <Carte className="accueil-carte">
        {onglets.length > 0 ? (
          <Onglets onglets={onglets} initial={ongletInitial} />
        ) : (
          <p className="accueil-vide">
            Aucun match joué, aucune soirée au calendrier.
          </p>
        )}
      </Carte>

      {/* Le coup d'envoi, sous la carte des matchs, tant qu'aucun match de
          ce soir n'est en cours. Une feuille oubliée un autre jour ne le
          bloque pas : elle a sa carte, et la soirée doit pouvoir commencer. */}
      {!liveMatch && ctx.canScore && (
        <div className="accueil-lancer">
          {jourDeJeu && coupDEnvoiPret ? (
            <>
              <RematchButton
                clubId={clubId}
                slug={slug}
                teamAName={nomA}
                teamBName={nomB}
                kind="INTERNAL"
                opponentId={null}
                matchDayId={soireeEnCours?.id ?? null}
                seasonId={activeSeason?.id ?? null}
                label="Coup d'envoi"
                hint={`${nomA} ${compoA} vs ${compoB} ${nomB} — ${
                  sourcePreparee
                    ? "la compo préparée pour ce soir"
                    : "la compo de la dernière fois"
                }`}
                players={compoPrete}
              />
              <Link href={hrefNouveau} className="verre grand">
                Composer les équipes
                <Icon name="chevron" size={16} />
              </Link>
            </>
          ) : (
            <Link href={hrefNouveau} className={jourDeJeu ? "plein" : "verre grand"}>
              Lancer un match
              <Icon name="chevron" size={16} />
            </Link>
          )}
        </div>
      )}

      {maSaison}

      {/* LE TABLEAU : les six premiers, et le lien vers le classement
          complet. */}
      {tableau.length > 0 && (
        <Carte titre="Tableau" className="accueil-carte" style={{ padding: "0 12px 10px" }}>
          <div className="tableau-tete">
            <span />
            <span />
            <span>Joueur</span>
            <span>MJ</span>
            <span>V</span>
            <span>N</span>
            <span>D</span>
            <span>B</span>
            <span>PTS</span>
          </div>
          {tableau.map((r, i) => rangeeTableau(r, i + 1))}
          {monIndex >= tableau.length && (
            <>
              <div className="tableau-saut" aria-hidden>
                ···
              </div>
              {rangeeTableau(classementTrie[monIndex], monIndex + 1)}
            </>
          )}
          <Link href={`/c/${slug}/stats`} className="tableau-pied">
            Tableau complet ›
          </Link>
        </Carte>
      )}

      {/* Les derniers paliers franchis dans le club, après le tableau : on y
          descend le mardi, on ne le cherche pas au bord du terrain. */}
      {succes && (
        <ExploitsDuClub
          slug={slug}
          fil={succes.club.fil}
          campDe={chasubleDe}
          maintenant={maintenant}
        />
      )}
    </main>
  );
}
