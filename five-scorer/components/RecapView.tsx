"use client";

import Link from "next/link";
import { useState } from "react";
import { shareMatchImage } from "@/lib/shareCard";

type Player = {
  id: string;
  name: string;
  goals: number;
  assists: number;
  team: "A" | "B";
};

type Goal = {
  id: string;
  scorerId: string;
  assistId: string | null;
  team: "A" | "B";
  minute: number | null;
  createdAt: string;
  scorerName: string;
  assistName: string | null;
};

type Match = {
  id: string;
  playedAt: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  status: "LIVE" | "FINISHED";
  mvpId: string | null;
};

export default function RecapView({
  match,
  mvpName,
  teamA,
  teamB,
  goals,
  showLiveResumeLink = false,
  showActions = true,
  onRematch,
  publicShareUrl,
}: {
  match: Match;
  mvpName: string | null;
  teamA: Player[];
  teamB: Player[];
  goals: Goal[];
  showLiveResumeLink?: boolean;
  showActions?: boolean;
  onRematch?: () => void;
  publicShareUrl?: string;
}) {
  const [copied, setCopied] = useState(false);

  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;

  const goalCount: Record<string, number> = {};
  const assistCount: Record<string, number> = {};
  goals.forEach((g) => {
    goalCount[g.scorerId] = (goalCount[g.scorerId] ?? 0) + 1;
    if (g.assistId) assistCount[g.assistId] = (assistCount[g.assistId] ?? 0) + 1;
  });

  const all = [...teamA, ...teamB];
  const scorers = all
    .filter((p) => goalCount[p.id])
    .sort((a, b) => goalCount[b.id] - goalCount[a.id]);
  const assisters = all
    .filter((p) => assistCount[p.id])
    .sort((a, b) => assistCount[b.id] - assistCount[a.id]);

  async function onShareImage() {
    await shareMatchImage({ match, mvpName, teamA, teamB, goals });
  }

  async function onCopyLink() {
    const url =
      publicShareUrl ||
      (typeof window !== "undefined" ? `${window.location.origin}/r/${match.id}` : "");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4 py-2">
      <div className="recap-header">MATCH TERMINÉ</div>

      <div className="recap-hero">
        <div className="recap-teams">
          <div className="recap-team-name A">{match.teamAName.toUpperCase()}</div>
          <div className="recap-team-name B">{match.teamBName.toUpperCase()}</div>
        </div>
        <div className="recap-score">
          <span className={`score-num ${winA ? "win" : winB ? "lose" : ""}`}>
            {match.scoreA}
          </span>
          <span className="score-sep">:</span>
          <span className={`score-num ${winB ? "win" : winA ? "lose" : ""}`}>
            {match.scoreB}
          </span>
        </div>
        <div className="mt-2 text-center text-xs uppercase tracking-widest text-[color:var(--ink-2)]">
          {new Date(match.playedAt).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
        </div>
      </div>

      {mvpName && (
        <div className="mvp-pill">
          ⭐ MVP — <strong>{mvpName}</strong>
        </div>
      )}

      {showLiveResumeLink && (
        <Link
          href={`/matches/${match.id}/live`}
          className="block rounded-lg bg-[color:var(--a-500)] px-4 py-3 text-center font-bold text-white"
        >
          Reprendre le match en cours →
        </Link>
      )}

      <div>
        <div className="section-title">Chronologie</div>
        {goals.length === 0 ? (
          <div className="muted pad">Aucun but.</div>
        ) : (
          <div className="timeline">
            {goals.map((g) => (
              <div key={g.id} className={`timeline-row ${g.team}`}>
                <span className="timeline-minute">
                  {g.minute != null ? `${g.minute}'` : "—"}
                </span>
                <span className="timeline-ball">⚽</span>
                <span className="timeline-scorer">{g.scorerName}</span>
                {g.assistName && (
                  <span className="timeline-assist">(p. {g.assistName})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {scorers.length > 0 && (
        <div>
          <div className="section-title">Buteurs</div>
          <div className="event-list">
            {scorers.map((p, i) => (
              <div key={p.id} className="ev">
                <span>
                  <span className="podium-medal">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "·"}
                  </span>{" "}
                  <span className={`tag ${p.team}`}>
                    {p.team === "A" ? match.teamAName : match.teamBName}
                  </span>{" "}
                  {p.name}
                </span>
                <strong className="goal-dots">
                  {"•".repeat(Math.min(goalCount[p.id], 5))}
                  {goalCount[p.id] > 5 ? ` +${goalCount[p.id] - 5}` : ""}
                </strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {assisters.length > 0 && (
        <div>
          <div className="section-title">Passes décisives</div>
          <div className="event-list">
            {assisters.map((p) => (
              <div key={p.id} className="ev">
                <span>{p.name}</span>
                <strong>{assistCount[p.id]}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {showActions && (
        <>
          <div className="flex gap-2">
            <button onClick={onShareImage} className="btn ghost big flex-1">
              📤 Partager image
            </button>
            <button onClick={onCopyLink} className="btn ghost big flex-1">
              {copied ? "✓ Lien copié" : "🔗 Copier lien"}
            </button>
          </div>
          {onRematch && (
            <button onClick={onRematch} className="btn primary big w-full">
              🔄 Rematch
            </button>
          )}
        </>
      )}
    </div>
  );
}
