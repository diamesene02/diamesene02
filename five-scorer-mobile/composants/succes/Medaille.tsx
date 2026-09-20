import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import type { Jetons } from "../../lib/couleurs";
import {
  CHEMINS_ICONES,
  NOMS_MATIERES,
  TEINTE_LEGENDE,
  TEINTES_MATIERES,
  type IconeSucces as Cle,
  type Matiere,
} from "../../lib/succes-icones";
import { couleursClub } from "./commun";

/// La médaille d'un succès : un anneau de métal, un cœur sombre, l'icône au
/// milieu — la même que celle du site (components/succes/Medaille.tsx), mêmes
/// teintes (lib/succes-icones.ts), mêmes proportions : anneau de 8,5 % du
/// diamètre, icône à la moitié.
///
/// Tout est dans un seul <Svg> de 100 × 100 : les dégradés du site (linéaire
/// à 145° pour l'anneau, radial pour le cœur) s'y écrivent tels quels, là où
/// des vues empilées n'auraient donné que des aplats.
///
/// `matiere` à null : la médaille verrouillée, aux jetons du thème. L'icône
/// reste : on voit ce qu'on vise.
export default function Medaille({
  icone,
  matiere,
  t,
  chasubles,
  taille = 56,
  etiquette,
}: {
  icone: Cle;
  matiere: Matiere | null;
  t: Jetons;
  /// Les couleurs du club, pour la médaille « légende » quand les jetons ne
  /// les portent pas.
  chasubles?: { a: string; b: string };
  taille?: number;
  /// Pour un lecteur d'écran, si la médaille porte seule le sens.
  etiquette?: string;
}) {
  // Deux médailles sur un écran ne doivent pas partager un dégradé.
  const id = useId().replace(/[^A-Za-z0-9]/g, "");
  const chemins = CHEMINS_ICONES[icone] ?? CHEMINS_ICONES.etoile;

  let anneau: [string, string, string] | null = null;
  let coeur: [string, string];
  let encre: string;
  if (matiere === null) {
    coeur = [t.seg ?? "rgba(0,0,0,0.3)", t.seg ?? "rgba(0,0,0,0.3)"];
    encre = t.i3 ?? "rgba(255,255,255,0.4)";
  } else if (matiere === "legende") {
    const c = couleursClub(t, chasubles);
    anneau = [c.a, c.a, c.b];
    coeur = [TEINTE_LEGENDE.coeurClair, TEINTE_LEGENDE.coeur];
    encre = TEINTE_LEGENDE.encre;
  } else {
    const m = TEINTES_MATIERES[matiere];
    anneau = [m.clair, m.base, m.sombre];
    coeur = [m.coeurClair, m.coeur];
    encre = m.encre;
  }

  return (
    <View
      style={[
        s.racine,
        { width: taille, height: taille, borderRadius: taille / 2 },
        matiere !== null && s.ombre,
        matiere !== null && { backgroundColor: anneau?.[2] },
      ]}
      accessible={!!etiquette}
      accessibilityRole={etiquette ? "image" : undefined}
      accessibilityLabel={etiquette ?? (matiere ? NOMS_MATIERES[matiere] : undefined)}
      importantForAccessibility={etiquette ? "yes" : "no-hide-descendants"}
    >
      <Svg width={taille} height={taille} viewBox="0 0 100 100">
        <Defs>
          {anneau && (
            <LinearGradient id={`a${id}`} x1="0.1" y1="-0.07" x2="0.9" y2="1.07">
              <Stop offset="0" stopColor={anneau[0]} />
              <Stop offset={matiere === "legende" ? "0" : "0.45"} stopColor={anneau[1]} />
              <Stop offset="1" stopColor={anneau[2]} />
            </LinearGradient>
          )}
          <RadialGradient id={`c${id}`} cx="0.35" cy="0.28" r="0.8" fx="0.35" fy="0.28">
            <Stop offset="0" stopColor={coeur[0]} />
            <Stop offset="0.9" stopColor={coeur[1]} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={anneau ? `url(#a${id})` : (t.gb ?? "rgba(255,255,255,0.16)")} />
        <Circle
          cx={50}
          cy={50}
          r={41.5}
          fill={`url(#c${id})`}
          stroke={matiere === null ? "none" : "rgba(0,0,0,0.35)"}
          strokeWidth={1}
        />
        <G transform={`translate(25 25) scale(${50 / 24})`}>
          {chemins.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill="none"
              stroke={encre}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  racine: { alignItems: "center", justifyContent: "center" },
  ombre: {
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
