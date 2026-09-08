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
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import LigneScore from "@/components/ios/LigneScore";

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

function valeurLocale(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function veille(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(20, 0, 0, 0);
  return d;
}

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
  dateSoiree = null,
  saisieApresCoup = false,
  compoPreparee = [],
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
  /// Date de la soirée visée (ISO) quand on vient saisir après coup.
  dateSoiree?: string | null;
  /// Ouvrir d'emblée en « déjà joué » — le lien « Saisir les résultats ».
  saisieApresCoup?: boolean;
  /// La compo préparée pour la soirée. Le club décide ses équipes trois à
  /// quatre jours avant de jouer : quand elle existe, elle est la bonne
  /// réponse — bien plus que « tous les présents dans l'équipe A ».
  compoPreparee?: { playerId: string; team: "A" | "B" }[];
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
    // La compo préparée pour la soirée d'abord ; à défaut, les présents,
    // présélectionnés côté A et à répartir via le générateur.
    compoPreparee.length > 0
      ? Object.fromEntries(
          compoPreparee.map((l) => [l.playerId, l.team as Assignment])
        )
      : Object.fromEntries(presentPlayerIds.map((id) => [id, "A" as Assignment]))
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

  // Saisie après coup. La date se calcule au montage, côté client : comme
  // partout ailleurs dans l'app, c'est le fuseau de celui qui joue qui fait
  // foi — pas celui du serveur, qui est en UTC.
  const [retro, setRetro] = useState(saisieApresCoup);
  const [quand, setQuand] = useState("");
  useEffect(() => {
    const d = dateSoiree ? new Date(dateSoiree) : veille();
    if (Number.isNaN(d.getTime())) return;
    // Une soirée est stockée à la date du jour, souvent à minuit : l'heure de
    // coup d'envoi du club est plus juste que 00:00 pour trier les matchs.
    if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(20, 0, 0, 0);
    setQuand(valeurLocale(d));
  }, [dateSoiree]);

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
    // Match déjà joué : la date choisie fait la feuille rétro. Une date
    // illisible vaut mieux refusée que silencieusement remplacée par « il y a
    // une minute » — la soirée finirait rangée au mauvais jour.
    let quandISO: string | undefined;
    if (retro && !scheduled) {
      const d = new Date(quand);
      if (!quand || Number.isNaN(d.getTime())) {
        setError("Choisis la date du match.");
        return;
      }
      if (d.getTime() > Date.now()) {
        setError("Cette date est dans le futur — programme le match plutôt.");
        return;
      }
      quandISO = d.toISOString();
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
            playedAt: quandISO,
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {scheduled ? (
          // Match programmé : le mode est figé par la convocation.
          <span className="verre" style={{ color: "var(--i2)" }}>
            Match programmé · {scheduled.kind === "INTERNAL" ? "Entre nous" : "Vs adversaire"}
          </span>
        ) : (
          <div className="segment" role="radiogroup" aria-label="Type de match">
            {(
              [
                ["INTERNAL", "Entre nous"],
                ["EXTERNAL", "Vs adversaire"],
              ] as const
            ).map(([m, label]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn(mode === m && "actif")}>
                {label}
              </button>
            ))}
          </div>
        )}
        <SyncBadge compact />
      </div>

      {/* Quand ? — un match se saisit aussi le lendemain. Sans cette porte,
          une soirée jouée sans téléphone n'entrait jamais dans les stats. */}
      {!scheduled && (
        <div className="carte" style={{ padding: "16px 18px" }}>
          <div className="text-[17px] font-semibold">Quand ?</div>
          <div className="mt-0.5 text-[13px]" style={{ color: "var(--i2)" }}>
            {retro
              ? "Feuille sans chrono : tu tapes les buts, tu enregistres."
              : "La feuille s'ouvre en direct, chrono lancé."}
          </div>
          <div className="segment plein-large mt-3" role="radiogroup" aria-label="Quand le match a été joué">
            {(
              [
                [false, "Maintenant"],
                [true, "Déjà joué"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={retro === v}
                onClick={() => setRetro(v)}
                className={cn(retro === v && "actif")}
              >
                {label}
              </button>
            ))}
          </div>
          {retro && (
            <input
              type="datetime-local"
              value={quand}
              max={valeurLocale(new Date())}
              onChange={(e) => setQuand(e.target.value)}
              aria-label="Date et heure du match"
              className="mt-2.5 w-full"
            />
          )}
        </div>
      )}

      {mode === "INTERNAL" ? (
        <div className="carte" style={{ padding: "6px 0 14px" }}>
          <LigneScore nomA={teamAName || "A"} nomB={teamBName || "B"} scoreA={teamA.length} scoreB={teamB.length} etat="Effectif" heure="joueurs par équipe" />
          <div className="grid grid-cols-2 gap-2.5" style={{ padding: "0 14px" }}>
            <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} aria-label="Nom de la première équipe" className="w-full" />
            <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} aria-label="Nom de la seconde équipe" className="w-full" />
          </div>
        </div>
      ) : (
        <div className="carte" style={{ padding: "16px 18px 18px" }}>
          <span className="kicker">Adversaire</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {opponents.map((o) => (
              <button
                key={o.id}
                onClick={() => setOpponentId(o.id)}
                className={cn(opponentId === o.id ? "plein" : "verre")}
                style={{ height: 44 }}
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
              className="min-w-0 flex-1"
            />
            <button onClick={addOpponent} className="verre grand">
              <Icon name="plus" size={14} />
              Ajouter
            </button>
          </div>
        </div>
      )}

      <div className="carte" style={{ padding: "0 18px 6px" }}>
        <div className="flex items-baseline justify-between" style={{ padding: "16px 0 6px" }}>
          <h2 className="kicker" style={{ color: "var(--ink)" }}>
            {mode === "INTERNAL" ? "Qui joue ? — tape : aucun → A → B" : "Qui joue ? — tape pour sélectionner"}
          </h2>
          <span className="text-[15px] tabular-nums" style={{ color: "var(--i2)" }}>
            {selected.length}
          </span>
        </div>
        {sortedPlayers.map((p) => {
          const a = assignments[p.id] ?? "none";
          const camp = a === "A" ? "A" : a === "B" ? "B" : null;
          return (
            <button key={p.id} type="button" onClick={() => cycle(p.id)} className="rangee-ios" aria-pressed={a !== "none"} style={{ minHeight: 56, cursor: "pointer" }}>
              <AvatarAnneau nom={p.name} photo={p.photo} camp={camp} />
              <span className="libelle">
                <span style={{ fontWeight: a === "none" ? 400 : 600, color: a === "none" ? "var(--i2)" : "var(--ink)" }}>
                  {p.name}
                  {p.isGuest && <span style={{ color: "var(--i3)" }}> (inv.)</span>}
                  {p.isGk && <span style={{ color: "var(--i3)" }}> · gardien</span>}
                </span>
                <span className="aide">Niveau {p.skill ?? 3}</span>
              </span>
              <span className="valeur" style={{ fontWeight: 600, color: a === "none" ? "var(--i3)" : "var(--ink)" }}>
                {a === "none" ? "—" : mode === "EXTERNAL" ? "Joue" : a === "A" ? teamAName : teamBName}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "INTERNAL" && selected.length >= 2 && (
        <div className="carte" style={{ padding: "16px 18px" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[17px] font-semibold">Équipes équilibrées</div>
              <div className="text-[13px]" style={{ color: "var(--i2)" }}>
                Répartit les {selected.length} sélectionnés selon leur niveau, gardiens séparés.
              </div>
            </div>
            <button onClick={() => generateTeams()} className="verre grand">
              {drawn ? "Retirer au sort" : "Équilibrer"}
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

      <div className="carte" style={{ padding: "16px 18px 18px" }}>
        <h3 className="kicker mb-2">Ajouter un invité</h3>
        <div className="flex gap-2">
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGuest()}
            placeholder="Nom de l'invité"
            className="min-w-0 flex-1"
          />
          <button onClick={addGuest} className="verre grand">
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
        className="plein w-full"
        style={{ height: 56, fontSize: 19 }}
      >
        {loading ? "Création…" : retro ? "Ouvrir la feuille" : "Coup d'envoi"}
      </button>
    </div>
  );
}
