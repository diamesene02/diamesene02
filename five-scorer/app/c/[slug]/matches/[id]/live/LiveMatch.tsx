"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import PlayerTile from "@/components/PlayerTile";
import MvpPicker from "@/components/MvpPicker";
import SyncBadge from "@/components/SyncBadge";
import { cn } from "@/lib/cn";
import Icon from "@/components/Icon";
import Ecusson from "@/components/ios/Ecusson";
import { lettre } from "@/lib/ini";
import "./live.css";
import {
  addEvent,
  finishMatch,
  getLocalMatch,
  ajouterJoueurAuMatch,
  joueursAbsentsDuMatch,
  movePlayerTeam,
  removeEvent,
  setEventAssist,
  saveRoster,
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

type FicheJoueur = {
  id: string;
  name: string;
  nickname: string | null;
  skill: number;
  isGk: boolean;
  isGuest: boolean;
};

export default function LiveMatch({
  slug,
  matchId,
  clubId,
  vivier: vivierClub,
  settings,
  onFinished,
}: {
  slug: string;
  matchId: string;
  clubId: string;
  /// Tous les joueurs actifs du club, pour amorcer le cache local.
  vivier: FicheJoueur[];
  settings: Settings;
  /// Quand il est fourni, la fin de match ne NAVIGUE plus vers le récap
  /// serveur — elle remonte au parent. Hors-ligne, naviguer vers une page
  /// serveur pour un match que le serveur ne connaît pas encore, c'était
  /// perdre l'écran, le score final et la file d'envoi d'un coup.
  onFinished?: (matchId: string) => void;
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
  // La cérémonie du but : un compteur pour rejouer l'éclair à chaque but.
  const [eclair, setEclair] = useState<{ team: "A" | "B"; n: number } | null>(null);
  // Le coup de sifflet final : un écran d'une seconde, un tap pour passer.
  const [tempsPlein, setTempsPlein] = useState(false);
  const passerSlate = useRef<(() => void) | null>(null);
  // Le retardataire : les joueurs du club absents de la feuille de ce match.
  const [vivier, setVivier] = useState<{ id: string; name: string }[]>([]);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  // Amorçage du cache local, à chaque ouverture : c'est le seul moment où l'on
  // est sûr d'avoir le réseau.
  useEffect(() => {
    if (vivierClub.length > 0) void saveRoster(clubId, vivierClub);
  }, [clubId, vivierClub]);
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

  useEffect(() => {
    if (!compoMode) {
      setAjoutOuvert(false);
      return;
    }
    let vivant = true;
    void joueursAbsentsDuMatch(matchId).then((v) => {
      if (vivant) setVivier(v);
    });
    return () => {
      vivant = false;
    };
  }, [compoMode, matchId, data]);

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
  // Ce garde sert au match terminé AILLEURS (autre téléphone, autre onglet) :
  // on quitte l'écran live. Mais il ne doit pas court-circuiter notre propre
  // coup de sifflet : dès que finishMatch écrivait dans la base locale, le
  // status passait à FINISHED et la redirection partait AVANT que le slate ne
  // s'affiche — la cérémonie de fin de match n'existait jamais.
  const finished = data?.match?.status === "FINISHED";
  useEffect(() => {
    if (finished && !tempsPlein) {
      if (onFinished) onFinished(matchId);
      else router.replace(`/c/${slug}/matches/${matchId}`);
    }
  }, [finished, tempsPlein, router, slug, matchId, onFinished]);

  // Le but reçoit sa cérémonie : la bande du camp qui marque balaie le
  // panneau pendant que le chiffre roule. L'ancienne version posait une
  // classe `goaled` que le CSS ne connaissait pas — le but tombait sans un
  // mouvement.
  const prevScoreRef = useRef<{ a: number; b: number } | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = prevScoreRef.current;
    const curr = { a: data.match.scoreA, b: data.match.scoreB };
    if (prev) {
      if (curr.a > prev.a) setEclair((e) => ({ team: "A", n: (e?.n ?? 0) + 1 }));
      else if (curr.b > prev.b) setEclair((e) => ({ team: "B", n: (e?.n ?? 0) + 1 }));
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
      playGoalSound("B");
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
        
        const credited = conceding === "A" ? "B" : "A";
        playGoalSound(credited);
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

  async function faireEntrer(playerId: string, team: "A" | "B") {
    setAjoutOuvert(false);
    try {
      await ajouterJoueurAuMatch(matchId, playerId, team);
      if (navigator.vibrate) navigator.vibrate(18);
      setJustMoved(playerId);
      if (moveTimer.current) clearTimeout(moveTimer.current);
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
      // Temps plein : une seconde, ou un tap. Le match est déjà terminé dans
      // Dexie avant que l'écran ne parte — le slate n'est pas une attente.
      await finishMatch(matchId, mvpId);
      setTempsPlein(true);
      await new Promise<void>((res) => {
        passerSlate.current = res;
        setTimeout(res, 1000);
      });
      void kickSync();
      if (onFinished) onFinished(matchId);
      else router.replace(`/c/${slug}/matches/${matchId}`);
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

  /// Le bouton « Annuler » du bas : le DERNIER événement, quel qu'il soit —
  /// but, csc, carton, mi-temps. C'est le geste de la maquette ; l'appui
  /// long sur un joueur reste le chemin précis pour SON dernier but.
  async function annulerDernier() {
    if (!data || data.events.length === 0) return;
    const e = data.events[data.events.length - 1];
    try {
      await removeEvent(matchId, e.id);
      setInvite((i) => (i?.eventId === e.id ? null : i));
      if (e.type === "HALF_TIME") {
        await getDb().matches.update(matchId, { period: 1 });
        setHalftimeJustSet(false);
      }
      if (navigator.vibrate) navigator.vibrate(30);
      void kickSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  if (data === undefined) {
    return (
      <main className="live fond-match" style={{ display: "grid", placeItems: "center", color: "rgba(255,255,255,.6)" }}>
        Chargement…
      </main>
    );
  }
  if (data === null) {
    return (
      <main className="live fond-match" style={{ display: "grid", placeItems: "center" }}>
        <div className="mx-auto max-w-md p-6 text-center">
          <h1 className="mb-2 text-[22px] font-semibold">Match introuvable</h1>
          <p className="mb-6 text-[15px] text-[rgba(255,255,255,.62)]">
            Ce match n&apos;existe pas dans la mémoire locale de cet appareil.
          </p>
          <button onClick={() => router.replace(`/c/${slug}`)} className="plein">
            Retour
          </button>
        </div>
      </main>
    );
  }

  const { match, teamA, teamB, events } = data;
  // Même raison : tant que le slate est à l'écran, le composant doit rester
  // monté pour le rendre.
  if (match.status === "FINISHED" && !tempsPlein) return null;

  const external = match.kind === "EXTERNAL";
  const period = match.period ?? 1;
  const aLead = match.scoreA > match.scoreB;
  const bLead = match.scoreB > match.scoreA;
  const sheetPlayers: LivePlayer[] =
    sheet?.kind === "card" ? (sheet.team === "A" ? teamA : teamB) : [];
  // Une passe vient d'un coéquipier du buteur ; l'auteur d'un csc est dans
  // l'équipe qui l'a concédé.
  const inviteCandidats: LivePlayer[] = !invite
    ? []
    : invite.kind === "passe"
      ? (invite.team === "A" ? teamA : teamB).filter((p) => p.id !== invite.scorerId)
      : invite.conceding === "A"
        ? teamA
        : teamB;
  const inviteTitre = invite?.kind === "passe" ? "Passe décisive ?" : "Qui l'a mis ?";
  const inviteRefus = invite?.kind === "passe" ? "Sans passe" : "Sans préciser";

  // « Karim 3′, 11′ » sous chaque écusson, dans l'ordre du match.
  const buteurs = (t: "A" | "B") => {
    const out: { nom: string; mins: string[] }[] = [];
    for (const e of events) {
      if (e.team !== t || (e.type !== "GOAL" && e.type !== "OWN_GOAL")) continue;
      const nom = e.playerName
        ? e.type === "OWN_GOAL" ? `${e.playerName} (csc)` : e.playerName
        : e.type === "OWN_GOAL"
          ? "csc"
          : t === "B" ? match.teamBName : match.teamAName;
      const s = out.find((x) => x.nom === nom);
      const m = e.minute != null ? `${e.minute}′` : "";
      if (s) s.mins.push(m);
      else out.push({ nom, mins: [m] });
    }
    return out;
  };
  const buteursA = buteurs("A");
  const buteursB = buteurs("B");

  const eventIcon = (t: string) => {
    if (t === "GOAL") return <Icon name="ball" size={16} />;
    if (t === "OWN_GOAL") return <Icon name="ball" size={16} className="opacity-50" />;
    if (t === "YELLOW_CARD") return <span style={{ color: "#ffd60a" }}><Icon name="card" size={16} filled label="Carton jaune" /></span>;
    if (t === "HALF_TIME") return <Icon name="whistle" size={16} />;
    return <span style={{ color: "#ff453a" }}><Icon name="card" size={16} filled label="Carton rouge" /></span>;
  };

  const dateLabel = new Date(match.playedAt).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const Ballon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.4l3.9 2.8-1.5 4.6h-4.8L8.1 10.2z" />
    </svg>
  );

  return (
    <main className="live fond-match">
      <div className="grabber" style={{ background: "rgba(255,255,255,.3)" }} />
      <div className="live-barre">
        <button
          type="button"
          onClick={() => router.push(`/c/${slug}`)}
          aria-label="Quitter le live (le match continue)"
          className="verre rond"
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden>
            <path d="M10 2L2 10l8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="legende">{dateLabel} · {external ? match.teamBName : "Match"}</span>
        <div className="droite">
          <SyncBadge compact />
          <button
            type="button"
            onClick={() => setTimelineOpen((o) => !o)}
            className="verre rond"
            aria-label="Événements du match"
          >
            <Icon name="list" size={18} />
          </button>
        </div>
      </div>

      {/* Le score, et l'éclair de couleur du camp qui vient de marquer. */}
      <div className="live-tete">
        {eclair && <div key={eclair.n} className={cn("live-flash joue", eclair.team)} aria-hidden />}
        <div className="live-marque">
          <div className={cn("live-chiffre", bLead && "perd")}>
            <span className="score-lourd">{match.scoreA}</span>
          </div>
          <div className="live-milieu">
            <span className={cn("etat", paused && "pause")}>{paused ? "Pause" : "En direct"}</span>
            <span className={cn("horloge", overtime && "depasse")}>
              {fmt(overtime ? elapsedMs : Math.min(elapsedMs, limitMs))}
            </span>
            {period !== 2 ? (
              <button type="button" className="periode" onClick={onHalftime} title="Siffler la mi-temps">
                1re · mi-temps ›
              </button>
            ) : (
              <span className="periode" style={{ cursor: "default" }}>
                {halftimeJustSet && paused ? "2de · à reprendre" : "2de"}
              </span>
            )}
          </div>
          <div className={cn("live-chiffre", aLead && "perd")}>
            <span className="score-lourd">{match.scoreB}</span>
          </div>
        </div>
        <div className="live-equipes">
          <div className="live-equipe">
            <Ecusson camp="A" lettre={lettre(match.teamAName)} taille={76} />
            <span className="nom">{match.teamAName}</span>
          </div>
          <div className="live-equipe">
            <Ecusson camp={external ? "club" : "B"} lettre={lettre(match.teamBName)} taille={76} />
            <span className="nom">{match.teamBName}</span>
          </div>
        </div>
        <div className="live-buteurs">
          <div>
            {buteursA.length > 0 && <Ballon />}
            <div>
              {buteursA.map((s) => (
                <div key={s.nom}>
                  {s.nom} <span className="mins">{s.mins.filter(Boolean).join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="B">
            <div>
              {buteursB.map((s) => (
                <div key={s.nom}>
                  {s.nom} <span className="mins">{s.mins.filter(Boolean).join(", ")}</span>
                </div>
              ))}
            </div>
            {buteursB.length > 0 && <Ballon />}
          </div>
        </div>
      </div>

      {error && (
        <div className="live-erreur" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* Corriger la compo est un moment distinct du match, avec sa propre
          bande : jamais sur une rangée de joueur. C'est ce qui garde la rangée
          entièrement dédiée au but. */}
      {!external && compoMode && (
        <div className="live-compo">
          <div>
            <div className="titre">Corriger la composition</div>
            <div className="aide">
              Tape un joueur pour l&apos;envoyer dans l&apos;autre équipe. Aucun but ne se compte tant que ce bandeau est là.
            </div>
          </div>
          <button type="button" onClick={() => setCompoMode(false)} className="plein" style={{ height: 44, padding: "0 16px" }}>
            Terminé
          </button>
        </div>
      )}

      {/* Le retardataire : il arrive à la 10e minute et n'était sur aucune
          feuille. */}
      {compoMode && !external && vivier.length > 0 && (
        <div className="live-ajout">
          {ajoutOuvert ? (
            <>
              <div className="titre">Il arrive en retard — dans quelle équipe ?</div>
              <ul>
                {vivier.map((v) => (
                  <li key={v.id}>
                    <span className="nom">{v.name}</span>
                    <button type="button" className="A" onClick={() => faireEntrer(v.id, "A")}>
                      {match.teamAName}
                    </button>
                    <button type="button" className="B" onClick={() => faireEntrer(v.id, "B")}>
                      {match.teamBName}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setAjoutOuvert(false)} className="live-compo-entree">
                Fermer
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setAjoutOuvert(true)} className="live-compo-entree" style={{ margin: 0 }}>
              + Faire entrer un joueur
            </button>
          )}
        </div>
      )}

      <div className="live-corps">
        <div className="live-cartes">
          <section className="live-carte">
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
                <button type="button" className="live-csc" onClick={() => addOwnGoal("A")} aria-label={`Contre son camp — but pour ${match.teamBName}`}>
                  Contre son camp
                </button>
                {settings.trackCards && (
                  <div className="live-cartons">
                    <button type="button" onClick={() => setSheet({ kind: "card", team: "A", card: "YELLOW_CARD" })} aria-label="Carton jaune" style={{ color: "#ffd60a" }}>
                      <Icon name="card" size={16} filled />
                    </button>
                    <button type="button" onClick={() => setSheet({ kind: "card", team: "A", card: "RED_CARD" })} aria-label="Carton rouge" style={{ color: "#ff453a" }}>
                      <Icon name="card" size={16} filled />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          <section className="live-carte">
            {external ? (
              <>
                <button type="button" onClick={addOpponentGoal} className="live-adverse">
                  <span className="plus">+1</span>
                  <span className="l">But {match.teamBName}</span>
                </button>
                <button type="button" onClick={undoOpponentGoal} className="live-csc">
                  Annuler le dernier
                </button>
                <button type="button" className="live-csc" onClick={() => addOwnGoal("B")}>
                  Contre son camp
                </button>
              </>
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
                    <button type="button" className="live-csc" onClick={() => addOwnGoal("B")} aria-label={`Contre son camp — but pour ${match.teamAName}`}>
                      Contre son camp
                    </button>
                    {settings.trackCards && (
                      <div className="live-cartons">
                        <button type="button" onClick={() => setSheet({ kind: "card", team: "B", card: "YELLOW_CARD" })} aria-label="Carton jaune" style={{ color: "#ffd60a" }}>
                          <Icon name="card" size={16} filled />
                        </button>
                        <button type="button" onClick={() => setSheet({ kind: "card", team: "B", card: "RED_CARD" })} aria-label="Carton rouge" style={{ color: "#ff453a" }}>
                          <Icon name="card" size={16} filled />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
        {!external && !compoMode && (
          <button type="button" onClick={() => setCompoMode(true)} className="live-compo-entree" aria-label="Corriger la composition des équipes">
            Corriger la composition ›
          </button>
        )}
        <div style={{ height: 12 }} />
      </div>

      <div className="live-pied">
        <button type="button" onClick={annulerDernier} className="verre grand" disabled={events.length === 0} aria-label="Annuler le dernier événement">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9h11a5 5 0 0 1 0 10H8" /><path d="M8 4.5L3.5 9 8 13.5" />
          </svg>
          Annuler
        </button>
        <button type="button" onClick={toggleClock} className="verre grand pause">
          {paused ? (halftimeJustSet ? "2de mi-temps" : "Reprendre") : "Pause"}
        </button>
        <button type="button" onClick={() => setConfirmOpen(true)} className="plein fin">
          Terminer
        </button>
      </div>

      {/* Une seule barre d'invite, jamais deux : passe décisive ou auteur d'un
          csc. Non bloquante — elle s'efface toute seule si personne ne répond,
          et le score n'a jamais attendu la réponse. */}
      {invite && inviteCandidats.length > 0 && (
        <div className="live-invite">
          <div className="titre">{inviteTitre}</div>
          <div className="choix">
            {inviteCandidats.map((p) => (
              <button key={p.id} type="button" onClick={() => repondreInvite(p.id)} className="verre">
                {p.name}
              </button>
            ))}
            <button type="button" onClick={() => repondreInvite(null)} className="verre" style={{ color: "rgba(255,255,255,.6)" }}>
              {inviteRefus}
            </button>
          </div>
        </div>
      )}

      {timelineOpen && (
        <div className="live-voile" onClick={(e) => { if (e.target === e.currentTarget) setTimelineOpen(false); }}>
          <div className="live-feuille">
            <div className="grabber" style={{ margin: "4px auto 0", background: "rgba(255,255,255,.3)" }} />
            <div className="tete">
              <span>Événements</span>
              <div className="actions">
                <button type="button" onClick={() => setSoundOn(toggleSound())} className="verre" aria-label={soundOn ? "Couper le son" : "Activer le son"}>
                  <Icon name={soundOn ? "sound" : "mute"} size={16} />
                  {soundOn ? "Son" : "Muet"}
                </button>
                <button type="button" onClick={() => setTimelineOpen(false)} className="verre rond" aria-label="Fermer">
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>
            {events.length === 0 ? (
              <p className="live-vide">Rien pour l&apos;instant. Ça va venir.</p>
            ) : (
              [...events].reverse().map((e) => (
                <div key={e.id} className="live-evt">
                  <span className="minute">{e.minute != null ? `${e.minute}′` : "—"}</span>
                  <span>{eventIcon(e.type)}</span>
                  {e.type === "HALF_TIME" ? (
                    <span className="qui" style={{ color: "rgba(255,255,255,.62)" }}>— Mi-temps —</span>
                  ) : (
                    <span className={cn("qui", e.team)}>
                      {/* Un csc est crédité à l'équipe qui en profite : sans
                          auteur, on nomme le camp qui l'a concédé. */}
                      {e.playerName ??
                        (e.type === "OWN_GOAL"
                          ? `csc de ${e.team === "B" ? match.teamAName : match.teamBName}`
                          : e.team === "B" ? match.teamBName : match.teamAName)}
                      {e.type === "OWN_GOAL" && e.playerName && " (csc)"}
                      {e.assistName && <span className="note"> — passe de {e.assistName}</span>}
                    </span>
                  )}
                  <button
                    type="button"
                    className="annuler"
                    onClick={async () => {
                      await removeEvent(matchId, e.id);
                      setInvite((i) => (i?.eventId === e.id ? null : i));
                      if (e.type === "HALF_TIME") {
                        await getDb().matches.update(matchId, { period: 1 });
                        setHalftimeJustSet(false);
                      }
                      void kickSync();
                    }}
                  >
                    Annuler
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {sheet && (
        <div className="live-voile" onClick={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div className="live-feuille">
            <div className="grabber" style={{ margin: "4px auto 0", background: "rgba(255,255,255,.3)" }} />
            <div className="tete">
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: sheet.card === "YELLOW_CARD" ? "#ffd60a" : "#ff453a", display: "inline-flex" }}><Icon name="card" size={18} filled /></span>
                {sheet.card === "YELLOW_CARD" ? "Carton jaune pour…" : "Carton rouge pour…"}
              </span>
            </div>
            <div className="live-grille">
              {sheetPlayers.map((p) => (
                <button key={p.id} type="button" onClick={() => onSheetPick(p.id)} className="verre grand" style={{ justifyContent: "flex-start" }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="live-voile centre" onClick={(e) => { if (e.target === e.currentTarget) setConfirmOpen(false); }}>
          <div className="live-confirm">
            <h2>Terminer ce match ?</h2>
            <div className="boutons">
              <button type="button" onClick={() => setConfirmOpen(false)} className="verre grand">
                Pas encore
              </button>
              <button type="button" onClick={requestFinish} className="plein">
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}

      {tempsPlein && (
        <div className="live-plein fond-match" onClick={() => passerSlate.current?.()} role="status" aria-live="polite">
          <div style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "rgba(255,255,255,.62)" }}>Temps plein</div>
            <div className="live-marque" style={{ padding: "8px 0 0" }}>
              <div className={cn("live-chiffre", bLead && "perd")}><span className="score-lourd">{match.scoreA}</span></div>
              <div style={{ width: 2, height: 70, background: "rgba(255,255,255,.35)", alignSelf: "center" }} />
              <div className={cn("live-chiffre", aLead && "perd")}><span className="score-lourd">{match.scoreB}</span></div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 18 }}>
              {aLead ? `${match.teamAName} l'emporte` : bLead ? `${match.teamBName} l'emporte` : "Match nul"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", marginTop: 24 }}>Touche pour continuer</div>
          </div>
        </div>
      )}

      {mvpOpen && (
        <MvpPicker players={[...teamA, ...teamB]} onCancel={() => setMvpOpen(false)} onConfirm={onFinish} busy={finishing} />
      )}
    </main>
  );
}
