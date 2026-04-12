"use client";

import { useState } from "react";

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
      <div className="w-full max-w-md rounded-2xl bg-[#0f172a] p-4 shadow-xl">
        <h2 className="mb-1 text-lg font-bold">Élire le MVP</h2>
        <p className="mb-3 text-xs text-gray-400">
          Optionnel — tu peux terminer sans MVP.
        </p>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id === selected ? null : p.id)}
              className={
                "big-touch flex w-full items-center justify-between rounded-lg px-4 py-3 text-left " +
                (selected === p.id
                  ? "bg-yellow-500/30 ring-2 ring-yellow-400"
                  : "bg-white/5 hover:bg-white/10")
              }
            >
              <span className="font-semibold">{p.name}</span>
              {selected === p.id && <span>⭐</span>}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="big-touch flex-1 rounded-lg bg-white/10 py-3 hover:bg-white/20"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={busy}
            className="big-touch flex-1 rounded-lg bg-pitch-600 py-3 font-semibold hover:bg-pitch-700 disabled:opacity-50"
          >
            {busy ? "…" : "Terminer"}
          </button>
        </div>
      </div>
    </div>
  );
}
