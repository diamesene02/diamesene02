"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import PlayerTile from "@/components/PlayerTile";
import MvpPicker from "@/components/MvpPicker";
import SyncBadge from "@/components/SyncBadge";
import { getLocalMatch, scoreGoal, undoLastGoalOf, finishMatch } from "@/lib/localMatch";
import { kickSync } from "@/lib/sync";

function useMatchClock(startTs: number | null) {
  const [text, setText] = useState("00:00");
  useEffect(() => {
    if (!startTs) return;
    const tick = () => {
      const s = Math.floor((Date.now() - startTs) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setText(`${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTs]);
  return text;
}

export default function LiveMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const data = useLiveQuery(() => getLocalMatch(matchId), [matchId]);

  const [mvpOpen, setMvpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startTs = useRef<number | null>(null);
  if (data && !startTs.current) {
    startTs.current = new Date(data.match.playedAt).getTime();
  }
  const clock = useMatchClock(startTs.current);

  // Score-pop animation on change
  const scoreARef = useRef<HTMLSpanElement>(null);
  const scoreBRef = useRef<HTMLSpanElement>(null);
  const prevScoreRef = useRef<{ a: number; b: number } | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = prevScoreRef.current;
    const curr = { a: data.match.scoreA, b: data.match.scoreB };
    if (prev) {
      if (curr.a > prev.a && scoreARef.current) {
        scoreARef.current.classList.add("goaled");
        setTimeout(() => scoreARef.current?.classList.remove("goaled"), 600);
      }
      if (curr.b > prev.b && scoreBRef.current) {
        scoreBRef.current.classList.add("goaled");
        setTimeout(() => scoreBRef.current?.classList.remove("goaled"), 600);
      }
    }
    prevScoreRef.current = curr;
  }, [data]);

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

  const aLead = match.scoreA > match.scoreB;
  const bLead = match.scoreB > match.scoreA;

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
      {/* Topbar: LIVE dot + clock | sync dot + Fin */}
      <header className="live-topbar">
        <div className="live-topbar-left">
          <span className="live-dot" />
          <span>LIVE</span>
          <span className="match-clock">{clock}</span>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge compact />
          <button onClick={() => setConfirmOpen(true)} className="btn-fin">
            Fin
          </button>
        </div>
      </header>

      {/* Scorebar hero */}
      <header className="scorebar">
        <div className="scorebar-team A">
          <div className="team-chip A">{match.teamAName}</div>
        </div>
        <div className="scoreboard">
          <span ref={scoreARef} className={`score${aLead ? " leading A" : ""}`}>
            {match.scoreA}
          </span>
          <span className="sep">:</span>
          <span ref={scoreBRef} className={`score${bLead ? " leading B" : ""}`}>
            {match.scoreB}
          </span>
        </div>
        <div className="scorebar-team B">
          <div className="team-chip B">{match.teamBName}</div>
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

      {/* Player tiles */}
      <div className="live-container flex-1">
        <section>
          <div className="team-label hidden px-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--a-400)]">
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
          <div className="team-label hidden px-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--b-400)]">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="rounded-2xl border border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] p-6 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
            <h2 className="mb-4 text-lg font-bold">Terminer ce match ?</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-lg bg-[color:var(--bg-2)] px-4 py-3 font-bold"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setMvpOpen(true);
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-bold text-white"
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
