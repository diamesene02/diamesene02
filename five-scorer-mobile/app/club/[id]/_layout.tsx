import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  IconeAccueil,
  IconeBallon,
  IconeCalendrier,
  IconeCourbe,
  IconePlus,
} from "../../../composants/Icones";

/// La barre du bas, reprise de celle du site (components/BottomNav.tsx).
///
/// Cinq onglets de largeur égale sur 64 px, l'icône puis son libellé en 13
/// gras, et un trait de 3 px sous l'actif. Le troisième n'est pas une page :
/// c'est « Créer », qui ouvre une feuille.
///
/// On dessine la barre à la main plutôt que d'utiliser celle d'expo-router :
/// l'onglet du milieu n'a pas d'écran derrière lui, et le trait actif du site
/// est au-dessus du libellé, pas en dessous de la barre.
const ONGLETS = [
  { nom: "index", libelle: "Accueil", Icone: IconeAccueil },
  { nom: "matchs", libelle: "Matchs", Icone: IconeBallon },
  { nom: "soirees", libelle: "Soirées", Icone: IconeCalendrier },
  { nom: "stats", libelle: "Stats", Icone: IconeCourbe },
] as const;

export default function DispositionClub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [feuille, setFeuille] = useState(false);
  const bas = useSafeAreaInsets().bottom;

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
        tabBar={({ state, navigation }) => (
          <View style={[s.barre, { height: 64 + bas, paddingBottom: bas }]}>
            {ONGLETS.slice(0, 2).map((o) => (
              <Onglet
                key={o.nom}
                {...o}
                actif={state.routes[state.index]?.name === o.nom}
                onPress={() => navigation.navigate(o.nom)}
              />
            ))}

            <Pressable
              onPress={() => setFeuille(true)}
              accessibilityLabel="Créer un match ou une soirée"
              style={s.onglet}
            >
              <IconePlus couleur="rgba(255,255,255,0.4)" />
              <Text style={[s.libelle, { color: "rgba(255,255,255,0.4)" }]}>Créer</Text>
            </Pressable>

            {ONGLETS.slice(2).map((o) => (
              <Onglet
                key={o.nom}
                {...o}
                actif={state.routes[state.index]?.name === o.nom}
                onPress={() => navigation.navigate(o.nom)}
              />
            ))}
          </View>
        )}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="matchs" />
        <Tabs.Screen name="soirees" />
        <Tabs.Screen name="stats" />
      </Tabs>

      <Modal
        visible={feuille}
        transparent
        animationType="slide"
        onRequestClose={() => setFeuille(false)}
      >
        <Pressable style={s.voile} onPress={() => setFeuille(false)}>
          <Pressable style={[s.feuille, { paddingBottom: bas + 16 }]} onPress={() => {}}>
            <Action
              titre="Lancer un match maintenant"
              aide="Deux équipes, un score, un chrono"
              onPress={() => {
                setFeuille(false);
                router.push({ pathname: "/compo", params: { clubId: id } });
              }}
            />
            <Action
              titre="Saisir un match déjà joué"
              aide="La feuille sans chrono, pour rattraper une soirée"
              onPress={() => {
                setFeuille(false);
                router.push({ pathname: "/compo", params: { clubId: id, quand: "deja" } });
              }}
            />
            <View style={{ height: 8 }} />
            <Pressable onPress={() => setFeuille(false)} style={s.fermer}>
              <Text style={s.fermerTexte}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Onglet({
  libelle,
  Icone,
  actif,
  onPress,
}: {
  libelle: string;
  Icone: (p: { couleur: string; taille?: number }) => React.ReactElement;
  actif: boolean;
  onPress: () => void;
}) {
  const couleur = actif ? "#ffffff" : "rgba(255,255,255,0.4)";
  return (
    <Pressable onPress={onPress} style={s.onglet} accessibilityRole="button">
      <Icone couleur={couleur} />
      <Text style={[s.libelle, { color: couleur }]}>{libelle}</Text>
      {actif && <View style={s.trait} />}
    </Pressable>
  );
}

function Action({
  titre,
  aide,
  onPress,
}: {
  titre: string;
  aide: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={s.action}>
      <View style={{ flex: 1 }}>
        <Text style={s.actionTitre}>{titre}</Text>
        <Text style={s.actionAide}>{aide}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  barre: {
    flexDirection: "row",
    alignItems: "stretch",
    // La hauteur est posée à l'usage : en React Native elle englobe le
    // rembourrage, donc « 64 » avec une zone sûre de 34 ne laissait que 30 px
    // de contenu — le trait de l'onglet actif barrait le libellé.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0b0b0e",
    paddingHorizontal: 4,
  },
  onglet: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8 },
  libelle: { fontSize: 13, fontWeight: "600" },
  // Le trait du site est posé sous l'onglet actif, bord à bord moins 12 px.
  trait: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 3,
    backgroundColor: "#ffffff",
  },

  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  feuille: {
    backgroundColor: "#0b0b0e",
    borderTopWidth: 3,
    borderTopColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionTitre: { color: "#ffffff", fontSize: 17, fontWeight: "600" },
  actionAide: { color: "rgba(255,255,255,0.62)", fontSize: 13, paddingTop: 2 },
  chevron: { color: "rgba(255,255,255,0.4)", fontSize: 22 },
  fermer: { height: 52, alignItems: "center", justifyContent: "center" },
  fermerTexte: { color: "rgba(255,255,255,0.62)", fontSize: 17, fontWeight: "600" },
});
