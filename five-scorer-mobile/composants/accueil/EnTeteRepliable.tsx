import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { jeton, type Jetons } from "../../lib/couleurs";

/// Au-delà de ce défilement, le grand titre est parti : l'en-tête compact
/// prend le relais (`EnteteCollante` du site, même seuil).
export const SEUIL_REPLI = 60;

/// L'en-tête compact de l'accueil : « Five Scorer » centré sur une barre de
/// 56 sous la zone du statut, qui apparaît en fondu quand la grande barre a
/// défilé.
///
/// Le site floute ce qui passe dessous. Sans expo-blur (pas dans le binaire
/// installé), un `mn` translucide laisserait lire le tableau à travers le
/// titre : on le pose sur le fond du club à 80 %, comme la liste du menu.
///
/// Monté hors du défilement, dans le cadre de l'écran. Il remonte sous la
/// barre d'état (`top` négatif) pour la couvrir aussi : sans ça, une bande
/// du dégradé restait entre l'heure et la barre. Il ne capte aucun toucher,
/// comme sur le site — ce qu'il recouvre reste touchable par la barre d'état.
export default function EnTeteRepliable({ t, visible }: { t: Jetons; visible: boolean }) {
  const haut = useSafeAreaInsets().top;
  const opacite = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacite, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacite]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        s.barre,
        {
          top: -haut,
          height: haut + 56,
          paddingTop: haut,
          borderBottomColor: jeton(t, "sep"),
          opacity: opacite,
        },
      ]}
    >
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: jeton(t, "bgSolid"), opacity: 0.8 }]}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: jeton(t, "mn") }]} />
      <Text style={[s.titre, { color: t.ink }]} numberOfLines={1}>
        Five Scorer
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  barre: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  titre: { fontSize: 17, fontWeight: "600" },
});
