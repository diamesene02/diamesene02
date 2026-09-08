"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { voteMotm } from "@/app/actions/motm";
import AvatarAnneau from "@/components/ios/AvatarAnneau";

type Candidate = { id: string; name: string; votes: number };

// Le vote de l'homme du match : une carte, une rangée par joueur avec sa
// barre de voix. Un tap = ma voix ; on peut la déplacer à tout moment.
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
        votes: c.id === playerId ? c.votes + (prev === playerId ? 0 : 1) : c.id === prev ? Math.max(0, c.votes - 1) : c.votes,
      })),
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
    <section className="carte" style={{ padding: "0 20px 8px" }}>
      <div className="carte-titre">Homme du match</div>
      <p className="text-center text-[15px]" style={{ color: "var(--i2)", marginTop: -6, paddingBottom: 8 }}>
        {totalVotes} vote{totalVotes > 1 ? "s" : ""} · touche pour voter, tu peux changer d&apos;avis.
      </p>
      {[...rows]
        .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
        .map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={pending}
            onClick={() => vote(c.id)}
            aria-pressed={selected === c.id}
            className="flex w-full items-center gap-3 border-t text-left"
            style={{ minHeight: 56, borderColor: "var(--sep)", background: "none", color: "var(--ink)", fontFamily: "inherit", padding: "6px 0" }}
          >
            <AvatarAnneau nom={c.name} taille={32} />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className={cn("truncate text-[17px]", selected === c.id ? "font-semibold" : "font-medium")}>
                {c.name}
                {selected === c.id && <span style={{ color: "var(--or)" }}> ★</span>}
              </span>
              <span style={{ height: 4, borderRadius: 2, background: "var(--sep)", overflow: "hidden" }}>
                <span style={{ display: "block", height: 4, borderRadius: 2, width: `${(c.votes / max) * 100}%`, background: "var(--or)" }} />
              </span>
            </span>
            <span className="text-[22px] font-bold tabular-nums" style={{ color: c.votes ? "var(--or)" : "var(--i3)" }}>
              {c.votes}
            </span>
          </button>
        ))}
      {error && <p className="pt-2 text-[15px]" style={{ color: "var(--bad)" }}>{error}</p>}
    </section>
  );
}
