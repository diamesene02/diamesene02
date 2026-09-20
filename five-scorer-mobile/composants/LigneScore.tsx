import { Pressable, StyleSheet, Text, View } from "react-native";
import { EcussonChasuble } from "./base";
import { jeton, type Jetons } from "../lib/couleurs";
import { lettre as lettreDe } from "../lib/ini";

/// LA ligne de score du site (`components/ios/LigneScore.tsx`) : écusson et
/// nom, chiffre, état au centre, chiffre, écusson et nom.
///
/// Le perdant est grisé, jamais rouge. Un match en direct porte le point
/// rouge au centre ; un match terminé porte « Terminé » et son heure ; un
/// match à venir n'a pas de chiffres. L'accueil, les matchs, la compo et
/// l'aperçu des réglages la partagent — sur le site aussi.
///
/// Les chiffres sont condensés par transformation (`scaleX(.86)`), jamais par
/// une chasse : c'est le « score lourd » du site, et il garde les chiffres
/// tabulaires alignés d'une ligne à l'autre.
export default function LigneScore({
  t,
  nomA,
  nomB,
  couleurA,
  couleurB,
  scoreA,
  scoreB,
  etat = "Terminé",
  heure,
  direct = false,
  aVenir = false,
  onPress,
  pied,
  lettreA,
  lettreB,
  reduite = false,
}: {
  t: Jetons;
  nomA: string;
  nomB: string;
  couleurA: string;
  couleurB: string;
  scoreA?: number | null;
  scoreB?: number | null;
  /// Le mot du centre : « Terminé », « En direct », « Effectif »…
  etat?: string;
  /// Sous l'état : l'heure, la durée, « joueurs par équipe ».
  heure?: string;
  direct?: boolean;
  aVenir?: boolean;
  onPress?: () => void;
  /// Une ligne sous toute la largeur (le buteur, le lieu).
  pied?: string;
  lettreA?: string;
  lettreB?: string;
  /// L'aperçu des réglages : écussons de 44, chiffres de 30, noms en 13.
  reduite?: boolean;
}) {
  const a = scoreA ?? 0;
  const b = scoreB ?? 0;
  const aPerd = !aVenir && !direct && a < b;
  const bPerd = !aVenir && !direct && b < a;
  const cote = reduite ? 64 : 88;
  const ecusson = reduite ? 44 : 60;
  const hauteur = ecusson;

  const camp = (nom: string, couleur: string, l: string | undefined) => (
    <View style={[s.camp, { width: cote }]}>
      <EcussonChasuble couleur={couleur} lettre={l ?? lettreDe(nom)} taille={ecusson} />
      <Text
        style={[s.nom, reduite && s.nomReduit, { color: jeton(t, "i2"), maxWidth: cote }]}
        numberOfLines={1}
      >
        {nom}
      </Text>
    </View>
  );
  const chiffre = (n: number, perd: boolean) =>
    aVenir ? (
      <View style={s.chiffre} />
    ) : (
      <View style={[s.chiffre, { height: hauteur }]}>
        <Text
          allowFontScaling={false}
          style={[
            s.lourd,
            reduite && s.lourdReduit,
            { color: perd ? jeton(t, "i3") : t.ink },
          ]}
        >
          {n}
        </Text>
      </View>
    );

  const corps = (
    <>
      <View style={s.rangee}>
        {camp(nomA, couleurA, lettreA)}
        {chiffre(a, aPerd)}
        <View style={[s.milieu, { height: hauteur }]}>
          {direct ? (
            <View style={s.direct}>
              <View style={[s.point, { backgroundColor: jeton(t, "bad") }]} />
              <Text style={[s.etat, { color: jeton(t, "bad") }]} numberOfLines={1}>
                {etat}
              </Text>
            </View>
          ) : (
            <Text style={[s.etat, reduite && s.etatReduit, { color: t.ink }]} numberOfLines={1}>
              {etat}
            </Text>
          )}
          {heure ? (
            <Text style={[s.heure, { color: jeton(t, "i2") }]} numberOfLines={1}>
              {heure}
            </Text>
          ) : null}
        </View>
        {chiffre(b, bPerd)}
        {camp(nomB, couleurB, lettreB)}
      </View>
      {pied ? <Text style={[s.pied, { color: jeton(t, "i2") }]}>{pied}</Text> : null}
    </>
  );

  const etiquette = aVenir
    ? `${nomA} contre ${nomB}, ${etat}${heure ? `, ${heure}` : ""}`
    : `${nomA} ${a}, ${nomB} ${b}, ${etat}${heure ? `, ${heure}` : ""}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={etiquette}
        style={({ pressed }) => [s.ligne, pressed && { opacity: 0.7 }]}
      >
        {corps}
      </Pressable>
    );
  }
  return (
    <View style={s.ligne} accessible accessibilityLabel={etiquette}>
      {corps}
    </View>
  );
}

const s = StyleSheet.create({
  ligne: { paddingTop: 12, paddingHorizontal: 12, paddingBottom: 14 },
  rangee: { flexDirection: "row", alignItems: "flex-start" },
  camp: { alignItems: "center", gap: 8 },
  nom: { fontSize: 16, fontWeight: "500" },
  nomReduit: { fontSize: 13 },
  // `minWidth` : sans lui, un milieu large (« Effectif · joueurs par équipe »,
  // sur la compo) pousse les chiffres sous leur largeur naturelle et le 8 se
  // retrouve coupé en deux, de part et d'autre du texte. Le milieu, lui, se
  // rétrécit : un libellé vaut moins que le score.
  chiffre: { flex: 1, minWidth: 36, alignItems: "center", justifyContent: "center" },
  lourd: {
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -2.6,
    lineHeight: 56,
    fontVariant: ["tabular-nums"],
    transform: [{ scaleX: 0.86 }],
  },
  lourdReduit: { fontSize: 30, letterSpacing: -1.5, lineHeight: 34 },
  milieu: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 8,
  },
  etat: { fontSize: 17, fontWeight: "600" },
  etatReduit: { fontSize: 13 },
  heure: { fontSize: 13, fontVariant: ["tabular-nums"] },
  direct: { flexDirection: "row", alignItems: "center", gap: 6 },
  point: { width: 8, height: 8, borderRadius: 4 },
  pied: { fontSize: 15, textAlign: "center", paddingTop: 8, paddingHorizontal: 8 },
});
