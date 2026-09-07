"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

type P = { id: string; name: string };

export default function MvpPicker({
  players,
  onCancel,
  onConfirm,
  busy,
}: {
  players: P[];
  onCancel: () => void;
  onConfirm: (mvpId: string | null) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-2 sm:items-center">
      <div className="w-full max-w-md rounded-none bg-[color:var(--pitch-1)] p-4">
        <h2 className="mb-1 text-lg font-bold">Élire le MVP</h2>
        <p className="mb-3 text-xs text-[color:var(--ink-3)]">
          Optionnel — tu peux terminer sans MVP.
        </p>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id === selected ? null : p.id)}
              className={
 "big-touch flex w-full items-center justify-between gap-2 rounded-[2px] px-4 py-3 text-left transition-colors " +
                (selected === p.id
                  ? "bg-[color:var(--pitch-3)] ring-1 ring-[color:var(--gold)]"
                  : "bg-[color:var(--pitch-2)] hover:bg-[color:var(--rule)]")
              }
            >
              <span className="min-w-0 truncate font-semibold">{p.name}</span>
              {selected === p.id && (
                <Icon
                  name="star"
                  filled
                  size={16}
                  label="MVP choisi"
                  className="shrink-0 text-[color:var(--gold)]"
                />
              )}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="btn ghost big flex-1"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={busy}
            className="btn primary big flex-1"
          >
            {busy ? "…" : "Terminer"}
          </button>
        </div>
      </div>
    </div>
  );
}
