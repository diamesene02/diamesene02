/// Les deux seules opérations de couleur que l'app fait elle-même.
///
/// Tout le reste — les trente jetons dérivés des deux chasubles du club, avec
/// leur plancher de contraste — est calculé par lib/theme.ts CÔTÉ SERVEUR et
/// arrive tout fait dans la réponse. La règle ne doit exister qu'à un seul
/// endroit : le jour où elle bouge, le web et le mobile doivent bouger
/// ensemble, sans que personne ait à y penser.

function composantes(c: string): [number, number, number] {
  const v = c.replace("#", "");
  const n =
    v.length === 3
      ? v
          .split("")
          .map((x) => x + x)
          .join("")
      : v;
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

/// Le dégradé de fond : la chasuble A en haut, la B en bas, toutes deux
/// largement assombries pour rester une teinte et non un aplat.
export function melange(a: string, b: string, part: number): string {
  const [r1, g1, b1] = composantes(a);
  const [r2, g2, b2] = composantes(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * part);
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`;
}

/// L'encre d'un écusson : noire sur une chasuble claire, blanche sinon.
export function lisible(c: string): string {
  const [r, g, b] = composantes(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72 ? "#111" : "#fff";
}

/// Les quatre arrêts du dégradé de fond, dans l'ordre.
export function fondDuClub(couleurA: string, couleurB: string): [string, string, string, string] {
  return [
    melange(couleurA, "#000000", 0.72),
    melange(couleurA, "#000000", 0.85),
    melange(couleurB, "#000000", 0.9),
    melange(couleurB, "#000000", 0.95),
  ];
}

export type Jetons = Record<string, string>;

/// Les valeurs de repli, quand les jetons du club ne sont pas encore chargés.
/// Volontairement neutres : afficher les couleurs d'un club au hasard puis les
/// remplacer ferait clignoter l'écran.
export const JETONS_NEUTRES: Jetons = {
  bgSolid: "#0b0b0e",
  ink: "#ffffff",
  i2: "rgba(255,255,255,0.62)",
  i3: "rgba(255,255,255,0.4)",
  sep: "rgba(255,255,255,0.12)",
  cdSolid: "rgba(255,255,255,0.085)",
  cb: "rgba(255,255,255,0.14)",
  seg: "rgba(0,0,0,0.3)",
  bt: "#ffffff",
  bf: "#111111",
  or: "#ffd60a",
  bad: "#ff453a",
  ok: "#30d158",
};
