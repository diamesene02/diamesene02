import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MatchRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      mvp: true,
      players: { include: { player: true } },
      goals: { include: { scorer: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!match) notFound();

  const scorersA = new Map<string, { name: string; count: number }>();
  const scorersB = new Map<string, { name: string; count: number }>();
  for (const g of match.goals) {
    const bucket = g.team === "A" ? scorersA : scorersB;
    const existing = bucket.get(g.scorerId);
    if (existing) existing.count++;
    else bucket.set(g.scorerId, { name: g.scorer.name, count: 1 });
  }

  const teamA = match.players.filter((mp) => mp.team === "A");
  const teamB = match.players.filter((mp) => mp.team === "B");

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <Link href="/" className="text-sm text-gray-400 hover:text-white">
        ← Accueil
      </Link>

      <header className="rounded-2xl bg-white/5 p-6 text-center">
        <div className="text-xs uppercase text-gray-400">
          {new Date(match.playedAt).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </div>
        <div className="mt-2 flex items-center justify-center gap-6 text-2xl font-bold">
          <span>{match.teamAName}</span>
          <span className="text-5xl font-black">
            {match.scoreA} - {match.scoreB}
          </span>
          <span>{match.teamBName}</span>
        </div>
        {match.mvp && (
          <div className="mt-3 text-sm">
            ⭐ MVP : <span className="font-semibold">{match.mvp.name}</span>
          </div>
        )}
        {match.status === "LIVE" && (
          <Link
            href={`/matches/${match.id}/live`}
            className="mt-4 inline-block rounded-lg bg-pitch-600 px-4 py-2 text-sm font-semibold"
          >
            Reprendre le match en cours →
          </Link>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <TeamCard
          title={match.teamAName}
          players={teamA.map((mp) => mp.player.name)}
          scorers={[...scorersA.values()]}
          tint="pitch"
        />
        <TeamCard
          title={match.teamBName}
          players={teamB.map((mp) => mp.player.name)}
          scorers={[...scorersB.values()]}
          tint="blue"
        />
      </section>
    </main>
  );
}

function TeamCard({
  title,
  players,
  scorers,
  tint,
}: {
  title: string;
  players: string[];
  scorers: { name: string; count: number }[];
  tint: "pitch" | "blue";
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 " +
        (tint === "pitch"
          ? "border-pitch-600/40 bg-pitch-900/20"
          : "border-blue-500/40 bg-blue-900/20")
      }
    >
      <h2 className="text-lg font-bold">{title}</h2>
      <h3 className="mt-3 text-xs uppercase text-gray-400">Buteurs</h3>
      {scorers.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun but</p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {scorers
            .sort((a, b) => b.count - a.count)
            .map((s) => (
              <li key={s.name}>
                {s.name} <span className="text-gray-400">× {s.count}</span>
              </li>
            ))}
        </ul>
      )}
      <h3 className="mt-4 text-xs uppercase text-gray-400">Composition</h3>
      <p className="text-sm text-gray-300">{players.join(" · ")}</p>
    </div>
  );
}
