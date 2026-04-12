import Link from "next/link";
import { getTopScorers } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function TopScorersPage() {
  const scorers = await getTopScorers(50);
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <Link href="/" className="text-sm text-gray-400 hover:text-white">
        ← Accueil
      </Link>
      <h1 className="text-2xl font-bold">Classement des buteurs</h1>
      {scorers.length === 0 ? (
        <p className="text-gray-500">Aucun but enregistré.</p>
      ) : (
        <ol className="divide-y divide-white/5 rounded-xl bg-white/5">
          {scorers.map((s, i) => (
            <li key={s.playerId}>
              <Link
                href={`/stats/players/${s.playerId}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/5"
              >
                <span className="w-6 text-right text-gray-400">{i + 1}</span>
                <span className="flex-1 font-medium">
                  {s.name}
                  {s.isGuest && (
                    <span className="ml-1 text-xs text-gray-400">(inv.)</span>
                  )}
                </span>
                <span className="text-lg font-bold">{s.goals}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
