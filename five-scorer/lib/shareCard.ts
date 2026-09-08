// La carte de match — l'objet qu'on poste dans le groupe à 23h14.
//
// C'est là qu'est le wow d'un club amateur : pas sur le téléphone du marqueur,
// mais quinze minutes plus tard, quand quinze personnes voient la même image.
// C'est la MÊME carte que celle affichée dans la feuille « Partager le récap »
// (maquette tour 4) : fond de match sombre avec le grain et les halos aux
// couleurs des deux chasubles, le club en tête, le score lourd avec le
// perdant grisé, les écussons ronds, les buteurs avec leurs minutes, l'homme
// du match et le lien public en pied.

import { DEFAULT_BIB_A, DEFAULT_BIB_B } from "./color";
import { crest, lum, mix, normaliseCouleur, rgba } from "./theme";

type Player = { id: string; name: string; goals: number; team: "A" | "B" };
type Goal = {
  id: string;
  scorerId: string;
  team: "A" | "B";
  minute: number | null;
  createdAt: string;
  scorerName?: string;
};
type Match = {
  playedAt: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
};
export type ClubCarte = {
  name: string;
  colorA: string | null;
  colorB: string | null;
};

// 1080 × 1350 : le 4/5 d'Instagram et de WhatsApp. La maquette dessine la
// carte à 330 px de large ; tout est mis à l'échelle ×3,27.
const W = 1080;
const H = 1350;
const K = W / 330;
const FONT = '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

function police(ctx: CanvasRenderingContext2D, poids: number, taille: number) {
  ctx.font = `${poids} ${Math.round(taille)}px ${FONT}`;
}

function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/// L'écusson : le dégradé radial de la maquette, la lettre au centre.
function ecusson(ctx: CanvasRenderingContext2D, x: number, y: number, d: number, couleur: string, lettre: string) {
  const r = d / 2;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r);
  g.addColorStop(0, mix(couleur, "#ffffff", 0.32));
  g.addColorStop(0.55, couleur);
  g.addColorStop(1, mix(couleur, "#000000", 0.28));
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.4)";
  ctx.shadowBlur = 18 * K * 0.5;
  ctx.shadowOffsetY = 6 * K * 0.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r - 2 * K, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,.3)";
  ctx.lineWidth = 4 * K;
  ctx.stroke();
  police(ctx, 800, d * 0.4);
  ctx.fillStyle = lum(couleur) > 0.72 ? "#111" : "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(lettre, x, y + d * 0.02);
  ctx.textBaseline = "alphabetic";
}

/// « Karim 3′, 11′, 15′ » par camp, dans l'ordre du match.
function buteurs(goals: Goal[], joueurs: Player[], match: Match, t: "A" | "B") {
  const parId = new Map(joueurs.map((p) => [p.id, p.name]));
  const out: { nom: string; mins: string[] }[] = [];
  for (const g of goals.filter((g) => g.team === t)) {
    const nom =
      (g.scorerId && parId.get(g.scorerId)) ||
      g.scorerName ||
      `csc de ${g.team === "B" ? match.teamAName : match.teamBName}`;
    const s = out.find((x) => x.nom === nom);
    const m = g.minute != null ? `${g.minute}′` : "";
    if (s) s.mins.push(m);
    else out.push({ nom, mins: [m] });
  }
  return out.slice(0, 5);
}

export function contexteCarte(playedAt: string): string {
  const d = new Date(playedAt);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export async function renderShareCard({
  match,
  teamA,
  teamB,
  goals,
  mvpName,
  club,
  contexte,
  publicUrl,
}: {
  match: Match;
  teamA: Player[];
  teamB: Player[];
  goals: Goal[];
  mvpName?: string | null;
  club?: ClubCarte;
  contexte?: string;
  publicUrl?: string;
}): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const A = normaliseCouleur(club?.colorA, DEFAULT_BIB_A);
  const B = normaliseCouleur(club?.colorB, DEFAULT_BIB_B);
  const aGagne = match.scoreA > match.scoreB;
  const bGagne = match.scoreB > match.scoreA;

  // Le fond de match : dégradé profond, halos de chasuble, grain.
  arrondi(ctx, 0, 0, W, H, 26 * K);
  ctx.clip();
  const fond = ctx.createLinearGradient(0, 0, 0, H);
  fond.addColorStop(0, "#0b0b12");
  fond.addColorStop(1, "#1b1c36");
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, W, H);
  const halo = (cx: number, couleur: string, a: number) => {
    const g = ctx.createRadialGradient(cx, H * 0.4, 0, cx, H * 0.4, W * 0.7);
    g.addColorStop(0, rgba(couleur, a));
    g.addColorStop(0.7, rgba(couleur, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  halo(0, A, 0.34);
  halo(W, B, 0.36);
  ctx.fillStyle = "rgba(255,255,255,.06)";
  for (let y = 0; y < H; y += 5 * K) for (let x = 0; x < W; x += 5 * K) ctx.fillRect(x, y, 2.6, 2.6);

  const P = 22 * K;
  // En-tête : l'écusson du club, son nom, le contexte à droite.
  ecusson(ctx, P + 13 * K, P + 13 * K, 26 * K, A, (club?.name ?? "F").trim()[0]?.toUpperCase() ?? "F");
  police(ctx, 600, 15 * K);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText(club?.name ?? "Five Scorer", P + 34 * K, P + 18.5 * K);
  police(ctx, 400, 13 * K);
  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.textAlign = "right";
  ctx.fillText(contexte ?? contexteCarte(match.playedAt), W - P, P + 18 * K);

  // Le score lourd, condensé par transformation, perdant à 40 %.
  const yScore = 505 * K / K * 1 + 0; // ligne de base des chiffres
  const S = 110 * K;
  const yBase = 470;
  const dessineChiffre = (n: number, cx: number, perd: boolean) => {
    ctx.save();
    ctx.translate(cx, yBase);
    ctx.scale(0.86, 1);
    police(ctx, 800, S);
    ctx.textAlign = "center";
    ctx.fillStyle = perd ? "rgba(255,255,255,.4)" : "#fff";
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  };
  void yScore;
  dessineChiffre(match.scoreA, W * 0.27, bGagne);
  dessineChiffre(match.scoreB, W * 0.73, aGagne);
  police(ctx, 600, 13 * K);
  ctx.fillStyle = "rgba(255,255,255,.6)";
  ctx.textAlign = "center";
  ctx.fillText("Terminé", W / 2, yBase - S * 0.3);

  // Écussons et noms.
  const yEc = yBase + 80 * K * 0.5;
  ecusson(ctx, W * 0.27, yEc, 56 * K, A, match.teamAName.trim()[0]?.toUpperCase() ?? "A");
  ecusson(ctx, W * 0.73, yEc, 56 * K, B, match.teamBName.trim()[0]?.toUpperCase() ?? "B");
  police(ctx, 600, 17 * K);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(match.teamAName, W * 0.27, yEc + 28 * K + 20 * K);
  ctx.fillText(match.teamBName, W * 0.73, yEc + 28 * K + 20 * K);

  // Les buteurs, deux colonnes.
  const bA = buteurs(goals, [...teamA, ...teamB], match, "A");
  const bB = buteurs(goals, [...teamA, ...teamB], match, "B");
  let y = yEc + 28 * K + 20 * K + 34 * K;
  police(ctx, 400, 13 * K);
  const ligne = (b: { nom: string; mins: string[] }, x: number, droite: boolean) => {
    const mins = b.mins.filter(Boolean).join(", ");
    ctx.textAlign = droite ? "right" : "left";
    ctx.fillStyle = "#fff";
    if (droite) {
      const wm = mins ? ctx.measureText(" " + mins).width : 0;
      ctx.fillText(b.nom, x - wm, y);
      ctx.fillStyle = "rgba(255,255,255,.5)";
      if (mins) ctx.fillText(" " + mins, x, y);
    } else {
      ctx.fillText(b.nom, x, y);
      const wn = ctx.measureText(b.nom + " ").width;
      ctx.fillStyle = "rgba(255,255,255,.5)";
      if (mins) ctx.fillText(mins, x + wn, y);
    }
  };
  const n = Math.max(bA.length, bB.length);
  for (let i = 0; i < n; i++) {
    if (bA[i]) ligne(bA[i], P, false);
    if (bB[i]) ligne(bB[i], W - P, true);
    y += 20 * K;
  }

  // Le pied : un filet, l'homme du match à gauche, le lien à droite.
  const yPied = H - P - 14 * K;
  ctx.fillStyle = "rgba(255,255,255,.14)";
  ctx.fillRect(P, yPied - 22 * K, W - 2 * P, 1 * K);
  police(ctx, 400, 13 * K);
  ctx.textAlign = "left";
  if (mvpName) {
    ctx.fillStyle = "#ffd60a";
    ctx.fillText("★", P, yPied);
    ctx.fillStyle = "#fff";
    ctx.fillText(`Homme du match · ${mvpName}`, P + 22 * K, yPied);
  }
  if (publicUrl) {
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillText(publicUrl.replace(/^https?:\/\//, ""), W - P, yPied);
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export async function shareMatchImage(
  data: Parameters<typeof renderShareCard>[0],
  publicUrl?: string,
): Promise<void> {
  const blob = await renderShareCard({ ...data, publicUrl: data.publicUrl ?? publicUrl });
  if (!blob) return;
  const file = new File([blob], `five-scorer-${Date.now()}.png`, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[]; url?: string; text?: string }) => boolean;
  };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Match" });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  if (publicUrl && nav.canShare && nav.canShare({ url: publicUrl })) {
    try {
      await navigator.share({ title: "Match", url: publicUrl });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  await telechargerImage(blob, file.name);
}

/// Enregistrer : le PNG part dans les téléchargements (ou s'ouvre, sur les
/// navigateurs qui refusent le téléchargement déclenché par script).
export async function telechargerImage(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
