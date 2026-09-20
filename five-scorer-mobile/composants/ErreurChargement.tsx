import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { BoutonVerre, CarteVerre } from "./base";
import type { Jetons } from "../lib/couleurs";
import {
  detailTechnique,
  messageErreur,
  natureErreur,
  vautLaPeineDeReessayer,
} from "../lib/erreurs";

/// Ce qu'un écran montre quand son chargement a échoué.
///
/// Une phrase qui dit quoi faire, et le bouton qui le fait : « Réessayer »,
/// ou « Se reconnecter » quand c'est la session. Avant, l'écran écrivait
/// l'erreur brute en rouge, adresse du serveur comprise, et seul un
/// tirer-pour-rafraîchir que rien ne signalait permettait de relancer.
///
/// Le message d'origine n'est pas perdu : un appui long sur la phrase
/// l'affiche. C'est lui qu'on recopiera dans un message si ça recommence.
export default function ErreurChargement({
  t,
  erreur,
  onReessayer,
  style,
}: {
  t: Jetons;
  /// L'erreur telle qu'attrapée — un objet `Error` ou le message déjà rangé
  /// en chaîne, les deux se traduisent.
  erreur: unknown;
  onReessayer?: () => unknown;
  style?: StyleProp<ViewStyle>;
}) {
  const [enCours, setEnCours] = useState(false);
  const detail = detailTechnique(erreur);
  const session = natureErreur(erreur) === "session";

  const reessayer = async () => {
    if (!onReessayer) return;
    setEnCours(true);
    try {
      await onReessayer();
    } finally {
      setEnCours(false);
    }
  };

  return (
    <CarteVerre t={t} style={[s.carte, style]}>
      <Pressable
        onLongPress={detail ? () => Alert.alert("Détail technique", detail) : undefined}
        accessibilityHint={detail ? "Appui long pour le détail technique" : undefined}
      >
        <Text style={[s.message, { color: t.ink }]}>{messageErreur(erreur)}</Text>
      </Pressable>
      {session ? (
        <BoutonVerre
          t={t}
          taille="normal"
          titre="Se reconnecter"
          onPress={() => router.replace("/connexion")}
        />
      ) : onReessayer && vautLaPeineDeReessayer(erreur) ? (
        <BoutonVerre
          t={t}
          taille="normal"
          titre={enCours ? "On réessaie…" : "Réessayer"}
          disabled={enCours}
          onPress={() => void reessayer()}
        />
      ) : null}
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  carte: { padding: 18, gap: 14, alignItems: "stretch" },
  message: { fontSize: 17, lineHeight: 22, textAlign: "center" },
});
