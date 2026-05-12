import Link from "next/link";
import { getSeasons, type SeasonWinner } from "@/lib/seasons";

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const seasons = await getSeasons();

  return (
    <main className="relative min-h-screen">
      <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-6">
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)] hover:text-white"
        >
          ← Accueil
        </Link>

        <header className="mt-6 mb-8">
          <span className="kicker">Archives par mois</span>
          <h1 className="display-xl mt-3">
            Saisons<span className="text-[color:var(--gold)]">.</span>
          </h1>
          <p className="mt-2 text-sm text-[color:var(--ink-1)]">
            Champion buteur, MVP du mois et meilleur ratio victoires.
          </p>
        </header>

        {seasons.length === 0 ? (
          <p className="text-[color:var(--ink-2)]">
            Aucun match terminé pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-4">
            {seasons.map((s) => (
              <section
                key={s.id}
                className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)]/60 p-5 backdrop-blur"
              >
                <header className="mb-4 flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-black tracking-tight">{s.label}</h2>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--ink-2)]">
                    {s.matchCount} match{s.matchCount > 1 ? "s" : ""}
                  </span>
                </header>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <WinnerCard
                    label="Meilleur buteur"
                    icon="⚽"
                    winner={s.topScorer}
                    unit="buts"
                  />
                  <WinnerCard
                    label="Roi des MVP"
                    icon="⭐"
                    winner={s.topMvp}
                    unit="MVP"
                    accent="gold"
                  />
                  <WinnerCard
                    label="Meilleur ratio"
                    icon="🏆"
                    winner={s.bestRatio}
                    unit="%"
                    accent="amber"
                  />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function WinnerCard({
  label,
  icon,
  winner,
  unit,
  accent,
}: {
  label: string;
  icon: string;
  winner: SeasonWinner | null;
  unit: string;
  accent?: "gold" | "amber";
}) {
  const ring =
    accent === "gold"
      ? "border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5"
      : accent === "amber"
        ? "border-[color:var(--a-500)]/30 bg-[color:var(--a-500)]/5"
        : "border-[color:var(--stroke)] bg-[color:var(--bg-2)]/40";
  const valColor =
    accent === "gold"
      ? "text-[color:var(--gold)]"
      : accent === "amber"
        ? "text-[color:var(--a-400)]"
        : "text-[color:var(--ink-0)]";

  return (
    <div className={`rounded-xl border p-3 ${ring}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {winner ? (
        <Link
          href={`/stats/players/${winner.playerId}`}
          className="mt-2 block hover:opacity-80"
        >
          <div className="truncate text-base font-bold">{winner.name}</div>
          <div className={`mt-0.5 font-mono text-2xl font-black ${valColor}`}>
            {winner.value}
            <span className="ml-1 text-xs font-bold text-[color:var(--ink-2)]">
              {unit}
            </span>
            {winner.detail && (
              <span className="ml-2 font-sans text-[10px] font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
                ({winner.detail})
              </span>
            )}
          </div>
        </Link>
      ) : (
        <div className="mt-2 text-sm text-[color:var(--ink-2)]">—</div>
      )}
    </div>
  );
}
