import Link from "next/link";
import { getTopScorers } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const rows = await getTopScorers(50);

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-4">
      <Link href="/" className="text-sm text-[color:var(--ink-2)] hover:text-white">
        ← Accueil
      </Link>

      <header>
        <h1 className="text-3xl font-black tracking-tight">Classement</h1>
        <p className="text-sm text-[color:var(--ink-2)]">Buts + passes décisives, tous matchs confondus</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-[color:var(--ink-2)]">Aucun but enregistré.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]">
          <div className="grid grid-cols-[32px_1fr_48px_48px_48px_48px] items-center gap-2 border-b border-[color:var(--stroke)] px-3 py-2 text-[10px] uppercase tracking-widest text-[color:var(--ink-2)]">
            <span />
            <span>Joueur</span>
            <span className="text-right">MP</span>
            <span className="text-right" title="Buts">⚽</span>
            <span className="text-right" title="Passes décisives">🅿</span>
            <span className="text-right text-[color:var(--gold)]">G+A</span>
          </div>
          <ol>
            {rows.map((s, i) => (
              <li key={s.playerId}>
                <Link
                  href={`/stats/players/${s.playerId}`}
                  className="grid grid-cols-[32px_1fr_48px_48px_48px_48px] items-center gap-2 border-b border-[color:var(--stroke)] px-3 py-3 text-sm transition-colors last:border-b-0 hover:bg-white/5"
                >
                  <span className="text-right text-[color:var(--ink-2)] font-mono">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                  <span className="font-bold">
                    {s.name}
                    {s.isGuest && (
                      <span className="ml-1 text-[10px] text-[color:var(--ink-2)]">(inv.)</span>
                    )}
                  </span>
                  <span className="text-right text-[color:var(--ink-1)] font-mono text-xs">
                    {s.matchesPlayed}
                  </span>
                  <span className="text-right font-mono font-bold">{s.goals}</span>
                  <span className="text-right font-mono text-[color:var(--ink-1)]">{s.assists}</span>
                  <span className="text-right font-mono font-black text-[color:var(--gold)]">
                    {s.ga}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
