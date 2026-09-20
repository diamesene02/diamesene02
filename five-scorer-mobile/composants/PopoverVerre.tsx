import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { jeton, type Jetons } from "../lib/couleurs";

/// Le rectangle d'un élément dans la fenêtre, tel que `measureInWindow` le
/// rend : c'est sous lui que la liste s'ouvre.
export type Ancre = { x: number; y: number; largeur: number; hauteur: number };

/// Mesure une vue pour y ancrer une liste. Rend `null` si la vue n'est pas
/// encore posée (mesure nulle) : l'appelant garde alors sa position de repli.
export function mesurer(vue: View | null, suite: (a: Ancre | null) => void): void {
  if (!vue) return suite(null);
  vue.measureInWindow((x, y, largeur, hauteur) =>
    suite(largeur > 0 && hauteur > 0 ? { x, y, largeur, hauteur } : null),
  );
}

/// La liste flottante en verre du site (`.menu-club`, `.stats-saison-menu`),
/// ancrée sous l'élément qui l'ouvre, bord droit contre bord droit.
///
/// Voile à 30 %, fond `mn`, trait `cb`, reflet haut et grande ombre, et
/// l'apparition `fsMenu` du site : 260 ms, de 0,94 à 1 depuis le coin haut
/// droit, avec une montée de 8 points.
///
/// Le site floute ce qu'il y a derrière (`backdrop-filter`). Le téléphone ne
/// le peut pas sans expo-blur, qui n'est pas dans le binaire installé — et un
/// module natif ne part pas par une mise à jour à chaud. On épaissit donc un
/// peu le verre : un fond du club à 55 % sous le `mn` du site. Sans flou, le
/// texte de l'écran se lisait à travers le menu.
export default function PopoverVerre({
  t,
  ancre,
  onClose,
  largeur,
  ecart = 8,
  rayon = 24,
  style,
  children,
}: {
  t: Jetons;
  /// `null` : fermé.
  ancre: Ancre | null;
  onClose: () => void;
  largeur: number;
  /// La distance entre le bas de l'ancre et le haut de la liste. −4 pour le
  /// menu du club, qui mord sur la pilule comme sur le site.
  ecart?: number;
  rayon?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const fenetre = useWindowDimensions();
  const marges = useSafeAreaInsets();
  const apparition = useRef(new Animated.Value(0)).current;
  const ouvert = ancre != null;

  useEffect(() => {
    if (!ouvert) return;
    apparition.setValue(0);
    Animated.timing(apparition, {
      toValue: 1,
      duration: 260,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [ouvert, apparition]);

  if (!ancre) return null;

  const l = Math.min(largeur, fenetre.width - 28);
  const droite = Math.max(14, fenetre.width - (ancre.x + ancre.largeur));
  const haut = Math.max(marges.top + 8, ancre.y + ancre.hauteur + ecart);
  const hauteurMax = fenetre.height - haut - marges.bottom - 14;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: apparition }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, s.voile]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          s.liste,
          {
            top: haut,
            right: droite,
            width: l,
            maxHeight: hauteurMax,
            borderRadius: rayon,
            borderColor: jeton(t, "cb"),
            opacity: apparition,
            transformOrigin: "top right",
            transform: [
              {
                translateY: apparition.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
              },
              { scale: apparition.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
          style,
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: rayon - 1, backgroundColor: jeton(t, "bgSolid"), opacity: 0.55 },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: rayon - 1,
              backgroundColor: jeton(t, "mn"),
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
            },
          ]}
        />
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  voile: { backgroundColor: "rgba(0,0,0,0.3)" },
  liste: {
    position: "absolute",
    borderWidth: 1,
    boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
  },
});
