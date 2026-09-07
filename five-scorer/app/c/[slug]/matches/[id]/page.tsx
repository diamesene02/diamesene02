import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import RecapView from "@/components/RecapView";
import MotmVotePanel from "@/components/MotmVotePanel";
import DeleteMatchButton from "@/components/DeleteMatchButton";
import RematchButton from "@/components/RematchButton";
import Icon from "@/components/Icon";
import MatchRsvpPanel from "./MatchRsvpPanel";
import CancelMatchButton from "./CancelMatchButton";

export const dynamic = "force-dynamic";

export default async function MatchRecapPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);

  const match = await prisma.match.findFirst({
    where: { id, clubId: ctx.club.id },
    include: {
      mvp: true,
      opponent: true,
      season: { select: { name: true } },
      participants: { include: { player: true } },
      events: { orderBy: { createdAt: "asc" }, include: { player: true } },
      motmVotes: true,
      rsvps: { select: { playerId: true, status: true } },
      matchDay: { select: { id: true, date: true } },
    },
  });
  if (!match) notFound();

  // Rejouer, c'est créer un match AUJOURD'HUI. Il ne doit donc hériter ni de
  // la saison ni de la soirée du match rejoué s'il regarde un vieux récap :
  // sinon le match du soir se retrouve classé dans une saison close, ou
  // rattaché à une soirée d'il y a trois semaines.
  const [saisonActive, matchEnCours] = await Promise.all([
    prisma.season.findFirst({
      where: { clubId: ctx.club.id, isActive: true },
      orderBy: { startsAt: "desc" },
      select: { id: true },
    }),
    prisma.match.findFirst({
      where: { clubId: ctx.club.id, status: "LIVE" },
      select: { id: true },
    }),
  ]);
  const soireeEnCours =
    match.matchDay &&
    Math.abs(match.matchDay.date.getTime() - Date.now()) < 12 * 3600_000
      ? match.matchDay.id
      : null;

  // ── Match programmé / annulé : vue convocation, pas de récap ──────────────
  if (match.status === "SCHEDULED" || match.status === "CANCELED") {
    const scheduledAt = match.scheduledAt ?? match.playedAt;
    const dateLabel = scheduledAt.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const timeLabel = scheduledAt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const versus =
      match.kind === "EXTERNAL" && match.opponent
        ? match.opponent.name
        : match.teamBName;

    if (match.status === "CANCELED") {
      return (
        <main className="mx-auto max-w-2xl">
          <section className="bande">
            <span className="kicker" style={{ color: "var(--loss)" }}>
              Match annulé
            </span>
            <h1 className="display-md mt-2">
              {match.teamAName}{" "}
              <span className="text-[color:var(--ink-2)]">vs</span> {versus}
            </h1>
            <p className="mt-2 text-sm tabular-nums text-[color:var(--ink-1)]">
              Était prévu le {dateLabel} · {timeLabel}
              {match.venue ? ` · ${match.venue}` : ""}
            </p>
            {ctx.canManage && (
              <div className="mt-6 flex justify-end border-t border-[color:var(--rule)] pt-4">
                <DeleteMatchButton slug={slug} matchId={match.id} />
              </div>
            )}
          </section>
        </main>
      );
    }

    const [roster, myPlayer] = await Promise.all([
      prisma.player.findMany({
        where: { clubId: ctx.club.id, isArchived: false, isGuest: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.player.findFirst({
        where: { clubId: ctx.club.id, userId: ctx.user.id },
        select: { id: true },
      }),
    ]);
    const statusByPlayer = new Map(
      match.rsvps.map((r) => [r.playerId, r.status])
    );

    return (
      <main className="mx-auto max-w-2xl">
        <section className="aurora edge-top relative overflow-hidden bande creuse">
          <div className="relative z-[1]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[2px] border border-[color:var(--bib-b-ink)]/40 bg-[color:var(--pitch-2)] px-2.5 py-0.5 text-[13px] font-semibold text-[color:var(--bib-b-ink)]">
                Match programmé
              </span>
              {match.season && <span className="kicker">{match.season.name}</span>}
            </div>
            <h1 className="display-md mt-3">
              {match.teamAName}{" "}
              <span className="text-[color:var(--ink-2)]">vs</span>{" "}
              <span className="text-[color:var(--bib-b-ink)]">{versus}</span>
            </h1>
            <div className="mt-3 text-2xl font-black capitalize">
              {dateLabel}
              <span className="ml-3 text-xl tabular-nums text-[color:var(--ink-1)]">
                {timeLabel}
              </span>
            </div>
            {match.venue && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-[color:var(--ink-1)]">
                <Icon name="pin" size={14} className="shrink-0" />
                <span>{match.venue}</span>
              </div>
            )}
            {ctx.canScore && (
              <Link
                href={`/c/${slug}/matches/new?scheduled=${match.id}`}
                className="group mt-5 inline-flex min-h-[56px] items-center gap-2 rounded-[2px] bg-[color:var(--ink-1)] px-6 text-base font-black tracking-tight text-[color:var(--pitch-0)] transition-transform hover:scale-[1.02]"
              >
                <span>Composer les équipes et lancer</span>
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            )}
          </div>
        </section>

        <section className="mt-6 bande">
          <span className="kicker mb-3 block">Convocation — qui est là ?</span>
          <MatchRsvpPanel
            slug={slug}
            matchId={match.id}
            myPlayerId={myPlayer?.id ?? null}
            canManage={ctx.canManage}
            players={roster.map((p) => ({
              playerId: p.id,
              name: p.name,
              status: statusByPlayer.get(p.id) ?? null,
            }))}
          />
        </section>

        {ctx.canManage && (
          <div className="mt-8 flex justify-end border-t border-[color:var(--rule)] pt-4">
            <CancelMatchButton slug={slug} matchId={match.id} />
          </div>
        )}
      </main>
    );
  }

  const players = match.participants.map((p) => ({
    id: p.player.id,
    name: p.player.name,
    team: p.team as "A" | "B",
    goals: match.events.filter(
      (e) => e.type === "GOAL" && e.playerId === p.player.id
    ).length,
  }));
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const goals = match.events
    .filter((e) => e.type === "GOAL" || e.type === "OWN_GOAL")
    .map((e) => ({
      id: e.id,
      // Un csc apparaît dans la chronologie mais ne crédite pas le joueur
      // au classement des buteurs.
      scorerId: e.type === "OWN_GOAL" ? "" : (e.playerId ?? ""),
      team: e.team as "A" | "B",
      minute: e.minute,
      createdAt: e.createdAt.toISOString(),
      // Un csc peut rester sans auteur : le score part au premier tap et
      // personne n'est obligé d'avouer. Sans ce repli, le récap affichait
      // « ? » — ce qui se lit comme une panne, pas comme une abstention.
      scorerName: e.player
        ? e.type === "OWN_GOAL"
          ? `${e.player.name} (csc)`
          : e.player.name
        : e.type === "OWN_GOAL"
          ? `csc de ${e.team === "B" ? match.teamAName : match.teamBName}`
          : match.kind === "EXTERNAL" && e.team === "B"
            ? (match.opponent?.name ?? match.teamBName)
            : "?",
    }));

  // Les joueurs archivés depuis ne sont pas reconduits — l'accueil le faisait
  // déjà, le récap non : rejouer y réenrôlait des gens partis du club, et
  // saveRoster les réinjectait dans le cache local de l'appareil.
  const rejouables = match.participants.filter((p) => !p.player.isArchived);

  const votesByPlayer = new Map<string, number>();
  for (const v of match.motmVotes) {
    votesByPlayer.set(v.playerId, (votesByPlayer.get(v.playerId) ?? 0) + 1);
  }
  const myVote =
    match.motmVotes.find((v) => v.voterId === ctx.user.id)?.playerId ?? null;
  const showVoting =
    ctx.club.motmMode === "VOTE" &&
    match.status === "FINISHED" &&
    players.length > 0;

  return (
    <main className="mx-auto max-w-2xl">
      <RecapView
        match={{
          id: match.id,
          playedAt: match.playedAt.toISOString(),
          teamAName: match.teamAName,
          teamBName:
            match.kind === "EXTERNAL" && match.opponent
              ? match.opponent.name
              : match.teamBName,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          status: match.status === "FINISHED" ? "FINISHED" : "LIVE",
          mvpId: match.mvpId,
        }}
        mvpName={match.mvp?.name ?? null}
        teamA={teamA}
        teamB={teamB}
        goals={goals}
        showLiveResumeLink={match.status === "LIVE" && ctx.canScore}
        liveHref={`/c/${slug}/matches/${match.id}/live`}
      />

      {/* Une soirée, c'est plusieurs matchs. Le suivant part d'ici, avec la
          composition qu'on vient de jouer — pas de l'écran de création. */}
      {/* Pas de « on rejoue » tant qu'un match tourne : deux matchs LIVE en
          même temps, c'est deux tableaux d'affichage pour un seul terrain. */}
      {match.status === "FINISHED" &&
        ctx.canScore &&
        !matchEnCours &&
        rejouables.length > 0 && (
          <RematchButton
            clubId={ctx.club.id}
            slug={slug}
            teamAName={match.teamAName}
            teamBName={match.teamBName}
            kind={match.kind === "EXTERNAL" ? "EXTERNAL" : "INTERNAL"}
            opponentId={match.opponentId}
            matchDayId={soireeEnCours}
            seasonId={saisonActive?.id ?? null}
            players={rejouables.map((p) => ({
              id: p.player.id,
              name: p.player.name,
              nickname: p.player.nickname,
              skill: p.player.skill,
              estGardien: p.player.isGk,
              gardienCeMatch: p.isGk,
              isGuest: p.player.isGuest,
              team: p.team as "A" | "B",
            }))}
          />
        )}

      {showVoting && (
        <div className="mt-6">
          <MotmVotePanel
            slug={slug}
            matchId={match.id}
            myVote={myVote}
            candidates={players.map((p) => ({
              id: p.id,
              name: p.name,
              votes: votesByPlayer.get(p.id) ?? 0,
            }))}
          />
        </div>
      )}

      {ctx.canManage && match.status === "FINISHED" && (
        <div className="mt-8 flex items-center justify-between border-t border-[color:var(--rule)] pt-4">
          <Link
            href={`/c/${slug}/matches/${match.id}/edit`}
            className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[color:var(--rule-hi)] bg-[color:var(--pitch-2)] px-4 text-sm font-bold hover:border-[color:var(--ink-1)]"
          >
            Corriger
          </Link>
          <DeleteMatchButton slug={slug} matchId={match.id} />
        </div>
      )}
    </main>
  );
}
