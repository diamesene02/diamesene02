import { StyleSheet, Text, View } from "react-native";
import { BoutonVerre } from "../base";
import type { Jetons } from "../../lib/couleurs";

/// La pastille « But de Bakary (12′) retiré · Rétablir » (`.live-retour` du
/// site), cinq secondes au-dessus du pied.
///
/// « Annuler » est collé à « Pause » : un pouce qui vise l'un touche l'autre,
/// et un but disparaissait sans trace — seul un son le signalait. La
/// pastille dit ce qui est parti et laisse le temps de le remettre. Posée
/// AU-DESSUS du pied, pas dessus : on doit pouvoir terminer le match sans
/// attendre qu'elle s'efface.
export default function BandeRetrait({
  t,
  phrase,
  onRetablir,
}: {
  t: Jetons;
  phrase: string;
  onRetablir: () => void;
}) {
  return (
    <View style={s.bande} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Text style={[s.phrase, { color: t.ink }]} numberOfLines={1}>
        {phrase}
      </Text>
      <BoutonVerre t={t} taille="normal" titre="Rétablir" onPress={onRetablir} />
    </View>
  );
}

const s = StyleSheet.create({
  bande: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 14,
    marginBottom: 4,
    paddingVertical: 6,
    paddingRight: 6,
    paddingLeft: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(14,14,24,0.94)",
  },
  phrase: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600" },
});
