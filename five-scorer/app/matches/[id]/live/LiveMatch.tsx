"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import PlayerTile from "@/components/PlayerTile";
import MvpPicker from "@/components/MvpPicker";
import SyncBadge from "@/components/SyncBadge";
import { getLocalMatch, scoreGoal, undoLastGoalOf, finishMatch } from "@/lib/localMatch";
import { kickSync } from "@/lib/sync";

export default function LiveMatch({ matchId }: { matchId: string }) {
  const router = useRouter();

  // Live view straight from Dexie. Re-renders on every local mutation.
  const data = useLiveQuery(() => getLocalMatch(matchId), [matchId]);

  const [mvpOpen, setMvpOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <main className="grid min-h-screen place-items-center text-gray-400">
        Chargement…
      </main>
    );
  }
  if (data === null) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="mb-2 text-xl font-bold">Match introuvable</h1>
        <p className="mb-6 text-sm text-gray-400">
          Ce match n&apos;existe pas dans la mémoire locale de ce téléphone.
        </p>
        <button
          onClick={() => router.replace("/")}
          className="rounded-lg bg-white/10 px-4 py-2"
        >
          Retour
        </button>
      </main>
    );
  }

  const { match, teamA, teamB } = data;

  // If the match was finished elsewhere, redirect to the recap.
  if (match.status === "FINISHED") {
    router.replace(`/matches/${matchId}`);
    return null;
  }

  async function addGoal(playerId: string) {
    try {
      await scoreGoal(matchId, playerId);
      void kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function removeGoal(playerId: string) {
    try {
      const removedId = await undoLastGoalOf(matchId, playerId);
      if (!removedId) setError("Aucun but à annuler pour ce joueur");
      else void kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function onFinish(mvpId: string | null) {
    setFinishing(true);
    try {
      await finishMatch(matchId, mvpId);
      void kickSync();
      router.replace(`/matches/${matchId}`);
    } catch (e) {
      setFinishing(false);
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-black/60 px-4 py-3 backdrop-blur">
        <div className="flex-1 text-center">
          <div className="text-xs uppercase text-pitch-500">{match.teamAName}</div>
          <div className="text-score leading-none">{match.scoreA}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-3xl text-gray-500">—</div>
          <SyncBadge />
        </div>
        <div className="flex-1 text-center">
          <div className="text-xs uppercase text-blue-400">{match.teamBName}</div>
          <div className="text-score leading-none">{match.scoreB}</div>
        </div>
      </header>

      {error && (
        <div
          className="bg-red-900/40 px-4 py-2 text-sm text-red-200"
          onClick={() => setError(null)}
        >
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
              onGoal={() => addGoal(p.id)}
              onUndo={() => removeGoal(p.id)}
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
              onGoal={() => addGoal(p.id)}
              onUndo={() => removeGoal(p.id)}
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
          onConfirm={onFinish}
          busy={finishing}
        />
      )}
    </main>
  );
}
