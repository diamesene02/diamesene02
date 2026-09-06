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
  onGoal: () => void;
  onUndo: () => void;
};

// Le ballon du jeu d'icônes commun, à la taille de la tuile.
const BallIcon = () => (
  <span className="fs-tile-ball">
    <Icon name="ball" size={12} />
  </span>
);

function PlayerTileImpl({ name, goals, tint, onGoal, onUndo }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const startPress = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    didLongRef.current = false;
    btnRef.current?.classList.add("long-pressing");
    try { btnRef.current?.setPointerCapture(e.pointerId); } catch {}
    timerRef.current = setTimeout(() => {
      didLongRef.current = true;
      suppressTapUntil = Date.now() + SUPPRESS_TAP_MS;
      btnRef.current?.classList.remove("long-pressing");
      if (goals > 0) {
        if (navigator.vibrate) navigator.vibrate(30);
        playUndoSound();
        onUndo();
      }
    }, 500);
  }, [goals, onUndo]);

  const endPress = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      btnRef.current?.classList.remove("long-pressing");
      const suppressed = Date.now() < suppressTapUntil;
      if (!didLongRef.current && !suppressed) {
        unlockAudio();
        if (navigator.vibrate) navigator.vibrate(12);
        playGoalSound();
        onGoal();
      }
      e.preventDefault();
    },
    [onGoal]
  );

  const cancelPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    btnRef.current?.classList.remove("long-pressing");
  }, []);

  const teamCls = tint === "pitch" ? "A" : "B";

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
    <div className={cn("fs-tile", teamCls)}>
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
