"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { cn } from "@/lib/cn";
import { getDb, type LocalPlayer } from "@/lib/db";
import {
  addLocalGuest,
  createMatch,
  launchScheduledMatch,
  saveRoster,
} from "@/lib/localMatch";
import { kickSync } from "@/lib/sync";
import { balanceTeams } from "@/lib/balance";
import { createOpponent } from "@/app/actions/opponents";
import SyncBadge from "@/components/SyncBadge";
import Icon from "@/components/Icon";

type Assignment = "none" | "A" | "B";
type Mode = "INTERNAL" | "EXTERNAL";

/// Match programmé à lancer : la config (mode, adversaire, noms) vient du
/// serveur, la page ne sert qu'à composer les équipes avec les présents.
type ScheduledInfo = {
  id: string;
  kind: Mode;
  opponentId: string | null;
  matchDayId: string | null;
  seasonId: string | null;
  teamAName: string;
  teamBName: string;
};

// Le roster rendu côté serveur est un premier paint optimiste ; le client lit
// ensuite Dexie pour que la page marche aussi ouverte hors-ligne.
export default function NewMatchForm({
  clubId,
  slug,
  initialPlayers,
  opponents,
  seasonId,
  matchDayId,
  presentPlayerIds,
  scheduled = null,
  nomsParDefaut = { a: "Blanc", b: "Noir" },
}: {
  clubId: string;
  slug: string;
  initialPlayers: LocalPlayer[];
  opponents: { id: string; name: string }[];
  seasonId: string | null;
  matchDayId: string | null;
  presentPlayerIds: string[];
  scheduled?: ScheduledInfo | null;
  /// Les noms d'équipe se DÉDUISENT des chasubles du club : « Blanc » et
  /// « Noir » écrits en dur contredisaient les écussons orange et bleu.
  nomsParDefaut?: { a: string; b: string };
}) {
  const router = useRouter();

  useEffect(() => {
    if (initialPlayers.length > 0) void saveRoster(clubId, initialPlayers);
    if (typeof navigator !== "undefined" && navigator.onLine) {
      fetch(`/api/clubs/${clubId}/roster`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { players?: Omit<LocalPlayer, "clubId">[] } | null) => {
          if (data?.players) void saveRoster(clubId, data.players);
        })
        .catch(() => {});
    }
  }, [clubId, initialPlayers]);

  const players =
    useLiveQuery(
      async () => getDb().roster.where("clubId").equals(clubId).toArray(),
      [clubId],
      initialPlayers
    ) ?? initialPlayers;

  // Lancement d'un match programmé : mode verrouillé, config préremplie.
  const [mode, setMode] = useState<Mode>(scheduled?.kind ?? "INTERNAL");
  const [teamAName, setTeamAName] = useState(
    scheduled && scheduled.kind === "INTERNAL" ? scheduled.teamAName : nomsParDefaut.a
  );
  const [teamBName, setTeamBName] = useState(
    scheduled && scheduled.kind === "INTERNAL" ? scheduled.teamBName : nomsParDefaut.b
  );
  const [opponentId, setOpponentId] = useState<string>(
    scheduled?.opponentId ?? opponents[0]?.id ?? ""
  );
  const [newOpponent, setNewOpponent] = useState("");
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(
    // Session avec RSVP : les présents sont présélectionnés (côté A, à
    // répartir via le générateur).
    Object.fromEntries(presentPlayerIds.map((id) => [id, "A" as Assignment]))
  );
  const [guestName, setGuestName] = useState("");
  // Le générateur est déterministe : à graine égale et effectif égal, il
  // rend les mêmes équipes. Repartir de 1 à chaque ouverture, c'était donc
  // rejouer la composition de la fois d'avant — « on tourne les équipes »
  // n'arrivait jamais. La graine est tirée au montage, côté client seulement
  // (pas pendant le rendu, sinon l'hydratation diverge).
  const [seed, setSeed] = useState(1);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    setSeed(Math.floor(Math.random() * 1_000_000) + 1);
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedPlayers = useMemo(
    () =>
      [...players].sort((a, b) => {
        if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
    [players]
  );

  const selected = useMemo(
    () => sortedPlayers.filter((p) => (assignments[p.id] ?? "none") !== "none"),
    [sortedPlayers, assignments]
  );
  const teamA = useMemo(
    () => selected.filter((p) => assignments[p.id] === "A"),
    [selected, assignments]
  );
  const teamB = useMemo(
    () => selected.filter((p) => assignments[p.id] === "B"),
    [selected, assignments]
  );

  function cycle(playerId: string) {
    setAssignments((prev) => {
      const current = prev[playerId] ?? "none";
      const next: Assignment =
        mode === "EXTERNAL"
          ? current === "none"
            ? "A"
            : "none" // en EXTERNAL, une seule équipe : la nôtre
          : current === "none"
            ? "A"
            : current === "A"
              ? "B"
              : "none";
      return { ...prev, [playerId]: next };
    });
  }

  function generateTeams(nextSeed?: number) {
    const s = nextSeed ?? seed;
    const pool = selected.map((p) => ({
      id: p.id,
      name: p.name,
      skill: p.skill ?? 3,
      isGk: p.isGk ?? false,
    }));
    const { teamA: a, teamB: b } = balanceTeams(pool, { seed: s });
    setAssignments((prev) => {
      const next = { ...prev };
      a.forEach((p) => (next[p.id] = "A"));
      b.forEach((p) => (next[p.id] = "B"));
      return next;
    });
    setSeed(s + 1);
    setDrawn(true);
  }

  async function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    const id = await addLocalGuest(clubId, name);
    setAssignments((a) => ({ ...a, [id]: "A" }));
    setGuestName("");
  }

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

  async function startMatch() {
    const external = mode === "EXTERNAL";
    if (teamA.length === 0) {
      setError("Sélectionne au moins un joueur");
      return;
    }
    if (!external && teamB.length === 0) {
      setError("Chaque équipe doit avoir au moins un joueur");
      return;
    }
    if (external && !opponentId) {
      setError("Choisis l'équipe adverse");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const opponentName =
        opponents.find((o) => o.id === opponentId)?.name ?? "Adversaire";
      const compo = {
        teamAName: external ? "Nous" : teamAName,
        teamBName: external ? opponentName : teamBName,
        teamA: teamA.map((p) => ({ playerId: p.id, isGk: p.isGk ?? false })),
        teamB: external
          ? []
          : teamB.map((p) => ({ playerId: p.id, isGk: p.isGk ?? false })),
      };
      // Match programmé : on seed le store local avec le MÊME id — le serveur
      // bascule SCHEDULED → LIVE via l'op createMatch idempotente.
      const matchId = scheduled
        ? await launchScheduledMatch({
            id: scheduled.id,
            clubId,
            matchDayId: scheduled.matchDayId,
            seasonId: scheduled.seasonId,
            kind: mode,
            opponentId: external ? opponentId : null,
            ...compo,
          })
        : await createMatch({
            clubId,
            matchDayId,
            seasonId,
            kind: mode,
            opponentId: external ? opponentId : null,
            ...compo,
          });
      void kickSync();
      router.replace(`/c/${slug}/matches/${matchId}/live`);
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  const strength = (team: typeof teamA) =>
    team.reduce((s, p) => s + (p.skill ?? 3), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        {scheduled ? (
          // Match programmé : le mode est figé par la convocation.
          <span className="rounded-[2px] border border-[color:var(--bib-b-ink)]/40 bg-[color:var(--pitch-2)] px-3.5 py-2 text-[13px] font-semibold text-[color:var(--bib-b-ink)]">
            Match programmé ·{" "}
            {scheduled.kind === "INTERNAL" ? "Entre nous" : "Vs adversaire"}
          </span>
        ) : (
          <div className="flex gap-1 rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)] p-1">
            {(
              [
                ["INTERNAL", "Entre nous"],
                ["EXTERNAL", "Vs adversaire"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
 "min-h-[44px] rounded-[2px] px-3.5 text-[13px] font-semibold transition-colors",
                  mode === m
                    ? "bg-[color:var(--ink-1)] text-[color:var(--pitch-0)]"
                    : "text-[color:var(--ink-1)] hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <SyncBadge />
      </div>

      {mode === "INTERNAL" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="kicker">Équipe A</span>
            <input
              value={teamAName}
              onChange={(e) => setTeamAName(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--bib-a)]"
            />
          </label>
          <label className="block">
            <span className="kicker">Équipe B</span>
            <input
              value={teamBName}
              onChange={(e) => setTeamBName(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--b-500)]"
            />
          </label>
        </div>
      ) : (
        <div className="rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)] p-4">
          <span className="kicker">Adversaire</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {opponents.map((o) => (
              <button
                key={o.id}
                onClick={() => setOpponentId(o.id)}
                className={cn(
 "inline-flex min-h-[44px] items-center rounded-[2px] border px-4 text-sm font-bold transition-colors",
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
              className="min-h-[44px] flex-1 rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 text-sm outline-none focus:border-[color:var(--b-500)]"
            />
            <button
              onClick={addOpponent}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[2px] border border-[color:var(--rule-hi)] bg-[color:var(--pitch-2)] px-4 text-sm font-bold hover:border-[color:var(--bib-b-ink)]"
            >
              <Icon name="plus" size={14} />
              Ajouter
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="kicker">
            {mode === "INTERNAL"
              ? "Joueurs — tape pour assigner : aucun → A → B"
              : "Qui joue ? — tape pour sélectionner"}
          </h2>
          <span className="text-xs font-bold tabular-nums text-[color:var(--ink-2)]">
            {selected.length} sélectionné·s
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sortedPlayers.map((p) => {
            const a = assignments[p.id] ?? "none";
            return (
              <button
                key={p.id}
                onClick={() => cycle(p.id)}
                className={cn(
 "big-touch rounded-none border px-3 py-3 text-left transition",
                  a === "none" &&
 "border-[color:var(--rule)] bg-[color:var(--pitch-1)]",
                  a === "A" &&
 "border-[color:var(--bib-a)] bg-[color:var(--pitch-2)]",
                  a === "B" &&
 "border-[color:var(--bib-b-ink)] bg-[color:var(--pitch-2)]"
                )}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="truncate">
                    {p.name}
                    {p.isGuest && (
                      <span className="ml-1 text-xs text-[color:var(--ink-2)]">
                        (inv.)
                      </span>
                    )}
                  </span>
                  {p.isGk && (
                    <Icon
                      name="glove"
                      size={14}
                      label="Gardien"
                      className="shrink-0 text-[color:var(--ink-2)]"
                    />
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between text-xs text-[color:var(--ink-1)]">
                  <span>
                    {a === "none"
                      ? "—"
                      : mode === "EXTERNAL"
                        ? "Joue"
                        : a === "A"
                          ? teamAName
                          : teamBName}
                  </span>
                  {/* Le glyphe ★ n'existe pas dans Archivo : il basculerait
                      en police système. On dessine les étoiles. */}
                  <span
                    className="flex items-center gap-0.5 text-[color:var(--ink-3)]"
                    role="img"
                    aria-label={`Niveau ${p.skill ?? 3} sur 5`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Icon
                        key={n}
                        name="star"
                        size={9}
                        filled={n <= (p.skill ?? 3)}
                        className={n <= (p.skill ?? 3) ? "" : "opacity-35"}
                      />
                    ))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {mode === "INTERNAL" && selected.length >= 2 && (
        <div className="rounded-none border border-[color:var(--ink-1)]/30 bg-[color:var(--ink-2)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black">
                Générateur d&apos;équipes équilibrées
              </div>
              <div className="mt-0.5 text-xs text-[color:var(--ink-1)]">
                Répartit les {selected.length} sélectionnés selon leur niveau
                (et sépare les gardiens).
              </div>
            </div>
            <button
              onClick={() => generateTeams()}
              className="inline-flex min-h-[44px] items-center rounded-[2px] bg-[color:var(--ink-1)] px-5 text-sm font-black text-[color:var(--pitch-0)] transition-transform hover:scale-[1.03]"
            >
              {drawn ? "Re-tirer" : "Équilibrer"}
            </button>
          </div>
          {teamA.length > 0 && teamB.length > 0 && (
            <div className="mt-3 flex items-center gap-3 text-xs tabular-nums text-[color:var(--ink-1)]">
              <span className="text-[color:var(--bib-a-ink)]">
                {teamAName} {strength(teamA)}
              </span>
              <span className="text-[color:var(--ink-2)]">vs</span>
              <span className="text-[color:var(--bib-b-ink)]">
                {teamBName} {strength(teamB)}
              </span>
              <span className="text-[color:var(--ink-2)]">
                · écart {Math.abs(strength(teamA) - strength(teamB))}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)] p-4">
        <h3 className="kicker mb-2">Ajouter un invité</h3>
        <div className="flex gap-2">
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGuest()}
            placeholder="Nom de l'invité"
            className="min-h-[44px] flex-1 rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 outline-none focus:border-[color:var(--ink-1)]"
          />
          <button
            onClick={addGuest}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[2px] border border-[color:var(--rule-hi)] bg-[color:var(--pitch-2)] px-4 font-bold hover:border-[color:var(--ink-1)]"
          >
            <Icon name="plus" size={14} />
            Invité
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm tabular-nums text-[color:var(--ink-1)]">
        <span>
          {mode === "INTERNAL"
            ? `${teamAName} : ${teamA.length} · ${teamBName} : ${teamB.length}`
            : `${teamA.length} joueur·s`}
        </span>
      </div>

      {error && <p className="text-sm text-[color:var(--loss)]">{error}</p>}

      <button
        onClick={startMatch}
        disabled={loading}
        className="w-full rounded-none bg-[color:var(--ink-1)] py-5 text-xl font-black text-[color:var(--pitch-0)] disabled:opacity-50"
      >
        {loading ? "Création…" : "Lancer le match"}
      </button>
    </div>
  );
}
