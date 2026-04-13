"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  goals: number;
  tint: "pitch" | "blue";
  onGoal: () => void;
  onUndo: () => void;
};

export default function PlayerTile({ name, goals, tint, onGoal, onUndo }: Props) {
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

  const endPress = useCallback((e: React.PointerEvent) => {
    clearTimeout(timerRef.current!);
    btnRef.current?.classList.remove("long-pressing");
    if (!didLongRef.current) onGoal();
    e.preventDefault();
  }, [onGoal]);

  const cancelPress = useCallback(() => {
    clearTimeout(timerRef.current!);
    btnRef.current?.classList.remove("long-pressing");
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1",
        tint === "pitch"
          ? "border-l-[3px] border-l-pitch-500 bg-pitch-900/30"
          : "border-l-[3px] border-l-blue-500 bg-blue-900/30"
      )}
    >
      <div className="flex-1 truncate text-sm font-bold">{name}</div>
      {goals > 0 && (
        <div className="min-w-[20px] text-center text-base font-extrabold text-amber-400">
          {goals}
        </div>
      )}
      <button
        ref={btnRef}
        aria-label="Ajouter un but (maintenir pour annuler)"
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        className={cn(
          "rounded-lg px-3 py-2 text-lg font-extrabold text-white transition-colors touch-manipulation",
          "[&.long-pressing]:!bg-red-600",
          tint === "pitch"
            ? "bg-pitch-600 active:bg-pitch-700"
            : "bg-blue-600 active:bg-blue-700"
        )}
      >
        +1
      </button>
    </div>
  );
}
