"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import Icon from "@/components/Icon";
import { voteMotm } from "@/app/actions/motm";

type Candidate = { id: string; name: string; votes: number };

export default function MotmVotePanel({
  slug,
  matchId,
  candidates,
  myVote,
}: {
  slug: string;
  matchId: string;
  candidates: Candidate[];
  myVote: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(myVote);
  const [rows, setRows] = useState(candidates);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalVotes = rows.reduce((s, c) => s + c.votes, 0);

  function vote(playerId: string) {
    if (pending) return;
    setError(null);
    const prev = selected;
    setSelected(playerId);
    // Optimiste : déplace ma voix.
    setRows((rs) =>
      rs.map((c) => ({
        ...c,
        votes:
          c.id === playerId
            ? c.votes + (prev === playerId ? 0 : 1)
            : c.id === prev
              ? Math.max(0, c.votes - 1)
              : c.votes,
      }))
    );
    startTransition(async () => {
      const res = await voteMotm(slug, matchId, playerId);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        setSelected(prev);
      }
    });
  }

  const max = Math.max(1, ...rows.map((c) => c.votes));

  return (
    <div className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-4">
      <div className="mb-1 text-sm font-black uppercase tracking-wider text-[color:var(--gold)]">
        Homme du match — vote des membres
      </div>
      <p className="mb-3 text-xs tabular-nums text-[color:var(--ink-3)]">
        {totalVotes} vote{totalVotes > 1 ? "s" : ""} · tu peux changer ton vote
        à tout moment.
      </p>
      <div className="space-y-1.5">
        {[...rows]
          .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
          .map((c) => (
            <button
              key={c.id}
              disabled={pending}
              onClick={() => vote(c.id)}
              className={cn(
                "relative block w-full overflow-hidden rounded-xl border px-4 py-2.5 text-left transition-colors",
                selected === c.id
                  ? "border-[color:var(--gold)] bg-[color:var(--bg-2)]"
                  : "border-[color:var(--stroke)] bg-[color:var(--bg-2)] hover:border-[color:var(--stroke-hi)]"
              )}
            >
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${(c.votes / max) * 100}%`,
                  background:
                    "color-mix(in srgb, var(--gold) 16%, transparent)",
                }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1.5 font-bold">
                  <span className="truncate">{c.name}</span>
                  {selected === c.id && (
                    <Icon
                      name="check"
                      size={14}
                      label="Ton vote"
                      className="shrink-0 text-[color:var(--gold)]"
                    />
                  )}
                </span>
                <span className="text-sm font-black tabular-nums text-[color:var(--gold)]">
                  {c.votes}
                </span>
              </span>
            </button>
          ))}
      </div>
      {error && (
        <p className="mt-2 text-sm text-[color:var(--loss)]">{error}</p>
      )}
    </div>
  );
}
