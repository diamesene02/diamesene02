import Link from "next/link";
import { getTopScorers } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const rows = await getTopScorers(50);

  return (
    <main className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 opacity-20">
        <div className="pitch-motif absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-6">
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)] hover:text-white"
        >
          ← Accueil
        </Link>

        <header className="mt-6 mb-8">
          <span className="kicker">Saison en cours</span>
          <h1 className="display-xl mt-3">
            Classement<span className="text-[color:var(--lime)]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[color:var(--ink-1)]">
            Buts + passes décisives, tous matchs confondus.
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="text-[color:var(--ink-2)]">Aucun but enregistré.</p>
        ) : (
          <>
            {/* Top 3 podium */}
            <section className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
              {rows.slice(0, 3).map((s, i) => {
                const heights = ["h-40", "h-32", "h-28"];
                const medals = ["🥇", "🥈", "🥉"];
                const order = [1, 0, 2][i]; // center 1st on podium
                return (
                  <Link
                    key={s.playerId}
                    href={`/stats/players/${s.playerId}`}
                    className={`relative flex flex-col items-center justify-end rounded-t-xl border border-[color:var(--stroke)] bg-gradient-to-t from-[color:var(--bg-1)] to-transparent p-3 transition-colors hover:border-[color:var(--lime)]/40 ${heights[i]}`}
                    style={{ order }}
                  >
                    <div className="text-3xl">{medals[i]}</div>
                    <div className="mt-1 text-center text-xs font-black uppercase tracking-wider">
                      {s.name}
                    </div>
                    <div
                      className="num-sculpt mt-1 text-3xl"
                      data-win={i === 0 ? "true" : "false"}
                    >
                      {s.ga}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-[color:var(--ink-2)]">
                      G+A
                    </div>
                  </Link>
                );
              })}
            </section>

            {/* Full list */}
            <div className="overflow-hidden rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]/60 backdrop-blur">
              <div className="grid grid-cols-[32px_1fr_40px_40px_40px_48px] items-center gap-2 border-b border-[color:var(--stroke)] bg-[color:var(--bg-2)]/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
                <span />
                <span>Joueur</span>
                <span className="text-right">MP</span>
                <span className="text-right">⚽</span>
                <span className="text-right">🅿</span>
                <span className="text-right text-[color:var(--lime)]">G+A</span>
              </div>
              <ol>
                {rows.map((s, i) => (
                  <li key={s.playerId}>
                    <Link
                      href={`/stats/players/${s.playerId}`}
                      className="grid grid-cols-[32px_1fr_40px_40px_40px_48px] items-center gap-2 border-b border-[color:var(--stroke)] px-3 py-3 text-sm transition-colors last:border-b-0 hover:bg-white/[0.03]"
                    >
                      <span className="text-right font-mono text-xs text-[color:var(--ink-2)]">
                        {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                      </span>
                      <span className="truncate font-bold">
                        {s.name}
                        {s.isGuest && (
                          <span className="ml-1 text-[10px] text-[color:var(--ink-2)]">
                            (inv.)
                          </span>
                        )}
                      </span>
                      <span className="text-right font-mono text-xs text-[color:var(--ink-1)]">
                        {s.matchesPlayed}
                      </span>
                      <span className="text-right font-mono font-bold">{s.goals}</span>
                      <span className="text-right font-mono text-[color:var(--ink-1)]">
                        {s.assists}
                      </span>
                      <span className="text-right font-mono font-black text-[color:var(--lime)]">
                        {s.ga}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
