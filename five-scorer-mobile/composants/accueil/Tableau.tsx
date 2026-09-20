import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, CarteVerre } from "../base";
import { jeton, type Jetons } from "../../lib/couleurs";
import type { Accueil } from "../../lib/api";
import { evolutionPhrase, evolutionTexte, rangTexte } from "./logique";

type Ligne = Accueil["classement"][number];

const compte = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/// Le tableau de l'accueil (`.tableau` du site) : les six premiers, aux
/// points du club, chaque rangée vers la fiche du joueur, et « Tableau
/// complet › » vers les stats. Il était une impasse : rien ne se touchait.
///
/// Et, pour le mardi matin, comme le site : sous le rang, les places gagnées
/// (▲2) ou perdues (▼1) depuis la dernière soirée (`SuccesClub.evolutions`) ;
/// MA rangée surlignée, et ajoutée à sa vraie place après une coupure quand
/// je ne suis pas dans les six — c'est elle qu'on cherche.
export default function Tableau({
  t,
  classement,
  evolutions,
  monJoueurId,
  ouvrirJoueur,
  ouvrirStats,
}: {
  t: Jetons;
  classement: Accueil["classement"];
  evolutions: Record<string, number> | null;
  monJoueurId: string | null;
  ouvrirJoueur: (playerId: string) => void;
  ouvrirStats: () => void;
}) {
  const six = classement.slice(0, 6);
  const moi = monJoueurId ? classement.find((r) => r.playerId === monJoueurId) : undefined;
  const moiEnPlus = moi && !six.includes(moi) ? moi : null;
  const sep = jeton(t, "sep");

  const rangee = (r: Ligne, filet: boolean) => {
    const estMoi = r.playerId === monJoueurId;
    const evo = evolutions?.[r.playerId];
    const evoTexte = evolutionTexte(evo);
    const phrase = evolutionPhrase(evo);
    return (
      <Pressable
        key={r.playerId}
        onPress={() => ouvrirJoueur(r.playerId)}
        accessibilityRole="button"
        accessibilityLabel={[
          `${rangTexte(r.rang)}, ${r.nom}${estMoi ? ", toi" : ""}`,
          compte(r.points, "point"),
          compte(r.matchs, "match"),
          compte(r.victoires, "victoire"),
          compte(r.buts, "but"),
          phrase,
        ]
          .filter(Boolean)
          .join(", ")}
        style={({ pressed }) => [
          s.rangee,
          filet && { borderTopWidth: 1, borderTopColor: sep },
          estMoi && { backgroundColor: jeton(t, "gl"), borderRadius: 14 },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={s.colRang}>
          <Text style={[s.rang, { color: t.ink }]}>{r.rang}</Text>
          {evoTexte ? (
            <Text style={[s.evo, { color: jeton(t, (evo ?? 0) > 0 ? "ok" : "bad") }]}>{evoTexte}</Text>
          ) : null}
        </View>
        <Avatar nom={r.nom} photo={r.photo} t={t} camp={r.camp ?? null} taille={30} />
        <Text
          style={[s.colNom, s.nom, { color: t.ink }]}
          numberOfLines={1}
        >
          {r.nom}
        </Text>
        <Text style={[s.chiffre, s.l30, { color: t.ink }]}>{r.matchs}</Text>
        <Text style={[s.chiffre, s.l26, { color: t.ink }]}>{r.victoires}</Text>
        <Text style={[s.chiffre, s.l26, { color: t.ink }]}>{r.nuls}</Text>
        <Text style={[s.chiffre, s.l26, { color: t.ink }]}>{r.defaites}</Text>
        <Text style={[s.chiffre, s.l30, { color: t.ink }]}>{r.buts}</Text>
        <Text style={[s.chiffre, s.l40, s.points, { color: t.ink }]}>{r.points}</Text>
      </Pressable>
    );
  };

  const estMoi = (i: number) => six[i]?.playerId === monJoueurId;

  return (
    <CarteVerre t={t} style={s.carte}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Tableau
      </Text>
      <View style={s.tete} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={s.colRang} />
        <View style={s.colAvatar} />
        <Text style={[s.colNom, s.teteTexte, { color: jeton(t, "i2") }]}>Joueur</Text>
        <Text style={[s.teteTexte, s.l30, { color: jeton(t, "i2") }]}>MJ</Text>
        <Text style={[s.teteTexte, s.l26, { color: jeton(t, "i2") }]}>V</Text>
        <Text style={[s.teteTexte, s.l26, { color: jeton(t, "i2") }]}>N</Text>
        <Text style={[s.teteTexte, s.l26, { color: jeton(t, "i2") }]}>D</Text>
        <Text style={[s.teteTexte, s.l30, { color: jeton(t, "i2") }]}>B</Text>
        <Text style={[s.teteTexte, s.l40, { color: jeton(t, "i2") }]}>PTS</Text>
      </View>
      {/* Un filet ENTRE deux rangées seulement — ni sous l'en-tête, ni
          autour de la mienne, que son fond sépare déjà. */}
      {six.map((r, i) => rangee(r, i > 0 && !estMoi(i) && !estMoi(i - 1)))}
      {moiEnPlus && (
        <>
          <Text
            style={[s.saut, { color: jeton(t, "i3"), borderTopColor: sep }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            ···
          </Text>
          {rangee(moiEnPlus, false)}
        </>
      )}
      <Pressable
        onPress={ouvrirStats}
        accessibilityRole="button"
        style={({ pressed }) => [s.pied, { borderTopColor: sep }, pressed && { opacity: 0.6 }]}
      >
        <Text style={[s.piedTexte, { color: jeton(t, "i2") }]}>Tableau complet ›</Text>
      </Pressable>
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  // `padding: 0 12px 10px` : les filets s'arrêtent à 12 des bords.
  carte: { paddingHorizontal: 12, paddingBottom: 10 },
  titre: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingTop: 20,
    paddingBottom: 12,
  },
  // La grille du site : 24 30 1fr 30 26 26 26 30 40.
  tete: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingBottom: 8 },
  teteTexte: { fontSize: 15, textAlign: "center" },
  rangee: { flexDirection: "row", alignItems: "center", height: 54, paddingHorizontal: 6 },
  colRang: { width: 24, alignItems: "flex-start", justifyContent: "center" },
  colAvatar: { width: 30 },
  colNom: { flex: 1, minWidth: 0, paddingLeft: 8, textAlign: "left" },
  rang: { fontSize: 17, fontVariant: ["tabular-nums"], lineHeight: 19 },
  evo: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 12,
    fontVariant: ["tabular-nums"],
  },
  nom: { fontSize: 17, fontWeight: "500" },
  chiffre: { fontSize: 17, textAlign: "center", fontVariant: ["tabular-nums"] },
  points: { fontWeight: "600" },
  l26: { width: 26 },
  l30: { width: 30 },
  l40: { width: 40 },
  // Le joueur au-delà du sixième : sa ligne vient après une coupure.
  saut: {
    paddingTop: 2,
    paddingBottom: 4,
    borderTopWidth: 1,
    fontSize: 13,
    lineHeight: 13,
    letterSpacing: 2,
    textAlign: "center",
  },
  pied: {
    marginTop: 0,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    alignItems: "center",
  },
  piedTexte: { fontSize: 17, fontWeight: "600" },
});
