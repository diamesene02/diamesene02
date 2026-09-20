import { Pressable, StyleSheet, Text, View } from "react-native";
import Medaille from "../succes/Medaille";
import { dateRelative } from "../succes/textes";
import { jeton, type Jetons } from "../../lib/couleurs";
import { NOMS_MATIERES } from "../../lib/succes-icones";
import type { Deblocage } from "../../lib/succes";

/// Un palier franchi, sur la fiche du joueur — la ligne du site
/// (`.palier-ligne`) : la médaille, « Soirée de feu · 3 buts en une
/// soirée », le jour à droite. Sans le nom du joueur : c'est sa fiche.
///
/// Touchable quand le serveur sait quel match l'a déclenché : on va au récap,
/// là où le triplé s'est joué. Sans match (une série de soirées, un titre de
/// saison), la ligne ne fait pas semblant.
export default function LignePalier({
  t,
  palier,
  chasubles,
  onPress,
}: {
  t: Jetons;
  palier: Deblocage;
  chasubles?: { a: string; b: string };
  onPress?: () => void;
}) {
  const quand = dateRelative(palier.le);
  const cadre = [s.ligne, { borderTopColor: jeton(t, "sep") }];
  const etiquette = `${palier.nom}, ${palier.libelle}, ${NOMS_MATIERES[palier.matiere]}${quand ? `, ${quand}` : ""}`;
  const contenu = (
    <>
      <Medaille icone={palier.icone} matiere={palier.matiere} t={t} chasubles={chasubles} taille={36} />
      <View style={s.textes}>
        <Text style={[s.texte, { color: t.ink }]}>
          <Text style={s.nom}>{palier.nom}</Text> · {palier.libelle}
        </Text>
      </View>
      {quand ? <Text style={[s.quand, { color: jeton(t, "i2") }]}>{quand}</Text> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={cadre} accessible accessibilityLabel={etiquette}>
        {contenu}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiquette}
      accessibilityHint="Ouvre le récap du match"
      style={({ pressed }) => [...cadre, pressed && { opacity: 0.7 }]}
    >
      {contenu}
    </Pressable>
  );
}

const s = StyleSheet.create({
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  textes: { flex: 1, minWidth: 0 },
  texte: { fontSize: 17, lineHeight: 22 },
  nom: { fontWeight: "600" },
  quand: { fontSize: 15 },
});
