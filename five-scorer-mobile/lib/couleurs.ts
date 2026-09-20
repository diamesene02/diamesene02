/// Les rares opérations de couleur que l'app fait elle-même.
///
/// Tout le reste — les trente jetons dérivés des deux chasubles du club, avec
/// leur plancher de contraste — est calculé par lib/theme.ts CÔTÉ SERVEUR et
/// arrive tout fait dans la réponse. La règle ne doit exister qu'à un seul
/// endroit : le jour où elle bouge, le web et le mobile doivent bouger
/// ensemble, sans que personne ait à y penser. Ce qui suit ne fait que
/// relire ces jetons pour les moteurs de dessin du téléphone, qui ne savent
/// pas lire une chaîne CSS (le dégradé du verre, celui de l'écusson).

import { mix, rgba } from "./noyau/theme";

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

/// Le fond en thème clair : trois arrêts, aux positions 0, 0,44 et 1
/// (lib/theme.ts du site).
export function fondClairDuClub(couleurA: string, couleurB: string): [string, string, string] {
  return [mix(couleurA, "#ffffff", 0.88), "#f2f2f7", mix(couleurB, "#ffffff", 0.92)];
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/// Les trois arrêts de l'écusson : `crest()` du site, lu pour react-native-svg.
///
/// Le site écrit `radial-gradient(circle at 35% 30%, clair, c 55%, sombre)`.
/// Ici on rend les trois couleurs, et c'est le composant qui les pose aux
/// positions 0, 0,55 et 1. Une couleur qui n'est pas un hexadécimal (un club
/// ancien, une valeur de test) donne un aplat plutôt qu'un dégradé cassé.
export function arretsDeCrete(couleur: string): [string, string, string] {
  if (!HEX.test(couleur)) return [couleur, couleur, couleur];
  return [mix(couleur, "#ffffff", 0.32), couleur, mix(couleur, "#000000", 0.28)];
}

/// Une couleur de chasuble à une opacité donnée : les halos du fond de match.
export function voile(couleur: string, opacite: number): string {
  return HEX.test(couleur) ? rgba(couleur, opacite) : couleur;
}

export type Jetons = Record<string, string>;

/// Les deux couleurs du verre des cartes, lues dans le jeton `cd`.
///
/// En sombre, `cd` est « linear-gradient(180deg, rgba(…,.11), rgba(…,.06)) » ;
/// en clair, un simple « rgba(255,255,255,.78) ». expo-linear-gradient veut
/// deux couleurs : on prend la première et la dernière qu'on trouve, et une
/// seule donne un aplat.
export function degradeDuVerre(t: Jetons): [string, string] {
  const couleurs = (t.cd ?? "").match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi) ?? [];
  const haut = couleurs[0];
  const bas = couleurs[couleurs.length - 1];
  if (!haut || !bas) return ["rgba(255,255,255,0.11)", "rgba(255,255,255,0.06)"];
  return [haut, bas];
}

/// Les valeurs de repli, quand les jetons du club ne sont pas encore chargés.
/// Volontairement neutres : afficher les couleurs d'un club au hasard puis les
/// remplacer ferait clignoter l'écran.
export const JETONS_NEUTRES: Jetons = {
  bgSolid: "#0b0b0e",
  // Le fond du menu et des feuilles, en attendant la teinte du club.
  mn: "rgba(20,20,24,0.92)",
  ink: "#ffffff",
  i2: "rgba(255,255,255,0.62)",
  i3: "rgba(255,255,255,0.4)",
  sep: "rgba(255,255,255,0.12)",
  cd: "linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.06))",
  cdSolid: "rgba(255,255,255,0.085)",
  cb: "rgba(255,255,255,0.14)",
  cs: "inset 0 1px 0 rgba(255,255,255,.14),0 10px 30px rgba(0,0,0,.18)",
  seg: "rgba(0,0,0,0.3)",
  // Le verre des boutons et des pilules, le fond des avatars.
  gl: "rgba(255,255,255,0.12)",
  gb: "rgba(255,255,255,0.16)",
  av: "rgba(0,0,0,0.4)",
  // La lueur des pilules : sans couleur de club, un blanc discret.
  ring: "rgba(255,255,255,0.3)",
  bt: "#ffffff",
  bf: "#111111",
  or: "#ffd60a",
  bad: "#ff453a",
  ok: "#30d158",
};

/// Un jeton, ou sa valeur neutre si l'objet reçu ne le porte pas.
///
/// Les jetons du serveur les portent tous ; ceux qu'un écran fabrique à la
/// main (la feuille de match, l'attente du noyau) n'en ont qu'une partie.
/// Un `undefined` en couleur ne lève pas : il peint transparent, sans rien
/// dire — une bordure qui disparaît au lieu d'une erreur.
export function jeton(t: Jetons, cle: string): string {
  return t[cle] ?? JETONS_NEUTRES[cle] ?? "transparent";
}
