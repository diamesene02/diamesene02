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
  movePlayerTeam,
  removeEvent,
  setEventAssist,
  setEventScorer,
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

type SheetMode = {
  kind: "card";
  team: "A" | "B";
  card: "YELLOW_CARD" | "RED_CARD";
};

/// Les deux questions qu'on peut poser APRÈS un but, sans jamais retenir le
/// score. Un seul état pour les deux : elles s'affichent au même endroit, en
/// bas de l'écran. Deux états séparés laissaient la seconde barre recouvrir la
/// première — même position, même z-index, fond opaque — et la question cachée
/// expirait sous l'autre sans que personne la voie.
type Invite =
  | { kind: "passe"; eventId: string; team: "A" | "B"; scorerId: string }
  | { kind: "csc"; eventId: string; conceding: "A" | "B" };

const DUREE_INVITE_MS = 15000;

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
  const [invite, setInvite] = useState<Invite | null>(null);
  const inviteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mode correction de composition : les tuiles cessent de compter des buts et
  // ne servent plus qu'à faire changer un joueur de camp. Voir PlayerTile.
  const [compoMode, setCompoMode] = useState(false);
  // Tuile qui vient de changer de camp : un éclair de contour pour que l'œil
  // suive le déplacement d'une colonne à l'autre.
  const [justMoved, setJustMoved] = useState<string | null>(null);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);
  useEffect(
    () => () => {
      if (inviteTimer.current) clearTimeout(inviteTimer.current);
      if (moveTimer.current) clearTimeout(moveTimer.current);
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

  /// Le seul chemin qui pose une invite. Poser la nouvelle efface forcément
  /// l'ancienne : une seule barre peut exister à la fois.
  const ouvrirInvite = useCallback((i: Invite) => {
    if (inviteTimer.current) clearTimeout(inviteTimer.current);
    setInvite(i);
    // Assez long pour célébrer le but avant de répondre.
    inviteTimer.current = setTimeout(() => setInvite(null), DUREE_INVITE_MS);
  }, []);

  const fermerInvite = useCallback(() => {
    if (inviteTimer.current) clearTimeout(inviteTimer.current);
    setInvite(null);
  }, []);

  const addGoal = useCallback(
    async (playerId: string, team: "A" | "B") => {
      try {
        const eventId = await addEvent(matchId, {
          type: "GOAL",
          team,
          playerId,
          minute: liveMinute(),
        });
        if (settings.trackAssists) {
          ouvrirInvite({ kind: "passe", eventId, team, scorerId: playerId });
        } else {
          fermerInvite();
        }
        void kickSync();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    },
    [matchId, ouvrirInvite, fermerInvite, settings.trackAssists, liveMinute]
  );

  const removeGoal = useCallback(
    async (playerId: string) => {
      try {
        const removedId = await undoLastGoalOf(matchId, playerId);
        if (!removedId) setError("Aucun but à annuler pour ce joueur");
        else {
          setInvite((i) => (i?.eventId === removedId ? null : i));
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
    // Le rang « Contre son camp » fait monter le compteur de B exactement
    // comme le gros « +1 But ». Ne chercher que les GOAL, c'était laisser le
    // bouton d'annulation le plus proche du geste incapable de le défaire :
    // il supprimait un vrai but adverse plus ancien, et le score retombait à
    // la bonne valeur — donc rien ne signalait l'erreur.
    // Le filtre portait aussi sur `!e.playerId`. Or un csc n'a un buteur nul
    // que TANT QUE personne n'a répondu à « Qui l'a mis ? » : dès qu'un nom
    // est donné, le csc redevenait invisible pour l'annulation, qui supprimait
    // alors un vrai but adverse plus ancien. La bonne condition est « le
    // dernier événement qui a fait monter le compteur de B » — sur un match
    // contre un adversaire extérieur, aucun de ses buts ne porte de buteur.
    const last = [...data.events]
      .reverse()
      .find(
        (e) => e.team === "B" && (e.type === "GOAL" || e.type === "OWN_GOAL")
      );
    if (!last) {
      setError("Aucun but adverse à annuler");
      return;
    }
    await removeEvent(matchId, last.id);
    setInvite((i) => (i?.eventId === last.id ? null : i));
    void kickSync();
  }, [data, matchId]);

  /// Contre son camp : le score d'abord, le nom ensuite.
  ///
  /// Sur le terrain, personne ne revendique un csc — l'aveu met dix secondes
  /// à venir et le nom fait débat. Faire du buteur un préalable, c'était
  /// bloquer le tableau d'affichage sur une discussion. Un tap suffit
  /// désormais : le but est crédité au bon camp immédiatement, l'auteur se
  /// désigne après, sans rien retenir.
  const addOwnGoal = useCallback(
    async (conceding: "A" | "B") => {
      try {
        playGoalSound();
        const credited = conceding === "A" ? "B" : "A";
        const eventId = await addEvent(matchId, {
          type: "OWN_GOAL",
          team: credited,
          playerId: null,
          minute: liveMinute(),
        });
        ouvrirInvite({ kind: "csc", eventId, conceding });
        void kickSync();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    },
    [matchId, ouvrirInvite, liveMinute]
  );

  /// Réponse à l'invite du bas d'écran — passe décisive ou auteur d'un csc.
  async function repondreInvite(playerId: string | null) {
    if (!invite) return;
    const courante = invite;
    fermerInvite();
    if (!playerId) return;
    try {
      // L'événement peut avoir été annulé depuis la chronologie pendant que la
      // barre était ouverte. Refermer la barre comme si le nom avait été pris
      // renvoyait l'utilisateur convaincu d'avoir renseigné l'auteur.
      const ecrit =
        courante.kind === "passe"
          ? await setEventAssist(matchId, courante.eventId, playerId)
          : await setEventScorer(matchId, courante.eventId, playerId);
      if (!ecrit) {
        setError("Ce but n'existe plus — rien n'a été enregistré");
        return;
      }
      void kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  /// Fait passer un joueur dans l'autre camp. Appelé uniquement depuis le mode
  /// correction de compo : hors de ce mode, aucune tuile n'expose ce geste.
  async function deplacerJoueur(playerId: string, depuis: "A" | "B") {
    try {
      await movePlayerTeam(matchId, playerId, depuis === "A" ? "B" : "A");
      if (navigator.vibrate) navigator.vibrate(18);
      if (moveTimer.current) clearTimeout(moveTimer.current);
      setJustMoved(playerId);
      moveTimer.current = setTimeout(
        () => setJustMoved((id) => (id === playerId ? null : id)),
        400
      );
      void kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function onSheetPick(playerId: string | null) {
    if (sheet?.kind !== "card") return;
    try {
      if (!playerId) return;
      await addEvent(matchId, {
        type: sheet.card,
        team: sheet.team,
        playerId,
        minute: liveMinute(),
      });
      void kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSheet(null);
    }
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
  const sheetPlayers: LivePlayer[] =
    sheet?.kind === "card" ? (sheet.team === "A" ? teamA : teamB) : [];
  // L'auteur d'un csc est forcément dans l'équipe qui a encaissé contre elle.
  // Une passe vient d'un coéquipier du buteur ; l'auteur d'un csc est dans
  // l'équipe qui l'a concédé.
  const inviteCandidats: LivePlayer[] = !invite
    ? []
    : invite.kind === "passe"
      ? (invite.team === "A" ? teamA : teamB).filter(
          (p) => p.id !== invite.scorerId
        )
      : invite.conceding === "A"
        ? teamA
        : teamB;
  const inviteTitre =
    invite?.kind === "passe" ? "Passe ?" : "Qui l'a mis ?";
  const inviteRefus = invite?.kind === "passe" ? "Sans passe" : "Sans préciser";

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
          {/* Le mot « PAUSE » occupait 53 px, et seulement à l'arrêt —
              c'est-à-dire précisément dans l'état où la barre débordait et
              où le bouton « MT » se faisait voler son tap. Le chrono le dit
              sans rien coûter : il s'éteint quand il ne tourne plus, et le
              bouton d'à côté montre alors un triangle de lecture. */}
          <span
            className={cn(
              "periode-chip rounded border border-[color:var(--stroke)] px-1 text-[9px] font-black uppercase tracking-wider text-[color:var(--ink-1)]",
              period === 2 ? "p2" : "p1"
            )}
          >
            {period === 2 ? "2de" : "1re"}
          </span>
          {/* Un seul chrono. Le temps additionnel était affiché à part, dans
              un second compteur : à deux, ils poussaient « MT », les
              événements et le son les uns sur les autres — trois boutons
              superposés dès qu'un match dépassait son temps, c'est-à-dire
              presque toujours. Passé la limite, le chrono cesse d'être
              plafonné et passe au rouge : on lit le temps réel, et qu'on est
              au-delà, d'un seul coup d'œil. */}
          <span
            className="match-clock"
            style={
              paused
                ? { color: "var(--ink-3)" }
                : overtime
                  ? { color: "var(--live)" }
                  : undefined
            }
          >
            {fmt(overtime ? elapsedMs : Math.min(elapsedMs, limitMs))}
          </span>
          {/* Le bouton restait un carré, SAUF juste après la mi-temps où il
              s'élargissait pour annoncer « 2de mi-temps ». À cet instant
              précis la barre portait aussi le mot PAUSE et la pastille de
              période : elle débordait de 85 px et recouvrait entièrement le
              bouton des événements — taper « 2de mi-temps » ouvrait la
              chronologie. La pastille « 2de » juste à gauche dit déjà la même
              chose ; le bouton reprend sa taille fixe. */}
          <button
            onClick={toggleClock}
            className="icon-btn"
            title={paused ? "Reprendre" : "Pause"}
            aria-label={paused ? "Reprendre le chrono" : "Mettre en pause"}
          >
            <Icon name={paused ? "play" : "pause"} size={16} />
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
        {/* Le groupe de droite ne cède jamais de place : c'est lui qui porte
            « Fin » et la pastille de synchro. Le son a quitté cette barre — à
            375 px le compte ne tenait pas, et le dépassement ne se voyait pas :
            il ne décalait rien, il RECOUVRAIT. Le bouton des événements
            recevait le tap destiné à « MT ». Le son est un réglage, pas un
            geste de match : il est passé dans le panneau des événements. */}
        <div className="live-topbar-right">
          <button
            onClick={() => setTimelineOpen((o) => !o)}
            className="icon-btn"
            title="Événements"
            aria-label="Événements du match"
          >
            <Icon name="list" size={18} />
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

      {/* Bandeau du mode correction. Il occupe la largeur, annonce ce que font
          les tuiles, et porte la seule sortie — impossible de croire qu'on est
          encore en train de marquer. */}
      {/* Corriger la compo est un moment distinct du match. Il a sa propre
          bande, sous le tableau d'affichage : jamais sur une tuile de joueur.
          C'est ce qui permet de garder la tuile entièrement dédiée au but — le
          geste le plus répété du match ne doit jamais ouvrir autre chose. */}
      {!external &&
        (compoMode ? (
          <div className="compo-bandeau">
            <div>
              <div className="compo-bandeau-titre">
                Corriger la composition
              </div>
              <div className="compo-bandeau-aide">
                Tape un joueur pour l&apos;envoyer dans l&apos;autre équipe.
                Aucun but ne se compte tant que ce bandeau est là.
              </div>
            </div>
            <button onClick={() => setCompoMode(false)} className="compo-fini">
              Terminé
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCompoMode(true)}
            className="compo-entree"
            aria-label="Corriger la composition des équipes"
          >
            Corriger la composition
            <Icon name="chevron" size={13} />
          </button>
        ))}

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
              justMoved={justMoved === p.id}
              mode={compoMode ? "compo" : "score"}
              onGoal={() => addGoal(p.id, "A")}
              onUndo={() => removeGoal(p.id)}
              onMove={() => deplacerJoueur(p.id, "A")}
            />
          ))}
          {!compoMode && (
            <>
              <CscRow
                team="A"
                opponent={match.teamBName}
                onTap={() => addOwnGoal("A")}
              />
              <TeamToolbar
                team="A"
                trackCards={settings.trackCards}
                onCard={(card) => setSheet({ kind: "card", team: "A", card })}
              />
            </>
          )}
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
                Annuler le dernier
              </button>
              <CscRow
                team="B"
                opponent={match.teamAName}
                onTap={() => addOwnGoal("B")}
              />
            </div>
          ) : (
            <>
              {teamB.map((p) => (
                <PlayerTile
                  key={p.id}
                  name={p.name}
                  goals={p.goals}
                  tint="blue"
                  justMoved={justMoved === p.id}
                  mode={compoMode ? "compo" : "score"}
                  onGoal={() => addGoal(p.id, "B")}
                  onUndo={() => removeGoal(p.id)}
                  onMove={() => deplacerJoueur(p.id, "B")}
                />
              ))}
              {!compoMode && (
                <>
                  <CscRow
                    team="B"
                    opponent={match.teamAName}
                    onTap={() => addOwnGoal("B")}
                  />
                  <TeamToolbar
                    team="B"
                    trackCards={settings.trackCards}
                    onCard={(card) => setSheet({ kind: "card", team: "B", card })}
                  />
                </>
              )}
            </>
          )}
        </section>
      </div>

      {/* Une seule barre d'invite, jamais deux : passe décisive ou auteur d'un
          csc. Non bloquante — elle s'efface toute seule si personne ne répond,
          et le score n'a jamais attendu la réponse. */}
      {invite && inviteCandidats.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] p-3">
          <div className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-xs font-black uppercase tracking-wider text-[color:var(--ink-1)]">
              {inviteTitre}
            </span>
            {inviteCandidats.map((p) => (
              <button
                key={p.id}
                onClick={() => repondreInvite(p.id)}
                className="shrink-0 rounded-full border border-[color:var(--stroke-hi)] bg-[color:var(--bg-2)] px-4 py-2 text-sm font-bold hover:border-[color:var(--lime)]"
              >
                {p.name}
              </button>
            ))}
            <button
              onClick={() => repondreInvite(null)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold uppercase text-[color:var(--ink-2)]"
            >
              {inviteRefus} <Icon name="close" size={12} />
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSoundOn(toggleSound())}
                  className="icon-btn w-auto gap-1.5 px-3 text-[11px] font-black uppercase tracking-wider"
                  aria-label={soundOn ? "Couper le son" : "Activer le son"}
                >
                  <Icon name={soundOn ? "sound" : "mute"} size={16} />
                  {soundOn ? "Son" : "Muet"}
                </button>
                <button
                  onClick={() => setTimelineOpen(false)}
                  className="icon-btn"
                  aria-label="Fermer"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
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
                        {/* Un csc est crédité à l'équipe qui en profite. Sans
                            nom d'auteur, le repli sur `e.team` affichait donc
                            « Noir (csc) » pour un but marqué par un joueur de
                            Blanc — l'inverse de ce qui s'est passé. Sans
                            buteur désigné, on nomme le camp qui l'a concédé. */}
                        {e.playerName ??
                          (e.type === "OWN_GOAL"
                            ? `csc de ${e.team === "B" ? match.teamAName : match.teamBName}`
                            : e.team === "B"
                              ? match.teamBName
                              : match.teamAName)}
                        {e.type === "OWN_GOAL" && e.playerName && " (csc)"}
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
                        // Même réflexe que les deux autres annulations : si la
                        // barre du bas interrogeait CET événement, elle n'a
                        // plus rien à demander.
                        setInvite((i) => (i?.eventId === e.id ? null : i));
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

      {/* Feuille : changement de camp, ou carton */}
      {sheet && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/70"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheet(null);
          }}
        >
          <div className="w-full rounded-t-3xl border-t border-[color:var(--stroke-hi)] bg-[color:var(--bg-1)] p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider">
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

/// Le contre son camp, au pied de la colonne de l'équipe qui l'encaisse.
///
/// Il était caché derrière trois lettres en 11 px de l'encre la plus pâle —
/// lisible comme une étiquette, pas comme un bouton — et ouvrait une fenêtre
/// qui exigeait un nom avant de bouger le score. Écrit en toutes lettres, à la
/// jauge d'une tuile de joueur, avec le camp bénéficiaire nommé en dessous, il
/// n'y a plus ni doute sur ce qu'il fait ni délai avant que le score soit juste.
function CscRow({
  team,
  opponent,
  onTap,
}: {
  team: "A" | "B";
  opponent: string;
  onTap: () => void;
}) {
  const body = (
    <div className="fs-tile-body">
      <div className="fs-csc-label">
        <span className="fs-csc-title">Contre son camp</span>
        <span className="fs-csc-sub">but pour {opponent}</span>
      </div>
    </div>
  );
  const plus = (
    <button onClick={onTap} className="fs-tile-plus" aria-label={`Contre son camp — but pour ${opponent}`}>
      +1
    </button>
  );
  return (
    <div className={cn("fs-tile fs-csc", team)}>
      {team === "A" ? (
        <>
          <div className="fs-tile-accent" />
          {body}
          {plus}
        </>
      ) : (
        <>
          {plus}
          {body}
          <div className="fs-tile-accent" />
        </>
      )}
    </div>
  );
}

function TeamToolbar({
  team,
  trackCards,
  onCard,
}: {
  team: "A" | "B";
  trackCards: boolean;
  onCard: (card: "YELLOW_CARD" | "RED_CARD") => void;
}) {
  if (!trackCards) return null;
  return (
    <div
      className={cn(
        "flex gap-2 p-2",
        team === "B" && "flex-row-reverse"
      )}
    >
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
