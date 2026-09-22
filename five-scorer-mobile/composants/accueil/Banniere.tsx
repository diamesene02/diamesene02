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
///
/// Trois rangs, trois tailles, dans l'ordre où on les lit :
///
/// 1. QUAND — « Demain 19:00 », en 26/700 : c'est la réponse à la question ;
/// 2. OÙ — « Urban Soccer Guyancourt », en 17 : utile, jamais urgent ;
/// 3. MA PLACE — « 10 présents · complet · Tu es inscrit », en 13.
///
/// Les trois tenaient en une seule phrase de 21 points qui passait sur deux
/// lignes sous le bouton de fermeture, et rien n'y ressortait. Le titre garde
/// désormais sa ligne : la colonne de texte s'arrête avant le ✕.
export default function Banniere({
  t,
  couleurA,
  titre,
  lieu,
  aide,
  onPress,
  onFermer,
}: {
  t: Jetons;
  couleurA: string;
  /// Le quand : « Demain 19:00 » (logique.ts, `titreBanniere`).
  titre: string;
  /// Le où, quand la soirée en a un.
  lieu?: string | null;
  aide: string;
  onPress: () => void;
  onFermer: () => void;
}) {
  return (
    <CarteVerre
      t={t}
      onPress={onPress}
      etiquette={[titre, lieu, aide].filter(Boolean).join(". ")}
      style={s.carte}
    >
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
          <Rect x="0" y="0" width="100%" height="100%" rx={27} ry={27} fill="url(#haloBanniere)" />
        </Svg>
      </View>
      {/* Seul le TITRE s'arrête avant la cible du ✕ — c'est la seule ligne qui
          passe à sa hauteur. Le lieu et l'état, plus bas, prennent toute la
          carte : sinon « Tu es / compté présent » se coupait pour rien. */}
      <View>
        <Text style={[s.titre, s.sousCroix, { color: t.ink }]} numberOfLines={2}>
          {titre}
        </Text>
        {lieu ? (
          // Deux lignes plutôt qu'une coupure : un nom de salle est un nom
          // propre, « Urban Soccer Guy… » ne veut rien dire.
          <Text style={[s.lieu, { color: jeton(t, "i2") }]} numberOfLines={2}>
            {lieu}
          </Text>
        ) : null}
        <Text style={[s.aide, { color: jeton(t, "i2") }]} numberOfLines={2}>
          {aide}
        </Text>
      </View>
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
  // Rayon 28 comme toutes les autres cartes : trois arrondis différents sur
  // un même écran (24, 22, 28) se voyaient.
  carte: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20 },
  titre: { fontSize: 26, fontWeight: "700", lineHeight: 30, letterSpacing: -0.5 },
  sousCroix: { paddingRight: 36 },
  lieu: { fontSize: 17, lineHeight: 22, marginTop: 4 },
  aide: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  // Une vraie cible de 44, l'icône centrée dedans : posée au ras du coin, on
  // la ratait et le tap tombait sur la bannière — qui ouvre la soirée.
  fermer: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
