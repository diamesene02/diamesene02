import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CarteVerre } from "../base";
import CarteNiveau from "../succes/CarteNiveau";
import TuileBadge from "../succes/TuileBadge";
import DetailBadge from "./DetailBadge";
import LignePalier from "./LignePalier";
import SeriesJoueur from "./SeriesJoueur";
import { ordonnerBadges } from "./affichage";
import { jeton, type Jetons } from "../../lib/couleurs";
import { leger } from "../../lib/haptique";
import type { Badge, SuccesJoueur } from "../../lib/succes";

/// Trois rangées de deux : le reste se déplie. Vingt-six tuiles d'un bloc
/// faisaient une page entière de médailles grises. Mêmes nombres que le site.
const TUILES_VISIBLES = 6;
const PALIERS_VISIBLES = 5;

/// « Nouveau » sur une tuile : la semaine qui suit, jusqu'à la soirée
/// suivante.
const NOUVEAU_MS = 7 * 86_400_000;

const ECART = 10;

/// La section « Succès » de la fiche — celle du site (SuccesFiche.tsx), dans
/// le même ordre : le niveau, les séries, la vitrine des badges, les derniers
/// paliers franchis. Elle remplace « Prochains paliers » et « Trophées », que
/// les succès englobent : deux listes qui disaient la même chose avec
/// d'autres seuils.
///
/// La vitrine montre d'abord ce qui vient de tomber, puis ce qui est à
/// portée — c'est ce qui fait revenir le lundi —, puis le reste
/// (`ordonnerBadges`). Toucher une tuile ouvre son détail : tous ses paliers,
/// celui qu'on vise, la part du club qui l'a.
export default function SectionSucces({
  t,
  succes,
  elo,
  chasubles,
  estMoi,
  onOuvrirMatch,
}: {
  t: Jetons;
  succes: SuccesJoueur;
  /// La cote actuelle, pour mesurer la distance au palier d'Élo.
  elo: number | null;
  chasubles?: { a: string; b: string };
  estMoi: boolean;
  onOuvrirMatch: (matchId: string) => void;
}) {
  const [detail, setDetail] = useState<Badge | null>(null);
  const [toutesLesTuiles, setToutesLesTuiles] = useState(false);
  const [tousLesPaliers, setTousLesPaliers] = useState(false);
  const [largeur, setLargeur] = useState(0);

  const maintenant = new Date();
  const badges = ordonnerBadges(succes.badges, { series: succes.series, elo, maintenant });
  const obtenus = succes.badges.filter((b) => b.palier > 0).length;
  const tuiles = toutesLesTuiles ? badges : badges.slice(0, TUILES_VISIBLES);
  const autres = badges.length - TUILES_VISIBLES;
  const paliers = tousLesPaliers
    ? succes.deblocages
    : succes.deblocages.slice(0, PALIERS_VISIBLES);
  const precedents = succes.deblocages.length - PALIERS_VISIBLES;
  // Deux colonnes exactes, mesurées : une dernière tuile seule garde la
  // largeur des autres au lieu de s'étirer sur toute la ligne.
  const colonne = largeur > 0 ? Math.floor((largeur - ECART) / 2) : undefined;

  return (
    <>
      <CarteNiveau
        t={t}
        niveau={succes.niveau}
        chasubles={chasubles}
        detail={succes.xpDetail}
        style={s.marge}
      />

      <SeriesJoueur t={t} series={succes.series} style={s.marge} />

      <CarteVerre t={t} style={[s.marge, s.carteBadges]}>
        <Text style={[s.titre, s.titreBadges, { color: t.ink }]} accessibilityRole="header">
          Succès
        </Text>
        <Text style={[s.compte, { color: jeton(t, "i2") }]}>
          {obtenus} sur {succes.badges.length} débloqué{obtenus > 1 ? "s" : ""}
        </Text>
        <View style={s.grille} onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}>
          {tuiles.map((b) => (
            <TuileBadge
              key={b.id}
              t={t}
              badge={b}
              chasubles={chasubles}
              nouveau={
                b.obtenuLe != null && maintenant.getTime() - Date.parse(b.obtenuLe) <= NOUVEAU_MS
              }
              onPress={() => {
                // La médaille s'ouvre en grand : un petit coup sous le doigt,
                // comme partout où une feuille monte.
                leger();
                setDetail(b);
              }}
              style={colonne ? { width: colonne } : s.tuileRepli}
            />
          ))}
        </View>
        {autres > 0 && (
          <Repli
            t={t}
            ouvert={toutesLesTuiles}
            onPress={() => setToutesLesTuiles((o) => !o)}
            ouvrir={`Voir les ${autres} autres`}
            style={s.repliBadges}
          />
        )}
      </CarteVerre>

      {succes.deblocages.length > 0 && (
        <CarteVerre t={t} style={[s.marge, s.cartePaliers]}>
          <Text style={[s.titre, s.titrePaliers, { color: t.ink }]} accessibilityRole="header">
            Derniers paliers débloqués
          </Text>
          {paliers.map((p) => (
            <LignePalier
              key={`${p.badgeId}:${p.palier}`}
              t={t}
              palier={p}
              chasubles={chasubles}
              onPress={p.matchId ? () => onOuvrirMatch(p.matchId as string) : undefined}
            />
          ))}
          {precedents > 0 && (
            <Repli
              t={t}
              ouvert={tousLesPaliers}
              onPress={() => setTousLesPaliers((o) => !o)}
              ouvrir={precedents === 1 ? "Voir le précédent" : `Voir les ${precedents} précédents`}
              style={[s.repliPaliers, { borderTopColor: jeton(t, "sep") }]}
            />
          )}
        </CarteVerre>
      )}

      <DetailBadge
        t={t}
        badge={detail}
        chasubles={chasubles}
        estMoi={estMoi}
        onMatch={onOuvrirMatch}
        onClose={() => setDetail(null)}
      />
    </>
  );
}

/// Le repli du site (`details.plus`) : « Voir les N autres », puis
/// « Masquer » une fois ouvert.
function Repli({
  t,
  ouvert,
  onPress,
  ouvrir,
  style,
}: {
  t: Jetons;
  ouvert: boolean;
  onPress: () => void;
  ouvrir: string;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: ouvert }}
      style={({ pressed }) => [s.repli, style, pressed && { opacity: 0.6 }]}
    >
      <Text style={[s.repliTexte, { color: jeton(t, "i2") }]}>{ouvert ? "Masquer" : ouvrir}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  marge: { marginTop: 14 },
  titre: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, textAlign: "center" },
  carteBadges: { paddingHorizontal: 16, paddingBottom: 16 },
  titreBadges: { paddingTop: 20, paddingBottom: 2 },
  compte: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 14,
    fontVariant: ["tabular-nums"],
  },
  grille: { flexDirection: "row", flexWrap: "wrap", gap: ECART },
  // Avant la première mesure : deux colonnes approximatives, sans étirement.
  tuileRepli: { width: "47%" },
  cartePaliers: { paddingHorizontal: 20, paddingBottom: 6 },
  titrePaliers: { paddingTop: 20, paddingBottom: 8 },
  repli: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  repliBadges: { marginTop: 6 },
  repliPaliers: { borderTopWidth: 1 },
  repliTexte: { fontSize: 15, fontWeight: "600" },
});
