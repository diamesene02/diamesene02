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
        >
          {/* La feuille de match ne se quitte pas d'un balayage.
              Le geste de retour d'iOS part du bord gauche — exactement là où
              se trouve la première tuile de joueur, celle qu'on tape à chaque
              but. Un pouce qui glisse un peu, et l'écran de saisie s'en va au
              milieu du match. On sort par le bouton « ‹ », ou en terminant. */}
          <Stack.Screen name="match/[id]" options={{ gestureEnabled: false }} />
        </Stack>
      </FournisseurNoyau>
    </SafeAreaProvider>
  );
}
