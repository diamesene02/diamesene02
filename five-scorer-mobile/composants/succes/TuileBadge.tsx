import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { Jetons } from "../../lib/couleurs";
import { NOMS_MATIERES } from "../../lib/succes-icones";
import Medaille from "./Medaille";
import { dateCourte, resteAvantPalier } from "./textes";
import type { BadgeAffiche } from "./types";

/// Une famille de succès dans la grille : la médaille, le nom, et une seule
/// ligne — ce qu'il reste à faire, ou la date quand tout est pris. La matière
/// dit déjà où on en est. Même tuile que le site (components/succes/TuileBadge.tsx).
export default function TuileBadge({
  t,
  badge,
  chasubles,
  nouveau = false,
  onPress,
  style,
}: {
  t: Jetons;
  badge: BadgeAffiche;
  chasubles?: { a: string; b: string };
  /// Une pastille « Nouveau », pour ce qui vient d'être annoncé.
  nouveau?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const reste = resteAvantPalier(badge);
  const sous = reste ?? (badge.obtenuLe ? `obtenu le ${dateCourte(badge.obtenuLe)}` : "tous les paliers");
  const etat = badge.matiere ? NOMS_MATIERES[badge.matiere] : "à débloquer";
  const verrouillee = badge.palier === 0;

  const contenu = (
    <>
      <Medaille icone={badge.icone} matiere={badge.matiere} t={t} chasubles={chasubles} taille={56} />
      {nouveau && (
        <View style={[s.nouveau, { backgroundColor: t.bt ?? "#fff" }]}>
          <Text style={[s.nouveauTexte, { color: t.bf ?? "#111" }]}>Nouveau</Text>
        </View>
      )}
      <Text style={[s.nom, { color: verrouillee ? t.i2 : t.ink }]} numberOfLines={1}>
        {badge.nom}
      </Text>
      <Text style={[s.sous, { color: t.i2 }]} numberOfLines={2}>
        {sous}
      </Text>
    </>
  );

  const cadre = [s.tuile, { backgroundColor: t.seg, borderColor: t.gb ?? t.cb }, style];
  const etiquette = `${badge.nom}, ${etat}, ${sous}`;
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiquette}
      style={({ pressed }) => [...cadre, pressed && { opacity: 0.7 }]}
    >
      {contenu}
    </Pressable>
  ) : (
    <View style={cadre} accessible accessibilityLabel={etiquette}>
      {contenu}
    </View>
  );
}

const s = StyleSheet.create({
  tuile: {
    alignItems: "center",
    gap: 4,
    minWidth: 0,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  nom: { marginTop: 6, fontSize: 15, fontWeight: "700", textAlign: "center" },
  sous: { fontSize: 13, lineHeight: 16, textAlign: "center", fontVariant: ["tabular-nums"] },
  nouveau: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  nouveauTexte: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
});
