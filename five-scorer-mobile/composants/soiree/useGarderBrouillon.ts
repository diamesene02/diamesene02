import { useRef } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";
// Le react-navigation EMBARQUÉ par expo-router, pas celui de node_modules :
// c'est lui qui porte la pile de l'app, et un autre exemplaire ne verrait
// aucun écran.
import { usePreventRemove } from "expo-router/react-navigation";
import { avertissement } from "../../lib/haptique";

/// Demande avant de quitter un écran où l'on a composé sans enregistrer.
///
/// Le capitaine place douze joueurs, touche « ‹ » par réflexe — ou balaie
/// depuis le bord — et tout était perdu, sans un mot. Le geste de retour est
/// retenu tant que `modifie` est vrai : « Enregistrer », « Jeter » ou
/// « Rester ».
///
/// Rend `laisserPartir()` : à appeler juste avant une navigation voulue
/// (le coup d'envoi remplace l'écran par la feuille de match) pour qu'elle
/// ne pose pas la question.
export function useGarderBrouillon({
  modifie,
  titre,
  message,
  enregistrer,
  jeter,
}: {
  modifie: boolean;
  titre: string;
  message: string;
  /// Rend `true` quand c'est enregistré : l'écran peut alors partir.
  enregistrer?: () => Promise<boolean>;
  jeter?: () => void;
}): () => void {
  const navigation = useNavigation();
  const libre = useRef(false);

  usePreventRemove(modifie, ({ data }) => {
    if (libre.current) {
      navigation.dispatch(data.action);
      return;
    }
    avertissement();
    Alert.alert(titre, message, [
      { text: "Rester", style: "cancel" },
      {
        text: "Jeter",
        style: "destructive",
        onPress: () => {
          jeter?.();
          navigation.dispatch(data.action);
        },
      },
      ...(enregistrer
        ? [
            {
              text: "Enregistrer",
              style: "default" as const,
              onPress: () => {
                void enregistrer().then((ok) => {
                  if (ok) navigation.dispatch(data.action);
                });
              },
            },
          ]
        : []),
    ]);
  });

  return () => {
    libre.current = true;
  };
}
