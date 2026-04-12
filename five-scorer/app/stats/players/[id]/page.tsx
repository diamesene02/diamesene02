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

  const { player, matchesPlayed, goals, wins, draws, losses, mvpCount } = stats;
  const finished = wins + draws + losses;
  const winRate = finished === 0 ? 0 : Math.round((wins / finished) * 100);
  const avgGoals =
    matchesPlayed === 0 ? 0 : Math.round((goals / matchesPlayed) * 100) / 100;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <Link href="/stats/scorers" className="text-sm text-gray-400 hover:text-white">
        ← Buteurs
      </Link>
      <header>
        <h1 className="text-3xl font-bold">
          {player.name}
          {player.isGuest && (
            <span className="ml-2 text-sm text-gray-400">(invité)</span>
          )}
        </h1>
      </header>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Matchs joués" value={matchesPlayed} />
        <Stat label="Buts" value={goals} />
        <Stat label="Moy. buts/match" value={avgGoals} />
        <Stat label="Victoires" value={wins} />
        <Stat label="Nuls" value={draws} />
        <Stat label="Défaites" value={losses} />
        <Stat label="% victoires" value={`${winRate}%`} />
        <Stat label="MVP" value={mvpCount} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <div className="text-xs uppercase text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
