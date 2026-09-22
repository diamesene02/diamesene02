import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, CarteVerre } from "../base";
import EnTeteCarte from "./EnTeteCarte";
import { jeton, type Jetons } from "../../lib/couleurs";
import type { Accueil } from "../../lib/api";
import { evolutionPhrase, evolutionTexte, rangTexte } from "./logique";

type Ligne = Accueil["classement"][number];

const compte = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/// Le tableau de l'accueil (`.tableau` du site) : les six premiers, aux
/// points du club, chaque rangée vers la fiche du joueur, et « Voir tout »
/// vers les stats, dans l'en-tête. Il était une impasse : rien ne se touchait.
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
        {/* Un prénom long rétrécit d'un point ou deux plutôt que de perdre ses
            lettres : « Compte de démo » se lisait « Compte de… ». Les colonnes
            de chiffres, elles, ne bougent pas — c'est ce qui tient le tableau
            aligné. */}
        <Text
          style={[s.colNom, s.nom, { color: t.ink }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
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
      <EnTeteCarte
        t={t}
        titre="Tableau"
        action="Voir tout"
        etiquette="Voir le tableau complet"
        onAction={ouvrirStats}
        style={s.enTete}
      />
      <View style={s.tete} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={s.colRang} />
        <View style={s.colAvatar} />
        {/* `colNom` APRÈS `teteTexte` : son `textAlign: left` doit gagner, sinon
            « JOUEUR » se centrait au-dessus d'une colonne de noms calés à
            gauche — deux points de départ pour une même colonne. */}
        <Text style={[s.teteTexte, s.colNom, { color: jeton(t, "i2") }]}>Joueur</Text>
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
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  // `padding: 0 12px 10px` : les filets s'arrêtent à 12 des bords.
  carte: { paddingHorizontal: 12, paddingBottom: 8 },
  // Les rangées portent 6 de plus que la carte : le titre les rejoint.
  enTete: { paddingHorizontal: 6 },
  // La grille, resserrée : 24 30 1fr 28 24 24 24 28 36 au lieu de
  // 24 30 1fr 30 26 26 26 30 40. Quatorze points rendus à la colonne des
  // noms, qui est la seule à en manquer — « Jean-Baptiste » y tient enfin.
  tete: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingBottom: 6 },
  // 13 en capitales : un en-tête de colonne se lit une fois, pas à chaque
  // rangée. Il ne pèse plus le même poids que les chiffres qu'il annonce.
  teteTexte: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  rangee: { flexDirection: "row", alignItems: "center", height: 48, paddingHorizontal: 6 },
  colRang: { width: 24, alignItems: "flex-start", justifyContent: "center" },
  colAvatar: { width: 30 },
  colNom: { flex: 1, minWidth: 0, paddingLeft: 8, textAlign: "left" },
  rang: { fontSize: 15, fontVariant: ["tabular-nums"], lineHeight: 17 },
  evo: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 12,
    fontVariant: ["tabular-nums"],
  },
  nom: { fontSize: 17, fontWeight: "500" },
  // Les chiffres de détail descendent à 15 et les points restent à 17, en
  // gras : sur une rangée de six nombres, c'est le seul qu'on cherche.
  chiffre: { fontSize: 15, textAlign: "center", fontVariant: ["tabular-nums"] },
  points: { fontSize: 17, fontWeight: "700" },
  l26: { width: 24 },
  l30: { width: 28 },
  l40: { width: 36 },
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
});
