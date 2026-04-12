"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveMatch, type LivePlayer } from "@/stores/liveMatch";
import PlayerTile from "@/components/PlayerTile";
import MvpPicker from "@/components/MvpPicker";

type Props = {
  matchId: string;
  teamAName: string;
  teamBName: string;
  initialScoreA: number;
  initialScoreB: number;
  teamA: LivePlayer[];
  teamB: LivePlayer[];
};

export default function LiveMatch(props: Props) {
  const router = useRouter();
  const { scoreA, scoreB, teamA, teamB, init, applyGoal, setScores } =
    useLiveMatch();
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init({
      matchId: props.matchId,
      scoreA: props.initialScoreA,
      scoreB: props.initialScoreB,
      teamA: props.teamA,
      teamB: props.teamB,
    });
  }, [init, props.matchId, props.initialScoreA, props.initialScoreB, props.teamA, props.teamB]);

  async function addGoal(playerId: string, team: "A" | "B") {
    applyGoal(playerId, team, 1);
    try {
      const res = await fetch(`/api/matches/${props.matchId}/goals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scorerId: playerId }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { scoreA: number; scoreB: number };
      setScores(data.scoreA, data.scoreB);
    } catch {
      applyGoal(playerId, team, -1);
      setError("Impossible d'enregistrer le but — réessaie.");
    }
  }

  async function removeGoal(playerId: string, team: "A" | "B") {
    applyGoal(playerId, team, -1);
    try {
      const res = await fetch(
        `/api/matches/${props.matchId}/goals?scorerId=${playerId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { scoreA: number; scoreB: number };
      setScores(data.scoreA, data.scoreB);
    } catch {
      applyGoal(playerId, team, 1);
      setError("Annulation impossible.");
    }
  }

  async function finishMatch(mvpId: string | null) {
    setFinishing(true);
    const res = await fetch(`/api/matches/${props.matchId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "FINISHED", mvpId }),
    });
    setFinishing(false);
    if (!res.ok) {
      setError("Impossible de terminer le match");
      return;
    }
    router.replace(`/matches/${props.matchId}`);
  }

  const [mvpOpen, setMvpOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-black/60 px-4 py-3 backdrop-blur">
        <div className="flex-1 text-center">
          <div className="text-xs uppercase text-pitch-500">{props.teamAName}</div>
          <div className="text-score leading-none">{scoreA}</div>
        </div>
        <div className="text-3xl text-gray-500">—</div>
        <div className="flex-1 text-center">
          <div className="text-xs uppercase text-blue-400">{props.teamBName}</div>
          <div className="text-score leading-none">{scoreB}</div>
        </div>
      </header>

      {error && (
        <div className="bg-red-900/40 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid flex-1 grid-cols-2 gap-2 p-2">
        <section className="space-y-2">
          {teamA.map((p) => (
            <PlayerTile
              key={p.id}
              name={p.name}
              goals={p.goals}
              tint="pitch"
              onGoal={() => addGoal(p.id, "A")}
              onUndo={() => removeGoal(p.id, "A")}
            />
          ))}
        </section>
        <section className="space-y-2">
          {teamB.map((p) => (
            <PlayerTile
              key={p.id}
              name={p.name}
              goals={p.goals}
              tint="blue"
              onGoal={() => addGoal(p.id, "B")}
              onUndo={() => removeGoal(p.id, "B")}
            />
          ))}
        </section>
      </div>

      <footer className="sticky bottom-0 bg-black/70 p-3 backdrop-blur">
        <button
          onClick={() => setMvpOpen(true)}
          className="big-touch w-full rounded-xl bg-red-600 py-4 text-lg font-bold hover:bg-red-700"
        >
          Terminer le match
        </button>
      </footer>

      {mvpOpen && (
        <MvpPicker
          players={[...teamA, ...teamB]}
          onCancel={() => setMvpOpen(false)}
          onConfirm={finishMatch}
          busy={finishing}
        />
      )}
    </main>
  );
}
