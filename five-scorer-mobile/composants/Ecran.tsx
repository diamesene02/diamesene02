import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { fondDuClub, JETONS_NEUTRES, type Jetons } from "../lib/couleurs";

/// Le cadre commun de tous les écrans : le fond dégradé aux couleurs du club,
/// et les marges de sécurité de l'appareil.
///
/// Le dégradé n'apparaît que quand on connaît les couleurs. Tant qu'on ne les
/// connaît pas, un fond neutre — en afficher d'autres puis les remplacer
/// ferait clignoter l'écran à chaque ouverture.
export default function Ecran({
  t = JETONS_NEUTRES,
  chasubles,
  children,
}: {
  t?: Jetons;
  chasubles?: { a: string; b: string };
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.racine, { backgroundColor: t.bgSolid }]}>
      <StatusBar style="light" />
      {chasubles && (
        <LinearGradient
          colors={fondDuClub(chasubles.a, chasubles.b)}
          locations={[0, 0.38, 0.74, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <SafeAreaView style={styles.racine}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({ racine: { flex: 1 } });
