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

  const data = useLiveQuery(() => getLocalMatch(matchId), [matchId]);

  const [mvpOpen, setMvpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      {/* Header: scores + Fin button */}
      <header className="sticky top-0 z-10 flex items-center gap-4 bg-black/70 px-4 py-2 backdrop-blur">
        <div className="flex-1 text-center">
          <div className="text-xs uppercase text-pitch-500">{match.teamAName}</div>
          <div className="text-5xl font-black leading-none">{match.scoreA}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-2xl text-gray-500">&mdash;</div>
          <SyncBadge />
        </div>
        <div className="flex-1 text-center">
          <div className="text-xs uppercase text-blue-400">{match.teamBName}</div>
          <div className="text-5xl font-black leading-none">{match.scoreB}</div>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          className="shrink-0 rounded-lg border border-red-800 bg-red-900/30 px-3 py-1.5 text-xs font-bold text-red-300 active:bg-red-600 active:text-white"
        >
          Fin
        </button>
      </header>

      {error && (
        <div
          className="bg-red-900/40 px-4 py-2 text-sm text-red-200"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      {/* Player tiles — landscape: 2 team columns, portrait: 2-col grid */}
      <div className="live-container flex-1">
        <section>
          <div className="team-label hidden px-2 text-[11px] font-bold uppercase tracking-wide text-pitch-400">
            {match.teamAName}
          </div>
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
        <section>
          <div className="team-label hidden px-2 text-[11px] font-bold uppercase tracking-wide text-blue-400">
            {match.teamBName}
          </div>
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

      {/* Confirm dialog */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}
        >
          <div className="rounded-2xl border border-gray-700 bg-gray-900 p-6 text-center">
            <h2 className="mb-4 text-lg font-bold">Terminer ce match ?</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-lg bg-gray-800 px-4 py-3 font-bold"
              >
                Annuler
              </button>
              <button
                onClick={() => { setConfirmOpen(false); setMvpOpen(true); }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-bold"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}

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
