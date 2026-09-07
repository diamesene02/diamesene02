"use client";

import Link from "next/link";
import { useState } from "react";
import { shareMatchImage } from "@/lib/shareCard";
import Icon from "@/components/Icon";

type Player = {
  id: string;
  name: string;
  goals: number;
  team: "A" | "B";
};

type Goal = {
  id: string;
  scorerId: string;
  team: "A" | "B";
  minute: number | null;
  createdAt: string;
  scorerName: string;
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
  liveHref,
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
  liveHref?: string;
  showActions?: boolean;
  onRematch?: () => void;
  publicShareUrl?: string;
}) {
  const [copied, setCopied] = useState(false);

  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;

  const goalCount: Record<string, number> = {};
  goals.forEach((g) => {
    goalCount[g.scorerId] = (goalCount[g.scorerId] ?? 0) + 1;
  });

  const all = [...teamA, ...teamB];
  const scorers = all
    .filter((p) => goalCount[p.id])
    .sort((a, b) => goalCount[b.id] - goalCount[a.id]);

  const publicUrl =
    publicShareUrl ||
    (typeof window !== "undefined" ? `${window.location.origin}/r/${match.id}` : "");

  async function onShareImage() {
    try {
      await shareMatchImage({ match, mvpName, teamA, teamB, goals }, publicUrl);
    } catch (e) {
      console.error("share image failed", e);
    }
  }

  async function onShareLink() {
    const nav = navigator as Navigator & {
      canShare?: (d: { url?: string; text?: string }) => boolean;
    };
    const title = `${match.teamAName} ${match.scoreA} — ${match.scoreB} ${match.teamBName}`;
    if (nav.canShare && nav.canShare({ url: publicUrl })) {
      try {
        await navigator.share({ title, text: title, url: publicUrl });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt("Lien du match :", publicUrl);
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
        <div className="mt-2 text-center text-xs  text-[color:var(--ink-3)]">
          {new Date(match.playedAt).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
        </div>
      </div>

      {mvpName && (
        <div className="mvp-pill">
          <Icon name="star" filled size={14} />
          MVP — <strong>{mvpName}</strong>
        </div>
      )}

      {showLiveResumeLink && (
        <Link
          href={liveHref ?? `/matches/${match.id}/live`}
          className="flex items-center justify-center gap-2 rounded-[2px] bg-[color:var(--ink-1)] px-4 py-3 text-center font-bold text-[color:var(--pitch-0)]"
        >
          Reprendre le match en cours
          <Icon name="chevron" size={14} />
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
                <Icon
                  name="ball"
                  size={14}
                  label="But"
                  className="timeline-ball shrink-0"
                />
                <span className="timeline-scorer">{g.scorerName}</span>
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
                  {/* Le rang se dit avec un chiffre tabulaire, pas une médaille. */}
                  <span className="podium-medal">{i + 1}</span>{" "}
                  <span className={`tag ${p.team}`}>
                    {p.team === "A" ? match.teamAName : match.teamBName}
                  </span>{" "}
                  {p.name}
                </span>
                <strong className="goal-count">{goalCount[p.id]}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {showActions && (
        <>
          <div className="flex gap-2">
            <button onClick={onShareLink} className="btn primary big flex-1">
              {copied ? (
                <>
                  <Icon name="check" size={16} />
                  Lien copié
                </>
              ) : (
 "Partager lien"
              )}
            </button>
            <button onClick={onShareImage} className="btn ghost big flex-1">
              Image
            </button>
          </div>
          {onRematch && (
            <button onClick={onRematch} className="btn ghost big w-full">
              Rematch
            </button>
          )}
        </>
      )}
    </div>
  );
}
