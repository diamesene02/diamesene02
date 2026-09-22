import { Pressable, StyleSheet, Text, View } from "react-native";
import { CarteVerre } from "../base";
import { IconeJeu } from "../Icones";
import { jeton, type Jetons } from "../../lib/couleurs";

/// L'or des rappels du site (`--gold`). Pas un jeton du club : un rappel a la
/// même couleur quelles que soient les chasubles, c'est ce qui le fait
/// reconnaître d'un coup d'œil.
const OR_RAPPEL = "#ffc24d";

/// Un rappel de l'accueil (`.rappel` du site) : fond `seg`, filet or à
/// gauche, un titre qui dit la chose à faire, une aide qui dit où et quand,
/// un chevron. Toute la rangée se touche.
export function Rappel({
  t,
  titre,
  aide,
  onPress,
}: {
  t: Jetons;
  titre: string;
  aide: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titre}. ${aide}`}
      style={({ pressed }) => [
        s.rappel,
        { backgroundColor: jeton(t, "seg") },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={s.corps}>
        <Text style={[s.titre, { color: t.ink }]}>{titre}</Text>
        <Text style={[s.aide, { color: jeton(t, "i2") }]}>{aide}</Text>
      </View>
      <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={16} />
    </Pressable>
  );
}

/// Une carte de rattrapage (`.accueil-rattrapage` du site) : un titre or en
/// capitales, puis une rangée par chose à rattraper — « Mercredi 9 septembre
/// · 0–0 · Terminer › », « Lundi 7 septembre · Saisir la feuille › ».
///
/// Pleine largeur ET même rayon (28) que les autres cartes : le site la rentre
/// de 14 points de chaque côté et la colle sous la bannière, un reste d'une
/// mise en page où son conteneur n'avait pas de marge.
export function CarteRattrapage({
  t,
  titre,
  rangees,
}: {
  t: Jetons;
  titre: string;
  rangees: { cle: string; quand: string; acte: string; onPress: () => void }[];
}) {
  return (
    <CarteVerre t={t} style={s.carte}>
      <Text style={[s.titreCarte, { color: jeton(t, "or") }]} accessibilityRole="header">
        {titre}
      </Text>
      {rangees.map((r, i) => (
        <Pressable
          key={r.cle}
          onPress={r.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${r.quand}, ${r.acte}`}
          style={({ pressed }) => [
            s.rangee,
            i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[s.quand, { color: t.ink }]} numberOfLines={1}>
            {r.quand}
          </Text>
          <Text style={[s.acte, { color: jeton(t, "i2") }]} numberOfLines={1}>
            {r.acte}
          </Text>
          <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={16} />
        </Pressable>
      ))}
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  // Rayon 18, et non 14 : un rappel n'est pas une carte (28), mais il en est
  // voisin. Trois arrondis différents dans une même colonne se remarquent —
  // c'est le genre de détail qui fait « bricolé » sans qu'on sache dire
  // pourquoi.
  rappel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    minHeight: 56,
    borderRadius: 18,
    borderLeftWidth: 3,
    borderLeftColor: OR_RAPPEL,
  },
  corps: { flex: 1, minWidth: 0, gap: 2 },
  titre: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
  aide: { fontSize: 13, lineHeight: 18 },

  carte: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8 },
  titreCarte: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  rangee: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56 },
  quand: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "600" },
  acte: { fontSize: 15, fontWeight: "600" },
});
