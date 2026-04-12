"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type Player = {
  id: string;
  name: string;
  isGuest: boolean;
};

type Assignment = "none" | "A" | "B";

export default function NewMatchForm({ players: initial }: { players: Player[] }) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>(initial);
  const [teamAName, setTeamAName] = useState("Équipe A");
  const [teamBName, setTeamBName] = useState("Équipe B");
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamA = useMemo(
    () => players.filter((p) => assignments[p.id] === "A"),
    [players, assignments]
  );
  const teamB = useMemo(
    () => players.filter((p) => assignments[p.id] === "B"),
    [players, assignments]
  );

  function cycle(playerId: string) {
    setAssignments((prev) => {
      const current = prev[playerId] ?? "none";
      const next: Assignment =
        current === "none" ? "A" : current === "A" ? "B" : "none";
      return { ...prev, [playerId]: next };
    });
  }

  async function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, isGuest: true }),
    });
    if (!res.ok) {
      setError("Impossible d'ajouter l'invité");
      return;
    }
    const { player } = (await res.json()) as { player: Player };
    setPlayers((ps) => [...ps, player]);
    setAssignments((a) => ({ ...a, [player.id]: "A" }));
    setGuestName("");
  }

  async function startMatch() {
    if (teamA.length === 0 || teamB.length === 0) {
      setError("Chaque équipe doit avoir au moins un joueur");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamAName,
        teamBName,
        teamA: teamA.map((p) => p.id),
        teamB: teamB.map((p) => p.id),
      }),
    });
    if (!res.ok) {
      setLoading(false);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Erreur");
      return;
    }
    const { match } = (await res.json()) as { match: { id: string } };
    router.replace(`/matches/${match.id}/live`);
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase text-gray-400">Nom équipe A</span>
          <input
            value={teamAName}
            onChange={(e) => setTeamAName(e.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-pitch-500"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase text-gray-400">Nom équipe B</span>
          <input
            value={teamBName}
            onChange={(e) => setTeamBName(e.target.value)}
            className="mt-1 w-full rounded-lg bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-pitch-500"
          />
        </label>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase text-gray-400">
          Joueurs — tape pour assigner : Aucun → A → B
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {players.map((p) => {
            const a = assignments[p.id] ?? "none";
            return (
              <button
                key={p.id}
                onClick={() => cycle(p.id)}
                className={cn(
                  "big-touch rounded-xl border px-3 py-3 text-left transition",
                  a === "none" && "border-white/10 bg-white/5",
                  a === "A" && "border-pitch-500 bg-pitch-600/40",
                  a === "B" && "border-blue-400 bg-blue-600/30"
                )}
              >
                <div className="font-semibold">
                  {p.name}
                  {p.isGuest && (
                    <span className="ml-1 text-xs text-gray-400">(inv.)</span>
                  )}
                </div>
                <div className="text-xs text-gray-300">
                  {a === "none" ? "—" : a === "A" ? teamAName : teamBName}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl bg-white/5 p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase text-gray-400">
          Ajouter un invité
        </h3>
        <div className="flex gap-2">
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Nom de l'invité"
            className="flex-1 rounded-lg bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-pitch-500"
          />
          <button
            onClick={addGuest}
            className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
          >
            + Invité
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          {teamAName} : {teamA.length} · {teamBName} : {teamB.length}
        </span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={startMatch}
        disabled={loading}
        className="big-touch w-full rounded-2xl bg-pitch-600 py-5 text-xl font-bold hover:bg-pitch-700 disabled:opacity-50"
      >
        {loading ? "Création…" : "Lancer le match"}
      </button>
    </div>
  );
}
