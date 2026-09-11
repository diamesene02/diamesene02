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
/// Court, et à l'IMPÉRATIF — c'est le geste qui compte, pas la nouvelle.
///
/// Un bandeau ne porte pas de bouton : l'app ne peut pas se mettre à jour
/// elle-même, et un bouton qui ne ferait rien serait pire que la phrase. Dire
/// le geste EST la suite que demande l'article V.
const MOTS: Record<Exclude<VerdictProtocole, "ok">, string> = {
  "trop-vieux": "Mets à jour l'app.",
  // Le cas qu'on oublie : l'app est plus RÉCENTE que le serveur, parce qu'un
  // déploiement est en cours. Ce n'est pas à l'utilisateur de mettre à jour —
  // on lui dit d'attendre, pas d'agir.
  "trop-recent": "Le serveur se met à jour.",
};

export default function BandeauVersion() {
  const [verdict, setVerdict] = useState<VerdictProtocole>(verdictActuel);
  const haut = useSafeAreaInsets().top;

  useEffect(() => abonnerVerdict(setVerdict), []);

  if (verdict === "ok") return null;
  const t = JETONS_NEUTRES;

  return (
    // Dans le FLUX, pas en `absolute`. Posé par-dessus, il recouvrait le titre
    // du club — et, sur la feuille de match, le bouton « ‹ » et le menu, dont
    // la surface tapable tombait de 44 à 29 px sur l'écran qu'on tient à une
    // main en jouant. Un avertissement qui cache ce qu'on utilise est pire que
    // pas d'avertissement.
    //
    // Il pousse donc l'app vers le bas quand il s'affiche. Les écrans en
    // dessous gardent leur propre marge haute, ce qui ajoute un peu d'air —
    // c'est le bon échange : de l'espace en trop de temps en temps, jamais
    // rien de caché.
    <View style={[s.bandeau, { paddingTop: haut + 10, backgroundColor: t.or }]}>
      <Text style={s.texte}>{MOTS[verdict]}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bandeau: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  texte: { fontSize: 14, fontWeight: "600", color: "#000", textAlign: "center" },
});
