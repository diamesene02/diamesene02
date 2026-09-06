"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateMatchDetails } from "@/app/actions/matches";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function EditMatchForm({
  slug,
  matchId,
  initial,
  participants,
  seasons,
}: {
  slug: string;
  matchId: string;
  initial: {
    teamAName: string;
    teamBName: string;
    playedAt: string; // ISO
    mvpId: string | null;
    seasonId: string | null;
    notes: string;
  };
  participants: { id: string; name: string; team: "A" | "B" }[];
  seasons: { id: string; name: string; isActive: boolean }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [teamAName, setTeamAName] = useState(initial.teamAName);
  const [teamBName, setTeamBName] = useState(initial.teamBName);
  const [playedAt, setPlayedAt] = useState("");
  const [mvpId, setMvpId] = useState(initial.mvpId ?? "");
  const [seasonId, setSeasonId] = useState(initial.seasonId ?? "");
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);

  // datetime-local dépend du fuseau du navigateur → rempli après montage.
  useEffect(() => {
    setPlayedAt(toLocalInput(initial.playedAt));
  }, [initial.playedAt]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const date = playedAt ? new Date(playedAt) : null;
    if (!date || Number.isNaN(date.getTime())) {
      setError("Date invalide.");
      return;
    }
    startTransition(async () => {
      const res = await updateMatchDetails(slug, matchId, {
        teamAName,
        teamBName,
        playedAt: date.toISOString(),
        mvpId: mvpId || null,
        seasonId: seasonId || null,
        notes,
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur");
      } else {
        router.push(`/c/${slug}/matches/${matchId}`);
        router.refresh();
      }
    });
  }

  const inputCls =
    "mt-1 min-h-[44px] w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 outline-none focus:border-[color:var(--lime)]";

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="kicker">Équipe A</span>
          <input
            value={teamAName}
            onChange={(e) => setTeamAName(e.target.value)}
            required
            className="mt-1 min-h-[44px] w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 outline-none focus:border-[color:var(--a-500)]"
          />
        </label>
        <label className="block">
          <span className="kicker">Équipe B</span>
          <input
            value={teamBName}
            onChange={(e) => setTeamBName(e.target.value)}
            required
            className="mt-1 min-h-[44px] w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 outline-none focus:border-[color:var(--b-500)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="kicker">Joué le</span>
        <input
          type="datetime-local"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          required
          className={inputCls}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="kicker">MVP</span>
          <select
            value={mvpId}
            onChange={(e) => setMvpId(e.target.value)}
            className={inputCls}
          >
            <option value="">Aucun</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.team})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="kicker">Saison</span>
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            className={inputCls}
          >
            <option value="">Hors saison</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="kicker">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Petit pont, grand moment…"
          className={inputCls}
        />
      </label>

      {error && <p className="text-sm text-[color:var(--loss)]">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[56px] items-center rounded-full bg-[color:var(--lime)] px-6 text-sm font-black text-[color:var(--bg-0)] disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Link
          href={`/c/${slug}/matches/${matchId}`}
          className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-5 text-sm font-bold text-[color:var(--ink-1)] hover:text-white"
        >
          Annuler
        </Link>
      </div>

      <p className="border-t border-[color:var(--stroke)] pt-4 text-xs text-[color:var(--ink-2)]">
        Pour corriger les buts, ouvre le match et utilise la timeline.
      </p>
    </form>
  );
}
