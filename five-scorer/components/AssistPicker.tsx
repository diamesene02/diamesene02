"use client";

import { useEffect } from "react";

type Teammate = { id: string; name: string };

export default function AssistPicker({
  scorerName,
  scorerTeam,
  teammates,
  onPick,
  onSkip,
}: {
  scorerName: string;
  scorerTeam: "A" | "B";
  teammates: Teammate[];
  onPick: (playerId: string) => void;
  onSkip: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onSkip, 5000);
    return () => clearTimeout(t);
  }, [onSkip]);

  const teamCls = scorerTeam === "A" ? "A" : "B";

  return (
    <div
      className="assist-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}
    >
      <div className="assist-box">
        <div className="assist-title">
          <span className={`tag ${teamCls}`}>BUT</span>
          <span> {scorerName} — passeur ?</span>
        </div>
        <div className="assist-chips">
          {teammates.map((p) => (
            <button
              key={p.id}
              className={`assist-chip ${teamCls}`}
              onClick={() => onPick(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button className="btn ghost assist-skip" onClick={onSkip}>
          Aucune passe
        </button>
      </div>
    </div>
  );
}
