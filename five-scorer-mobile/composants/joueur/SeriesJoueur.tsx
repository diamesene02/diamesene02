import { StyleSheet, Text, View } from "react-native";
import { CarteVerre } from "../base";
import { jeton, type Jetons } from "../../lib/couleurs";
import type { Serie } from "../../lib/succes";

/// La ligne sous le chiffre, mot pour mot celle du site (SuccesFiche.tsx).
function sousSerie(s: Pick<Serie, "enCours" | "record">): string {
  if (s.record === 0) return "pas encore de série";
  if (s.enCours > 0 && s.enCours >= s.record) return "record en cours";
  return `en cours · record ${s.record}`;
}

/// Les quatre séries du joueur, en deux colonnes : le nom, la série EN COURS
/// en grand — c'est elle qui se joue lundi prochain —, et le record dessous.
export default function SeriesJoueur({
  t,
  series,
  style,
}: {
  t: Jetons;
  series: Serie[];
  style?: object;
}) {
  if (series.length === 0) return null;
  return (
    <CarteVerre t={t} style={[s.carte, style]}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Séries
      </Text>
      <View style={s.grille}>
        {series.map((se) => {
          const bas = sousSerie(se);
          return (
            <View
              key={se.id}
              style={[s.tuile, { backgroundColor: jeton(t, "seg"), borderColor: jeton(t, "gb") }]}
              accessible
              accessibilityLabel={`${se.nom} : ${se.enCours}, ${bas}`}
            >
              <Text
                style={[s.nom, { color: t.ink }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {se.nom}
              </Text>
              <Text style={[s.chiffre, { color: t.ink }]} numberOfLines={1}>
                {se.enCours}
              </Text>
              <Text style={[s.bas, { color: jeton(t, "i2") }]} numberOfLines={1}>
                {bas}
              </Text>
            </View>
          );
        })}
      </View>
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 16, paddingBottom: 16 },
  titre: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingTop: 20,
    paddingBottom: 12,
  },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // Deux colonnes : quatre séries, toujours paires.
  tuile: {
    width: "47%",
    flexGrow: 1,
    gap: 2,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nom: { fontSize: 17, fontWeight: "600" },
  chiffre: {
    fontSize: 28,
    letterSpacing: -0.4,
    lineHeight: 32,
    fontVariant: ["tabular-nums"],
  },
  bas: { fontSize: 13, fontVariant: ["tabular-nums"] },
});
