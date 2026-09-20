import { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";
import { fondClairDuClub, fondDuClub, JETONS_NEUTRES, type Jetons } from "../lib/couleurs";

/// Le cadre commun de tous les écrans : le fond aux couleurs du club, sa
/// trame pointillée, les marges de sécurité de l'appareil, et l'entrée en
/// fondu du site.
///
/// Le dégradé n'apparaît que quand on connaît les couleurs. Tant qu'on ne les
/// connaît pas, un fond neutre — en afficher d'autres puis les remplacer
/// ferait clignoter l'écran à chaque ouverture.
export default function Ecran({
  t = JETONS_NEUTRES,
  chasubles,
  children,
  fond = "club",
  clair = false,
  anime = true,
}: {
  t?: Jetons;
  chasubles?: { a: string; b: string };
  children: React.ReactNode;
  /// « match » : le fond du récap et de la carte de partage (`.fond-match`
  /// du site) — toujours sombre, bleu nuit, avec le halo de chaque chasuble
  /// de son côté. Quel que soit le club.
  fond?: "club" | "match";
  /// Le thème clair du site. L'app reste en sombre tant qu'aucun réglage ne
  /// le propose ; le fond sait déjà le peindre.
  clair?: boolean;
  /// L'entrée en fondu et montée de 10 points (`.ecran` du site, 320 ms).
  /// À couper pour un écran qui se remonte souvent.
  anime?: boolean;
}) {
  const apparition = useRef(new Animated.Value(anime ? 0 : 1)).current;
  useEffect(() => {
    if (!anime) return;
    Animated.timing(apparition, {
      toValue: 1,
      duration: 320,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [anime, apparition]);

  const match = fond === "match";
  return (
    <View style={[styles.racine, { backgroundColor: match ? "#0b0b12" : t.bgSolid }]}>
      <StatusBar style={clair && !match ? "dark" : "light"} />
      {match ? (
        <FondMatch chasubles={chasubles} />
      ) : (
        chasubles &&
        (clair ? (
          <LinearGradient
            colors={fondClairDuClub(chasubles.a, chasubles.b)}
            locations={[0, 0.44, 1]}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <LinearGradient
            colors={fondDuClub(chasubles.a, chasubles.b)}
            locations={[0, 0.38, 0.74, 1]}
            style={StyleSheet.absoluteFill}
          />
        ))
      )}
      <Trame
        couleur={
          clair && !match
            ? "rgba(0,0,0,0.035)"
            : match
              ? "rgba(255,255,255,0.06)"
              : "rgba(255,255,255,0.05)"
        }
      />
      <SafeAreaView style={styles.racine}>
        <Animated.View
          style={[
            styles.racine,
            {
              opacity: apparition,
              transform: [
                {
                  translateY: apparition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/// La trame du site : un point de 0,8 px tous les 5 px, à 5 % de blanc,
/// posée sur le dégradé (`radial-gradient(…) 0 0/5px 5px`).
///
/// UN seul Svg et un motif répété, pas une grille de vues : l'écran en
/// compterait plus de quinze mille. Le motif se dessine une fois, le moteur
/// le recopie. `memo` : l'écran se re-rend à chaque chargement, la trame n'a
/// aucune raison de suivre.
const Trame = memo(function Trame({ couleur }: { couleur: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="trame" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
            <Circle cx="2.5" cy="2.5" r="1" fill={couleur} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#trame)" />
      </Svg>
    </View>
  );
});

/// `.fond-match` : un dégradé bleu nuit, et deux halos elliptiques de
/// 60 % × 50 % posés sur les bords à 32 % de la hauteur — la chasuble A à
/// gauche (34 %), la B à droite (36 %), fondues à 70 %.
const FondMatch = memo(function FondMatch({
  chasubles,
}: {
  chasubles?: { a: string; b: string };
}) {
  return (
    <>
      <LinearGradient
        colors={["#0b0b12", "#14152a", "#1b1c36"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {chasubles && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="haloA" cx="0%" cy="32%" rx="60%" ry="50%" fx="0%" fy="32%">
                <Stop offset="0" stopColor={chasubles.a} stopOpacity={0.34} />
                <Stop offset="0.7" stopColor={chasubles.a} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="haloB" cx="100%" cy="32%" rx="60%" ry="50%" fx="100%" fy="32%">
                <Stop offset="0" stopColor={chasubles.b} stopOpacity={0.36} />
                <Stop offset="0.7" stopColor={chasubles.b} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#haloA)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#haloB)" />
          </Svg>
        </View>
      )}
    </>
  );
});

const styles = StyleSheet.create({ racine: { flex: 1 } });
