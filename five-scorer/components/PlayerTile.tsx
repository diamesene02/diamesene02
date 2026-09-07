"use client";

import { memo, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { unlockAudio, playGoalSound, playUndoSound } from "@/lib/audio";
import Icon from "@/components/Icon";

// Module-level guard: suppress taps for a short window after a long-press
// fires, so the release doesn't accidentally add a goal after undoing.
let suppressTapUntil = 0;
const SUPPRESS_TAP_MS = 700;

type Props = {
  name: string;
  goals: number;
  tint: "pitch" | "blue";
  /// Vient de changer de camp : un éclair de contour pour que l'œil suive.
  justMoved?: boolean;
  /// « score » : la tuile compte les buts, et RIEN d'autre. « compo » : le
  /// match est en pause de correction, la tuile ne sert plus qu'à faire
  /// changer un joueur de camp. Les deux ne coexistent jamais.
  ///
  /// La séparation est délibérée. Marquer un but s'est fait pendant des mois
  /// en appuyant sur la tuile du joueur ; brancher « changer d'équipe » sur
  /// la même surface, c'était rendre le geste le plus fréquent du match
  /// ambigu — un appui censé compter un but ouvrant une fenêtre à la place.
  mode?: "score" | "compo";
  onGoal: () => void;
  onUndo: () => void;
  /// Appelé au tap en mode compo uniquement.
  onMove?: () => void;
};

// Le ballon du jeu d'icônes commun, à la taille de la tuile.
const BallIcon = () => (
  <span className="fs-tile-ball">
    <Icon name="ball" size={12} />
  </span>
);

function PlayerTileImpl({
  name,
  goals,
  tint,
  justMoved,
  mode = "score",
  onGoal,
  onUndo,
  onMove,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const startPress = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      didLongRef.current = false;
      btnRef.current?.classList.add("long-pressing");
      try {
        btnRef.current?.setPointerCapture(e.pointerId);
      } catch {}
      timerRef.current = setTimeout(() => {
        didLongRef.current = true;
        btnRef.current?.classList.remove("long-pressing");
        if (goals > 0) {
          // Le garde n'est armé QUE si une annulation a réellement eu lieu : il
          // sert à absorber le relâchement du doigt, qui sinon rajouterait le but
          // qu'on vient de retirer. L'armer sur un appui sans effet rendait
          // muette la tuile suivante pendant 700 ms — le buteur tapait, rien ne
          // se passait, le but était perdu au milieu du match.
          suppressTapUntil = Date.now() + SUPPRESS_TAP_MS;
          if (navigator.vibrate) navigator.vibrate(30);
          playUndoSound();
          onUndo();
        } else {
          // Rien à annuler : on le dit au doigt plutôt que de ne rien faire.
          if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
          btnRef.current?.classList.add("rien-a-annuler");
          setTimeout(
            () => btnRef.current?.classList.remove("rien-a-annuler"),
            320,
          );
        }
      }, 500);
    },
    [goals, onUndo],
  );

  const endPress = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      btnRef.current?.classList.remove("long-pressing");
      const suppressed = Date.now() < suppressTapUntil;
      if (!didLongRef.current && !suppressed) {
        unlockAudio();
        if (navigator.vibrate) navigator.vibrate(12);
        playGoalSound(tint === "pitch" ? "A" : "B");
        onGoal();
      }
      e.preventDefault();
    },
    [onGoal, tint],
  );

  const cancelPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    btnRef.current?.classList.remove("long-pressing");
  }, []);

  const teamCls = tint === "pitch" ? "A" : "B";

  // ── Mode correction de compo ───────────────────────────────────────────
  // La tuile entière devient une seule cible, et rien n'y compte de but. La
  // flèche pointe vers la colonne d'en face : la destination se lit avant le
  // geste, pas après.
  if (mode === "compo") {
    return (
      <button
        type="button"
        onClick={onMove}
        className={cn("fs-tile fs-tile-compo", teamCls, justMoved && "arrive")}
        aria-label={`${name} — envoyer dans l'autre équipe`}
      >
        <div className="fs-tile-accent" />
        <div className="fs-tile-body">
          <span className="fs-tile-name">{name}</span>
          <span className="fs-tile-fleche">
            <Icon name="chevron" size={16} />
          </span>
        </div>
      </button>
    );
  }

  const body = (
    <div className="fs-tile-body">
      <div className="fs-tile-name">{name}</div>
      <div className="fs-tile-goals-wrap">
        {goals > 0 && <BallIcon />}
        <span className="fs-tile-goals">{goals > 0 ? goals : ""}</span>
      </div>
    </div>
  );

  const accent = <div className="fs-tile-accent" />;
  const plus = (
    <button
      ref={btnRef}
      aria-label="Ajouter un but (maintenir pour annuler)"
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      className="fs-tile-plus"
    >
      +1
    </button>
  );

  return (
    <div className={cn("fs-tile", teamCls, justMoved && "arrive")}>
      {tint === "pitch" ? (
        <>
          {accent}
          {body}
          {plus}
        </>
      ) : (
        <>
          {plus}
          {body}
          {accent}
        </>
      )}
    </div>
  );
}

export default memo(PlayerTileImpl);
