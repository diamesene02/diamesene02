import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Jetons } from "../../lib/couleurs";
import { Carte, duree, EcussonChasuble, MOUVEMENT, Touche, useMouvementReduit } from "../base";
import BarreProgression from "./BarreProgression";
import { nombre } from "./textes";
import type { NiveauAffiche } from "./types";

/// Le niveau d'un joueur : le chiffre dans l'écusson du club — celui de la
/// pastille posée sur l'avatar de la fiche —, le titre, l'XP, ce qui reste
/// jusqu'au suivant. Le détail des XP est replié : on le lit une fois, pour
/// comprendre, pas à chaque passage. Même carte que le site
/// (components/succes/CarteNiveau.tsx).
export default function CarteNiveau({
  t,
  niveau,
  chasubles,
  detail,
  style,
}: {
  t: Jetons;
  niveau: NiveauAffiche;
  chasubles?: { a: string; b: string };
  /// `SuccesJoueur.xpDetail`. Absent, rien ne se replie.
  detail?: { source: string; xp: number }[];
  style?: object;
}) {
  const [ouvert, setOuvert] = useState(false);
  // Le chevron tournait d'un coup, de zéro à cent quatre-vingts : on ne
  // voyait pas qu'il avait tourné, seulement qu'il avait changé. Il pivote
  // maintenant en `bascule` (180 ms), comme le détail du site.
  const reduit = useMouvementReduit();
  const pivot = useRef(new Animated.Value(ouvert ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(pivot, {
      toValue: ouvert ? 1 : 0,
      duration: duree(reduit, MOUVEMENT.bascule),
      easing: MOUVEMENT.courbe,
      useNativeDriver: true,
    }).start();
  }, [ouvert, pivot, reduit]);
  const suivant = niveau.niveau + 1;
  const reste = Math.max(0, niveau.xpSuivant - niveau.xp);
  const lignes = (detail ?? []).filter((d) => d.xp !== 0);
  const couleurA = chasubles?.a ?? t.ta ?? "#FF6B2C";

  return (
    <Carte t={t} style={[s.carte, style]}>
      <View style={s.tete}>
        <EcussonChasuble couleur={couleurA} lettre={String(niveau.niveau)} taille={56} />
        <View style={s.textes}>
          <Text style={[s.titre, { color: t.ink }]} numberOfLines={1}>
            {niveau.titre}
          </Text>
          <Text style={[s.sous, { color: t.i2 }]}>
            Niveau {niveau.niveau} · {nombre(niveau.xp)} XP
          </Text>
        </View>
      </View>
      <BarreProgression
        t={t}
        part={niveau.progression}
        chasubles={chasubles}
        hauteur={6}
        etiquette={`Vers le niveau ${suivant}`}
        style={s.barre}
      />
      <Text style={[s.reste, { color: t.i2 }]}>
        encore <Text style={[s.gras, { color: t.ink }]}>{nombre(reste)} XP</Text> pour le niveau {suivant}
      </Text>

      {lignes.length > 0 && (
        <View style={[s.detail, { borderTopColor: t.sep }]}>
          <Touche
            onPress={() => setOuvert((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: ouvert }}
            voile={0.6}
            style={s.detailTete}
          >
            <Text style={[s.detailTitre, { color: t.i2 }]}>D'où viennent les XP</Text>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: pivot.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "180deg"],
                    }),
                  },
                ],
              }}
            >
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke={t.i3}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </Animated.View>
          </Touche>
          {ouvert &&
            lignes.map((d) => (
              <View key={d.source} style={s.detailLigne}>
                <Text style={[s.detailSource, { color: t.ink }]}>{d.source}</Text>
                <Text style={[s.detailXp, { color: t.i2 }]}>+{nombre(d.xp)}</Text>
              </View>
            ))}
        </View>
      )}
    </Carte>
  );
}

const s = StyleSheet.create({
  carte: { paddingTop: 18, paddingBottom: 14 },
  tete: { flexDirection: "row", alignItems: "center", gap: 14 },
  textes: { flex: 1, minWidth: 0 },
  titre: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  sous: { marginTop: 2, fontSize: 15, fontVariant: ["tabular-nums"] },
  barre: { marginTop: 16 },
  reste: { marginTop: 8, fontSize: 13, fontVariant: ["tabular-nums"] },
  gras: { fontWeight: "700" },
  detail: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  detailTete: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailTitre: { fontSize: 15, fontWeight: "600" },
  detailLigne: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7 },
  detailSource: { fontSize: 15, flexShrink: 1 },
  detailXp: { fontSize: 15, fontVariant: ["tabular-nums"] },
});
