"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Match = {
  id: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  status: "LIVE" | "FINISHED";
  mvpId: string | null;
};

type Player = { id: string; name: string; team: "A" | "B" };
type Goal = {
  id: string;
  scorerId: string;
  scorerName: string;
  assistId: string | null;
  assistName: string | null;
  team: "A" | "B";
  minute: number | null;
};

export default function EditMatchForm({
  match: initial,
  players,
  goals: initialGoals,
}: {
  match: Match;
  players: Player[];
  goals: Goal[];
}) {
  const router = useRouter();
  const [teamAName, setTeamAName] = useState(initial.teamAName);
  const [teamBName, setTeamBName] = useState(initial.teamBName);
  const [scoreA, setScoreA] = useState(initial.scoreA);
  const [scoreB, setScoreB] = useState(initial.scoreB);
  const [mvpId, setMvpId] = useState<string | null>(initial.mvpId);
  const [goals, setGoals] = useState(initialGoals);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch(`/api/matches/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamAName,
          teamBName,
          scoreA,
          scoreB,
          mvpId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || res.statusText);
      }
      setOk(true);
      setTimeout(() => setOk(false), 2000);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function deleteGoal(goalId: string) {
    if (!confirm("Supprimer ce but ?")) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/matches/${initial.id}/goals?goalId=${encodeURIComponent(goalId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Échec de la suppression");
      const j = await res.json();
      setGoals((gs) => gs.filter((g) => g.id !== goalId));
      if (typeof j.scoreA === "number") setScoreA(j.scoreA);
      if (typeof j.scoreB === "number") setScoreB(j.scoreB);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function addGoal(scorerId: string, assistId: string | null, minute: number | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${initial.id}/goals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scorerId,
          assistId,
          minute,
          createdAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec de l'ajout");
      }
      const j = await res.json();
      const scorer = players.find((p) => p.id === scorerId)!;
      const assister = assistId ? players.find((p) => p.id === assistId) : null;
      setGoals((gs) => [
        ...gs,
        {
          id: j.goal.id,
          scorerId,
          scorerName: scorer.name,
          assistId: assistId,
          assistName: assister?.name ?? null,
          team: scorer.team,
          minute,
        },
      ]);
      if (typeof j.scoreA === "number") setScoreA(j.scoreA);
      if (typeof j.scoreB === "number") setScoreB(j.scoreB);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function updateAssist(goalId: string, assistId: string | null) {
    try {
      await fetch(`/api/matches/${initial.id}/goals`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goalId, assistId }),
      });
      setGoals((gs) =>
        gs.map((g) =>
          g.id === goalId
            ? {
                ...g,
                assistId,
                assistName: assistId ? players.find((p) => p.id === assistId)?.name ?? null : null,
              }
            : g
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function deleteMatch() {
    if (!confirm("SUPPRIMER ce match ? Toutes les données seront perdues. Irréversible.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/matches/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec suppression");
      router.replace("/matches/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  async function reopenMatch() {
    if (!confirm("Rouvrir ce match en LIVE ? Tu pourras modifier les buts depuis le mobile.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/matches/${initial.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "LIVE" }),
      });
      if (!res.ok) throw new Error("Échec");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="cursor-pointer rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}
      {ok && (
        <div className="rounded-lg bg-green-900/40 px-3 py-2 text-sm text-green-200">
          ✓ Enregistré
        </div>
      )}

      {/* Teams + scores */}
      <section className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
          Équipes & score
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase text-[color:var(--a-400)]">
              Nom équipe A
            </span>
            <input
              value={teamAName}
              onChange={(e) => setTeamAName(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 font-bold"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase text-[color:var(--b-400)]">
              Nom équipe B
            </span>
            <input
              value={teamBName}
              onChange={(e) => setTeamBName(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 font-bold"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase text-[color:var(--a-400)]">
              Score A
            </span>
            <input
              type="number"
              min={0}
              value={scoreA}
              onChange={(e) => setScoreA(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 font-mono text-xl font-black"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase text-[color:var(--b-400)]">
              Score B
            </span>
            <input
              type="number"
              min={0}
              value={scoreB}
              onChange={(e) => setScoreB(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2 font-mono text-xl font-black"
            />
          </label>
        </div>
      </section>

      {/* MVP */}
      <section className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
          MVP
        </h2>
        <select
          value={mvpId ?? ""}
          onChange={(e) => setMvpId(e.target.value || null)}
          className="w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-2"
        >
          <option value="">— Aucun MVP —</option>
          {[...teamA, ...teamB].map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.team === "A" ? teamAName : teamBName}
            </option>
          ))}
        </select>
      </section>

      {/* Add goal */}
      <section className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
          ⚽ Ajouter un but
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <AddGoalColumn
            teamLabel={teamAName}
            teamClass="A"
            players={teamA}
            teammates={teamA}
            onAdd={addGoal}
            busy={busy}
          />
          <AddGoalColumn
            teamLabel={teamBName}
            teamClass="B"
            players={teamB}
            teammates={teamB}
            onAdd={addGoal}
            busy={busy}
          />
        </div>
      </section>

      {/* Goals */}
      <section className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
          Buts ({goals.length})
        </h2>
        {goals.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-2)]">Aucun but enregistré. Utilise le bloc ci-dessus pour en ajouter.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map((g) => {
              const teammates = players.filter((p) => p.team === g.team && p.id !== g.scorerId);
              return (
                <li
                  key={g.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    g.team === "A"
                      ? "border-[color:var(--a-500)]/30 bg-[color:var(--a-500)]/5"
                      : "border-[color:var(--b-500)]/30 bg-[color:var(--b-500)]/5"
                  }`}
                >
                  <span className="font-mono text-xs text-[color:var(--ink-1)] min-w-[32px]">
                    {g.minute != null ? `${g.minute}'` : "—"}
                  </span>
                  <span className="flex-1 text-sm font-bold">{g.scorerName}</span>
                  <select
                    value={g.assistId ?? ""}
                    onChange={(e) => updateAssist(g.id, e.target.value || null)}
                    className="rounded border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-2 py-1 text-xs"
                  >
                    <option value="">Pas de passe</option>
                    {teammates.map((p) => (
                      <option key={p.id} value={p.id}>
                        p. {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    disabled={busy}
                    className="rounded bg-red-900/40 px-2 py-1 text-xs font-bold text-red-300 hover:bg-red-900/60 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-lg bg-[color:var(--a-500)] px-4 py-3 font-bold text-white disabled:opacity-50"
        >
          {busy ? "…" : "💾 Enregistrer"}
        </button>
      </div>

      <section className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 space-y-3 mt-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-red-400">
          Zone danger
        </h2>
        {initial.status === "FINISHED" && (
          <button
            onClick={reopenMatch}
            disabled={busy}
            className="w-full rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            ↺ Rouvrir en LIVE
          </button>
        )}
        <button
          onClick={deleteMatch}
          disabled={busy}
          className="w-full rounded-lg border border-red-700 bg-red-900/30 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-900/60 disabled:opacity-50"
        >
          🗑 Supprimer le match définitivement
        </button>
      </section>
    </div>
  );
}

function AddGoalColumn({
  teamLabel,
  teamClass,
  players,
  teammates,
  onAdd,
  busy,
}: {
  teamLabel: string;
  teamClass: "A" | "B";
  players: Player[];
  teammates: Player[];
  onAdd: (scorerId: string, assistId: string | null, minute: number | null) => void;
  busy: boolean;
}) {
  const [scorerId, setScorerId] = useState<string>("");
  const [assistId, setAssistId] = useState<string>("");
  const [minute, setMinute] = useState<string>("");

  const accent = teamClass === "A" ? "var(--a-400)" : "var(--b-400)";
  const border =
    teamClass === "A"
      ? "border-[color:var(--a-500)]/40"
      : "border-[color:var(--b-500)]/40";

  function submit() {
    if (!scorerId) return;
    const m = minute.trim() === "" ? null : parseInt(minute);
    onAdd(scorerId, assistId || null, Number.isNaN(m as number) ? null : m);
    setScorerId("");
    setAssistId("");
    setMinute("");
  }

  return (
    <div className={`rounded-lg border bg-[color:var(--bg-2)] p-3 space-y-2 ${border}`}>
      <div
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {teamLabel}
      </div>
      <select
        value={scorerId}
        onChange={(e) => setScorerId(e.target.value)}
        className="w-full rounded border border-[color:var(--stroke)] bg-[color:var(--bg-1)] px-2 py-1.5 text-sm font-bold"
      >
        <option value="">— Buteur —</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={assistId}
        onChange={(e) => setAssistId(e.target.value)}
        className="w-full rounded border border-[color:var(--stroke)] bg-[color:var(--bg-1)] px-2 py-1.5 text-xs"
      >
        <option value="">Pas de passe</option>
        {teammates
          .filter((p) => p.id !== scorerId)
          .map((p) => (
            <option key={p.id} value={p.id}>
              p. {p.name}
            </option>
          ))}
      </select>
      <div className="flex gap-1">
        <input
          type="number"
          placeholder="Min."
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          className="w-16 rounded border border-[color:var(--stroke)] bg-[color:var(--bg-1)] px-2 py-1.5 text-xs font-mono"
          min={0}
        />
        <button
          onClick={submit}
          disabled={!scorerId || busy}
          className="flex-1 rounded bg-[color:var(--a-500)] px-2 py-1.5 text-xs font-bold text-white disabled:opacity-30"
        >
          + Ajouter
        </button>
      </div>
    </div>
  );
}
