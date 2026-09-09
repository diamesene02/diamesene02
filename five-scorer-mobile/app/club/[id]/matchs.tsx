import Ecran from "../../../composants/Ecran";
import { View, Text, StyleSheet } from "react-native";

/// Provisoire — le relevé de l'écran du site est en cours.
export default function Provisoire() {
  return (
    <Ecran>
      <View style={s.centre}>
        <Text style={s.texte}>En construction.</Text>
      </View>
    </Ecran>
  );
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  texte: { color: "rgba(255,255,255,0.62)", fontSize: 17 },
});
