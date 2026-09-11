import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { abonnerVerdict, verdictActuel } from "../lib/protocoleClient";
import type { VerdictProtocole } from "../lib/protocole";
import { JETONS_NEUTRES } from "../lib/couleurs";

/// Ce que le serveur pense de notre version, dit et jamais imposé.
///
/// **Un bandeau, pas un écran, et rien n'est refusé.** Au gymnase sans réseau,
/// un blocage transformerait une incompatibilité de version en soirée perdue
/// — et une file bloquée est déjà le cul-de-sac que décrit `TRANS-13`. On ne
/// bloque pas ce qui se tape à une main (spec 0004, Q4).
///
/// Il se pose au-dessus du noyau dans `app/_layout.tsx` : il ne dépend
/// d'aucune donnée locale, et doit donc pouvoir s'afficher même si la base
/// refuse de s'ouvrir.
const MOTS: Record<Exclude<VerdictProtocole, "ok">, string> = {
  "trop-vieux": "Une mise à jour de l'app est disponible.",
  // Le cas qu'on oublie : l'app est plus récente que le serveur, parce qu'un
  // déploiement est en cours. Ce n'est pas à l'utilisateur de mettre à jour.
  "trop-recent": "Le serveur se met à jour. Réessaie dans un instant.",
};

export default function BandeauVersion() {
  const [verdict, setVerdict] = useState<VerdictProtocole>(verdictActuel);
  const haut = useSafeAreaInsets().top;

  useEffect(() => abonnerVerdict(setVerdict), []);

  if (verdict === "ok") return null;
  const t = JETONS_NEUTRES;

  return (
    <View style={[s.bandeau, { paddingTop: haut + 8, backgroundColor: t.or }]}>
      <Text style={s.texte}>{MOTS[verdict]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bandeau: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // Au-dessus de tout : c'est le seul élément qui doive rester lisible même
    // quand un écran s'ouvre par-dessus un autre.
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  texte: { fontSize: 14, fontWeight: "600", color: "#000", textAlign: "center" },
});
