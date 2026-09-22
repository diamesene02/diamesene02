import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { lisible, type Jetons } from "../lib/couleurs";
import { leger } from "../lib/haptique";
import { duree, MOUVEMENT, Touche, useMouvementReduit } from "./base";

/// La barre du bas, en verre flottant.
///
/// Elle avait disparu au profit du menu de la pilule, comme sur le site. Sur
/// un téléphone c'était une perte : les quatre écrans qu'on ouvre vingt fois
/// par soirée demandaient deux gestes au lieu d'un. Elle revient donc, mais
/// posée au-dessus du contenu plutôt que collée au bord — la matière du
/// produit (verre sombre, rayon large, lueur) au lieu d'un bandeau opaque.
///
/// Les écrans qui défilent sous elle réservent `ESPACE_BARRE` en bas de leur
/// contenu, sinon la dernière ligne se cache derrière.
export const HAUTEUR_BARRE = 62;
export const ESPACE_BARRE = HAUTEUR_BARRE + 26;

// La géométrie du creux, écrite une fois : l'indicateur qui suit l'onglet
// actif n'est plus dessiné par chaque onglet, c'est UNE vue qui glisse. Pour
// qu'elle tombe au bon endroit sans qu'on aille mesurer chaque onglet, la
// colonne d'un onglet a une hauteur connue — d'où l'interligne fixé sur le
// libellé, et le `stretch` de la barre.
const CREUX_L = 44;
const CREUX_H = 26;
const LIBELLE_H = 13;
const ECART = 2;
/// Le haut du creux dans la barre : le bloc icône + libellé, centré.
const CREUX_Y = Math.round(((HAUTEUR_BARRE - (CREUX_H + ECART + LIBELLE_H)) / 2) * 10) / 10;
/// La barre n'a PLUS de marge intérieure : une vue posée en absolu et une
/// colonne en `flex` ne comptent pas forcément la marge du parent de la même
/// façon, et un creux décalé de six points sous la mauvaise icône se voit.
/// Les colonnes font donc exactement un cinquième de la barre, et le creux
/// de 44 se centre dedans — il reste quinze points de chaque côté.
const MARGE = 0;

export type Onglet = {
  nom: string;
  libelle: string;
  icone: "accueil" | "ballon" | "plus" | "calendrier" | "courbe";
};

export const ONGLETS: Onglet[] = [
  { nom: "index", libelle: "Accueil", icone: "accueil" },
  { nom: "matchs", libelle: "Matchs", icone: "ballon" },
  { nom: "creer", libelle: "Créer", icone: "plus" },
  { nom: "soirees", libelle: "Soirées", icone: "calendrier" },
  { nom: "stats", libelle: "Stats", icone: "courbe" },
];

function Icone({
  nom,
  couleur,
  taille = 23,
}: {
  nom: Onglet["icone"];
  couleur: string;
  taille?: number;
}) {
  const p = { stroke: couleur, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      {nom === "accueil" && (
        <>
          <Path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5h-7v5H5A1.5 1.5 0 0 1 3.5 19z" {...p} />
        </>
      )}
      {nom === "ballon" && (
        <>
          <Circle cx="12" cy="12" r="8.5" {...p} />
          <Path d="M12 7.5 15.5 10l-1.3 4h-4.4L8.5 10z" {...p} />
        </>
      )}
      {nom === "plus" && <Path d="M12 5.5v13M5.5 12h13" {...p} />}
      {nom === "calendrier" && (
        <>
          <Rect x="3.5" y="5.5" width="17" height="15" rx="3.5" {...p} />
          <Path d="M3.5 10h17M8 3.5v4M16 3.5v4" {...p} />
        </>
      )}
      {nom === "courbe" && <Path d="M5 19V9.5M12 19V4.5M19 19v-6" {...p} />}
    </Svg>
  );
}

export default function BarreOnglets({
  t,
  actif,
  onChoisir,
  couleurA,
}: {
  t: Jetons;
  /// Le nom de l'écran courant (« index », « matchs », …) ; « creer » n'en est
  /// pas un, c'est la feuille de création.
  actif: string;
  onChoisir: (nom: string) => void;
  couleurA: string;
}) {
  const bas = useSafeAreaInsets().bottom;
  const encre = useMemo(() => lisible(couleurA), [couleurA]);
  const reduit = useMouvementReduit();
  const [largeur, setLargeur] = useState(0);

  // L'onglet montré par le creux. « creer » n'en est pas un : quand la
  // feuille de création est ouverte, le creux reste où il était et s'efface.
  const index = ONGLETS.findIndex((o) => o.nom === actif && o.icone !== "plus");
  const visible = index >= 0;
  const glisse = useRef(new Animated.Value(Math.max(index, 0))).current;
  const voile = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    const d = duree(reduit, MOUVEMENT.bascule);
    Animated.parallel([
      // On ne déplace le creux que vers un onglet réel ; sinon il resterait
      // planté sur le « + », qui n'est pas une destination.
      ...(visible
        ? [
            Animated.timing(glisse, {
              toValue: index,
              duration: d,
              easing: MOUVEMENT.courbe,
              useNativeDriver: true,
            }),
          ]
        : []),
      Animated.timing(voile, {
        toValue: visible ? 1 : 0,
        duration: d,
        easing: MOUVEMENT.courbe,
        useNativeDriver: true,
      }),
    ]).start();
  }, [glisse, index, reduit, visible, voile]);

  const colonne = largeur > 0 ? (largeur - MARGE * 2) / ONGLETS.length : 0;
  const depart = MARGE + colonne / 2 - CREUX_L / 2;

  return (
    <View
      pointerEvents="box-none"
      style={[s.zone, { paddingBottom: Math.max(bas - 6, 10) }]}
    >
      <View
        onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
        style={[
          s.barre,
          {
            height: HAUTEUR_BARRE,
            backgroundColor: t.mn ?? "rgba(24,24,28,0.86)",
            borderColor: t.cb,
          },
        ]}
      >
        {colonne > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              s.creuxGlissant,
              {
                opacity: voile,
                transform: [
                  {
                    // Une colonne d'écart par cran ; au-delà du premier,
                    // l'extrapolation linéaire d'Animated suffit.
                    translateX: glisse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [depart, depart + colonne],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
        {ONGLETS.map((o) => {
          const estActif = o.nom === actif;
          const central = o.icone === "plus";
          const couleur = central ? encre : estActif ? t.ink : "rgba(255,255,255,0.45)";
          return (
            <Touche
              key={o.nom}
              accessibilityRole="button"
              accessibilityLabel={central ? "Créer un match ou une soirée" : o.libelle}
              accessibilityState={{ selected: estActif }}
              onPress={() => {
                void leger();
                onChoisir(o.nom);
              }}
              // Le « + » est un bouton plein : il se voile comme un bouton.
              // Un onglet déjà choisi ne se voile pas, il confirme du point.
              voile={central ? 0.85 : estActif ? 1 : 0.6}
              style={s.onglet}
            >
              {central ? (
                <View style={[s.pastille, { backgroundColor: couleurA }]}>
                  <Icone nom={o.icone} couleur={couleur} taille={24} />
                </View>
              ) : (
                <>
                  <View style={s.creux}>
                    <Icone nom={o.icone} couleur={couleur} />
                  </View>
                  <Text style={[s.libelle, { color: couleur }]} numberOfLines={1}>
                    {o.libelle}
                  </Text>
                </>
              )}
            </Touche>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  zone: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
  },
  barre: {
    flexDirection: "row",
    // « stretch » et non « center » : chaque onglet fait toute la hauteur de
    // la barre, donc le creux tombe toujours à CREUX_Y. Avec « center », sa
    // hauteur dépendait de l'interligne du libellé, qu'on ne connaît pas.
    alignItems: "stretch",
    borderRadius: 31,
    borderWidth: StyleSheet.hairlineWidth,
    // L'ombre porte la barre au-dessus du contenu : sans elle, le verre se
    // confond avec une carte qui passe dessous.
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  onglet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    // 44 pt de haut au minimum : un doigt pressé, debout au bord du terrain.
    minHeight: 48,
  },
  creux: {
    width: CREUX_L,
    height: CREUX_H,
    alignItems: "center",
    justifyContent: "center",
  },
  /// Le creux de l'onglet actif : UNE vue qui glisse derrière les icônes, au
  /// lieu d'un fond qui s'allume ici et s'éteint là.
  creuxGlissant: {
    position: "absolute",
    left: 0,
    top: CREUX_Y,
    width: CREUX_L,
    height: CREUX_H,
    borderRadius: CREUX_H / 2,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  libelle: { fontSize: 11, fontWeight: "600", lineHeight: LIBELLE_H },
  pastille: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
});
