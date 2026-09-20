import { StyleSheet, Text, View } from "react-native";
import { EcussonChasuble } from "../base";
import { IconeBallon } from "../Icones";
import { minutesDuButeur } from "./textes";

// Le haut du récap, repris de RecapView.tsx et recap.css du site : le score
// en 148, l'état au milieu, les écussons de 76, puis les buteurs sur deux
// colonnes. Toujours sur le fond de match sombre : les encres sont en blanc
// franc et à opacité, pas en jetons de club.

const ROUGE = "#ff453a";
/// Le perdant du grand score : 35 % (`.recap-chiffre.perd`), plus effacé que
/// sur la feuille en direct, où l'on doit encore le lire à deux mètres.
const PERDANT = "rgba(255,255,255,0.35)";

export type EtatMarque = "TERMINE" | "ANNULE" | "EN_DIRECT";

/// Le score : trois colonnes, les chiffres compressés à 86 % (`.score-lourd`),
/// « Terminé » et la date au milieu, sans tiret entre les deux.
export function BlocScore({
  scoreA,
  scoreB,
  etat,
  date,
}: {
  scoreA: number;
  scoreB: number;
  etat: EtatMarque;
  /// « 2 sept. »
  date: string;
}) {
  return (
    <View
      style={s.marque}
      accessible
      accessibilityLabel={`${scoreA} à ${scoreB}, ${
        etat === "ANNULE" ? "annulé" : etat === "EN_DIRECT" ? "en direct" : "terminé"
      }, ${date}`}
    >
      <Chiffre valeur={scoreA} perd={scoreB > scoreA} />
      <View style={s.milieu}>
        {etat === "EN_DIRECT" ? (
          <View style={s.direct}>
            <View style={s.point} />
            <Text style={[s.etat, { color: ROUGE }]}>En direct</Text>
          </View>
        ) : (
          <Text style={[s.etat, etat === "ANNULE" && { color: ROUGE }]}>
            {etat === "ANNULE" ? "Annulé" : "Terminé"}
          </Text>
        )}
        <Text style={s.date}>{date}</Text>
      </View>
      <Chiffre valeur={scoreB} perd={scoreA > scoreB} />
    </View>
  );
}

function Chiffre({ valeur, perd }: { valeur: number; perd: boolean }) {
  return (
    <View style={s.colonne}>
      <Text
        allowFontScaling={false}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[s.chiffre, perd && { color: PERDANT }]}
      >
        {valeur}
      </Text>
    </View>
  );
}

/// Les deux écussons, le nom de chaque chasuble et son bilan de la saison.
export function Equipes({
  camps,
  couleurs,
}: {
  camps: { nom: string; lettre: string; bilan: string | null }[];
  couleurs: [string, string];
}) {
  return (
    <View style={s.equipes}>
      {camps.map((c, i) => (
        <View key={i} style={s.equipe}>
          <EcussonChasuble couleur={couleurs[i]} lettre={c.lettre} taille={76} anneau={5} />
          <Text style={s.nomEquipe} numberOfLines={1}>
            {c.nom}
          </Text>
          {c.bilan ? <Text style={s.bilan}>{c.bilan}</Text> : null}
        </View>
      ))}
    </View>
  );
}

type Buteur = { nom: string; minutes: (number | null)[] };

/// Les buteurs, sous les écussons et non dedans : deux colonnes, le ballon
/// du côté de l'écusson, les minutes plus pâles que le nom.
export function Buteurs({ a, b }: { a: Buteur[]; b: Buteur[] }) {
  if (a.length === 0 && b.length === 0) return null;
  const liste = (l: Buteur[], droite: boolean) => (
    <View style={s.liste}>
      {l.map((bt) => {
        const mins = minutesDuButeur(bt.minutes);
        return (
          <Text key={bt.nom} style={[s.buteur, droite && s.aDroite]} numberOfLines={2}>
            {bt.nom}
            {mins ? <Text style={s.minutes}> {mins}</Text> : null}
          </Text>
        );
      })}
    </View>
  );
  return (
    <View style={s.buteurs}>
      <View style={s.colonneButeurs}>
        {a.length > 0 && (
          <View style={s.ballon}>
            <IconeBallon couleur="#ffffff" taille={20} />
          </View>
        )}
        {liste(a, false)}
      </View>
      <View style={[s.colonneButeurs, s.colonneB]}>
        {liste(b, true)}
        {b.length > 0 && (
          <View style={s.ballon}>
            <IconeBallon couleur="#ffffff" taille={20} />
          </View>
        )}
      </View>
    </View>
  );
}

/// Le score réduit de l'en-tête condensé : écusson de 40, chiffre de 30.
export function MiniScore({
  scoreA,
  scoreB,
  lettres,
  couleurs,
  etat,
  date,
}: {
  scoreA: number;
  scoreB: number;
  lettres: [string, string];
  couleurs: [string, string];
  etat: EtatMarque;
  date: string;
}) {
  return (
    <View style={s.mini}>
      <View style={s.miniCamp}>
        <EcussonChasuble couleur={couleurs[0]} lettre={lettres[0]} taille={40} ombre={false} />
        <Text allowFontScaling={false} style={[s.miniChiffre, scoreB > scoreA && s.miniPerd]}>
          {scoreA}
        </Text>
      </View>
      <View style={s.miniMilieu}>
        <Text
          style={[s.miniEtat, etat !== "TERMINE" && { color: ROUGE }]}
          numberOfLines={1}
        >
          {etat === "ANNULE" ? "Annulé" : etat === "EN_DIRECT" ? "En direct" : "Terminé"}
        </Text>
        <Text style={s.miniDate} numberOfLines={1}>
          {date}
        </Text>
      </View>
      <View style={s.miniCamp}>
        <Text allowFontScaling={false} style={[s.miniChiffre, scoreA > scoreB && s.miniPerd]}>
          {scoreB}
        </Text>
        <EcussonChasuble couleur={couleurs[1]} lettre={lettres[1]} taille={40} ombre={false} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  marque: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 18,
    paddingHorizontal: 24,
  },
  colonne: { flex: 1, alignItems: "center", minWidth: 0 },
  // 148 en 800 à −0,05 em, compressé par transformation : c'est le « score
  // lourd » du site. L'interligne garde un peu d'air — à 148 pile, iOS rogne
  // le haut des chiffres.
  chiffre: {
    fontSize: 148,
    fontWeight: "800",
    letterSpacing: -7.4,
    lineHeight: 154,
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
    transform: [{ scaleX: 0.86 }],
  },
  milieu: { alignItems: "center", gap: 2, paddingHorizontal: 12 },
  etat: { fontSize: 17, fontWeight: "600", color: "#ffffff" },
  date: { fontSize: 15, color: "rgba(255,255,255,0.55)" },
  direct: { flexDirection: "row", alignItems: "center", gap: 6 },
  point: { width: 8, height: 8, borderRadius: 4, backgroundColor: ROUGE },

  equipes: { flexDirection: "row", paddingTop: 8, paddingHorizontal: 24 },
  equipe: { flex: 1, alignItems: "center", gap: 8, minWidth: 0 },
  nomEquipe: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, color: "#ffffff" },
  bilan: { fontSize: 15, color: "rgba(255,255,255,0.55)", marginTop: -6 },

  buteurs: { flexDirection: "row", gap: 16, paddingTop: 16, paddingHorizontal: 28 },
  colonneButeurs: { flex: 1, flexDirection: "row", gap: 8, minWidth: 0 },
  colonneB: { justifyContent: "flex-end" },
  // Le ballon s'aligne sur la première ligne de noms (interligne 27).
  ballon: { opacity: 0.85, paddingTop: 3.5 },
  liste: { flexShrink: 1, minWidth: 0 },
  buteur: { fontSize: 17, lineHeight: 27, color: "#ffffff" },
  aDroite: { textAlign: "right" },
  minutes: { color: "rgba(255,255,255,0.5)" },

  mini: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  miniCamp: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniChiffre: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
    transform: [{ scaleX: 0.86 }],
  },
  miniPerd: { color: "rgba(255,255,255,0.4)" },
  miniMilieu: { alignItems: "center", minWidth: 0, flexShrink: 1 },
  miniEtat: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
  miniDate: { fontSize: 13, color: "rgba(255,255,255,0.55)" },
});
