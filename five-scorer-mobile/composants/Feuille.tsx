import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Poignee } from "./base";
import { jeton, type Jetons } from "../lib/couleurs";

/// La feuille posée par le bas : choix du format, homme du match, « Créer ».
///
/// Le dessin du système, pas celui qu'on avait : plus de trait blanc de
/// 3 points en haut (aucune feuille native n'en a), un grand arrondi de 32,
/// le trait de verre `cb`, la poignée en `i3`. Le voile se fond et la
/// feuille monte, au lieu de faire glisser le voile avec elle.
export default function Feuille({
  t,
  visible,
  onClose,
  titre,
  children,
}: {
  t: Jetons;
  visible: boolean;
  onClose: () => void;
  titre?: string;
  children: React.ReactNode;
}) {
  const bas = useSafeAreaInsets().bottom;
  const montee = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    montee.setValue(0);
    Animated.timing(montee, {
      toValue: 1,
      duration: 300,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [visible, montee]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={s.voile}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          s.feuille,
          {
            paddingBottom: bas + 12,
            backgroundColor: jeton(t, "bgSolid"),
            borderColor: jeton(t, "cb"),
            transform: [
              { translateY: montee.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
            ],
          },
        ]}
      >
        <Poignee t={t} />
        {titre ? <Text style={[s.titre, { color: t.ink }]}>{titre}</Text> : <View style={s.air} />}
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  feuille: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 -20px 60px rgba(0,0,0,0.4)",
  },
  titre: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  air: { height: 12 },
});
