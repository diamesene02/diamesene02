import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function PlayerStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stats = await getPlayerStats(id);
  if (!stats) notFound();

  const { player, matchesPlayed, goals, assists, wins, draws, losses, mvpCount, recentMatches } =
    stats;
  const finished = wins + draws + losses;
  const winRate = finished === 0 ? 0 : Math.round((wins / finished) * 100);
  const avgGoals =
    matchesPlayed === 0 ? 0 : Math.round((goals / matchesPlayed) * 100) / 100;

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-5">
      <Link
        href="/stats/scorers"
        className="text-sm text-[color:var(--ink-2)] hover:text-white"
      >
        ← Classement
      </Link>

      <header className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-5">
        <h1 className="text-3xl font-black tracking-tight">
          {player.name}
          {player.isGuest && (
            <span className="ml-2 text-sm text-[color:var(--ink-2)]">(invité)</span>
          )}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[color:var(--bg-2)] px-3 py-1 text-[color:var(--ink-1)]">
            {matchesPlayed} match{matchesPlayed > 1 ? "s" : ""}
          </span>
          {mvpCount > 0 && (
            <span className="rounded-full bg-[color:var(--gold)] px-3 py-1 font-bold text-[#1f1500]">
              ⭐ {mvpCount} MVP
            </span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Buts" value={goals} big highlight />
        <Stat label="Passes déc." value={assists} big />
        <Stat label="G+A / match" value={avgGoals} big />
        <Stat label="Victoires" value={wins} tone="win" />
        <Stat label="Nuls" value={draws} />
        <Stat label="Défaites" value={losses} tone="lose" />
        <Stat label="% victoires" value={`${winRate}%`} />
        <Stat label="MVP" value={mvpCount} />
      </section>

      {recentMatches.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
            Derniers matchs
          </h2>
          <div className="overflow-hidden rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]">
            {recentMatches.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="flex items-center justify-between gap-3 border-b border-[color:var(--stroke)] px-3 py-3 text-sm last:border-b-0 hover:bg-white/5"
              >
                <span className="font-mono text-xs text-[color:var(--ink-2)]">
                  {new Date(m.playedAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <span className="flex-1 text-center font-mono font-bold">{m.score}</span>
                <ResultBadge result={m.result} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  big,
  highlight,
  tone,
}: {
  label: string;
  value: number | string;
  big?: boolean;
  highlight?: boolean;
  tone?: "win" | "lose";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10"
          : "border-[color:var(--stroke)] bg-[color:var(--bg-1)]"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
        {label}
      </div>
      <div
        className={`mt-1 font-black ${
          big ? "text-3xl" : "text-2xl"
        } ${
          highlight
            ? "text-[color:var(--gold)]"
            : tone === "win"
              ? "text-[color:var(--a-400)]"
              : tone === "lose"
                ? "text-[color:var(--ink-2)]"
                : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: "W" | "D" | "L" | "?" }) {
  const cls =
    result === "W"
      ? "bg-[color:var(--a-500)]/20 text-[color:var(--a-400)]"
      : result === "L"
        ? "bg-red-500/20 text-red-300"
        : result === "D"
          ? "bg-[color:var(--ink-2)]/20 text-[color:var(--ink-1)]"
          : "bg-[color:var(--bg-2)] text-[color:var(--ink-2)]";
  return (
    <span className={`w-6 text-center rounded px-1.5 py-0.5 text-xs font-black ${cls}`}>
      {result}
    </span>
  );
}
