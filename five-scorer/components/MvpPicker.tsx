"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import Icon from "@/components/Icon";

type P = { id: string; name: string };

// La feuille de fin de match qui désigne l'homme du match.
//
// Le mot : « homme du match », comme le réglage du club, le récap, la carte
// de vote, la fiche joueur, le palmarès et le succès `homme-du-match`. C'était
// le seul écran où l'on AGIT, et le seul à dire « MVP ».
//
// Le dessin : celui de l'écran en direct (`live-voile` / `live-feuille`, une
// feuille en verre qui monte du bas). La boîte à angles droits sur
// `--pitch-1` datait d'avant la refonte et détonnait sur le reste du match.
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
  const [choisi, setChoisi] = useState<string | null>(null);

  return (
    <div
      className="live-voile"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="live-feuille"
        role="dialog"
        aria-modal="true"
        aria-label="Élire l'homme du match"
      >
        <div
          className="grabber"
          style={{ margin: "4px auto 0", background: "rgba(255,255,255,.3)" }}
        />
        <div className="tete">Élire l'homme du match</div>
        <p className="live-confirm-aide" style={{ margin: "-8px 0 12px" }}>
          Facultatif — tu peux terminer sans.
        </p>
        <div className="live-grille" role="radiogroup" aria-label="Homme du match">
          {players.map((p) => {
            const actif = choisi === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => setChoisi(actif ? null : p.id)}
                className={cn("verre grand", actif && "lueur")}
                style={{ justifyContent: "flex-start", minWidth: 0 }}
              >
                {actif && (
                  <span
                    style={{ color: "var(--gold)", display: "inline-flex", flexShrink: 0 }}
                  >
                    <Icon name="star" filled size={16} />
                  </span>
                )}
                <span className="min-w-0 truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, paddingTop: 14 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="verre grand"
            style={{ flex: 1 }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(choisi)}
            disabled={busy}
            className="plein"
            style={{ flex: 1 }}
          >
            {busy ? "…" : "Terminer"}
          </button>
        </div>
      </div>
    </div>
  );
}
