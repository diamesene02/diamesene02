import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SyncBadge from "@/components/SyncBadge";
import { getTopScorers } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recentQuery = () =>
    prisma.match.findMany({
      where: { status: "FINISHED" },
      orderBy: { playedAt: "desc" },
      take: 6,
      include: { mvp: true, goals: true, players: true },
    });
  const liveQuery = () =>
    prisma.match.findFirst({
      where: { status: "LIVE" },
      orderBy: { playedAt: "desc" },
    });

  let recentMatches: Awaited<ReturnType<typeof recentQuery>> = [];
  let liveMatch: Awaited<ReturnType<typeof liveQuery>> = null;
  let topScorers: Awaited<ReturnType<typeof getTopScorers>> = [];
  let totalMatches = 0;
  let totalGoals = 0;
  try {
    [recentMatches, liveMatch, topScorers, totalMatches, totalGoals] = await Promise.all([
      recentQuery(),
      liveQuery(),
      getTopScorers(3),
      prisma.match.count({ where: { status: "FINISHED" } }),
      prisma.goal.count(),
    ]);
  } catch {
    /* offline */
  }

  const hero = recentMatches[0];
  const rest = recentMatches.slice(1);
  const now = new Date();
  const weekday = now.toLocaleDateString("fr-FR", { weekday: "long" }).toUpperCase();
  const dateStr = now.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const seqNumber = String(totalMatches + 1).padStart(3, "0");

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-4 md:pt-6">
        {/* Masthead */}
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--stroke)] pb-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="label-tech">⚑</span>
              <span className="seq">N°{seqNumber}</span>
              <span className="label-tech">·</span>
              <span className="seq">{weekday}</span>
            </div>
            <div className="mt-2 leading-none">
              <span className="font-display italic text-[44px] md:text-[56px] tracking-tight">
                Five
              </span>
              <span className="ml-2 align-middle font-mono text-xs font-medium uppercase tracking-[0.3em] text-[color:var(--ink-1)]">
                Scorer
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncBadge compact />
            <span className="seq hidden md:inline">{dateStr.toUpperCase()}</span>
          </div>
        </header>

        {/* Live strap (if there's a live match) */}
        {liveMatch && (
          <Link
            href={`/matches/${liveMatch.id}/live`}
            className="mt-5 block border border-[color:var(--amber)] bg-[color:var(--amber-dim)] transition-colors hover:bg-[color:var(--amber-dim)]/70"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-4">
                <span className="live-marker">En cours</span>
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--ink-1)]">
                  {liveMatch.teamAName} × {liveMatch.teamBName}
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="num text-3xl font-medium">
                  {liveMatch.scoreA} : {liveMatch.scoreB}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--amber)]">
                  Reprendre →
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* Hero editorial block */}
        <section className="mt-10 grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="label-tech">— Opérations</span>
            <h1 className="display-xl mt-3">
              Marquez.
              <br />
              <span className="text-[color:var(--amber)]">Annotez.</span>
              <br />
              Archivez.
            </h1>
            <p className="mt-4 max-w-sm font-mono text-[13px] leading-relaxed text-[color:var(--ink-1)]">
              Console de notation pour Five hebdomadaire. Score live, passes
              décisives, MVP calculé. Fonctionne hors ligne, synchronise quand
              le WiFi revient.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/matches/new" className="btn primary big">
                <span className="font-mono text-[11px] tracking-[0.22em]">
                  ⚑ NOUVEAU MATCH
                </span>
              </Link>
              <Link href="/matches/history" className="btn ghost big">
                <span className="font-mono text-[11px] tracking-[0.22em]">
                  ARCHIVES
                </span>
              </Link>
            </div>
          </div>

          {/* Sidebar: season stats */}
          <aside className="space-y-4 border-l border-[color:var(--stroke)] pl-6">
            <div>
              <div className="label-tech">Saison</div>
              <div className="mt-1 font-display italic text-3xl">
                2025 / 2026
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="label-tech">Matchs</div>
                <div className="num mt-1 text-3xl font-medium">
                  {totalMatches}
                </div>
              </div>
              <div>
                <div className="label-tech">Buts</div>
                <div className="num mt-1 text-3xl font-medium text-[color:var(--amber)]">
                  {totalGoals}
                </div>
              </div>
            </div>
            {topScorers.length > 0 && (
              <div className="pt-2">
                <div className="label-tech mb-2">Top buteurs</div>
                <ul className="space-y-1.5">
                  {topScorers.map((s, i) => (
                    <li key={s.playerId} className="leader">
                      <span className="font-mono text-[11px] text-[color:var(--ink-2)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-[12px] font-medium uppercase tracking-wider">
                        {s.name}
                      </span>
                      <span className="leader-dots" />
                      <span className="num text-[13px] font-medium text-[color:var(--amber)]">
                        {s.ga}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/stats/scorers"
                  className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[color:var(--ink-1)] hover:text-[color:var(--amber)]"
                >
                  Classement complet →
                </Link>
              </div>
            )}
          </aside>
        </section>

        {/* Hero match poster */}
        {hero && (
          <section className="mt-14">
            <div className="flex items-baseline justify-between border-b border-[color:var(--stroke)] pb-3">
              <div className="flex items-baseline gap-3">
                <span className="label-tech">— Dernier match</span>
                <span className="seq">
                  {new Date(hero.playedAt).toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  }).toUpperCase()}
                </span>
              </div>
              <Link
                href={`/matches/${hero.id}`}
                className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[color:var(--ink-1)] hover:text-[color:var(--amber)]"
              >
                Récap détaillé →
              </Link>
            </div>

            <Link
              href={`/matches/${hero.id}`}
              className="group block pt-8 pb-6 transition-opacity hover:opacity-95"
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-6">
                <div className="text-right">
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--a-400)]">
                    {hero.teamAName}
                  </div>
                  <div className="mt-3">
                    <span
                      className="num-display"
                      style={{ fontSize: "clamp(96px, 22vw, 200px)" }}
                      data-win={hero.scoreA > hero.scoreB ? "true" : "false"}
                    >
                      {hero.scoreA}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 pb-6">
                  <span className="font-display italic text-2xl text-[color:var(--ink-2)]">
                    vs
                  </span>
                </div>
                <div className="text-left">
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--b-400)]">
                    {hero.teamBName}
                  </div>
                  <div className="mt-3">
                    <span
                      className="num-display"
                      style={{ fontSize: "clamp(96px, 22vw, 200px)" }}
                      data-win={hero.scoreB > hero.scoreA ? "true" : "false"}
                    >
                      {hero.scoreB}
                    </span>
                  </div>
                </div>
              </div>

              {hero.mvp && (
                <div className="mt-4 border-l-2 border-[color:var(--amber)] pl-4">
                  <div className="label-tech">MVP</div>
                  <div className="display-md mt-0.5">{hero.mvp.name}</div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-4 border-t border-[color:var(--stroke)] pt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-1)]">
                <span>{hero.goals.length} buts</span>
                <span className="text-[color:var(--ink-2)]">·</span>
                <span>{hero.players.length} joueurs</span>
                <span className="text-[color:var(--ink-2)]">·</span>
                <span>
                  {new Date(hero.playedAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </Link>
          </section>
        )}

        {/* Archive list — classifieds style */}
        {rest.length > 0 && (
          <section className="mt-10">
            <div className="border-b border-[color:var(--stroke)] pb-2">
              <span className="label-tech">— Archives</span>
            </div>
            <ul className="mt-1">
              {rest.map((m, i) => (
                <li key={m.id}>
                  <Link
                    href={`/matches/${m.id}`}
                    className="grid grid-cols-[36px_60px_1fr_auto] items-baseline gap-3 border-b border-[color:var(--stroke)] py-3 transition-colors hover:bg-[color:var(--bg-1)]"
                  >
                    <span className="font-mono text-[10px] text-[color:var(--ink-2)]">
                      {String(i + 2).padStart(3, "0")}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-1)]">
                      {new Date(m.playedAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="truncate font-mono text-[12px] font-medium uppercase tracking-[0.05em]">
                      {m.teamAName}{" "}
                      <span className="text-[color:var(--ink-2)]">×</span>{" "}
                      {m.teamBName}
                      {m.mvp && (
                        <span className="ml-2 font-display italic text-[color:var(--amber)]">
                          {" "}
                          · {m.mvp.name}
                        </span>
                      )}
                    </span>
                    <span className="num text-[15px] font-medium">
                      <span
                        className={
                          m.scoreA > m.scoreB
                            ? "text-[color:var(--amber)]"
                            : "text-[color:var(--ink-1)]"
                        }
                      >
                        {m.scoreA}
                      </span>
                      <span className="px-1.5 text-[color:var(--ink-2)]">:</span>
                      <span
                        className={
                          m.scoreB > m.scoreA
                            ? "text-[color:var(--amber)]"
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

        {/* Footer */}
        <footer className="mt-16 flex items-baseline justify-between border-t border-[color:var(--stroke)] pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-2)]">
          <span>Five Scorer · Console v2</span>
          <span>Urban Foot · Jeudi 21H</span>
        </footer>
      </div>
    </main>
  );
}
