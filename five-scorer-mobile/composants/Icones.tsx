import Svg, { Circle, Path, Rect } from "react-native-svg";

/// Les icônes de la barre du bas, reprises trait pour trait de celles du site
/// (components/BottomNav.tsx) : même viewBox 24, même épaisseur 2, mêmes
/// extrémités arrondies. Une icône redessinée « à peu près » se remarque
/// aussitôt qu'on a les deux sous les yeux.

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

export function IconeAccueil({ couleur, taille = 24 }: Props) {
  return (
    <Svg {...commun(couleur, taille)}>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9.5V21h14V9.5" />
      <Path d="M9.5 21v-6h5v6" />
    </Svg>
  );
}

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

export function IconeCourbe({ couleur, taille = 24 }: Props) {
  return (
    <Svg {...commun(couleur, taille)}>
      <Path d="M5 21v-8" />
      <Path d="M12 21V4" />
      <Path d="M19 21v-12" />
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
  // « Effectif » n'existe pas au menu du site : la page s'y atteint par
  // « Mon profil ». Sur le téléphone elle a sa propre entrée — c'est là qu'on
  // ajoute un joueur avant un lundi, et fouiller un profil pour y arriver
  // serait un détour.
  effectif: "M16.5 20v-1.5a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4V20M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20.5 20v-1.5a4 4 0 0 0-3-3.87M15.5 3.87a4 4 0 0 1 0 7.75",
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
