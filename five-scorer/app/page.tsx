import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [recentMatches, liveMatch] = await Promise.all([
    prisma.match.findMany({
      where: { status: "FINISHED" },
      orderBy: { playedAt: "desc" },
      take: 5,
      include: { mvp: true },
    }),
    prisma.match.findFirst({
      where: { status: "LIVE" },
      orderBy: { playedAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Five Scorer</h1>
          <p className="text-sm text-gray-400">Les Five hebdo, en live.</p>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link
            href="/stats/scorers"
            className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10"
          >
            Buteurs
          </Link>
          <Link
            href="/matches/history"
            className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10"
          >
            Historique
          </Link>
        </nav>
      </header>

      {liveMatch ? (
        <Link
          href={`/matches/${liveMatch.id}/live`}
          className="block rounded-2xl border border-pitch-600 bg-pitch-900/40 p-6 hover:bg-pitch-900/60"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-pitch-500">
                Match en cours
              </div>
              <div className="mt-1 text-xl font-bold">
                {liveMatch.teamAName} vs {liveMatch.teamBName}
              </div>
            </div>
            <div className="text-4xl font-black">
              {liveMatch.scoreA} - {liveMatch.scoreB}
            </div>
          </div>
        </Link>
      ) : (
        <Link
          href="/matches/new"
          className="block rounded-2xl bg-pitch-600 p-8 text-center text-2xl font-bold hover:bg-pitch-700 big-touch"
        >
          + Nouveau match
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Derniers matchs</h2>
        {recentMatches.length === 0 ? (
          <p className="text-gray-500">Aucun match joué pour le moment.</p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-xl bg-white/5">
            {recentMatches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
                >
                  <div>
                    <div className="font-medium">
                      {m.teamAName} vs {m.teamBName}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(m.playedAt).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                      {m.mvp ? ` · MVP ${m.mvp.name}` : ""}
                    </div>
                  </div>
                  <div className="text-xl font-black">
                    {m.scoreA} - {m.scoreB}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
