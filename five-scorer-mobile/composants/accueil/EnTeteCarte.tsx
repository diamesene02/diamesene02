import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { IconeJeu } from "../Icones";
import { jeton, type Jetons } from "../../lib/couleurs";

/// L'en-tête d'une carte de l'accueil : le titre à GAUCHE (22/600) et, à sa
/// droite, la destination de la carte.
///
/// Les trois cartes du bas — « Ma saison », « Tableau », « Les exploits du
/// club » — avaient un titre centré ET, tout en bas, un pied centré qui
/// répétait « voir plus » : deux rangées pour dire ce qu'une seule dit mieux,
/// et trois titres au milieu d'une page qu'on parcourt du pouce en biais.
///
/// Le titre se cale donc à gauche, sur la même verticale que tout ce qu'il
/// annonce, et le lien remonte à côté de lui — c'est là qu'on le cherche,
/// comme dans Musique ou l'App Store. Chaque carte y gagne une cinquantaine
/// de points de hauteur, qui vont à ce qu'on est venu lire.
export default function EnTeteCarte({
  t,
  titre,
  action,
  etiquette,
  onAction,
  style,
}: {
  t: Jetons;
  titre: string;
  /// Le libellé du lien, court : « Voir tout », « Mes succès ».
  action?: string;
  /// Ce que le lecteur d'écran annonce à sa place, quand « Voir tout » ne
  /// suffit pas à dire où l'on va.
  etiquette?: string;
  onAction?: () => void;
  /// De quoi rattraper la marge de la carte quand ses rangées en ont une de
  /// plus (le tableau) : le titre doit tomber sur la même verticale que ce
  /// qu'il annonce.
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.tete, style]}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header" numberOfLines={1}>
        {titre}
      </Text>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={etiquette ?? action}
          hitSlop={8}
          style={({ pressed }) => [s.action, pressed && { opacity: 0.6 }]}
        >
          <Text style={[s.actionTexte, { color: jeton(t, "i2") }]} numberOfLines={1}>
            {action}
          </Text>
          <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={14} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  tete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titre: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, flexShrink: 1 },
  // La cible fait 44 avec le `hitSlop` : le texte seul n'en fait que 20.
  action: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  actionTexte: { fontSize: 15, fontWeight: "600" },
});
