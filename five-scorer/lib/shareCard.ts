// La carte de match — l'objet qu'on poste dans le groupe à 23h14.
//
// C'est là qu'est le wow d'un club amateur : pas sur le téléphone du marqueur,
// mais quinze minutes plus tard, quand quinze personnes voient la même image
// et que le perdant la voit aussi. Une seule grammaire, la même que le
// panneau de l'app : deux bandes de chasuble pleine hauteur aux bords, un
// chiffre géant en chasse 62 %, un filet de craie, une phrase calculée.
//
// La bande PORTE LE RÉSULTAT : 194 px pour le vainqueur, 65 px pour le
// perdant, 108/108 pour un nul. On sait qui a gagné à trois mètres, avant de
// lire le score — et ça survit au daltonisme, au noir et blanc, à une vignette
// de 80 px. Le fond est toujours le gazon : la chasuble ne porte jamais de
// texte (mesuré : elle plafonne à Lc 43-50), elle est punaisée sur le noir.
//
// Aucun dégradé, aucune ombre, aucun emoji, aucune pilule, aucun logo. Ce qui
// distingue cette carte d'un gabarit « Full Time », c'est la DONNÉE : la
// largeur de bande, les minutes des buts, une phrase qui n'existe que si le
// fait est vrai.

import { bibTheme, inkVariant } from "./color";

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

const W = 1080;
const H = 1350;
const PITCH0 = "#0e1211";
const INK1 = "#f4f6f3";
const INK2 = "#c8cfcb";
const INK3 = "#adb5b2";
const RULE = "#2c3532";
const GOLD = "#ffc24d";

/// Largeur de bande = résultat. Sur 1080 : 10 % au repos.
const BANDE = { repos: 108, vainqueur: 194, perdant: 65 };
const MARGE = 48;

type Chasse = "extra-condensed" | "condensed" | "semi-condensed" | "normal";

// Le raccourci `font` du canvas accepte la chasse par MOT-CLÉ seulement ; un
// pourcentage y est ignoré en silence — c'est ainsi que l'ancienne carte se
// dessinait en chasse normale sans que rien ne le dise. On pose aussi la
// propriété dédiée, plus récente et plus sûre.
function police(
  ctx: CanvasRenderingContext2D,
  poids: number,
  taille: number,
  chasse: Chasse = "normal",
) {
  ctx.font = `${poids} ${chasse} ${taille}px "Archivo", system-ui, sans-serif`;
  const c = ctx as CanvasRenderingContext2D & { fontStretch?: string };
  if ("fontStretch" in c) c.fontStretch = chasse;
}

async function chargerPolice() {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load('640 extra-condensed 100px "Archivo"'),
      document.fonts.load('600 condensed 60px "Archivo"'),
      document.fonts.load('600 semi-condensed 60px "Archivo"'),
      document.fonts.load('700 34px "Archivo"'),
      document.fonts.load('500 44px "Archivo"'),
    ]);
  } catch {
    // la police système prendra le relais : la carte reste juste, moins belle.
  }
}

function contexte(playedAt: string): string {
  const d = new Date(playedAt);
  const jour = d
    .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })
    .replace(".", "")
    .toUpperCase();
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} · ${heure}`;
}

/// La phrase n'existe que si le fait existe. Aucun adjectif, jamais de ligne
/// vide, jamais de « quelle soirée ». Des rangs, des écarts, des séries.
function phraseCalculee(
  match: Match,
  buteurs: { id: string; name: string; count: number }[],
): string | null {
  // Un csc anonyme n'est pas un buteur : la phrase ne nomme qu'un joueur.
  const meilleur = buteurs.find((b) => !b.id.startsWith("csc-"));
  if (meilleur && meilleur.count >= 2) return `${meilleur.name}, ${meilleur.count} buts`;
  const ecart = Math.abs(match.scoreA - match.scoreB);
  if (ecart >= 3) return `${ecart} buts d'écart`;
  if (match.scoreA === match.scoreB) return "Match nul";
  return null;
}

export async function renderShareCard({
  match,
  teamA,
  teamB,
  goals,
  mvpName,
  club,
}: {
  match: Match;
  teamA: Player[];
  teamB: Player[];
  goals: Goal[];
  mvpName?: string | null;
  club?: ClubCarte;
}): Promise<Blob | null> {
  await chargerPolice();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const t = bibTheme(club?.colorA, club?.colorB);
  const encreA = inkVariant(t.aSlab, PITCH0);
  const encreB = inkVariant(t.bSlab, PITCH0);
  const aGagne = match.scoreA > match.scoreB;
  const bGagne = match.scoreB > match.scoreA;
  const wA = aGagne ? BANDE.vainqueur : bGagne ? BANDE.perdant : BANDE.repos;
  const wB = bGagne ? BANDE.vainqueur : aGagne ? BANDE.perdant : BANDE.repos;

  // Le gazon, puis les deux bandes punaisées aux bords.
  ctx.fillStyle = PITCH0;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = t.aSlab;
  ctx.fillRect(0, 0, wA, H);
  // La bande B porte l'encoche — le seul discriminant qui survit à deux
  // chasubles sombres remontées au même gris. 50 px pleins, 10 px vides.
  ctx.fillStyle = t.bSlab;
  for (let y = 0; y < H; y += 60) ctx.fillRect(W - wB, y, wB, 50);

  const x0 = wA + MARGE;
  const x1 = W - wB - MARGE;
  const cx = (x0 + x1) / 2;

  // Filet de craie en tête, entre les bandes.
  ctx.fillStyle = INK1;
  ctx.fillRect(wA, 48, W - wA - wB, 6);

  // Contexte : l'unique ligne en capitales tracées de l'affiche.
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = INK3;
  police(ctx, 700, 34);
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = "4px";
  ctx.fillText(contexte(match.playedAt), x0, 130);
  if ("letterSpacing" in c) c.letterSpacing = "0px";

  // Codes d'équipe, à leur bord.
  police(ctx, 600, 62, "condensed");
  ctx.fillStyle = INK2;
  ctx.textAlign = "left";
  ctx.fillText(match.teamAName.toUpperCase(), x0, 240);
  ctx.textAlign = "right";
  ctx.fillText(match.teamBName.toUpperCase(), x1, 240);

  // LE SCORE — c'est lui la photo. 600 px, ou 480 dès qu'un score a deux
  // chiffres : mesuré, « 12 » et « 9 » ne tiennent pas entre les bandes à 600.
  const deuxChiffres = match.scoreA >= 10 || match.scoreB >= 10;
  const S = deuxChiffres ? 480 : 600;
  const hautChiffre = 300;
  const capHauteur = S * 0.72;
  const ligneBase = hautChiffre + capHauteur;
  police(ctx, 640, S, "extra-condensed");
  ctx.textAlign = "right";
  ctx.fillStyle = bGagne ? INK3 : INK1;
  ctx.fillText(String(match.scoreA), cx - 56, ligneBase);
  ctx.textAlign = "left";
  ctx.fillStyle = aGagne ? INK3 : INK1;
  ctx.fillText(String(match.scoreB), cx + 56, ligneBase);
  // L'axe médian, centré sur la hauteur des chiffres.
  const hAxe = Math.min(260, capHauteur);
  ctx.fillStyle = INK1;
  ctx.fillRect(cx - 3, hautChiffre + (capHauteur - hAxe) / 2, 6, hAxe);

  // Buteurs, triés. Un csc est un but : il figure, au nom de celui qui l'a
  // mis quand on le sait, sinon au nom du camp qui l'a concédé — sans ça un
  // match à trois csc se présentait presque vide.
  const compte: Record<string, number> = {};
  const libelle: Record<string, { name: string; team: "A" | "B" }> = {};
  const parNom = new Map(
    [...teamA, ...teamB].map((p) => [p.id, p] as const),
  );
  goals.forEach((g) => {
    const cle = g.scorerId || g.scorerName || `csc-${g.team}`;
    compte[cle] = (compte[cle] ?? 0) + 1;
    if (!libelle[cle]) {
      const j = g.scorerId ? parNom.get(g.scorerId) : undefined;
      libelle[cle] = j
        ? { name: j.name, team: j.team }
        : {
            name:
              g.scorerName ??
              `csc de ${g.team === "B" ? match.teamAName : match.teamBName}`,
            // Un csc est crédité à `g.team` ; son auteur est dans l'autre camp.
            team: g.team === "A" ? "B" : "A",
          };
    }
  });
  const buteurs = Object.keys(compte)
    .map((cle) => ({ id: cle, ...libelle[cle], count: compte[cle] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  let y = ligneBase + 96;

  // La phrase calculée — ou rien.
  const phrase = phraseCalculee(match, buteurs);
  if (phrase) {
    police(ctx, 600, 72, "semi-condensed");
    ctx.fillStyle = INK1;
    ctx.textAlign = "left";
    ctx.fillText(phrase, x0, y);
    y += 88;
  }

  // Les rangées de buteurs : minute sourde, nom en encre de camp, code au bord.
  ctx.textAlign = "left";
  for (const p of buteurs) {
    const minutes = goals
      .filter(
        (g) =>
          (g.scorerId || g.scorerName || `csc-${g.team}`) === p.id &&
          g.minute != null,
      )
      .map((g) => `${g.minute}'`)
      .join(" ");
    police(ctx, 500, 40);
    ctx.fillStyle = INK3;
    ctx.fillText(minutes || "—", x0, y);
    police(ctx, 600, 46, "semi-condensed");
    ctx.fillStyle = p.team === "A" ? encreA : encreB;
    ctx.fillText(p.name, x0 + 200, y);
    police(ctx, 500, 36, "condensed");
    ctx.fillStyle = INK3;
    ctx.textAlign = "right";
    ctx.fillText(
      `${p.count} · ${(p.team === "A" ? match.teamAName : match.teamBName).toUpperCase()}`,
      x1,
      y,
    );
    ctx.textAlign = "left";
    y += 60;
  }

  // Joueur du match : un filet d'or sous le nom, jamais une pastille.
  if (mvpName) {
    y += 24;
    police(ctx, 700, 34);
    ctx.fillStyle = INK3;
    ctx.fillText("JOUEUR DU MATCH", x0, y);
    y += 56;
    police(ctx, 600, 46, "semi-condensed");
    ctx.fillStyle = INK1;
    ctx.fillText(mvpName, x0, y);
    const largeur = ctx.measureText(mvpName).width;
    ctx.fillStyle = GOLD;
    ctx.fillRect(x0, y + 10, largeur, 3);
  }

  // La frise : un axe, une coche par but, A au-dessus, B en dessous. Huit
  // matchs se liraient comme un seul graphique de momentum ; ici, un match.
  const yAxe = H - 190;
  ctx.fillStyle = RULE;
  ctx.fillRect(x0, yAxe, x1 - x0, 2);
  const minutes = goals.map((g) => g.minute).filter((m): m is number => m != null);
  const duree = Math.max(40, ...minutes.map((m) => m + 2));
  goals.forEach((g, i) => {
    const frac =
      g.minute != null ? g.minute / duree : (i + 1) / (goals.length + 1);
    const x = Math.round(x0 + (x1 - x0) * frac);
    if (g.team === "A") {
      ctx.fillStyle = t.aSlab;
      ctx.fillRect(x - 3, yAxe - 26, 6, 24);
    } else {
      ctx.fillStyle = t.bSlab;
      ctx.fillRect(x - 3, yAxe + 4, 6, 10);
      ctx.fillRect(x - 3, yAxe + 16, 6, 10);
    }
  });

  // Signature : le club, en bas à gauche. Pas de marque d'app — le lien s'en
  // charge.
  police(ctx, 700, 34);
  ctx.fillStyle = INK2;
  ctx.textAlign = "left";
  ctx.fillText(club?.name ?? "", x0, H - 72);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export async function shareMatchImage(
  data: Parameters<typeof renderShareCard>[0],
  publicUrl?: string,
): Promise<void> {
  const blob = await renderShareCard(data);
  if (!blob) return;
  const file = new File([blob], `five-scorer-${Date.now()}.png`, {
    type: "image/png",
  });
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
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
