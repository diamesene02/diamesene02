import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { CarteVerre } from "../base";
import { IconeJeu } from "../Icones";
import { jeton, type Jetons } from "../../lib/couleurs";

/// La bannière de la prochaine soirée (`.banniere` du site) : une carte de
/// verre au halo de la chasuble A dans le coin haut droit, touchable en
/// entier vers la soirée, avec un ✕ qui la masque pour cette soirée-là.
///
/// C'est la première question qu'on se pose en ouvrant l'app un jeudi :
/// « je viens lundi ? ». Le texte disait « Touche pour répondre » sur une vue
/// qui ne répondait pas au toucher.
export default function Banniere({
  t,
  couleurA,
  titre,
  aide,
  onPress,
  onFermer,
}: {
  t: Jetons;
  couleurA: string;
  titre: string;
  aide: string;
  onPress: () => void;
  onFermer: () => void;
}) {
  return (
    <CarteVerre t={t} rayon={24} onPress={onPress} etiquette={`${titre} ${aide}`} style={s.carte}>
      {/* `radial-gradient(130% 150% at 100% 0%, --taH, transparent 60%)` :
          la chasuble A à 34 %, fondue aux trois cinquièmes. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="haloBanniere" cx="100%" cy="0%" rx="130%" ry="150%" fx="100%" fy="0%">
              <Stop offset="0" stopColor={couleurA} stopOpacity={0.34} />
              <Stop offset="0.6" stopColor={couleurA} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx={23} ry={23} fill="url(#haloBanniere)" />
        </Svg>
      </View>
      <Text style={[s.titre, { color: t.ink }]}>{titre}</Text>
      <Text style={[s.aide, { color: jeton(t, "i2") }]}>{aide}</Text>
      <Pressable
        onPress={onFermer}
        accessibilityRole="button"
        accessibilityLabel="Masquer pour cette soirée"
        style={({ pressed }) => [s.fermer, pressed && { backgroundColor: jeton(t, "gl") }]}
      >
        <IconeJeu nom="croix" couleur={jeton(t, "i3")} taille={18} epaisseur={2.2} />
      </Pressable>
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  // Les marges du site (22 22 20) et sa hauteur minimale.
  carte: { minHeight: 112, paddingTop: 22, paddingHorizontal: 22, paddingBottom: 20 },
  titre: { fontSize: 21, fontWeight: "600", lineHeight: 26, letterSpacing: -0.3, maxWidth: 270 },
  aide: { fontSize: 16, lineHeight: 21, marginTop: 6 },
  // Une vraie cible de 44, l'icône centrée dedans : posée au ras du coin, on
  // la ratait et le tap tombait sur la bannière — qui ouvre la soirée.
  fermer: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
