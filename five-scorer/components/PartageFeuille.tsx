"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { lettre } from "@/lib/ini";
import { renderShareCard, shareMatchImage, telechargerImage } from "@/lib/shareCard";
import Ecusson from "@/components/ios/Ecusson";

// La feuille « Partager le récap » : la carte de partage 4/5 aux couleurs du
// club, et trois actions — Partager l'image, Enregistrer, Copier le lien.
//
// Interface figée entre le récap (qui l'ouvre) et le partage (qui la dessine).
export type PartageProps = {
  open: boolean;
  onClose: () => void;
  match: {
    id: string;
    playedAt: string;
    teamAName: string;
    teamBName: string;
    scoreA: number;
    scoreB: number;
    status: "LIVE" | "FINISHED";
    mvpId: string | null;
  };
  mvpName: string | null;
  teamA: { id: string; name: string; goals: number; team: "A" | "B" }[];
  teamB: { id: string; name: string; goals: number; team: "A" | "B" }[];
  goals: {
    id: string;
    scorerId: string;
    team: "A" | "B";
    minute: number | null;
    createdAt: string;
    scorerName: string;
  }[];
  club?: { name: string; colorA: string | null; colorB: string | null };
  publicUrl: string;
  /// Libellé de contexte, ex. « Lun. 7 sept. · Match 1 ».
  contexte?: string;
};

export default function PartageFeuille({
  open,
  onClose,
  match,
  mvpName,
  teamA,
  teamB,
  goals,
  club,
  publicUrl,
  contexte,
}: PartageProps) {
  const [etat, setEtat] = useState<string | null>(null);
  if (!open) return null;

  const winA = match.scoreA > match.scoreB;
  const winB = match.scoreB > match.scoreA;
  const buteurs = (t: "A" | "B") => {
    const out: { nom: string; mins: string[] }[] = [];
    for (const g of goals.filter((g) => g.team === t)) {
      const s = out.find((x) => x.nom === g.scorerName);
      const m = g.minute != null ? `${g.minute}′` : "";
      if (s) s.mins.push(m);
      else out.push({ nom: g.scorerName, mins: [m] });
    }
    return out.slice(0, 5);
  };
  const bA = buteurs("A");
  const bB = buteurs("B");
  const donnees = { match, teamA, teamB, goals, mvpName, club, contexte, publicUrl };
  const lienCourt = publicUrl.replace(/^https?:\/\//, "");

  const partager = async () => {
    setEtat(null);
    try {
      await shareMatchImage(donnees, publicUrl);
    } catch {
      setEtat("Le partage a échoué.");
    }
  };
  const enregistrer = async () => {
    setEtat(null);
    const blob = await renderShareCard(donnees);
    if (!blob) return setEtat("Impossible de dessiner l'image.");
    await telechargerImage(blob, `five-scorer-${match.id}.png`);
    setEtat("Image enregistrée.");
  };
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setEtat("Lien copié.");
    } catch {
      prompt("Lien du match :", publicUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col" style={{ background: "var(--bg)", color: "var(--ink)" }} role="dialog" aria-modal="true" aria-label="Partager le récap">
      <div className="grabber" />
      <div className="flex items-center justify-between px-[14px] pt-2">
        <button type="button" onClick={onClose} className="verre">
          Fermer
        </button>
        <span className="text-[17px] font-semibold">Partager le récap</span>
        <span style={{ width: 80 }} />
      </div>

      <div className="flex flex-1 items-center justify-center px-[30px] pt-4">
        <div
          className="fond-match relative flex w-full flex-col overflow-hidden"
          style={{ aspectRatio: "4 / 5", borderRadius: 26, padding: "22px 22px 18px", boxShadow: "0 30px 60px rgba(0,0,0,.45)", background: "radial-gradient(rgba(255,255,255,.06) .8px,transparent 1.3px) 0 0/5px 5px,radial-gradient(70% 50% at 0% 40%,var(--taH),transparent 70%),radial-gradient(70% 50% at 100% 40%,var(--tbH),transparent 70%),linear-gradient(180deg,#0b0b12,#1b1c36)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              <Ecusson camp="A" lettre={lettre(club?.name ?? "F")} taille={26} style={{ borderRadius: 7 }} />
              {club?.name ?? "Five Scorer"}
            </div>
            <span className="text-[13px]" style={{ color: "rgba(255,255,255,.6)" }}>
              {contexte}
            </span>
          </div>
          <div className="mt-auto grid items-center" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
            <div className={cn("text-center text-[110px] font-extrabold leading-none tracking-[-.05em]")} style={{ color: winB ? "rgba(255,255,255,.4)" : "#fff" }}>
              <span className="score-lourd">{match.scoreA}</span>
            </div>
            <div className="px-1.5 text-[13px] font-semibold" style={{ color: "rgba(255,255,255,.6)" }}>
              Terminé
            </div>
            <div className="text-center text-[110px] font-extrabold leading-none tracking-[-.05em]" style={{ color: winA ? "rgba(255,255,255,.4)" : "#fff" }}>
              <span className="score-lourd">{match.scoreB}</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2">
            <div className="flex flex-col items-center gap-1.5">
              <Ecusson camp="A" lettre={lettre(match.teamAName)} taille={56} />
              <span className="text-[17px] font-semibold">{match.teamAName}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Ecusson camp="B" lettre={lettre(match.teamBName)} taille={56} />
              <span className="text-[17px] font-semibold">{match.teamBName}</span>
            </div>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-3 text-[13px] leading-[1.5]">
            <div>
              {bA.map((b) => (
                <div key={b.nom}>
                  {b.nom} <span style={{ color: "rgba(255,255,255,.5)" }}>{b.mins.filter(Boolean).join(", ")}</span>
                </div>
              ))}
            </div>
            <div className="text-right">
              {bB.map((b) => (
                <div key={b.nom}>
                  {b.nom} <span style={{ color: "rgba(255,255,255,.5)" }}>{b.mins.filter(Boolean).join(", ")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between pt-3.5 text-[13px]" style={{ borderTop: "1px solid rgba(255,255,255,.14)" }}>
            <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
              {mvpName && (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffd60a" aria-hidden>
                    <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
                  </svg>
                  Homme du match · {mvpName}
                </>
              )}
            </span>
            <span className="ml-2 max-w-[48%] truncate" style={{ color: "rgba(255,255,255,.5)" }}>{lienCourt}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-[14px] pb-[calc(var(--safe-b)+40px)] pt-4">
        <button type="button" onClick={partager} className="plein">
          Partager l&apos;image
        </button>
        <div className="flex gap-2.5">
          <button type="button" onClick={enregistrer} className="verre grand flex-1">
            Enregistrer
          </button>
          <button type="button" onClick={copier} className="verre grand flex-1">
            Copier le lien
          </button>
        </div>
        {etat && <p className="text-center text-[13px]" style={{ color: "var(--i2)" }}>{etat}</p>}
      </div>
    </div>
  );
}
