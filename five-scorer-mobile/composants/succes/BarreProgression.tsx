import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Jetons } from "../../lib/couleurs";
import { couleursClub, useMouvementReduit } from "./commun";

/// La barre fine d'un palier ou d'un niveau, aux couleurs du club — celle du
/// site (components/succes/BarreProgression.tsx).
///
/// Le dégradé va de la chasuble A à la B sur TOUTE la piste, et la barre n'en
/// découvre que sa part : une barre courte est de la couleur A, une barre
/// presque pleine vire à la B. D'où le dégradé posé dans la partie pleine
/// avec une largeur de `100 / part` % : rapportée à la partie pleine, c'est
/// exactement la largeur de la piste.
export default function BarreProgression({
  t,
  part,
  chasubles,
  hauteur = 5,
  etiquette,
  style,
}: {
  t: Jetons;
  /// 0..1
  part: number;
  chasubles?: { a: string; b: string };
  hauteur?: number;
  /// Ce que la barre mesure : « Vers le niveau 5 ».
  etiquette?: string;
  style?: ViewStyle;
}) {
  const p = Number.isFinite(part) ? Math.min(1, Math.max(0, part)) : 0;
  const { a, b } = couleursClub(t, chasubles);
  const reduit = useMouvementReduit();
  const pousse = useRef(new Animated.Value(reduit ? 1 : 0)).current;

  useEffect(() => {
    if (reduit) {
      pousse.setValue(1);
      return;
    }
    Animated.timing(pousse, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [pousse, reduit]);

  return (
    <View
      style={[s.piste, { height: hauteur, borderRadius: hauteur / 2, backgroundColor: t.sep }, style]}
      accessible={!!etiquette}
      accessibilityRole={etiquette ? "progressbar" : undefined}
      accessibilityLabel={etiquette}
      accessibilityValue={etiquette ? { min: 0, max: 100, now: Math.round(p * 100) } : undefined}
    >
      {p > 0 && (
        <Animated.View
          style={[
            s.pleine,
            {
              width: `${p * 100}%`,
              minWidth: hauteur,
              borderRadius: hauteur / 2,
              transform: [{ scaleX: pousse }],
            },
          ]}
        >
          <LinearGradient
            colors={[a, b]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[s.degrade, { width: `${100 / p}%` }]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  piste: { overflow: "hidden" },
  pleine: { height: "100%", overflow: "hidden", transformOrigin: "left" },
  degrade: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
