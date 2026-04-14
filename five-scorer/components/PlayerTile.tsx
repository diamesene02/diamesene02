"use client";

import { memo, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  goals: number;
  tint: "pitch" | "blue";
  onGoal: () => void;
  onUndo: () => void;
};

const BallIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="fs-tile-ball" aria-hidden>
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 2a7.94 7.94 0 0 1 5 1.78l-1.58 1.14-3.42-1.1Zm-7.8 6.24L5.9 9l1.3 3.94-1 .73-2-2.9Zm4.16 8.26-1.1-3.4L9 12.5l3 2.2v1.7Zm3.64.44v-1.76l3-2.2 1.74 1.04-1.1 3.4a7.93 7.93 0 0 1-3.64-.48Zm6.07-2.18-2-2.9 1.3-3.94 1.7 1.24a7.93 7.93 0 0 1-1 5.6Z" />
  </svg>
);

function PlayerTileImpl({ name, goals, tint, onGoal, onUndo }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const startPress = useCallback(() => {
    didLongRef.current = false;
    btnRef.current?.classList.add("long-pressing");
    timerRef.current = setTimeout(() => {
      didLongRef.current = true;
      btnRef.current?.classList.remove("long-pressing");
      if (goals > 0) {
        if (navigator.vibrate) navigator.vibrate(30);
        onUndo();
      }
    }, 500);
  }, [goals, onUndo]);

  const endPress = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      btnRef.current?.classList.remove("long-pressing");
      if (!didLongRef.current) {
        if (navigator.vibrate) navigator.vibrate(12);
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
