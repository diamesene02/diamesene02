import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getClubSummary } from "@/lib/stats";
import RsvpPanel from "@/components/RsvpPanel";
import Icon from "@/components/Icon";
import RematchButton from "@/components/RematchButton";
import Panneau from "@/components/Panneau";
import ReprendreLocal from "@/components/ReprendreLocal";
import { nomsChasubles } from "@/lib/color";

export const dynamic = "force-dynamic";

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

  const activeSeason = await prisma.season.findFirst({
    where: { clubId, isActive: true },
    orderBy: { startsAt: "desc" },
  });

  const [
    liveMatch,
    recentMatches,
    nextMatchDay,
    upcomingMatches,
    summary,
    myPlayer,
    lastLineup,
  ] = await Promise.all([
      prisma.match.findFirst({
        where: { clubId, status: "LIVE" },
        orderBy: { playedAt: "desc" },
      }),
      prisma.match.findMany({
        where: { clubId, status: "FINISHED" },
        orderBy: { playedAt: "desc" },
        take: 5,
        include: {
          mvp: true,
          opponent: true,
          events: { where: { type: { in: ["GOAL", "OWN_GOAL"] } } },
        },
      }),
      prisma.matchDay.findFirst({
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
        include: {
          rsvps: { include: { player: { select: { id: true, name: true } } } },
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
      getClubSummary({ clubId, seasonId: activeSeason?.id ?? null }),
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
    ]);

  // Les noms d'équipe par défaut se déduisent des chasubles du club : une
  // équipe nommée « Blanc » ne doit pas porter une barre noire.
  const nomsClub = nomsChasubles(ctx.club.colorA, ctx.club.colorB);

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

  // La compo se décide trois à quatre jours avant. À partir de cinq jours, si
  // elle n'est pas faite, on le dit — c'est l'oubli qui coûtait le temps au
  // coup d'envoi, et c'est le seul moment où le rappel sert encore à quelque
  // chose.
  // Compté en JOURS CIVILS, pas en millisecondes : à 19 h pour une soirée à
  // 20 h, Math.ceil sur l'écart donnait 1 et le rappel annonçait « Demain »
  // au-dessus de la date du jour même.
  const minuit = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
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

  const hero = recentMatches[0];
  const rest = recentMatches.slice(1);
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });

  const quandFr = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <main>
      {/* Le rappel qui règle la douleur d'origine : « à l'heure du match on
          oublie de faire la feuille de match ». La compo se décide trois à
          quatre jours avant ; à cinq jours, si elle n'est pas là, on le dit —
          avant le lundi, pas au coup d'envoi. */}
      {compoAFaire && nextMatchDay && (
        <Link href={`/c/${slug}/sessions/${nextMatchDay.id}`} className="rappel">
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
              {quandFr(nextMatchDay.date)}
              {nextMatchDay.location ? ` · ${nextMatchDay.location}` : ""} —
              préparer la compo maintenant
            </span>
          </span>
          <Icon name="chevron" size={16} />
        </Link>
      )}

      {/* Aucun calendrier : la cause racine de tout le reste. */}
      {!nextMatchDay && ctx.canManage && (
        <Link href={`/c/${slug}/saison`} className="rappel">
          <span className="rappel-pastille" style={{ background: "var(--ink-3)" }} />
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

      {/* LE MATCH EN COURS, s'il y en a un : le panneau, pas une carte. */}
      {liveMatch && (
        <Link href={`/c/${slug}/matches/${liveMatch.id}/live`} className="block">
          <div className="contexte">
            <span className="live-dot" aria-hidden />
            En direct — reprendre
          </div>
          <Panneau
            a={liveMatch.teamAName}
            b={liveMatch.teamBName}
            scoreA={liveMatch.scoreA}
            scoreB={liveMatch.scoreB}
            taille="panneau"
          />
        </Link>
      )}

      {/* LE PROCHAIN LUNDI. C'est l'information de la semaine, donc c'est le
          titre de la page — pas un slogan. Un club ne s'ouvre pas sur une
          promesse marketing, il s'ouvre sur sa prochaine échéance. */}
      {!liveMatch && (
        <section className="pt-2">
          {nextMatchDay ? (
            <>
              <div className="contexte">
                {joursAvant != null && joursAvant <= 0
                  ? "Ce soir"
                  : joursAvant === 1
                    ? "Demain"
                    : `Dans ${joursAvant} jours`}
                {nextMatchDay.location ? ` · ${nextMatchDay.location}` : ""}
              </div>
              <Link
                href={`/c/${slug}/sessions/${nextMatchDay.id}`}
                className="display-xl mt-2 block capitalize"
              >
                {nextMatchDay.date.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Link>
              <div className="synthese mt-3">
                <b>
                  {nextMatchDay.date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </b>
                {compoPrete.length > 0 && sourcePreparee ? (
                  <>
                    <span className="synthese-sep">·</span>
                    <span>
                      {nomA} <b>{compoA}</b> contre <b>{compoB}</b> {nomB}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="synthese-sep">·</span>
                    <span>équipes à préparer</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="contexte">{ctx.org.name}</div>
              <h1 className="display-xl mt-2">Aucune soirée au calendrier.</h1>
            </>
          )}

          {ctx.canScore && (
            <div className="mt-6">
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
                  <Link
                    href={`/c/${slug}/matches/new`}
                    className="btn ghost tap mt-3 w-full"
                  >
                    Composer les équipes
                    <Icon name="chevron" size={16} />
                  </Link>
                </>
              ) : (
                <Link
                  href={`/c/${slug}/matches/new`}
                  className="btn primary big tap w-full"
                >
                  Lancer un match
                  <Icon name="chevron" size={16} />
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {/* La section « Prochaine soirée » disait mot pour mot ce que le titre
          de la page dit déjà, et portait un sondage de présences dont ce club
          n'a pas l'usage : l'effectif est connu, les équipes se décident sur
          WhatsApp. Le lien vers la soirée est sur la date elle-même. */}

      {/* Prochains matchs programmés — convocations en cours */}
      {upcomingMatches.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Prochains matchs</span>
          <ul className="divide-y divide-[color:var(--rule)] overflow-hidden rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)]">
            {upcomingMatches.map((m) => {
              const when = m.scheduledAt ?? m.playedAt;
              return (
                <li key={m.id}>
                  <Link
                    href={`/c/${slug}/matches/${m.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--pitch-2)]"
                  >
                    <span className="w-20 shrink-0 font-mono text-[11px] uppercase leading-tight text-[color:var(--ink-2)]">
                      {fmtDate(when)}
                      <br />
                      <span className="text-[color:var(--ink-1)]">
                        {when.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      {m.teamAName}{" "}
                      <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                      {m.kind === "EXTERNAL" && m.opponent
                        ? m.opponent.name
                        : m.teamBName}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-bold text-[color:var(--bib-a-ink)]">
                      {m._count.rsvps} présent{m._count.rsvps > 1 ? "s" : ""}
                    </span>
                    <span className="shrink-0 text-[10px] font-black  text-[color:var(--bib-b-ink)]">
                      Répondre →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* La saison en UNE ligne. Quatre tuiles « étiquette + gros chiffre »
          occupaient un quart d'écran pour dire quatre nombres : c'est le
          gabarit de tableau de bord, pas la densité d'une page de sport. */}
      {summary.matchesPlayed > 0 && (
        <section className="bande mt-8">
          <div className="synthese">
            <span>
              <b>{summary.matchesPlayed}</b> match
              {summary.matchesPlayed > 1 ? "s" : ""}
            </span>
            <span className="synthese-sep">·</span>
            <span>
              <b>{summary.totalGoals}</b> but
              {summary.totalGoals > 1 ? "s" : ""}
            </span>
            {summary.topScorer && (
              <>
                <span className="synthese-sep">·</span>
                <span>
                  {summary.topScorer.name} <b>{summary.topScorer.goals}</b>
                </span>
              </>
            )}
            {summary.topMvp && (
              <>
                <span className="synthese-sep">·</span>
                <span>
                  {summary.topMvp.name} <b>{summary.topMvp.count}</b> fois
                  homme du match
                </span>
              </>
            )}
          </div>
        </section>
      )}

      {/* LE DERNIER MATCH. Le même panneau que partout, et la bande du
          vainqueur reste élargie : le résultat se lit à la géométrie avant
          d'être lu au chiffre. */}
      {hero && (
        <section className="mt-8">
          <div className="bande-titre">
            <span className="kicker">Dernier match</span>
            <Link
              href={`/c/${slug}/matches`}
              className="text-[13px] font-semibold text-[color:var(--ink-2)]"
            >
              Tout voir →
            </Link>
          </div>
          <Link href={`/c/${slug}/matches/${hero.id}`} className="block">
            <Panneau
              a={hero.teamAName}
              b={
                hero.kind === "EXTERNAL" && hero.opponent
                  ? hero.opponent.name
                  : hero.teamBName
              }
              scoreA={hero.scoreA}
              scoreB={hero.scoreB}
              taille="panneau"
              fini
              pied={
                <span className="synthese">
                  <span>{fmtDate(hero.playedAt)}</span>
                  <span className="synthese-sep">·</span>
                  <span>
                    <b>{hero.events.length}</b> but
                    {hero.events.length > 1 ? "s" : ""}
                  </span>
                  {hero.mvp && (
                    <>
                      <span className="synthese-sep">·</span>
                      <span style={{ color: "var(--gold)" }}>
                        {hero.mvp.name}
                      </span>
                    </>
                  )}
                </span>
              }
            />
          </Link>
        </section>
      )}

      {/* L'ARCHIVE en ticker : date, score tabulaire, adversaire. Un filet
          entre les lignes, aucun contour autour. Un service de résultats. */}
      {rest.length > 0 && (
        <section className="bande mt-8">
          <div className="bande-titre">
            <span className="kicker">Avant ça</span>
          </div>
          <ul>
            {rest.map((m) => {
              const aGagne = m.scoreA > m.scoreB;
              const bGagne = m.scoreB > m.scoreA;
              return (
                <li key={m.id}>
                  <Link href={`/c/${slug}/matches/${m.id}`} className="ticker">
                    <span className="ticker-heure">
                      {m.playedAt.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="ticker-score">
                      <span className={aGagne ? "" : "text-[color:var(--ink-3)]"}>
                        {m.scoreA}
                      </span>
                      <span className="px-1.5 text-[color:var(--rule-hi)]">—</span>
                      <span className={bGagne ? "" : "text-[color:var(--ink-3)]"}>
                        {m.scoreB}
                      </span>
                    </span>
                    <span className="ticker-buteurs">
                      {m.teamAName} · {" "}
                      {m.kind === "EXTERNAL" && m.opponent
                        ? m.opponent.name
                        : m.teamBName}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {hero && !liveMatch && ctx.canScore && (
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href={`/c/${slug}/matches/new`}
            className="inline-flex items-center gap-2 rounded-[2px] border border-[color:var(--rule-hi)] bg-[color:var(--pitch-2)] px-5 py-2.5 text-sm font-bold hover:border-[color:var(--ink-1)]"
          >
            + Nouveau match
          </Link>
        </div>
      )}
    </main>
  );
}
