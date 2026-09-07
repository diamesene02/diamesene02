"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSeason,
  closeSeason,
  reopenSeason,
} from "@/app/actions/seasons";

type SeasonRow = {
  id: string;
  name: string;
  isActive: boolean;
  period: string;
};

export default function SeasonsCard({
  slug,
  seasons,
}: {
  slug: string;
  seasons: SeasonRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Erreur");
      } else {
        setName("");
        router.refresh();
      }
    });
  }

  return (
    <section className="bande">
      <h2 className="kicker">Saisons</h2>

      {seasons.length > 0 ? (
        <ul className="mt-4 divide-y divide-[color:var(--rule)] overflow-hidden rounded-none border border-[color:var(--rule)]">
          {seasons.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-[color:var(--pitch-2)] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{s.name}</span>
                  {s.isActive && (
                    <span className="rounded-[2px] bg-[color:var(--ink-1)] px-2 py-0.5 text-[13px] font-semibold text-[color:var(--pitch-0)]">
                      active
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-xs text-[color:var(--ink-2)]">
                  {s.period}
                </div>
              </div>
              {s.isActive ? (
                <button
                  onClick={() => run(() => closeSeason(slug, s.id))}
                  disabled={isPending}
                  className="rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-4 py-1.5 text-xs font-bold text-[color:var(--ink-1)] hover:text-white disabled:opacity-50"
                >
                  Clôturer
                </button>
              ) : (
                <button
                  onClick={() => run(() => reopenSeason(slug, s.id))}
                  disabled={isPending}
                  className="rounded-[2px] border border-[color:var(--rule-hi)] bg-[color:var(--pitch-2)] px-4 py-1.5 text-xs font-bold hover:border-[color:var(--ink-1)] disabled:opacity-50"
                >
                  Réactiver
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[color:var(--ink-1)]">
          Aucune saison pour l&apos;instant — lance la première 👇
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) run(() => createSeason(slug, name));
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Saison 2026-2027"
          className="min-w-0 flex-1 rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--ink-1)]"
        />
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="rounded-[2px] bg-[color:var(--ink-1)] px-5 py-2 text-sm font-black text-[color:var(--pitch-0)] disabled:opacity-50"
        >
          {isPending ? "…" : "Créer"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-[color:var(--loss)]">{error}</p>}

      <p className="mt-3 text-xs text-[color:var(--ink-2)]">
        Les nouveaux matchs s&apos;attachent automatiquement à la saison
        active.
      </p>
    </section>
  );
}
