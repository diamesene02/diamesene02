import Link from "next/link";
import { prisma } from "@/lib/prisma";
import SyncBadge from "@/components/SyncBadge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recentQuery = () =>
    prisma.match.findMany({
      where: { status: "FINISHED" },
      orderBy: { playedAt: "desc" },
      take: 5,
      include: { mvp: true, goals: { include: { scorer: true } } },
    });
  const liveQuery = () =>
    prisma.match.findFirst({
      where: { status: "LIVE" },
      orderBy: { playedAt: "desc" },
    });

  let recentMatches: Awaited<ReturnType<typeof recentQuery>> = [];
  let liveMatch: Awaited<ReturnType<typeof liveQuery>> = null;
  try {
    [recentMatches, liveMatch] = await Promise.all([recentQuery(), liveQuery()]);
  } catch {
    /* offline */
  }

  const hero = recentMatches[0];
  const rest = recentMatches.slice(1);

  return (
    <main className="min-h-screen">
      {/* Ambient pitch lines background */}
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-4xl px-5 pb-16 pt-6">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="brand-pill">⚽ Five Scorer</span>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <SyncBadge compact />
            <Link
              href="/stats/scorers"
              className="rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)]/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur hover:border-[color:var(--stroke-hi)]"
            >
              Classement
            </Link>
            <Link
              href="/matches/history"
              className="rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)]/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur hover:border-[color:var(--stroke-hi)]"
            >
              Historique
            </Link>
          </nav>
        </header>

        {/* Hero */}
        {liveMatch ? (
          <Link
            href={`/matches/${liveMatch.id}/live`}
            className="aurora mt-6 block overflow-hidden rounded-3xl border border-[color:var(--a-500)]/50 p-6 transition-colors hover:border-[color:var(--a-400)]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_12px_#ef4444]" />
              <span className="kicker text-red-400" style={{ color: "#fca5a5" }}>
                En cours · reprendre
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="display-md">
                {liveMatch.teamAName}
                <br />
                <span className="text-[color:var(--b-400)]">vs {liveMatch.teamBName}</span>
              </div>
              <div className="num-sculpt text-7xl">
                {liveMatch.scoreA}
                <span className="text-[color:var(--ink-2)] px-2">:</span>
                {liveMatch.scoreB}
              </div>
            </div>
          </Link>
        ) : (
          <section className="aurora edge-top relative mt-6 overflow-hidden rounded-3xl border border-[color:var(--stroke)] p-8">
            <div className="relative z-[1] flex flex-col items-start gap-4">
              <span className="kicker">La maison du Five du jeudi</span>
              <h1 className="display-xl">
                Marque <em>vite</em>.
                <br />
                Regarde <span className="text-[color:var(--lime)]">mieux</span>.
              </h1>
              <p className="max-w-lg text-base text-[color:var(--ink-1)]">
                Score en live, stats qui tiennent, partage qui claque.
              </p>
              <Link
                href="/matches/new"
                className="group mt-2 inline-flex items-center gap-2 rounded-full bg-[color:var(--lime)] px-6 py-3 text-base font-black tracking-tight text-[#0a1400] shadow-[0_20px_60px_-15px_var(--lime-glow)] transition-transform hover:scale-[1.02]"
              >
                <span>Lancer un match</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </section>
        )}

        {/* Last match — editorial poster treatment */}
        {hero && (
          <section className="mt-10">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="kicker">Dernier match</span>
              <Link
                href="/matches/history"
                className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)] hover:text-white"
              >
                Tout voir →
              </Link>
            </div>
            <Link
              href={`/matches/${hero.id}`}
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
                    {hero.teamBName}
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
                    {new Date(hero.playedAt).toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <span className="text-[color:var(--ink-2)]">·</span>
                  <span className="font-mono text-[color:var(--ink-2)]">
                    {hero.goals.length} but{hero.goals.length > 1 ? "s" : ""}
                  </span>
                  {hero.mvp && (
                    <>
                      <span className="text-[color:var(--ink-2)]">·</span>
                      <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[color:var(--gold)]">
                        ⭐ {hero.mvp.name}
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

        {/* Older matches — compact list */}
        {rest.length > 0 && (
          <section className="mt-8">
            <span className="kicker mb-3 block">Archive</span>
            <ul className="divide-y divide-[color:var(--stroke)] overflow-hidden rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]/50 backdrop-blur">
              {rest.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/matches/${m.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="w-14 font-mono text-[11px] uppercase text-[color:var(--ink-2)]">
                      {new Date(m.playedAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="flex-1 truncate text-sm font-bold">
                      {m.teamAName}{" "}
                      <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                      {m.teamBName}
                    </span>
                    <span className="font-mono text-sm font-black">
                      <span
                        className={
                          m.scoreA > m.scoreB ? "text-[color:var(--lime)]" : "text-[color:var(--ink-1)]"
                        }
                      >
                        {m.scoreA}
                      </span>
                      <span className="px-1.5 text-[color:var(--ink-2)]">:</span>
                      <span
                        className={
                          m.scoreB > m.scoreA ? "text-[color:var(--lime)]" : "text-[color:var(--ink-1)]"
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

        {/* Secondary CTA if there's a live match (already handled above), or new-match shortcut if hero exists */}
        {hero && !liveMatch && (
          <div className="mt-8 flex justify-center">
            <Link
              href="/matches/new"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--stroke-hi)] bg-[color:var(--bg-2)] px-5 py-2.5 text-sm font-bold hover:border-[color:var(--lime)]"
            >
              + Nouveau match
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
