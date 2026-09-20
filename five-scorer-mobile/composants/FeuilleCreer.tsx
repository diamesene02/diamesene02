import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Feuille from "./Feuille";
import { IconeJeu } from "./Icones";
import { jeton, JETONS_NEUTRES, type Jetons } from "../lib/couleurs";

/// La feuille « Créer » : tout ce qu'on lance, en un endroit.
///
/// Elle vivait derrière le « + » de l'ancienne barre du bas. La barre est
/// partie (la navigation passe par la pilule, comme sur le site) ; la feuille
/// reste, et s'ouvre depuis le bloc de lancement de l'accueil.
///
/// Le libellé porte l'action, avec une ligne d'aide dessous et pas d'icône
/// par ligne — c'est le choix du site (components/BottomNav.tsx) : le texte
/// se lit plus vite qu'un pictogramme à deviner.
export default function FeuilleCreer({
  visible,
  onClose,
  clubId,
  t = JETONS_NEUTRES,
  soireeId,
  peutScorer = true,
  peutGerer = false,
  lieu,
}: {
  visible: boolean;
  onClose: () => void;
  clubId: string;
  t?: Jetons;
  /// La soirée du jour, quand il y en a une : la compo s'y rattache.
  soireeId?: string | null;
  /// Programmer une soirée demande le droit de marquer (`droits.peutScorer`
  /// de la saison, comme le bouton « Ajouter une soirée »).
  peutScorer?: boolean;
  /// Poser toute la saison d'un coup : les gérants seulement.
  peutGerer?: boolean;
  /// Le lieu habituel, pour préremplir la soirée et le calendrier.
  lieu?: string | null;
}) {
  const puis = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const compo = soireeId ? { clubId, soireeId } : { clubId };

  return (
    <Feuille t={t} visible={visible} onClose={onClose} titre="Créer">
      <Action
        t={t}
        titre="Lancer un match maintenant"
        aide="Deux équipes, un score, un chrono"
        onPress={puis(() => router.push({ pathname: "/compo", params: compo }))}
      />
      <Action
        t={t}
        titre="Saisir un match déjà joué"
        aide="La feuille sans chrono, pour rattraper une soirée"
        onPress={puis(() =>
          router.push({ pathname: "/compo", params: { ...compo, quand: "deja" } }),
        )}
      />
      {peutScorer && (
        <Action
          t={t}
          titre="Programmer une soirée"
          aide="Une date, un lieu : chacun répond présent"
          onPress={puis(() =>
            router.push({
              pathname: "/soiree/nouvelle",
              params: lieu ? { clubId, lieu } : { clubId },
            }),
          )}
        />
      )}
      {peutGerer && (
        <Action
          t={t}
          titre="Poser toute la saison"
          aide="Tous les lundis d'un coup, fériés et trêve sautés"
          onPress={puis(() =>
            router.push({
              pathname: "/calendrier",
              params: lieu ? { clubId, lieu } : { clubId },
            }),
          )}
        />
      )}
      <Pressable onPress={onClose} style={s.fermer} accessibilityRole="button">
        <Text style={[s.fermerTexte, { color: jeton(t, "i2") }]}>Fermer</Text>
      </Pressable>
    </Feuille>
  );
}

function Action({
  t,
  titre,
  aide,
  onPress,
}: {
  t: Jetons;
  titre: string;
  aide: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={aide}
      style={({ pressed }) => [s.action, pressed && { backgroundColor: jeton(t, "gl") }]}
    >
      <View style={s.actionTextes}>
        <Text style={[s.actionTitre, { color: t.ink }]}>{titre}</Text>
        <Text style={[s.actionAide, { color: jeton(t, "i2") }]}>{aide}</Text>
      </View>
      <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={18} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  actionTextes: { flex: 1, minWidth: 0 },
  actionTitre: { fontSize: 17, fontWeight: "600" },
  actionAide: { fontSize: 13, paddingTop: 2 },
  fermer: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 4 },
  fermerTexte: { fontSize: 17, fontWeight: "600" },
});
