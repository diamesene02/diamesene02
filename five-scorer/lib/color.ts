// Outillage couleur du système « craie sur gazon ».
//
// Un club choisit les couleurs de ses chasubles. Problème mesuré : une
// couleur d'équipe brute ne porte pas de texte — de l'encre sombre sur
// orange vif plafonne à Lc 50, sur bleu à Lc 43, là où il en faut 60.
// On dérive donc mécaniquement, pour chaque couleur choisie, une variante
// éclaircie qui atteint la cible ; l'aplat sert aux barres et pastilles,
// l'encre au texte. C'est la parade d'Apple Sports au conflit de deux
// couleurs d'équipe, appliquée par le calcul plutôt qu'à l'œil.

const CANVAS = "#141917"; // --pitch-1, la surface sur laquelle on lit
const TARGET_LC = 60; // petit texte / repère coloré

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function toHex(rgb: number[]): string {
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(Math.max(0, Math.min(255, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

/// Luminance perceptuelle d'APCA (exposant 2.4, pondérations sRGB).
function screenY(hex: string): number {
  const [r, g, b] = parse(hex).map((c) => (c / 255) ** 2.4);
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
}

/// Contraste APCA-W3 (0.1.9), en valeur absolue. WCAG 2.x surestime le
/// contraste sur fond sombre : c'est la bonne métrique ici.
export function apca(text: string, background: string): number {
  const BLK_THRS = 0.022;
  const BLK_CLMP = 1.414;
  let yT = screenY(text);
  let yB = screenY(background);
  yT = yT > BLK_THRS ? yT : yT + (BLK_THRS - yT) ** BLK_CLMP;
  yB = yB > BLK_THRS ? yB : yB + (BLK_THRS - yB) ** BLK_CLMP;
  if (Math.abs(yB - yT) < 0.0005) return 0;
  let contrast: number;
  if (yB > yT) {
    const sapc = (yB ** 0.56 - yT ** 0.57) * 1.14;
    contrast = sapc < 0.1 ? 0 : sapc - 0.027;
  } else {
    const sapc = (yB ** 0.65 - yT ** 0.62) * 1.14;
    contrast = sapc > -0.1 ? 0 : sapc + 0.027;
  }
  return Math.abs(contrast * 100);
}

/// Éclaircit une couleur juste assez pour qu'elle porte du texte sur le
/// fond de l'app. Retourne la couleur telle quelle si elle passe déjà.
export function inkVariant(hex: string, background = CANVAS): string {
  const base = parse(hex);
  if (apca(toHex(base), background) >= TARGET_LC) return toHex(base);
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const mixed = base.map((v) => v + (255 - v) * t);
    if (apca(toHex(mixed), background) >= TARGET_LC) return toHex(mixed);
  }
  return "#FFFFFF";
}

/// Les deux couleurs par défaut : celles des vraies chasubles de five.
export const DEFAULT_BIB_A = "#FF6B2C";
export const DEFAULT_BIB_B = "#3D8BFF";

export type BibTheme = {
  aFill: string;
  aInk: string;
  bFill: string;
  bInk: string;
};

export function bibTheme(a?: string | null, b?: string | null): BibTheme {
  const aFill = a && isValidHex(a) ? normalize(a) : DEFAULT_BIB_A;
  const bFill = b && isValidHex(b) ? normalize(b) : DEFAULT_BIB_B;
  return {
    aFill,
    aInk: inkVariant(aFill),
    bFill,
    bInk: inkVariant(bFill),
  };
}

function normalize(hex: string): string {
  return toHex(parse(hex));
}
