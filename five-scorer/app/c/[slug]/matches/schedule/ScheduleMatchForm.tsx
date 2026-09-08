"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { scheduleMatch } from "@/app/actions/schedule";
import { createOpponent } from "@/app/actions/opponents";

type Mode = "INTERNAL" | "EXTERNAL";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function ScheduleMatchForm({
  slug,
  opponents,
  nomsParDefaut = { a: "Blanc", b: "Noir" },
}: {
  slug: string;
  opponents: { id: string; name: string }[];
  /// Les noms d'équipe se déduisent des chasubles du club.
  nomsParDefaut?: { a: string; b: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<Mode>("INTERNAL");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [teamAName, setTeamAName] = useState(nomsParDefaut.a);
  const [teamBName, setTeamBName] = useState(nomsParDefaut.b);
  const [opponentId, setOpponentId] = useState<string>(opponents[0]?.id ?? "");
  const [newOpponent, setNewOpponent] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Défaut : dans 2 jours, 20h00 — calculé côté client (fuseau du navigateur).
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(20, 0, 0, 0);
    setDate(toLocalInput(d));
  }, []);

  async function addOpponent() {
    const name = newOpponent.trim();
    if (!name) return;
    const res = await createOpponent(slug, name);
    if (res.ok && res.opponentId) {
      setOpponentId(res.opponentId);
      setNewOpponent("");
      router.refresh();
    } else {
      setError(res.error ?? "Erreur");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = date ? new Date(date) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      setError("Date invalide.");
      return;
    }
    if (mode === "EXTERNAL" && !opponentId) {
      setError("Choisis l'équipe adverse.");
      return;
    }
    startTransition(async () => {
      const res = await scheduleMatch(slug, {
        scheduledAt: parsed.toISOString(),
        kind: mode,
        opponentId: mode === "EXTERNAL" ? opponentId : null,
        venue: venue.trim() || undefined,
        teamAName: teamAName.trim() || undefined,
        teamBName: teamBName.trim() || undefined,
      });
      if (!res.ok || !res.matchId) {
        setError(res.error ?? "Erreur");
      } else {
        router.push(`/c/${slug}/matches/${res.matchId}`);
        router.refresh();
      }
    });
  }

  const inputCls =
 "mt-1 w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--ink-1)]";

  return (
    <form
      onSubmit={submit}
      className="space-y-6 bande"
    >
      <div className="flex gap-1 self-start rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)] p-1">
        {(
          [
            ["INTERNAL", "Entre nous"],
            ["EXTERNAL", "Vs adversaire"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
 "rounded-[2px] px-3.5 py-2 text-[13px] font-semibold transition-colors",
              mode === m
                ? "bg-[color:var(--ink-1)] text-[color:var(--pitch-0)]"
                : "text-[color:var(--ink-1)] hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="kicker">Date & heure</span>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="kicker">Lieu</span>
        <input
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Urban Soccer …"
          className={inputCls}
        />
      </label>

      {mode === "INTERNAL" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="kicker">Équipe A</span>
            <input
              value={teamAName}
              onChange={(e) => setTeamAName(e.target.value)}
              className="mt-1 w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--bib-a)]"
            />
          </label>
          <label className="block">
            <span className="kicker">Équipe B</span>
            <input
              value={teamBName}
              onChange={(e) => setTeamBName(e.target.value)}
              className="mt-1 w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--b-500)]"
            />
          </label>
        </div>
      ) : (
        <div className="rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-2)] p-4">
          <span className="kicker">Adversaire</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {opponents.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOpponentId(o.id)}
                className={cn(
 "rounded-[2px] border px-4 py-2 text-sm font-bold transition-colors",
                  opponentId === o.id
                    ? "border-[color:var(--bib-b-ink)] bg-[color:var(--pitch-2)] text-[color:var(--bib-b-ink)]"
                    : "border-[color:var(--rule)] bg-[color:var(--pitch-2)] text-[color:var(--ink-1)]"
                )}
              >
                {o.name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newOpponent}
              onChange={(e) => setNewOpponent(e.target.value)}
              placeholder="Nouvelle équipe adverse…"
              className="flex-1 rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--b-500)]"
            />
            <button
              type="button"
              onClick={addOpponent}
              className="rounded-[2px] border border-[color:var(--rule-hi)] bg-[color:var(--pitch-2)] px-4 py-2 text-sm font-bold hover:border-[color:var(--bib-b-ink)]"
            >
              + Ajouter
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[color:var(--loss)]">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="big-touch w-full rounded-none bg-[color:var(--ink-1)] py-4 text-lg font-black text-[color:var(--pitch-0)] disabled:opacity-50"
      >
        {isPending ? "Création…" : "Programmer le match"}
      </button>

      <p className="text-xs text-[color:var(--ink-2)]">
        Les membres reçoivent la convocation sur l&apos;accueil et répondent
        présent. Le jour J, tu composes les équipes avec les présents et tu
        lances.
      </p>
    </form>
  );
}
