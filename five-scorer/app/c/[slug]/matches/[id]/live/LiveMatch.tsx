"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import PlayerTile from "@/components/PlayerTile";
import MvpPicker from "@/components/MvpPicker";
import SyncBadge from "@/components/SyncBadge";
import { cn } from "@/lib/cn";
import Icon from "@/components/Icon";
import {
  addEvent,
  finishMatch,
  getLocalMatch,
  removeEvent,
  setEventAssist,
  undoLastGoalOf,
  type LivePlayer,
} from "@/lib/localMatch";
import { kickSync } from "@/lib/sync";
import { getDb } from "@/lib/db";
import {
  fmt,
  minuteOf,
  nowElapsed,
  pause as pauseClock,
  start as startClock,
  type ClockState,
} from "@/lib/clock";
import {
  isSoundEnabled,
  toggleSound,
  playGoalSound,
  playFullTimeSound,
} from "@/lib/audio";

type Settings = {
  trackAssists: boolean;
  trackCards: boolean;
  motmMode: "VOTE" | "ADMIN" | "OFF";
  matchDurationMin: number;
};

type SheetMode =
  | { kind: "csc"; team: "A" | "B" } // qui a marqué contre son camp ?
  | { kind: "card"; team: "A" | "B"; card: "YELLOW_CARD" | "RED_CARD" };

export default function LiveMatch({
  slug,
  matchId,
  settings,
}: {
  slug: string;
  matchId: string;
  settings: Settings;
}) {
  const router = useRouter();
  const data = useLiveQuery(() => getLocalMatch(matchId), [matchId]);

  const [mvpOpen, setMvpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  // Nicety : après "MT", le bouton reprise annonce la 2de mi-temps.
  const [halftimeJustSet, setHalftimeJustSet] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [assistFor, setAssistFor] = useState<{
    eventId: string;
    team: "A" | "B";
    scorerId: string;
  } | null>(null);
  const assistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);
  useEffect(
    () => () => {
      if (assistTimer.current) clearTimeout(assistTimer.current);
    },
    []
  );

  // --- Chrono persistant ---------------------------------------------------
  // Source de vérité : les champs clock* de la ligne Dexie du match (arrivent
  // via useLiveQuery). Survit aux reloads et se partage entre onglets.
  const clockState: ClockState = {
    elapsedMs: data?.match?.clockElapsedMs ?? 0,
    runningSince: data?.match?.clockRunningSince ?? null,
  };
  const clockRef = useRef(clockState);
  clockRef.current = clockState;
  const paused = clockState.runningSince == null;

  // Minute de jeu courante, lue via ref pour ne pas invalider les callbacks.
  const liveMinute = useCallback(() => minuteOf(nowElapsed(clockRef.current)), []);

  // Premier open d'un match live sans état de chrono → on l'initialise. Les
  // matchs lancés avant cette fonctionnalité repartent de playedAt (≈ 0 pour
  // un match qui vient d'être créé) plutôt que de retomber à 00:00.
  const clockInitRef = useRef(false);
  useEffect(() => {
    const m = data?.match;
    if (!m || m.status !== "LIVE" || clockInitRef.current) return;
    clockInitRef.current = true;
    if (m.clockRunningSince == null && m.clockElapsedMs == null) {
      void getDb().matches.update(matchId, {
        clockElapsedMs: Math.max(0, Date.now() - Date.parse(m.playedAt)),
        clockRunningSince: new Date().toISOString(),
        period: 1,
      });
    }
  }, [data, matchId]);

  // Re-render régulier pour faire avancer l'affichage (l'état, lui, ne bouge
  // pas : le temps courant se dérive de runningSince).
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = nowElapsed(clockState);
  const limitMs = settings.matchDurationMin * 60_000;
  const overtime = elapsedMs >= limitMs;

  // Bip (une seule fois) au franchissement du temps réglementaire — pas de
  // bip si on rouvre un match déjà au-delà de la limite.
  const wasOverRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (data == null) return;
    if (wasOverRef.current === null) {
      wasOverRef.current = overtime;
      return;
    }
    if (overtime && !wasOverRef.current) playFullTimeSound();
    wasOverRef.current = overtime;
  }, [data, overtime]);

  const toggleClock = useCallback(async () => {
    const c = clockRef.current;
    const next = c.runningSince ? pauseClock(c) : startClock(c);
    if (!c.runningSince) setHalftimeJustSet(false); // reprise
    await getDb().matches.update(matchId, {
      clockElapsedMs: next.elapsedMs,
      clockRunningSince: next.runningSince,
    });
  }, [matchId]);

  const onHalftime = useCallback(async () => {
    try {
      const c = clockRef.current;
      const minute = minuteOf(nowElapsed(c));
      const next = pauseClock(c);
      await getDb().matches.update(matchId, {
        clockElapsedMs: next.elapsedMs,
        clockRunningSince: null,
        period: 2,
      });
      setHalftimeJustSet(true);
      await addEvent(matchId, { type: "HALF_TIME", team: "A", minute });
      void kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, [matchId]);

  // Match déjà terminé (ex. fini sur un autre appareil) → récap. La
  // navigation doit sortir du rendu, sinon React râle à juste titre.
  const finished = data?.match?.status === "FINISHED";
  useEffect(() => {
    if (finished) {
      router.replace(`/c/${slug}/matches/${matchId}`);
    }
  }, [finished, router, slug, matchId]);

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

  const openAssistPrompt = useCallback(
    (eventId: string, team: "A" | "B", scorerId: string) => {
      if (!settings.trackAssists) return;
      if (assistTimer.current) clearTimeout(assistTimer.current);
      setAssistFor({ eventId, team, scorerId });
      // Assez long pour célébrer le but avant de saisir la passe.
      assistTimer.current = setTimeout(() => setAssistFor(null), 15000);
    },
    [settings.trackAssists]
  );

  const addGoal = useCallback(
    async (playerId: string, team: "A" | "B") => {
      try {
        const eventId = await addEvent(matchId, {
          type: "GOAL",
          team,
          playerId,
          minute: liveMinute(),
        });
        openAssistPrompt(eventId, team, playerId);
        void kickSync();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    },
    [matchId, openAssistPrompt, liveMinute]
  );

  const removeGoal = useCallback(
    async (playerId: string) => {
      try {
        const removedId = await undoLastGoalOf(matchId, playerId);
        if (!removedId) setError("Aucun but à annuler pour ce joueur");
        else {
          setAssistFor((a) => (a?.eventId === removedId ? null : a));
          void kickSync();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    },
    [matchId]
  );

  const addOpponentGoal = useCallback(async () => {
    try {
      playGoalSound();
      await addEvent(matchId, {
        type: "GOAL",
        team: "B",
        playerId: null,
        minute: liveMinute(),
      });
      void kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }, [matchId, liveMinute]);

  const undoOpponentGoal = useCallback(async () => {
    if (!data) return;
    const last = [...data.events]
      .reverse()
      .find((e) => e.team === "B" && e.type === "GOAL" && !e.playerId);
    if (!last) {
      setError("Aucun but adverse à annuler");
      return;
    }
    await removeEvent(matchId, last.id);
    void kickSync();
  }, [data, matchId]);

  async function onSheetPick(playerId: string | null) {
    if (!sheet) return;
    try {
      if (sheet.kind === "csc") {
        // CSC d'un joueur de `sheet.team` → but crédité à l'équipe adverse.
        const credited = sheet.team === "A" ? "B" : "A";
        await addEvent(matchId, {
          type: "OWN_GOAL",
          team: credited,
          playerId,
          minute: liveMinute(),
        });
      } else {
        if (!playerId) return;
        await addEvent(matchId, {
          type: sheet.card,
          team: sheet.team,
          playerId,
          minute: liveMinute(),
        });
      }
      void kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSheet(null);
    }
  }

  async function pickAssist(assistPlayerId: string | null) {
    if (!assistFor) return;
    if (assistTimer.current) clearTimeout(assistTimer.current);
    if (assistPlayerId) {
      await setEventAssist(matchId, assistFor.eventId, assistPlayerId);
      void kickSync();
    }
    setAssistFor(null);
  }

  async function onFinish(mvpId: string | null) {
    setFinishing(true);
    try {
      await finishMatch(matchId, mvpId);
      void kickSync();
      router.replace(`/c/${slug}/matches/${matchId}`);
    } catch (e) {
      setFinishing(false);
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  function requestFinish() {
    setConfirmOpen(false);
    if (settings.motmMode === "ADMIN") setMvpOpen(true);
    else void onFinish(null);
  }

  if (data === undefined) {
    return (
      <main className="fixed inset-0 z-[60] grid place-items-center bg-[color:var(--bg-0)] text-gray-400">
        Chargement…
      </main>
    );
  }
  if (data === null) {
    return (
      <main className="fixed inset-0 z-[60] grid place-items-center bg-[color:var(--bg-0)]">
        <div className="mx-auto max-w-md p-6 text-center">
          <h1 className="mb-2 text-xl font-bold">Match introuvable</h1>
          <p className="mb-6 text-sm text-gray-400">
            Ce match n&apos;existe pas dans la mémoire locale de cet appareil.
          </p>
          <button
            onClick={() => router.replace(`/c/${slug}`)}
            className="rounded-lg bg-white/10 px-4 py-2"
          >
            Retour
          </button>
        </div>
      </main>
    );
  }

  const { match, teamA, teamB, events } = data;
  if (match.status === "FINISHED") return null; // redirection via l'effet

  const external = match.kind === "EXTERNAL";
  const period = match.period ?? 1;
  const aLead = match.scoreA > match.scoreB;
  const bLead = match.scoreB > match.scoreA;
  const sheetPlayers: LivePlayer[] = sheet
    ? sheet.team === "A"
      ? teamA
      : teamB
    : [];
  const assistCandidates: LivePlayer[] = assistFor
    ? (assistFor.team === "A" ? teamA : teamB).filter(
        (p) => p.id !== assistFor.scorerId
      )
    : [];

  // Chaque type d'événement a sa marque dessinée — plus d'emoji, dont le
  // rendu change d'un téléphone à l'autre et qui ignore la couleur du texte.
  const eventIcon = (t: string) => {
    if (t === "GOAL") return <Icon name="ball" size={15} />;
    if (t === "OWN_GOAL")
      return <Icon name="ball" size={15} className="opacity-50" />;
    if (t === "YELLOW_CARD")
      return (
        <Icon
          name="card"
          size={15}
          filled
          label="Carton jaune"
          className="text-[color:var(--gold)]"
        />
      );
    if (t === "HALF_TIME") return <Icon name="whistle" size={15} />;
    return (
      <Icon
        name="card"
        size={15}
        filled
        label="Carton rouge"
        className="text-[color:var(--loss)]"
      />
    );
  };

  return (
    <main className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[color:var(--bg-0)]">
      {/* Topbar */}
      <header className="live-topbar">
        <div className="live-topbar-left">
          <span
            className="live-dot"
            style={paused ? { animation: "none", opacity: 0.3 } : undefined}
          />
          <span>{paused ? "PAUSE" : "LIVE"}</span>
          <span className="rounded border border-[color:var(--stroke)] px-1 text-[9px] font-black uppercase tracking-wider text-[color:var(--ink-1)]">
            {period === 2 ? "2de" : "1re"}
          </span>
          <span
            className="match-clock"
            style={overtime ? { color: "var(--live)" } : undefined}
          >
            {fmt(Math.min(elapsedMs, limitMs))}
          </span>
          {overtime && (
            <span
              className="font-mono text-[10px] font-black"
              style={{ color: "var(--live)" }}
            >
              +{fmt(elapsedMs - limitMs)}
            </span>
          )}
          {/* La durée réglementaire n'est plus affichée en permanence : le
              chrono passe au rouge et affiche le temps additionnel une fois
              la limite franchie, ce qui suffit — et la barre tient sur une
              ligne à 375 px, bouton « Fin » compris. */}
          <button
            onClick={toggleClock}
            className={cn("icon-btn", paused && halftimeJustSet && "w-auto px-2")}
            title={
              paused
                ? halftimeJustSet
                  ? "2de mi-temps"
                  : "Reprendre"
                : "Pause"
            }
          >
            {paused ? (
              halftimeJustSet ? (
                <span className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wider">
                  <Icon name="play" size={12} /> 2de mi-temps
                </span>
              ) : (
                <Icon name="play" size={16} />
              )
            ) : (
              <Icon name="pause" size={16} />
            )}
          </button>
          {period !== 2 && (
            <button
              onClick={onHalftime}
              className="icon-btn w-auto px-1.5 text-[11px] font-black"
              title="Mi-temps"
            >
              MT
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimelineOpen((o) => !o)}
            className="icon-btn"
            title="Événements"
            aria-label="Événements du match"
          >
            <Icon name="list" size={18} />
          </button>
          <button
            onClick={() => setSoundOn(toggleSound())}
            className="icon-btn"
            title="Son"
            aria-label={soundOn ? "Couper le son" : "Activer le son"}
          >
            <Icon name={soundOn ? "sound" : "mute"} size={18} />
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
          className="bg-[color:var(--bg-2)] px-4 py-2 text-sm text-[color:var(--loss)]"
          onClick={() => setError(null)}
        >
          {error}
        </div>
      )}

      <div className="live-container flex-1 overflow-y-auto pb-28">
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
              onGoal={() => addGoal(p.id, "A")}
              onUndo={() => removeGoal(p.id)}
            />
          ))}
          <TeamToolbar
            team="A"
            trackCards={settings.trackCards}
            onCsc={() => setSheet({ kind: "csc", team: "A" })}
            onCard={(card) => setSheet({ kind: "card", team: "A", card })}
          />
        </section>
        <section>
          <div className="team-label hidden px-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--b-400)]">
            {match.teamBName}
          </div>
          {external ? (
            <div className="flex flex-col gap-2 p-2">
              <button
                onClick={addOpponentGoal}
                className="big-touch rounded-2xl border border-[color:var(--b-400)]/50 bg-[color:var(--b-wash)] py-8 text-center"
              >
                <div className="text-3xl font-black text-[color:var(--b-400)]">
                  +1
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[color:var(--ink-1)]">
                  But {match.teamBName}
                </div>
              </button>
              <button
                onClick={undoOpponentGoal}
                className="rounded-xl border border-[color:var(--stroke)] py-2.5 text-xs font-bold uppercase tracking-wider text-[color:var(--ink-2)] hover:text-white"
              >
                - Annuler le dernier
              </button>
            </div>
          ) : (
            <>
              {teamB.map((p) => (
                <PlayerTile
                  key={p.id}
                  name={p.name}
                  goals={p.goals}
                  tint="blue"
                  onGoal={() => addGoal(p.id, "B")}
                  onUndo={() => removeGoal(p.id)}
                />
              ))}
              <TeamToolbar
                team="B"
                trackCards={settings.trackCards}
                onCsc={() => setSheet({ kind: "csc", team: "B" })}
                onCard={(card) => setSheet({ kind: "card", team: "B", card })}
              />
            </>
          )}
        </section>
      </div>

      {/* Prompt passe décisive — non bloquant, disparaît tout seul */}
      {assistFor && (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] p-3">
          <div className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-xs font-black uppercase tracking-wider text-[color:var(--ink-1)]">
              Passe ?
            </span>
            {assistCandidates.map((p) => (
              <button
                key={p.id}
                onClick={() => pickAssist(p.id)}
                className="shrink-0 rounded-full border border-[color:var(--stroke-hi)] bg-[color:var(--bg-2)] px-4 py-2 text-sm font-bold hover:border-[color:var(--lime)]"
              >
                {p.name}
              </button>
            ))}
            <button
              onClick={() => pickAssist(null)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold uppercase text-[color:var(--ink-2)]"
            >
              Sans passe <Icon name="close" size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Timeline des événements */}
      {timelineOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/70"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTimelineOpen(false);
          }}
        >
          <div className="max-h-[70vh] w-full overflow-y-auto rounded-t-3xl border-t border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="kicker">Événements</span>
              <button
                onClick={() => setTimelineOpen(false)}
                className="icon-btn"
                aria-label="Fermer"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-[color:var(--ink-2)]">
                Rien pour l&apos;instant. Ça va venir.
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--stroke)]">
                {[...events].reverse().map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-10 font-mono text-xs text-[color:var(--ink-2)]">
                      {e.minute != null ? `${e.minute}'` : "—"}
                    </span>
                    <span>{eventIcon(e.type)}</span>
                    {e.type === "HALF_TIME" ? (
                      <span className="flex-1 text-xs font-bold uppercase tracking-wider text-[color:var(--ink-2)]">
                        — Mi-temps —
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "flex-1 text-sm font-bold",
                          e.team === "A"
                            ? "text-[color:var(--a-400)]"
                            : "text-[color:var(--b-400)]"
                        )}
                      >
                        {e.playerName ??
                          (e.team === "B" ? match.teamBName : match.teamAName)}
                        {e.type === "OWN_GOAL" && " (csc)"}
                        {e.assistName && (
                          <span className="ml-1 font-normal text-[color:var(--ink-2)]">
                            (passe : {e.assistName})
                          </span>
                        )}
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        await removeEvent(matchId, e.id);
                        if (e.type === "HALF_TIME") {
                          // Mi-temps annulée → on ré-ouvre la 1re période
                          // pour que le bouton MT redevienne disponible.
                          await getDb().matches.update(matchId, { period: 1 });
                          setHalftimeJustSet(false);
                        }
                        void kickSync();
                      }}
                      className="rounded-lg border border-[color:var(--stroke)] px-2.5 py-1 text-xs font-bold text-[color:var(--loss)] hover:border-[color:var(--loss)]"
                    >
                      Annuler
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Picker CSC / carton */}
      {sheet && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/70"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheet(null);
          }}
        >
          <div className="w-full rounded-t-3xl border-t border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
              {sheet.kind === "csc" ? (
                "Qui a marqué contre son camp ?"
              ) : (
                <>
                  <Icon
                    name="card"
                    size={16}
                    filled
                    className={
                      sheet.card === "YELLOW_CARD"
                        ? "text-[color:var(--gold)]"
                        : "text-[color:var(--loss)]"
                    }
                  />
                  {sheet.card === "YELLOW_CARD"
                    ? "Carton jaune pour…"
                    : "Carton rouge pour…"}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sheetPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSheetPick(p.id)}
                  className="big-touch rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-3 text-left font-bold hover:border-[color:var(--stroke-hi)]"
                >
                  {p.name}
                </button>
              ))}
              {sheet.kind === "csc" && (
                <button
                  onClick={() => onSheetPick(null)}
                  className="big-touch rounded-xl border border-dashed border-[color:var(--stroke)] px-3 py-3 text-left text-sm text-[color:var(--ink-2)]"
                >
                  Sans préciser
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80"
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
                onClick={requestFinish}
                className="flex-1 rounded-lg bg-[color:var(--loss)] px-4 py-3 font-bold text-[color:var(--bg-0)]"
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

function TeamToolbar({
  team,
  trackCards,
  onCsc,
  onCard,
}: {
  team: "A" | "B";
  trackCards: boolean;
  onCsc: () => void;
  onCard: (card: "YELLOW_CARD" | "RED_CARD") => void;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 p-2",
        team === "B" && "flex-row-reverse"
      )}
    >
      <button
        onClick={onCsc}
        className="rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink-3)]"
        title="Contre son camp"
      >
        CSC
      </button>
      {trackCards && (
        <>
          <button
            onClick={() => onCard("YELLOW_CARD")}
            className="rounded-md px-3 py-2 text-[color:var(--gold)]"
            aria-label="Carton jaune"
          >
            <Icon name="card" size={15} filled />
          </button>
          <button
            onClick={() => onCard("RED_CARD")}
            className="rounded-md px-3 py-2 text-[color:var(--loss)]"
            aria-label="Carton rouge"
          >
            <Icon name="card" size={15} filled />
          </button>
        </>
      )}
    </div>
  );
}
