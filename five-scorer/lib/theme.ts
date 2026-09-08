// Le thème aux couleurs du club — port fidèle de `themeVars()` de la maquette
// (FSScreen.dc.html, tour 4).
//
// Le fond n'est plus un vert générique : il est CALCULÉ depuis les deux
// chasubles — chasuble A en haut, chasuble B en bas — en sombre comme en
// clair. Tout ce qui suit en découle : écussons, halos du live, barres de
// stats, anneaux des avatars. Changer les couleurs dans les réglages rhabille
// l'app entière sans une ligne de code en plus.

import { DEFAULT_BIB_A, DEFAULT_BIB_B, isValidHex, inkVariant } from "./color";

export type Theme = "dark" | "light";

function hex(c: string): [number, number, number] {
  let h = c.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/// Mélange linéaire de deux couleurs, t ∈ [0,1] vers b.
export function mix(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  return (
    "#" +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    ).join("")
  );
}

export function rgba(c: string, a: number): string {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
}

/// Luminance simple (Rec. 601) : suffit pour choisir blanc ou noir sur un
/// écusson.
export function lum(c: string): number {
  const [r, g, b] = hex(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/// L'écusson : un dégradé radial qui donne du volume à l'aplat.
export function crest(c: string): string {
  return `radial-gradient(circle at 35% 30%,${mix(c, "#ffffff", 0.32)},${c} 55%,${mix(c, "#000000", 0.28)})`;
}

export function normaliseCouleur(c: string | null | undefined, fallback: string) {
  if (!c || !isValidHex(c)) return fallback;
  const [r, g, b] = hex(c);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/// Les jetons du thème, sous forme d'objet — un jeton, une valeur.
export function themeTokens(
  colorA: string | null | undefined,
  colorB: string | null | undefined,
  theme: Theme,
): Record<string, string> {
  const A = normaliseCouleur(colorA, DEFAULT_BIB_A);
  const B = normaliseCouleur(colorB, DEFAULT_BIB_B);
  const light = theme === "light";

  const dots = light
    ? "radial-gradient(rgba(0,0,0,.035) .8px,transparent 1.3px) 0 0/5px 5px"
    : "radial-gradient(rgba(255,255,255,.05) .8px,transparent 1.3px) 0 0/5px 5px";
  // Le fond porte les deux chasubles — mais comme une TEINTE, pas comme deux
  // aplats. Il gardait 58 % de la première couleur en haut : un club en vert
  // et rouge obtenait une page verte qui virait bordeaux, deux blocs cousus
  // l'un à l'autre. Les couleurs sombres (noir, bleu marine) ne le montraient
  // pas, les couleurs vives oui — et c'est le club qui les choisit.
  const bg = light
    ? `${dots},linear-gradient(180deg,${mix(A, "#ffffff", 0.88)} 0%,#f2f2f7 44%,${mix(B, "#ffffff", 0.92)} 100%)`
    : `${dots},linear-gradient(180deg,${mix(A, "#000000", 0.72)} 0%,${mix(A, "#000000", 0.85)} 38%,${mix(B, "#000000", 0.9)} 74%,${mix(B, "#000000", 0.95)} 100%)`;

  // Une couleur unie équivalente au fond, pour ce qui ne sait pas peindre un
  // dégradé (barre système, overscroll, couleur de thème du manifeste).
  const bgSolid = light ? "#f2f2f7" : mix(A, "#000000", 0.78);

  const v: Record<string, string> = light
    ? {
        cd: "rgba(255,255,255,.78)",
        cdSolid: "rgba(255,255,255,.78)",
        cb: "rgba(0,0,0,.06)",
        cs: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(0,0,0,.08)",
        ink: "#111",
        i2: "rgba(0,0,0,.55)",
        i3: "rgba(0,0,0,.32)",
        sep: "rgba(0,0,0,.08)",
        gl: "rgba(255,255,255,.8)",
        gb: "rgba(0,0,0,.08)",
        seg: "rgba(0,0,0,.06)",
        bt: "#111",
        bf: "#fff",
        av: "#fff",
        mn: "rgba(250,250,252,.85)",
        ring: rgba(A, 0.55),
        ok: "#248a3d",
        bad: "#d70015",
        or: "#b8860b",
      }
    : {
        cd: "linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.06))",
        cdSolid: "rgba(255,255,255,.085)",
        cb: "rgba(255,255,255,.14)",
        cs: "inset 0 1px 0 rgba(255,255,255,.14),0 10px 30px rgba(0,0,0,.18)",
        ink: "#fff",
        i2: "rgba(255,255,255,.62)",
        i3: "rgba(255,255,255,.4)",
        sep: "rgba(255,255,255,.12)",
        gl: "rgba(255,255,255,.12)",
        gb: "rgba(255,255,255,.16)",
        seg: "rgba(0,0,0,.3)",
        bt: "#fff",
        bf: "#111",
        av: "rgba(0,0,0,.4)",
        mn: rgba(mix(A, "#000000", 0.8), 0.8),
        ring: rgba(A, 0.55),
        ok: "#30d158",
        bad: "#ff453a",
        or: "#ffd60a",
      };

  Object.assign(v, {
    bg,
    bgSolid,
    ta: A,
    tb: B,
    taG: crest(A),
    tbG: crest(B),
    taH: rgba(A, 0.34),
    tbH: rgba(B, 0.36),
    taF: lum(A) > 0.72 ? "#111" : "#fff",
    tbF: lum(B) > 0.72 ? "#111" : "#fff",
    // L'encre d'équipe : la couleur brute porte du texte en clair ; en sombre,
    // on l'éclaircit jusqu'à Lc 60 (lib/color.ts).
    taInk: light ? A : inkVariant(A, mix(A, "#000000", 0.66)),
    tbInk: light ? B : inkVariant(B, mix(B, "#000000", 0.8)),
  });
  return v;
}

/// Les jetons en une déclaration CSS `--k:v;--k2:v2`.
export function themeVars(
  colorA: string | null | undefined,
  colorB: string | null | undefined,
  theme: Theme,
): string {
  return Object.entries(themeTokens(colorA, colorB, theme))
    .map(([k, val]) => `--${k}:${val}`)
    .join(";");
}

/// Le nom du cookie qui mémorise Sombre / Clair. Lu côté serveur pour que le
/// premier rendu soit déjà dans le bon thème — sans flash.
export const THEME_COOKIE = "fs-theme";

export function parseTheme(v: string | undefined | null): Theme {
  return v === "light" ? "light" : "dark";
}
