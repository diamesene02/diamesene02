"use client";

import Link from "next/link";
import { useState } from "react";
import { shareMatchImage } from "@/lib/shareCard";
import Icon from "@/components/Icon";
import Panneau from "@/components/Panneau";

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
  club,
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
  /// Nom et chasubles du club : la carte partagée se dessine avec ses
  /// couleurs, jamais avec une palette codée.
  club?: { name: string; colorA: string | null; colorB: string | null };
}) {
  const [copied, setCopied] = useState(false);

  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;

  const goalCount: Record<string, number> = {};
  goals.forEach((g) => {
    goalCount[g.scorerId] = (goalCount[g.scorerId] ?? 0) + 1;
  });

  // La chronologie doit être CHRONOLOGIQUE. Les buts arrivent ordonnés par
  // date de saisie : c'est le bon ordre pendant le match, et le mauvais dès
  // qu'on rattrape un but oublié — saisi en dernier, il se rangeait à la fin
  // alors qu'il s'est joué à la 3e minute.
  //
  // Un but sans minute (l'horloge n'a pas tourné) hérite de la minute du but
  // qui le précède : il reste là où on l'a saisi au lieu d'être renvoyé au
  // coup d'envoi.
  const ordonnes = (() => {
    let derniere = 0;
    const avecCle = goals.map((g, i) => {
      if (g.minute != null) derniere = g.minute;
      return { g, cle: derniere, i };
    });
    return avecCle
      .sort((x, y) => x.cle - y.cle || x.i - y.i)
      .map((x) => x.g);
  })();

  const all = [...teamA, ...teamB];

  // « Doublé de Diame · Triplé de Karim »
  //
  // Il y avait DEUX sections sous le score : une chronologie qui listait
  // chaque but avec sa minute et son buteur, puis un classement des buteurs
  // qui relistait les mêmes noms avec un « 1 » à côté. Sur un match à cinq
  // buts de cinq joueurs différents, la seconde ne disait pas un mot de plus
  // que la première — elle doublait l'écran pour rien.
  //
  // Ce qu'un classement de buteurs apporte VRAIMENT, la chronologie ne le
  // donne pas d'un coup d'œil : qui a marqué plusieurs fois. Donc cette ligne
  // n'existe QUE s'il y a un fait à dire. Sinon, rien — la chronologie suffit.
  const exploits = all
    .filter((p) => (goalCount[p.id] ?? 0) > 1)
    .sort((a, b) => goalCount[b.id] - goalCount[a.id])
    .map((p) => {
      const n = goalCount[p.id];
      if (n === 2) return `Doublé de ${p.name}`;
      if (n === 3) return `Triplé de ${p.name}`;
      return `${p.name}, ${n} buts`;
    });

  const dateLabel = new Date(match.playedAt).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const publicUrl =
    publicShareUrl ||
    (typeof window !== "undefined" ? `${window.location.origin}/r/${match.id}` : "");

  async function onShareImage() {
    try {
      await shareMatchImage({ match, mvpName, teamA, teamB, goals, club }, publicUrl);
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
    <div className="space-y-6 py-2">
      {/* Le panneau porte tout ce qui situe le match : date, buts, homme du
          match. Il y avait au-dessus une ligne « MATCH TERMINÉ » en capitales
          tracées — la bande élargie du vainqueur le dit déjà — puis la date
          centrée dans un bandeau gris, puis la pastille MVP encadrée d'or.
          Trois objets pour trois faits qui tiennent sous le score. */}
      <Panneau
        a={match.teamAName}
        b={match.teamBName}
        scoreA={match.scoreA}
        scoreB={match.scoreB}
        taille="panneau"
        fini={match.status === "FINISHED"}
        pied={
          <span className="synthese">
            <span className="capitalize">{dateLabel}</span>
            <span className="synthese-sep">·</span>
            <span>
              <b>{goals.length}</b> but{goals.length > 1 ? "s" : ""}
            </span>
            {mvpName && (
              <>
                <span className="synthese-sep">·</span>
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ color: "var(--gold)" }}
                >
                  <Icon name="star" size={12} filled />
                  {mvpName}
                </span>
              </>
            )}
          </span>
        }
      />

      {exploits.length > 0 && (
        <div className="synthese">
          {exploits.map((t, i) => (
            <span key={t} className="contents">
              {i > 0 && <span className="synthese-sep">·</span>}
              <span>{t}</span>
            </span>
          ))}
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

      <div className="bande">
        <div className="bande-titre">
          <span className="kicker">La chronologie</span>
        </div>
        {goals.length === 0 ? (
          <div className="muted pad">Aucun but.</div>
        ) : (
          <div className="timeline">
            {ordonnes.map((g) => (
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
