"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// Le classement, en rangées qui se déplient.
//
// C'était un tableau de treize colonnes larges de 640 px qu'on faisait
// défiler EN TRAVERS d'un écran de 375 : on ne pouvait jamais lire un joueur
// et son chiffre dans le même coup d'œil, et les en-têtes étaient en
// capitales tracées de 10 px. Ici, quatre colonnes tiennent sans défilement —
// joué, buts, pourcentage de victoires — et le reste se déplie SUR PLACE au
// tap. On échange la vue simultanée contre une vue lisible.

export type LigneClassement = {
  playerId: string;
  name: string;
  nickname: string | null;
  isGuest: boolean;
  matchesPlayed: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  wins: number;
  draws: number;
  losses: number;
  winPct: number;
  mvpCount: number;
  form: ("W" | "D" | "L")[];
  streak: number;
  elo: number;
  eloTrend: number;
};

/// Cinq carrés : plein pour une victoire, contour pour un nul, vide pour une
/// défaite. La forme se lit sans couleur — un daltonien la lit aussi.
function Forme({ form }: { form: ("W" | "D" | "L")[] }) {
  if (!form.length) return <span className="text-[color:var(--ink-3)]">—</span>;
  return (
    <span className="forme">
      {form.map((r, i) => (
        <span
          key={i}
          className={cn("forme-case", r === "W" && "v", r === "D" && "n")}
          title={r === "W" ? "Victoire" : r === "D" ? "Nul" : "Défaite"}
        />
      ))}
    </span>
  );
}

export default function Classement({
  slug,
  lignes,
  trackAssists,
  trackCards,
}: {
  slug: string;
  lignes: LigneClassement[];
  trackAssists: boolean;
  trackCards: boolean;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);

  return (
    <div>
      <div className="rangee-tete" style={{ ["--cols" as string]: 3 }}>
        <span />
        <span>Joueur</span>
        <span>J</span>
        <span>Buts</span>
        <span>%V</span>
      </div>
      {lignes.map((r, i) => {
        const estOuvert = ouvert === r.playerId;
        return (
          <div key={r.playerId}>
            <button
              type="button"
              onClick={() => setOuvert(estOuvert ? null : r.playerId)}
              aria-expanded={estOuvert}
              className="rangee"
              style={{ ["--cols" as string]: 3 }}
            >
              <span className="rangee-bande" aria-hidden />
              <span className="rangee-nom">
                <span className="rangee-rang">{i + 1}</span>
                {r.name}
                {r.isGuest && (
                  <span className="text-[color:var(--ink-3)]"> (inv.)</span>
                )}
              </span>
              <span className="rangee-num">{r.matchesPlayed}</span>
              <span className="rangee-num fort">{r.goals}</span>
              <span className="rangee-num">{r.winPct}</span>
            </button>
            {estOuvert && (
              <div className="rangee-detail">
                <div className="synthese">
                  <span>
                    <b>{r.wins}</b> V
                  </span>
                  <span className="synthese-sep">·</span>
                  <span>
                    <b>{r.draws}</b> N
                  </span>
                  <span className="synthese-sep">·</span>
                  <span>
                    <b>{r.losses}</b> D
                  </span>
                  <span className="synthese-sep">·</span>
                  <span>
                    Élo <b>{r.elo}</b>
                    {r.eloTrend !== 0 && (
                      <span
                        style={{
                          color:
                            r.eloTrend > 0 ? "var(--win)" : "var(--loss)",
                        }}
                      >
                        {" "}
                        {r.eloTrend > 0 ? "+" : "−"}
                        {Math.abs(r.eloTrend)}
                      </span>
                    )}
                  </span>
                  {r.mvpCount > 0 && (
                    <>
                      <span className="synthese-sep">·</span>
                      <span style={{ color: "var(--gold)" }}>
                        <b>{r.mvpCount}</b> fois homme du match
                      </span>
                    </>
                  )}
                  {trackAssists && r.assists > 0 && (
                    <>
                      <span className="synthese-sep">·</span>
                      <span>
                        <b>{r.assists}</b> passes
                      </span>
                    </>
                  )}
                  {trackCards && (r.yellow > 0 || r.red > 0) && (
                    <>
                      <span className="synthese-sep">·</span>
                      <span>
                        <span style={{ color: "var(--gold)" }}>{r.yellow}</span>
                        <span className="text-[color:var(--rule-hi)]">/</span>
                        <span style={{ color: "var(--loss)" }}>{r.red}</span>
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Forme form={r.form} />
                  {r.streak !== 0 && (
                    <span className="text-[13px] text-[color:var(--ink-3)]">
                      {r.streak > 0
                        ? `${r.streak} victoire${r.streak > 1 ? "s" : ""} d'affilée`
                        : `${Math.abs(r.streak)} défaite${
                            Math.abs(r.streak) > 1 ? "s" : ""
                          } d'affilée`}
                    </span>
                  )}
                  <Link
                    href={`/c/${slug}/players/${r.playerId}`}
                    className="ml-auto text-[13px] font-semibold text-[color:var(--ink-2)]"
                  >
                    Sa fiche →
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
