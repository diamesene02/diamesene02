import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { jeton, type Jetons } from "../../lib/couleurs";

/// Le champ « date et heure » — l'`input datetime-local` du site : un seul
/// champ, 52 de haut, fond `seg`, rayon 14.
///
/// Sur iOS, le sélecteur compact du système EST le champ : il affiche la
/// date et l'heure et s'ouvre au doigt. L'écran l'affichait sous un texte
/// qui disait déjà la même chose — la date apparaissait deux fois.
///
/// Sur Android, le sélecteur ne sait pas faire date ET heure d'un coup : le
/// champ ouvre la date, puis l'heure.
export default function ChampDate({
  t,
  valeur,
  onChange,
  maximum,
  etiquette,
}: {
  t: Jetons;
  valeur: Date;
  onChange: (d: Date) => void;
  maximum?: Date;
  etiquette: string;
}) {
  const [etape, setEtape] = useState<"date" | "heure" | null>(null);

  if (Platform.OS === "ios") {
    return (
      <View style={[s.champ, { backgroundColor: jeton(t, "seg") }]}>
        <DateTimePicker
          value={valeur}
          mode="datetime"
          display="compact"
          maximumDate={maximum}
          themeVariant="dark"
          locale="fr-FR"
          accessibilityLabel={etiquette}
          onChange={(_, d) => {
            if (d) onChange(d);
          }}
        />
      </View>
    );
  }

  const texte =
    valeur.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) +
    " · " +
    valeur.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Pressable
        onPress={() => setEtape("date")}
        accessibilityRole="button"
        accessibilityLabel={`${etiquette} : ${texte}`}
        style={({ pressed }) => [
          s.champ,
          s.champAndroid,
          { backgroundColor: jeton(t, "seg") },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={[s.texte, { color: t.ink }]} numberOfLines={1}>
          {texte.charAt(0).toUpperCase() + texte.slice(1)}
        </Text>
      </Pressable>
      {etape && (
        <DateTimePicker
          value={valeur}
          mode={etape === "date" ? "date" : "time"}
          display="default"
          maximumDate={maximum}
          onChange={(e, d) => {
            if (e.type === "dismissed" || !d) return setEtape(null);
            const suite = new Date(valeur);
            if (etape === "date") {
              suite.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              onChange(suite);
              setEtape("heure");
            } else {
              suite.setHours(d.getHours(), d.getMinutes(), 0, 0);
              onChange(suite);
              setEtape(null);
            }
          }}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  champ: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  champAndroid: { paddingHorizontal: 16 },
  texte: { fontSize: 17 },
});
