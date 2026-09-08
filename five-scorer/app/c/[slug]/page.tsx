import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";
import Icon from "@/components/Icon";
import RematchButton from "@/components/RematchButton";
import ReprendreLocal from "@/components/ReprendreLocal";
import Carte from "@/components/ios/Carte";
import Onglets from "@/components/ios/Onglets";
import Ecusson from "@/components/ios/Ecusson";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import LigneScore from "@/components/ios/LigneScore";
import { nomsChasubles, DEFAULT_BIB_B } from "@/lib/color";
import { lum, mix, normaliseCouleur } from "@/lib/theme";
import { ini, lettre } from "@/lib/ini";
import { estRetro } from "@/lib/retro";
import EnteteCollante from "./_accueil/EnteteCollante";
import Banniere from "./_accueil/Banniere";
import BoutonPresence from "./_accueil/BoutonPresence";
import HorlogeDirect from "./_accueil/HorlogeDirect";
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

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const heureFr = (d: Date) =>
  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
/// « 7 sept. »
const jourCourt = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
/// « Lundi 31 »
const ongletJour = (d: Date) =>
  majuscule(
    d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" }),
  );
/// « Lundi 14 septembre »
const jourLong = (d: Date) =>
  majuscule(
    d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );
/// « Sam. 19 sept. »
const jourAbrege = (d: Date) =>
  majuscule(
    d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  );
const minuit = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export default async function ClubHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;

  const debutDeCeJour = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const finDeCeJour = new Date(debutDeCeJour.getTime() + 86_400_000);

  const activeSeason = await prisma.season.findFirst({
    where: { clubId, isActive: true },
    orderBy: { startsAt: "desc" },
  });

  const [
    liveMatch,
    prochainesSoirees,
    upcomingMatches,
    myPlayer,
    lastLineup,
    classement,
  ] = await Promise.all([
    prisma.match.findFirst({
      where: { clubId, status: "LIVE" },
      orderBy: { playedAt: "desc" },
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
        rsvps: { select: { playerId: true, status: true } },
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
      select: { id: true },
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
  ]);

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

  const [matchsCeSoir, dernierFini, soireesSansResultat] = await Promise.all([
    ceSoirExiste
      ? prisma.match.findMany({
          where: {
            clubId,
            status: { in: ["FINISHED", "LIVE"] },
            OR: [
              ...(soireeDuJour ? [{ matchDayId: soireeDuJour.id }] : []),
              { playedAt: { gte: debutDeCeJour } },
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
          gte: new Date(debutDeCeJour.getTime() - 42 * 86_400_000),
        },
        // Un match seulement PROGRAMMÉ ne compte pas pour un résultat.
        matches: { none: { status: { in: ["LIVE", "FINISHED"] } } },
      },
      orderBy: { date: "desc" },
      take: 3,
      select: { id: true, date: true },
    }),
  ]);

  // La dernière soirée jouée : la soirée du calendrier à laquelle le dernier
  // match est rattaché, sinon tous les matchs de ce jour-là — un club qui
  // n'a pas encore posé son calendrier a quand même joué.
  const matchsDerniereSoiree = dernierFini
    ? await prisma.match.findMany({
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
    : [];
  const dateDerniereSoiree = dernierFini
    ? (dernierFini.matchDay?.date ?? dernierFini.playedAt)
    : null;

  // Les noms d'équipe par défaut se déduisent des chasubles du club : une
  // équipe nommée « Blanc » ne doit pas porter une barre noire.
  const nomsClub = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  // Le nom court : « FC Lundi Soir » devient « Lundi Soir ».
  const clubShort = ctx.org.name.replace(/^(FC|AS|US|SC|Five)\s+/i, "");

  // Rattacher le match à la soirée en cours, oui — à celle de la semaine
  // prochaine, non. On ne recolle que si on est effectivement dedans.
  const soireeEnCours =
    nextMatchDay &&
    Math.abs(nextMatchDay.date.getTime() - Date.now()) < 12 * 3600_000
      ? nextMatchDay
      : null;

  // D'où vient la compo du coup d'envoi, dans l'ordre :
  //   1. celle PRÉPARÉE pour la soirée du jour — le club connaît ses équipes
  //      trois à quatre jours avant, c'est la seule source qui soit juste ;
  //   2. à défaut, celle du dernier match joué, clairement annoncée comme telle.
  // Les joueurs archivés depuis ne sont jamais reconduits.
  // La compo à utiliser et le rattachement à la soirée sont deux questions
  // distinctes. On prend la compo dès qu'elle est préparée pour la prochaine
  // soirée — c'est l'intention la plus à jour du club, même la veille. On ne
  // RATTACHE le match à cette soirée, en revanche, que si on est dedans.
  const compoSoiree = (nextMatchDay?.lineup ?? []).map((l) => ({
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
    ? (nextMatchDay?.teamAName ?? nomsClub.a)
    : (lastLineup?.teamAName ?? nomsClub.a);
  const nomB = sourcePreparee
    ? (nextMatchDay?.teamBName ?? nomsClub.b)
    : (lastLineup?.teamBName ?? nomsClub.b);
  // La chasuble de chacun dans la dernière compo connue : c'est l'anneau
  // de son avatar dans le tableau.
  const chasubleDe = new Map(compoPrete.map((p) => [p.id, p.team]));

  // La compo se décide trois à quatre jours avant. À partir de cinq jours, si
  // elle n'est pas faite, on le dit — c'est l'oubli qui coûtait le temps au
  // coup d'envoi, et c'est le seul moment où le rappel sert encore à quelque
  // chose.
  // Compté en JOURS CIVILS, pas en millisecondes : à 19 h pour une soirée à
  // 20 h, Math.ceil sur l'écart donnait 1 et le rappel annonçait « Demain »
  // au-dessus de la date du jour même.
  const joursAvant = nextMatchDay
    ? Math.round((minuit(nextMatchDay.date) - minuit(new Date())) / 86_400_000)
    : null;
  // « ce soir », « demain », ou le jour nommé : le bouton dit de quelle soirée
  // vient la compo qu'il s'apprête à utiliser.
  const quandCourt =
    joursAvant == null || joursAvant <= 0
      ? "ce soir"
      : joursAvant === 1
        ? "demain"
        : (nextMatchDay?.date.toLocaleDateString("fr-FR", {
            weekday: "long",
          }) ?? "la prochaine soirée");
  const compoAFaire =
    nextMatchDay != null &&
    nextMatchDay.lineup.length === 0 &&
    joursAvant != null &&
    joursAvant <= 5 &&
    ctx.canScore;

  // ── La bannière : ce soir, sinon la prochaine soirée ───────────────────
  const soireeBanniere = soireeDuJour ?? prochaineSoiree;
  const presents = (md: { rsvps: { status: string }[] }) =>
    md.rsvps.filter((r) => r.status === "IN").length;
  const maReponse = (md: { rsvps: { playerId: string; status: "IN" | "MAYBE" | "OUT" }[] }) =>
    myPlayer ? (md.rsvps.find((r) => r.playerId === myPlayer.id)?.status ?? null) : null;
  // Le voile de la bannière : la chasuble B assombrie de moitié.
  // Le fond de la bannière dérive de la chasuble B, mais il doit rester
  // SOMBRE sous du texte blanc : une chasuble blanche donnait un voile blanc
  // et un titre illisible. On assombrit jusqu'à une luminance ≤ 0,3.
  let fondBanniere = mix(ctx.club.colorB, "#000000", 0.5);
  for (let i = 0; i < 6 && lum(fondBanniere) > 0.3; i++) fondBanniere = mix(fondBanniere, "#000000", 0.35);

  // ── Les onglets de la carte des matchs ─────────────────────────────────
  const nomAdverse = (m: {
    kind: "INTERNAL" | "EXTERNAL";
    teamBName: string;
    opponent: { name: string } | null;
  }) => (m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName);

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
          {joues === 0 && programmesCeSoir.length === 0 && (
            <p className="accueil-vide">Aucun match joué pour l&apos;instant.</p>
          )}
        </>
      ),
    });
  }

  if (prochaineSoiree || programmesPlusTard.length > 0) {
    const md = prochaineSoiree;
    const reponse = md ? maReponse(md) : null;
    const compoFaite = md ? md.lineup.length > 0 : false;
    const nA = md ? (md.teamAName ?? nomsClub.a) : nomsClub.a;
    const nB = md ? (md.teamBName ?? nomsClub.b) : nomsClub.b;
    const cA = md ? md.lineup.filter((l) => l.team === "A").length : 0;
    const cB = md ? md.lineup.filter((l) => l.team === "B").length : 0;
    onglets.push({
      id: "a-venir",
      label: "À venir",
      contenu: (
        <>
          {md && (
            <>
              <LigneSoiree
                texte={jourLong(md.date)}
                href={`/c/${slug}/sessions/${md.id}`}
              />
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
                  {md.rsvps.length} réponse{md.rsvps.length > 1 ? "s" : ""} ·{" "}
                  {compoFaite ? `${nA} ${cA} contre ${cB} ${nB}` : "équipes à préparer"}
                </span>
                {myPlayer && (
                  <BoutonPresence
                    slug={slug}
                    matchDayId={md.id}
                    playerId={myPlayer.id}
                    initial={reponse}
                  />
                )}
              </div>
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
                      {jourAbrege(quand)} · {heureFr(quand)}
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
  const tableau = classement
    .map((r) => ({ ...r, pts: r.wins * pointsWin + r.draws * pointsDraw }))
    .sort(
      (x, y) =>
        y.pts - x.pts ||
        y.wins - x.wins ||
        y.goals - x.goals ||
        x.name.localeCompare(y.name),
    )
    .slice(0, 6);

  return (
    <main className="ecran">
      <EnteteCollante />

      {soireeBanniere && (
        <Banniere
          cle={soireeBanniere.id}
          href={`/c/${slug}/sessions/${soireeBanniere.id}`}
          titre={
            soireeDuJour
              ? `Ce soir ${heureFr(soireeDuJour.date)}${soireeDuJour.location ? ` — ${soireeDuJour.location}` : ""}.`
              : `${jourAbrege(soireeBanniere.date)} ${heureFr(soireeBanniere.date)}${soireeBanniere.location ? ` — ${soireeBanniere.location}` : ""}.`
          }
          aide={`${presents(soireeBanniere)} présent${presents(soireeBanniere) > 1 ? "s" : ""} · ${
            maReponse(soireeBanniere) ? "Touchez pour la soirée." : "Touchez pour répondre."
          }`}
          fond={fondBanniere}
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

      {/* Aucun calendrier : la cause racine de tout le reste. */}
      {!nextMatchDay && ctx.canManage && (
        <Link href={`/c/${slug}/saison`} className="rappel mt-[18px]">
          <span className="rappel-pastille" style={{ background: "var(--i3)" }} />
          <span className="rappel-corps">
            <span className="rappel-titre">Aucune soirée au calendrier</span>
            <span className="rappel-aide">
              Pose la saison d&apos;un coup — tous les lundis, fériés exclus
            </span>
          </span>
          <Icon name="chevron" size={16} />
        </Link>
      )}

      {/* Le match en cours que le SERVEUR ne connaît pas encore (lancé hors-
          ligne, ou onglet tué) : il est dans Dexie, et c'est ici qu'on le
          retrouve. */}
      {!liveMatch && <ReprendreLocal slug={slug} clubId={clubId} />}

      {/* La feuille qu'on a oublié de fermer.
          Un match reste LIVE tant que personne n'a sifflé la fin — et une
          soirée se termine rarement par un tap sur « Terminer » : on range le
          téléphone, on rentre. Le lendemain ce match n'apparaissait NULLE PART
          sur l'accueil (il n'est ni de ce soir, ni terminé), tout en bloquant
          le coup d'envoi suivant et en gardant ses buts hors des
          statistiques. Il fallait le dire. */}
      {ctx.canScore && liveMatch && estRetro(liveMatch.playedAt) && (
        <section className="accueil-rattrapage">
          <div className="titre">Feuille restée ouverte</div>
          <Link
            href={`/c/${slug}/matches/${liveMatch.id}/live`}
            className="rangee"
          >
            <span className="quand">
              {jourLong(liveMatch.playedAt)} · {liveMatch.scoreA}–
              {liveMatch.scoreB}
            </span>
            <span className="acte">Terminer</span>
            <Icon name="chevron" size={16} />
          </Link>
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
          {soireesSansResultat.map((s) => (
            <Link
              key={s.id}
              href={`/c/${slug}/matches/new?md=${s.id}&joue=1`}
              className="rangee"
            >
              <span className="quand">{jourLong(s.date)}</span>
              <span className="acte">Saisir la feuille</span>
              <Icon name="chevron" size={16} />
            </Link>
          ))}
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

      {/* Le coup d'envoi, sous la carte des matchs, tant qu'aucun match
          n'est en cours. */}
      {!liveMatch && ctx.canScore && (
        <div className="accueil-lancer">
          {coupDEnvoiPret ? (
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
                    ? `la compo préparée pour ${quandCourt}`
                    : "la compo de la dernière fois"
                }`}
                players={compoPrete}
              />
              <Link href={`/c/${slug}/matches/new`} className="verre grand">
                Composer les équipes
                <Icon name="chevron" size={16} />
              </Link>
            </>
          ) : (
            <Link href={`/c/${slug}/matches/new`} className="plein">
              Lancer un match
              <Icon name="chevron" size={16} />
            </Link>
          )}
        </div>
      )}

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
          {tableau.map((r, i) => (
            <Link
              key={r.playerId}
              href={`/c/${slug}/players/${r.playerId}`}
              className="tableau-rangee"
            >
              <span>{i + 1}</span>
              <AvatarAnneau
                nom={r.name}
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
          ))}
          <Link href={`/c/${slug}/stats`} className="tableau-pied">
            Tableau complet ›
          </Link>
        </Carte>
      )}
    </main>
  );
}
