import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

// La pile de navigation. Pas d'en-tête natif : chaque écran dessine le sien,
// comme sur le web — la barre du club et le bouton de retour font partie du
// dessin, pas du chrome du système.
export default function Disposition() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0b0b0e" },
          animation: "slide_from_right",
        }}
      />
    </SafeAreaProvider>
  );
}
