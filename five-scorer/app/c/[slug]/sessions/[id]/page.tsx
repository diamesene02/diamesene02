import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";
import Icon from "@/components/Icon";
import MoneyPanel from "./MoneyPanel";
import SessionRsvpAdmin, { type SessionPlayerRow } from "./SessionRsvpAdmin";
import DeleteSessionButton from "./DeleteSessionButton";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;

  const md = await prisma.matchDay.findFirst({
    where: { id, clubId },
    include: {
      rsvps: { select: { playerId: true, status: true, hasPaid: true } },
      matches: {
        orderBy: { playedAt: "asc" },
        include: { mvp: true, opponent: true },
      },
    },
  });
  if (!md) notFound();

  const [players, myPlayer] = await Promise.all([
    prisma.player.findMany({
      where: { clubId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.player.findFirst({
      where: { clubId, userId: ctx.user.id },
      select: { id: true },
    }),
  ]);

  const rsvpByPlayer = new Map(md.rsvps.map((r) => [r.playerId, r]));
  const rsvpRows: SessionPlayerRow[] = players.map((p) => ({
    playerId: p.id,
    name: p.name,
    status: rsvpByPlayer.get(p.id)?.status ?? null,
  }));

  const payers = players
    .filter((p) => rsvpByPlayer.get(p.id)?.status === "IN")
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      hasPaid: rsvpByPlayer.get(p.id)?.hasPaid ?? false,
    }));

  const liveMatches = md.matches.filter((m) => m.status === "LIVE");
  const otherMatches = md.matches.filter((m) => m.status !== "LIVE");
  const hasFinished = md.matches.some((m) => m.status === "FINISHED");

  const leaderboard = hasFinished
    ? (await getLeaderboard({ clubId, matchDayId: id }))
        .filter((r) => r.matchesPlayed > 0)
        .slice(0, 10)
    : [];

  const dateLabel = md.date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const timeLabel = md.date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const fmtShort = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const opponentOr = (m: (typeof md.matches)[number]) =>
    m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;

  const showMoney = ctx.canManage || md.fieldCostCents != null;

  return (
    <main>
      {/* En-tête */}
      <section className="aurora edge-top relative overflow-hidden rounded-3xl border border-[color:var(--stroke)] p-6">
        <div className="relative z-[1]">
          <Link
            href={`/c/${slug}/sessions`}
            className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)] hover:text-white"
          >
            ← Les soirées
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="kicker">{md.title || "Soirée"}</span>
              <h1 className="display-md mt-1 capitalize">
                {dateLabel}
                <span className="ml-3 text-lg tabular-nums text-[color:var(--lime)]">
                  {timeLabel}
                </span>
              </h1>
              {md.location && (
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-[color:var(--ink-1)]">
                  <Icon name="pin" size={14} className="shrink-0" />
                  <span>{md.location}</span>
                </div>
              )}
              {md.notes && (
                <p className="mt-2 max-w-prose text-sm text-[color:var(--ink-2)]">
                  {md.notes}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ctx.canScore && (
                <Link
                  href={`/c/${slug}/matches/new?md=${md.id}`}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-[color:var(--lime)] px-5 text-xs font-black uppercase tracking-wider text-[color:var(--bg-0)]"
                >
                  Lancer un match
                </Link>
              )}
              {ctx.canManage && (
                <DeleteSessionButton slug={slug} matchDayId={md.id} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Présences */}
      <section className="mt-8 rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-6">
        <span className="kicker mb-4 block">Présences</span>
        <SessionRsvpAdmin
          key={rsvpRows.map((r) => `${r.playerId}:${r.status ?? "-"}`).join("|")}
          slug={slug}
          matchDayId={md.id}
          myPlayerId={myPlayer?.id ?? null}
          canManage={ctx.canManage}
          players={rsvpRows}
        />
      </section>

      {/* La part du terrain */}
      {showMoney && (
        <section className="mt-8 rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-6">
          <div className="mb-4 flex items-center gap-2 text-[color:var(--ink-3)]">
            <Icon name="coin" size={15} />
            <span className="kicker">Le terrain</span>
          </div>
          <MoneyPanel
            key={`${md.fieldCostCents ?? "-"}|${payers
              .map((p) => `${p.playerId}:${p.hasPaid ? 1 : 0}`)
              .join(",")}`}
            slug={slug}
            matchDayId={md.id}
            canManage={ctx.canManage}
            costCents={md.fieldCostCents}
            payers={payers}
          />
        </section>
      )}

      {/* Matchs de la soirée */}
      <section className="mt-8">
        <span className="kicker mb-3 block">Matchs de la soirée</span>
        {md.matches.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-1)]">
            Aucun match lancé pour cette session
            {ctx.canScore ? " — à toi de donner le coup d'envoi." : "."}
          </p>
        ) : (
          <div className="space-y-3">
            {liveMatches.map((m) => (
              <Link
                key={m.id}
                href={`/c/${slug}/matches/${m.id}/live`}
                className="flex min-h-[56px] items-center gap-4 rounded-2xl border border-[color:var(--live)]/40 bg-[color:var(--bg-1)] p-4 transition-colors hover:border-[color:var(--live)]"
              >
                <span className="live-dot shrink-0" />
                <span className="min-w-0 flex-1 truncate text-base font-black">
                  {m.teamAName}{" "}
                  <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                  {opponentOr(m)}
                </span>
                <span className="num-sculpt text-2xl">
                  {m.scoreA}
                  <span className="px-1.5 text-[color:var(--ink-2)]">:</span>
                  {m.scoreB}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--live)]">
                  Live →
                </span>
              </Link>
            ))}
            {otherMatches.length > 0 && (
              <ul className="divide-y divide-[color:var(--stroke)] overflow-hidden rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]">
                {otherMatches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/c/${slug}/matches/${m.id}`}
                      className="flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="w-12 shrink-0 text-[11px] tabular-nums text-[color:var(--ink-2)]">
                        {fmtShort(m.playedAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {m.teamAName}{" "}
                        <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                        {opponentOr(m)}
                        {m.mvp && (
                          <span className="ml-2 inline-flex items-center gap-1 align-middle text-[10px] font-black uppercase tracking-wider text-[color:var(--gold)]">
                            <Icon name="star" size={11} filled />
                            {m.mvp.name}
                          </span>
                        )}
                      </span>
                      {m.status === "SCHEDULED" ? (
                        <span className="rounded-full border border-[color:var(--b-400)]/40 bg-[color:var(--b-wash)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--b-400)]">
                          à venir
                        </span>
                      ) : (
                        <span className="text-sm font-black tabular-nums">
                          <span
                            className={
                              m.scoreA > m.scoreB
                                ? "text-[color:var(--lime)]"
                                : "text-[color:var(--ink-1)]"
                            }
                          >
                            {m.scoreA}
                          </span>
                          <span className="px-1.5 text-[color:var(--ink-2)]">
                            :
                          </span>
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
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Le classement de la soirée */}
      {leaderboard.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Les cracks du soir</span>
          <div className="scroll-x rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--stroke)] text-left text-[10px] font-black uppercase tracking-widest text-[color:var(--ink-2)]">
                  <th className="px-4 py-2.5">Joueur</th>
                  <th className="px-3 py-2.5 text-center">J</th>
                  <th className="px-3 py-2.5 text-center">V</th>
                  <th className="px-3 py-2.5 text-center">Buts</th>
                  <th className="px-3 py-2.5 text-center">MVP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--stroke)]">
                {leaderboard.map((r, i) => (
                  <tr key={r.playerId} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 font-bold">
                      <Link
                        href={`/c/${slug}/players/${r.playerId}`}
                        className="hover:text-[color:var(--lime)]"
                      >
                        <span className="mr-2 text-[11px] tabular-nums text-[color:var(--ink-2)]">
                          {i + 1}
                        </span>
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {r.matchesPlayed}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {r.wins}
                    </td>
                    <td className="px-3 py-2.5 text-center font-black tabular-nums text-[color:var(--lime)]">
                      {r.goals}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[color:var(--gold)]">
                      {r.mvpCount > 0 ? r.mvpCount : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
