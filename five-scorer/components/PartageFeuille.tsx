"use client";

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

// Gabarit provisoire : remplacé par l'écran de partage.
export default function PartageFeuille({ open, onClose }: PartageProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
      <button type="button" className="verre" onClick={onClose}>
        Fermer
      </button>
    </div>
  );
}
