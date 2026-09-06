import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getClubSummary } from "@/lib/stats";
import RsvpPanel from "@/components/RsvpPanel";
import Icon from "@/components/Icon";
import RematchButton from "@/components/RematchButton";

export const dynamic = "force-dynamic";

export default async function ClubHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;

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
        where: { clubId, date: { gte: new Date(Date.now() - 12 * 3600_000) } },
        orderBy: { date: "asc" },
        include: {
          rsvps: { include: { player: { select: { id: true, name: true } } } },
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

  // Les joueurs archivés depuis ne sont pas reconduits : une compo recopiée
  // telle quelle ferait revenir des gens qui ont quitté le club.
  const compoPrete = (lastLineup?.participants ?? []).filter(
    (p) => !p.player.isArchived,
  );
  const compoA = compoPrete.filter((p) => p.team === "A").length;
  const compoB = compoPrete.filter((p) => p.team === "B").length;
  const coupDEnvoiPret = compoA > 0 && compoB > 0;
  // Rattacher le match à la soirée en cours, oui — à celle de la semaine
  // prochaine, non. On ne recolle que si on est effectivement dedans.
  const soireeEnCours =
    nextMatchDay &&
    Math.abs(nextMatchDay.date.getTime() - Date.now()) < 12 * 3600_000
      ? nextMatchDay.id
      : null;

  const hero = recentMatches[0];
  const rest = recentMatches.slice(1);
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });

  return (
    <main>
      {/* Match en cours */}
      {liveMatch ? (
        <Link
          href={`/c/${slug}/matches/${liveMatch.id}/live`}
          className="aurora edge-top block overflow-hidden rounded-3xl p-6"
        >
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <span className="kicker text-[color:var(--live)]">
              En cours · reprendre
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="display-md">
              {liveMatch.teamAName}
              <br />
              <span className="text-[color:var(--b-400)]">
                vs {liveMatch.teamBName}
              </span>
            </div>
            <div className="num-sculpt text-7xl">
              {liveMatch.scoreA}
              <span className="px-2 text-[color:var(--ink-2)]">:</span>
              {liveMatch.scoreB}
            </div>
          </div>
        </Link>
      ) : (
        <section className="aurora edge-top relative overflow-hidden rounded-3xl border border-[color:var(--stroke)] p-8">
          <div className="relative z-[1] flex flex-col items-start gap-4">
            <span className="kicker">
              {activeSeason ? activeSeason.name : ctx.org.name}
            </span>
            <h1 className="display-xl">
              Marque <em>vite</em>.
              <br />
              Regarde <em>mieux</em>.
            </h1>
            {/* Une action dominante, deux secondaires de largeur égale :
                l'œil sait où aller, la grille tient au millimètre. */}
            {ctx.canScore && (
              <div className="mt-2 w-full">
                {/* À l'heure du match, la feuille n'est pas faite et on la
                    fait debout, au bord du terrain, pendant que dix personnes
                    attendent. Le coup d'envoi part donc de la dernière compo
                    jouée — annoncée avant le tap, et corrigeable une fois le
                    match lancé (tap sur un nom → changer de camp). L'écran de
                    composition reste là pour qui veut tout revoir. */}
                {coupDEnvoiPret && lastLineup ? (
                  <>
                    <RematchButton
                      clubId={clubId}
                      slug={slug}
                      teamAName={lastLineup.teamAName}
                      teamBName={lastLineup.teamBName}
                      kind="INTERNAL"
                      opponentId={null}
                      matchDayId={soireeEnCours}
                      seasonId={activeSeason?.id ?? null}
                      label="Coup d'envoi"
                      hint={`${lastLineup.teamAName} ${compoA} vs ${compoB} ${lastLineup.teamBName} — la compo de la dernière fois`}
                      players={compoPrete.map((p) => ({
                        id: p.player.id,
                        name: p.player.name,
                        nickname: p.player.nickname,
                        skill: p.player.skill,
                        isGk: p.isGk,
                        isGuest: p.player.isGuest,
                        team: p.team as "A" | "B",
                      }))}
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
                {/* « Programmer » sert de préfixe commun : les deux boutons
                    tiennent alors sur une ligne, sans rétrécir le texte. */}
                <div className="mt-4">
                  <span className="kicker">Programmer</span>
                  <div className="mt-2 flex gap-2">
                    <Link
                      href={`/c/${slug}/matches/schedule`}
                      className="btn ghost tap px-4 text-sm"
                    >
                      Un match
                    </Link>
                    <Link
                      href={`/c/${slug}/matches/new-session`}
                      className="btn ghost tap px-4 text-sm"
                    >
                      Une soirée
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Prochaine session + RSVP */}
      {nextMatchDay && (
        <section className="mt-8 rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="kicker">Prochaine soirée</span>
              <div className="mt-1 text-xl font-black">
                <Link
                  href={`/c/${slug}/sessions/${nextMatchDay.id}`}
                  className="hover:text-[color:var(--lime)]"
                >
                  {nextMatchDay.title || "Five"}
                </Link>
                <span className="ml-3 font-mono text-sm font-bold text-[color:var(--lime)]">
                  {fmtDate(nextMatchDay.date)}
                  {" · "}
                  {nextMatchDay.date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {nextMatchDay.location && (
                <div className="mt-0.5 text-sm text-[color:var(--ink-1)]">
                  <Icon name="pin" size={13} />
                  {nextMatchDay.location}
                </div>
              )}
            </div>
            {ctx.canScore && (
              <Link
                href={`/c/${slug}/matches/new?md=${nextMatchDay.id}`}
                className="rounded-full bg-[color:var(--lime)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[color:var(--bg-0)]"
              >
                Lancer un match
              </Link>
            )}
          </div>
          <RsvpPanel
            slug={slug}
            matchDayId={nextMatchDay.id}
            myPlayerId={myPlayer?.id ?? null}
            canManage={ctx.canManage}
            rsvps={nextMatchDay.rsvps.map((r) => ({
              playerId: r.player.id,
              name: r.player.name,
              status: r.status,
            }))}
          />
        </section>
      )}

      {/* Prochains matchs programmés — convocations en cours */}
      {upcomingMatches.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Prochains matchs</span>
          <ul className="divide-y divide-[color:var(--stroke)] overflow-hidden rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]">
            {upcomingMatches.map((m) => {
              const when = m.scheduledAt ?? m.playedAt;
              return (
                <li key={m.id}>
                  <Link
                    href={`/c/${slug}/matches/${m.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="w-20 shrink-0 font-mono text-[11px] uppercase leading-tight text-[color:var(--ink-2)]">
                      {fmtDate(when)}
                      <br />
                      <span className="text-[color:var(--lime)]">
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
                    <span className="shrink-0 font-mono text-xs font-bold text-[color:var(--a-400)]">
                      {m._count.rsvps} présent{m._count.rsvps > 1 ? "s" : ""}
                    </span>
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[color:var(--b-400)]">
                      Répondre →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Chiffres de la saison */}
      {summary.matchesPlayed > 0 && (
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Matchs", value: String(summary.matchesPlayed) },
            { label: "Buts", value: String(summary.totalGoals) },
            {
              label: "Pichichi",
              value: summary.topScorer
                ? `${summary.topScorer.name} · ${summary.topScorer.goals}`
                : "—",
            },
            {
              label: "MVP",
              value: summary.topMvp
                ? `${summary.topMvp.name} · ${summary.topMvp.count}`
                : "—",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] px-4 py-3"
            >
              <div className="kicker">{s.label}</div>
              <div className="mt-1 truncate text-lg font-black">{s.value}</div>
            </div>
          ))}
        </section>
      )}

      {/* Dernier match — traitement poster */}
      {hero && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="kicker">Dernier match</span>
            <Link
              href={`/c/${slug}/matches`}
              className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)] hover:text-white"
            >
              Tout voir →
            </Link>
          </div>
          <Link
            href={`/c/${slug}/matches/${hero.id}`}
            className="edge-top group block overflow-hidden rounded-3xl border border-[color:var(--stroke)] bg-gradient-to-br from-[color:var(--bg-1)] to-[color:var(--bg-0)] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] transition-colors hover:border-[color:var(--stroke-hi)]"
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--a-400)]">
                  {hero.teamAName}
                </div>
                <div
                  className="num-sculpt mt-2"
                  style={{ fontSize: "clamp(64px, 15vw, 140px)" }}
                  data-win={hero.scoreA > hero.scoreB ? "true" : "false"}
                >
                  {hero.scoreA}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-px bg-[color:var(--stroke-hi)]" />
                <span className="text-xs font-black uppercase tracking-widest text-[color:var(--ink-2)]">
                  VS
                </span>
                <div className="h-16 w-px bg-[color:var(--stroke-hi)]" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--b-400)]">
                  {hero.kind === "EXTERNAL" && hero.opponent
                    ? hero.opponent.name
                    : hero.teamBName}
                </div>
                <div
                  className="num-sculpt mt-2"
                  style={{ fontSize: "clamp(64px, 15vw, 140px)" }}
                  data-win={hero.scoreB > hero.scoreA ? "true" : "false"}
                >
                  {hero.scoreB}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--stroke)] pt-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-[color:var(--ink-1)]">
                  {fmtDate(hero.playedAt)}
                </span>
                <span className="text-[color:var(--ink-2)]">·</span>
                <span className="font-mono text-[color:var(--ink-2)]">
                  {hero.events.length} but{hero.events.length > 1 ? "s" : ""}
                </span>
                {hero.mvp && (
                  <>
                    <span className="text-[color:var(--ink-2)]">·</span>
                    <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[color:var(--gold)]">
                      <Icon name="star" size={11} filled />
                      {hero.mvp.name}
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-1)] group-hover:text-[color:var(--lime)]">
                Voir le récap →
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* Archive compacte */}
      {rest.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Archive</span>
          <ul className="divide-y divide-[color:var(--stroke)] overflow-hidden rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]">
            {rest.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/c/${slug}/matches/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="w-14 font-mono text-[11px] uppercase text-[color:var(--ink-2)]">
                    {m.playedAt.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <span className="flex-1 truncate text-sm font-bold">
                    {m.teamAName}{" "}
                    <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                    {m.kind === "EXTERNAL" && m.opponent
                      ? m.opponent.name
                      : m.teamBName}
                  </span>
                  <span className="font-mono text-sm font-black">
                    <span
                      className={
                        m.scoreA > m.scoreB
                          ? "text-[color:var(--lime)]"
                          : "text-[color:var(--ink-1)]"
                      }
                    >
                      {m.scoreA}
                    </span>
                    <span className="px-1.5 text-[color:var(--ink-2)]">:</span>
                    <span
                      className={
                        m.scoreB > m.scoreA
                          ? "text-[color:var(--lime)]"
                          : "text-[color:var(--ink-1)]"
                      }
                    >
                      {m.scoreB}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hero && !liveMatch && ctx.canScore && (
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href={`/c/${slug}/matches/new`}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--stroke-hi)] bg-[color:var(--bg-2)] px-5 py-2.5 text-sm font-bold hover:border-[color:var(--lime)]"
          >
            + Nouveau match
          </Link>
        </div>
      )}
    </main>
  );
}
