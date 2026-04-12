"use client";

import { cn } from "@/lib/cn";

type Props = {
  name: string;
  goals: number;
  tint: "pitch" | "blue";
  onGoal: () => void;
  onUndo: () => void;
};

export default function PlayerTile({ name, goals, tint, onGoal, onUndo }: Props) {
  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-xl border",
        tint === "pitch"
          ? "border-pitch-600/40 bg-pitch-900/30"
          : "border-blue-500/40 bg-blue-900/30"
      )}
    >
      <button
        onClick={onGoal}
        className={cn(
          "big-touch flex-1 px-4 py-4 text-left transition active:scale-[0.98]",
          tint === "pitch" ? "hover:bg-pitch-800/60" : "hover:bg-blue-800/60"
        )}
      >
        <div className="text-lg font-bold">{name}</div>
        <div className="text-xs uppercase text-gray-300">
          {goals} but{goals > 1 ? "s" : ""}
        </div>
      </button>
      <button
        onClick={onUndo}
        aria-label="Annuler un but"
        disabled={goals === 0}
        className="big-touch w-16 shrink-0 bg-black/40 text-2xl font-bold text-gray-300 hover:bg-black/60 disabled:opacity-30"
      >
        −
      </button>
      <button
        onClick={onGoal}
        aria-label="Ajouter un but"
        className={cn(
          "big-touch w-20 shrink-0 text-3xl font-black",
          tint === "pitch"
            ? "bg-pitch-600 hover:bg-pitch-700"
            : "bg-blue-600 hover:bg-blue-700"
        )}
      >
        +1
      </button>
    </div>
  );
}
