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
