import Svg, { Circle, Path, Rect } from "react-native-svg";

/// Les icônes d'usage général, reprises trait pour trait de celles du site :
/// même viewBox 24, même épaisseur 2, mêmes extrémités arrondies. Ne restent
/// ici que celles qui servent hors de la barre du bas — le calendrier des
/// en-têtes de soirée, le ballon, le plus. Les cinq icônes de la barre
/// revenue vivent dans composants/BarreOnglets.tsx, avec elle ; le menu de
/// la pilule tire les siennes de CHEMINS.
/// Une icône redessinée « à peu près » se remarque aussitôt qu'on a les deux
/// sous les yeux : si l'une d'elles revient, on la reprend du site.
///
/// Ce qui fait foi aujourd'hui : `five-scorer/components/ios/MenuClub.tsx`
/// (l'ordre des entrées et le jeu d'icônes). `components/BottomNav.tsx`,
/// que ce commentaire citait, n'était plus rendu nulle part : il a été
/// supprimé avec les quatre autres composants morts du site.

type Props = { couleur: string; taille?: number };

const commun = (couleur: string, taille: number) => ({
  width: taille,
  height: taille,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: couleur,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function IconeBallon({ couleur, taille = 24 }: Props) {
  return (
    <Svg {...commun(couleur, taille)}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7.5 16.3 10.6 14.65 15.65 H9.35 L7.7 10.6 Z" />
    </Svg>
  );
}

export function IconeCalendrier({ couleur, taille = 24 }: Props) {
  return (
    <Svg {...commun(couleur, taille)}>
      <Rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <Path d="M3.5 10h17" />
      <Path d="M8 3v4" />
      <Path d="M16 3v4" />
    </Svg>
  );
}

export function IconePlus({ couleur, taille = 24 }: Props) {
  return (
    <Svg {...commun(couleur, taille)}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Svg>
  );
}

/// Une icône « au trait », comme le `Ico` du menu du site : un seul chemin,
/// épaisseur 2,2, viewBox 24. Les chemins vivent dans `CHEMINS` ci-dessous,
/// copiés de components/ios/MenuClub.tsx — même dessin des deux côtés.
export function IconeTrait({
  d,
  couleur,
  taille = 26,
  carre,
}: {
  d: string;
  couleur: string;
  taille?: number;
  carre?: boolean;
}) {
  return (
    <Svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={2.2}
      strokeLinecap={carre ? "square" : "round"}
      strokeLinejoin="round"
    >
      <Path d={d} />
    </Svg>
  );
}

export const CHEMINS = {
  accueil: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6",
  soirees: "M3.5 5h17v16h-17zM3.5 10h17M8 3v4M16 3v4",
  saison:
    "M7 4h10v5a5 5 0 0 1-10 0zM7 5.5H4V8a3 3 0 0 0 3 3M17 5.5h3V8a3 3 0 0 1-3 3M12 14v3.5M8.5 20.5h7",
  stats: "M5 21v-8M12 21V4M19 21v-12",
  partager: "M12 14V3M8 7l4-4 4 4M5 11v10h14V11",
  reglages:
    "M20.5 9.5H11l-2.2-2.2H3.5v3.4a6.3 6.3 0 1 0 12.4 1.6h4.6zM9.6 13.2m-2.1 0a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0-4.2 0",
  clubs: "M4 6h16M4 12h16M4 18h16",
  sortir: "M9 4H5v16h4M13 8l4 4-4 4M17 12H8",
  // Le miroir exact de `sortir` : même porte, même flèche, l'autre sens. On
  // entre au lieu de partir. Grille de 24, tracé symétrique de celui du
  // dessus autour de x = 12 — les deux lignes se ressemblent au menu, et
  // c'est voulu : c'est la même porte.
  rejoindre: "M15 4h4v16h-4M11 8l4 4-4 4M15 12H6",
  // « Matchs » et « Effectif » sont entrés au menu du site le 19 septembre
  // 2026, avec la fin de la barre du bas : ce qui n'est pas au menu n'est
  // plus joignable. Mêmes tracés que components/ios/MenuClub.tsx.
  matchs: "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 7.4l3.9 2.8-1.5 4.6h-4.8L8.1 10.2z",
  effectif:
    "M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7M2.5 20.5c.6-3.6 3.1-5.8 6.5-5.8s5.9 2.2 6.5 5.8M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.9c2 .8 3.2 2.7 3.5 5.6",
} as const;

/// Les icônes du palmarès, reprises de `components/Icon.tsx` : grille de 24,
/// trait de 1,75, bouts FRANCS (le jeu maison n'arrondit pas). Elles ne
/// passent pas par `IconeTrait` : celui-ci est réglé sur le menu, dont le
/// trait est plus épais et les bouts arrondis.
function jeuMaison(couleur: string, taille: number) {
  return {
    width: taille,
    height: taille,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: couleur,
    strokeWidth: 1.75,
    strokeLinecap: "square" as const,
    strokeLinejoin: "round" as const,
  };
}

export function IconeTrophee({ couleur, taille = 26 }: Props) {
  return (
    <Svg {...jeuMaison(couleur, taille)}>
      <Path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <Path d="M7 5.5H4V8a3 3 0 0 0 3 3M17 5.5h3V8a3 3 0 0 1-3 3" />
      <Path d="M12 14v3.5M8.5 20.5h7" />
    </Svg>
  );
}

/// Le ballon qui part. La passe décisive n'a pas d'icône dans le jeu maison ;
/// celle-ci est celle que la page des stats dessine à la main.
export function IconePasse({ couleur, taille = 26 }: Props) {
  return (
    <Svg {...jeuMaison(couleur, taille)}>
      <Circle cx="15.5" cy="12" r="5.5" />
      <Path d="M2.5 12h7M6.5 8.5l3.5 3.5-3.5 3.5" />
    </Svg>
  );
}

/// Le ballon du palmarès : le même que celui de la barre du bas, mais au trait
/// du jeu maison.
export function IconeBallonFin({ couleur, taille = 26 }: Props) {
  return (
    <Svg {...jeuMaison(couleur, taille)}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7.5 16.3 10.6 14.65 15.65 H9.35 L7.7 10.6 Z" />
    </Svg>
  );
}

/// Le chevron du bouton retour, celui de `components/ios/BarreClub.tsx` :
/// 12 × 20, trait de 2,5, bouts arrondis. Le caractère « ‹ » qu'il remplace
/// faisait 6 × 10 points — un signe qu'on cherche au lieu d'un bouton qu'on
/// voit.
export function IconeRetour({ couleur, taille = 20 }: Props) {
  const largeur = Math.round((taille * 12) / 20);
  return (
    <Svg width={largeur} height={taille} viewBox="0 0 12 20" fill="none">
      <Path
        d="M10 2L2 10l8 8"
        stroke={couleur}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/// Les icônes du « jeu maison » du site (`components/Icon.tsx`) dont les
/// écrans de l'app ont besoin : grille de 24, trait de 1,75, bouts francs.
/// Même dessin des deux côtés, donc même nom.
const JEU = {
  plus: ["M12 4.5v15M4.5 12h15"],
  coche: ["M4.5 12.5l5 5 10-11"],
  croix: ["M5.5 5.5l13 13M18.5 5.5l-13 13"],
  chevron: ["M9 5l7 7-7 7"],
  liste: ["M4 7h16M4 12h16M4 17h10"],
  gant: [
    "M6 21v-7.5a2 2 0 0 1 2-2h1V6.5a1.5 1.5 0 0 1 3 0v5h1v-6a1.5 1.5 0 0 1 3 0v6h1V8a1.5 1.5 0 0 1 3 0v9a4 4 0 0 1-4 4z",
    "M6 16.5H3.5",
  ],
  etoile: ["M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z"],
  lecture: ["M7 4.5l12 7.5-12 7.5z"],
} as const;

export type NomIconeJeu = keyof typeof JEU;

export function IconeJeu({
  nom,
  couleur,
  taille = 16,
  plein,
  epaisseur = 1.75,
}: Props & {
  nom: NomIconeJeu;
  /// Remplit la forme (l'étoile, le triangle « lecture ») au lieu de la tracer.
  plein?: boolean;
  epaisseur?: number;
}) {
  // Le triangle de lecture du site est toujours plein et sans trait.
  const remplir = plein || nom === "lecture";
  return (
    <Svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill={remplir ? couleur : "none"}
      stroke={nom === "lecture" ? "none" : couleur}
      strokeWidth={epaisseur}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {JEU[nom].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
