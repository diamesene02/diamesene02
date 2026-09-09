import { jourLong } from "./dates";

/// Ce qu'on tape à la main dans le groupe WhatsApp le mardi matin, et qu'on
/// ne tape jamais.
///
/// La composition vivait dans la page de la soirée. L'app mobile en a besoin
/// aussi — c'est même là qu'elle sert le plus, puisqu'on partage depuis le
/// téléphone. Deux implémentations, ce serait deux mots différents pour la
/// même soirée selon l'endroit d'où on le copie.

/// Les buteurs d'un camp, comptés et mis en forme : « Bilal ×2, Karim (csc) ».
///
/// Camp par camp, jamais tous ensemble : « Karim ×3, Momo ×2, Diame » sous un
/// 5-1 laisse croire que les trois ont marqué pour le même camp. Le score dit
/// déjà qui est à gauche.
export function buteursDuCamp(
  evenements: { team: string; type: string; player?: { name: string } | null }[],
  camp: "A" | "B",
): string {
  const compte = new Map<string, number>();
  for (const e of evenements) {
    if (e.team !== camp) continue;
    const nom = e.player?.name ?? "?";
    const cle = e.type === "OWN_GOAL" ? `${nom} (csc)` : nom;
    compte.set(cle, (compte.get(cle) ?? 0) + 1);
  }
  return [...compte].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ");
}

export type EntreeMot = {
  nomA: string;
  nomB: string;
  scoreA: number;
  scoreB: number;
  buteursA: string;
  buteursB: string;
};

export function motDeLaSoiree(input: {
  date: Date;
  lieu: string | null;
  nomA: string;
  nomB: string;
  victoiresA: number;
  victoiresB: number;
  nuls: number;
  matchs: EntreeMot[];
  buts: number;
  meilleurButeur: { nom: string; buts: number } | null;
  hommeDuMatch: { nom: string } | null;
}): string | null {
  if (input.matchs.length === 0) return null;

  const l: string[] = [];
  l.push(`${jourLong(input.date)}${input.lieu ? ` — ${input.lieu}` : ""}`);
  l.push("");

  const { victoiresA: va, victoiresB: vb, nuls } = input;
  const suffixeNuls = nuls > 0 ? ` (${nuls} nul${nuls > 1 ? "s" : ""})` : "";
  if (va !== vb) {
    const gagnant = va > vb ? input.nomA : input.nomB;
    l.push(
      `${gagnant} gagne la soirée ${Math.max(va, vb)}-${Math.min(va, vb)}${suffixeNuls}`,
    );
  } else {
    l.push(`Soirée partagée ${va}-${vb}${suffixeNuls}`);
  }
  l.push("");

  input.matchs.forEach((m, i) => {
    l.push(`Match ${i + 1} : ${m.nomA} ${m.scoreA} - ${m.scoreB} ${m.nomB}`);
    if (m.buteursA) l.push(`  ${m.nomA} : ${m.buteursA}`);
    if (m.buteursB) l.push(`  ${m.nomB} : ${m.buteursB}`);
  });
  l.push("");

  const fin: string[] = [`${input.buts} but${input.buts > 1 ? "s" : ""} dans la soirée`];
  if (input.meilleurButeur) {
    fin.push(`meilleur buteur ${input.meilleurButeur.nom} (${input.meilleurButeur.buts})`);
  }
  if (input.hommeDuMatch) fin.push(`homme du match ${input.hommeDuMatch.nom}`);
  l.push(fin.join(" · "));

  return l.join("\n");
}
