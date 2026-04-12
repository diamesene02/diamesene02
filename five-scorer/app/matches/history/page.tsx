import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const matches = await prisma.match.findMany({
    orderBy: { playedAt: "desc" },
    include: { mvp: true },
    take: 100,
  });

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <Link href="/" className="text-sm text-gray-400 hover:text-white">
        ← Accueil
      </Link>
      <h1 className="text-2xl font-bold">Historique des matchs</h1>
      {matches.length === 0 ? (
        <p className="text-gray-500">Aucun match.</p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-xl bg-white/5">
          {matches.map((m) => (
            <li key={m.id}>
              <Link
                href={`/matches/${m.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
              >
                <div>
                  <div className="font-medium">
                    {m.teamAName} vs {m.teamBName}
                    {m.status === "LIVE" && (
                      <span className="ml-2 rounded bg-red-600/80 px-2 py-0.5 text-xs">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(m.playedAt).toLocaleString("fr-FR")}
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
    </main>
  );
}
