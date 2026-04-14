"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import PlayerTile from "@/components/PlayerTile";
import MvpPicker from "@/components/MvpPicker";
import SyncBadge from "@/components/SyncBadge";
import AssistPicker from "@/components/AssistPicker";
import {
  getLocalMatch,
  scoreGoal,
  setAssist,
  undoLastGoalOf,
  finishMatch,
} from "@/lib/localMatch";
import { kickSync } from "@/lib/sync";
import { isSoundEnabled, toggleSound } from "@/lib/audio";

function useMatchClock(startTs: number | null, paused: boolean) {
  const [text, setText] = useState("00:00");
  const pausedMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!startTs) return;
    if (paused && pausedAtRef.current == null) {
      pausedAtRef.current = Date.now();
    } else if (!paused && pausedAtRef.current != null) {
      pausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [paused, startTs]);

  useEffect(() => {
    if (!startTs) return;
    const tick = () => {
      if (paused) return;
      const s = Math.floor((Date.now() - startTs - pausedMsRef.current) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setText(`${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTs, paused]);

  return text;
}

export default function LiveMatch({ matchId }: { matchId: string }) {
  const router = useRouter();
  const data = useLiveQuery(() => getLocalMatch(matchId), [matchId]);

  const [mvpOpen, setMvpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [assistPicker, setAssistPicker] = useState<{
    goalId: string;
    scorerId: string;
    scorerName: string;
    scorerTeam: "A" | "B";
  } | null>(null);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const startTs = useRef<number | null>(null);
  if (data && !startTs.current) {
    startTs.current = new Date(data.match.playedAt).getTime();
  }
  const clock = useMatchClock(startTs.current, paused);

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

  const addGoal = useCallback(
    async (playerId: string, playerName: string, team: "A" | "B") => {
      try {
        const goalId = await scoreGoal(matchId, playerId);
        void kickSync();
        setAssistPicker({ goalId, scorerId: playerId, scorerName: playerName, scorerTeam: team });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    },
    [matchId]
  );

  const removeGoal = useCallback(
    async (playerId: string) => {
      try {
        const removedId = await undoLastGoalOf(matchId, playerId);
        if (!removedId) setError("Aucun but à annuler pour ce joueur");
        else void kickSync();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    },
    [matchId]
  );

  async function onPickAssist(assistId: string) {
    if (!assistPicker) return;
    try {
      await setAssist(assistPicker.goalId, assistId);
      void kickSync();
    } catch {
      /* non-blocking */
    }
    setAssistPicker(null);
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
  const scorerTeammates = assistPicker
    ? (assistPicker.scorerTeam === "A" ? teamA : teamB).filter((p) => p.id !== assistPicker.scorerId)
    : [];

  return (
    <main className="flex min-h-screen flex-col">
      {/* Topbar */}
      <header className="live-topbar">
        <div className="live-topbar-left">
          <span
            className="live-dot"
            style={paused ? { animation: "none", opacity: 0.3 } : undefined}
          />
          <span>{paused ? "PAUSE" : "LIVE"}</span>
          <span className="match-clock">{clock}</span>
          <button
            onClick={() => setPaused((p) => !p)}
            className="icon-btn"
            title={paused ? "Reprendre" : "Pause"}
          >
            {paused ? "\u25B6" : "\u23F8"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundOn(toggleSound())}
            className="icon-btn"
            title="Son"
          >
            {soundOn ? "\uD83D\uDD0A" : "\uD83D\uDD07"}
          </button>
          <SyncBadge compact />
          <button onClick={() => setConfirmOpen(true)} className="btn-fin">
            Fin
          </button>
        </div>
      </header>

      {/* Scorebar */}
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
              onGoal={() => addGoal(p.id, p.name, "A")}
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
              onGoal={() => addGoal(p.id, p.name, "B")}
              onUndo={() => removeGoal(p.id)}
            />
          ))}
        </section>
      </div>

      {assistPicker && scorerTeammates.length > 0 && (
        <AssistPicker
          scorerName={assistPicker.scorerName}
          scorerTeam={assistPicker.scorerTeam}
          teammates={scorerTeammates}
          onPick={onPickAssist}
          onSkip={() => setAssistPicker(null)}
        />
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="rounded-2xl border border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] p-6 text-center">
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
