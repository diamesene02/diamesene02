import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FournisseurNoyau } from "../composants/Noyau";

// La pile de navigation. Pas d'en-tête natif : chaque écran dessine le sien,
// comme sur le web — la barre du club et le bouton de retour font partie du
// dessin, pas du chrome du système.
export default function Disposition() {
  return (
    <SafeAreaProvider>
      {/* La base locale s'ouvre ici, une fois, avant le premier écran : c'est
          elle qui rend la saisie possible sans réseau, et la file qui pousse
          la soirée vers le serveur quand il revient. */}
      <FournisseurNoyau>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0b0b0e" },
            animation: "slide_from_right",
          }}
        />
      </FournisseurNoyau>
    </SafeAreaProvider>
  );
}
