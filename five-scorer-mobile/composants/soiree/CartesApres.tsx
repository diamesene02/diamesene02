import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Avatar, BoutonPlein, CarteVerre, EcussonChasuble } from "../base";
import LigneScore from "../LigneScore";
import { jeton, type Jetons } from "../../lib/couleurs";
import type { FicheSoiree } from "../../lib/api";

// Ce que la soirée devient une fois jouée : le bilan, le mot à coller dans
// le groupe, les matchs, les cracks. Les cartes du site
// (sessions/[id]/page.tsx), dans le même ordre.

/// « Le bilan de la soirée » — un COMPTE de matchs gagnés, pas un score : une
/// soirée gagnée un match à zéro ne doit pas se lire comme un 1-0.
export function CarteBilan({
  t,
  fiche,
  couleurA,
  couleurB,
}: {
  t: Jetons;
  fiche: FicheSoiree;
  couleurA: string;
  couleurB: string;
}) {
  const b = fiche.bilan;
  if (!b) return null;
  const joues = b.victoiresA + b.victoiresB + b.nuls;
  const camp = (cote: "a" | "b") => {
    const ch = fiche.chasubles[cote];
    const n = cote === "a" ? b.victoiresA : b.victoiresB;
    return (
      <View style={s.bilanCamp}>
        <EcussonChasuble couleur={cote === "a" ? couleurA : couleurB} lettre={ch.lettre} taille={44} />
        <Text style={[s.bilanNom, { color: jeton(t, "i2") }]} numberOfLines={1}>
          {ch.nom}
        </Text>
        <Text style={[s.bilanCompte, { color: t.ink }]}>{n}</Text>
        <Text style={[s.bilanUnite, { color: jeton(t, "i2") }]}>
          {cote === "a" ? b.uniteA : b.uniteB}
        </Text>
      </View>
    );
  };
  const gras = (x: string | number) => <Text style={[s.gras, { color: t.ink }]}>{x}</Text>;
  return (
    <CarteVerre t={t} style={s.carteBilan}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Le bilan de la soirée
        {b.enCours ? <Text style={[s.enCours, { color: jeton(t, "i2") }]}> · en cours</Text> : null}
      </Text>
      <View style={s.bilan}>
        {camp("a")}
        {camp("b")}
      </View>
      <View
        style={[s.jauge, { backgroundColor: jeton(t, "sep") }]}
        accessible
        accessibilityLabel={`${fiche.chasubles.a.nom} ${b.victoiresA}, ${fiche.chasubles.b.nom} ${b.victoiresB}, ${b.nuls} nul${b.nuls > 1 ? "s" : ""}`}
      >
        <View style={{ flexGrow: b.victoiresA, flexBasis: 0, backgroundColor: couleurA }} />
        <View style={{ flexGrow: b.nuls, flexBasis: 0, backgroundColor: jeton(t, "i3") }} />
        <View style={{ flexGrow: b.victoiresB, flexBasis: 0, backgroundColor: couleurB }} />
      </View>
      <Text style={[s.resume, { color: jeton(t, "i2") }]}>
        {joues} match{joues > 1 ? "s" : ""} joué{joues > 1 ? "s" : ""}
        {b.nuls > 0 ? ` · ${b.nuls} nul${b.nuls > 1 ? "s" : ""}` : ""} · {gras(b.buts)} but
        {b.buts > 1 ? "s" : ""}
        {b.buteur ? (
          <>
            {" "}
            · {b.buteur.nom} {gras(b.buteur.buts)}
          </>
        ) : null}
        {b.mvp ? (
          <>
            {" "}
            · <Text style={{ color: jeton(t, "or") }}>★ {b.mvp.nom}</Text>
          </>
        ) : null}
      </Text>
    </CarteVerre>
  );
}

/// « Le mot de la soirée » : ce qu'on tape à la main dans le groupe le mardi
/// matin, et qu'on ne tape jamais. Le partage natif ouvre WhatsApp
/// directement, et sa feuille propose aussi « Copier ».
export function CarteMot({ t, mot }: { t: Jetons; mot: string }) {
  return (
    <CarteVerre t={t} style={s.carteMot}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Le mot de la soirée
      </Text>
      <View style={[s.apercu, { backgroundColor: jeton(t, "seg"), borderColor: jeton(t, "gb") }]}>
        <ScrollView nestedScrollEnabled style={{ maxHeight: 232 }}>
          <Text selectable style={[s.mot, { color: t.ink }]}>
            {mot}
          </Text>
        </ScrollView>
      </View>
      <BoutonPlein
        t={t}
        titre="Envoyer sur le groupe"
        onPress={() => void Share.share({ message: mot }).catch(() => {})}
      />
    </CarteVerre>
  );
}

type Match = FicheSoiree["matchs"][number];

/// Un match en direct a sa carte à lui, au-dessus des autres : c'est lui
/// qu'on vient chercher en ouvrant la soirée pendant qu'elle se joue.
export function CarteDirect({
  t,
  m,
  couleurA,
  couleurB,
  onOuvrir,
}: {
  t: Jetons;
  m: Match;
  couleurA: string;
  couleurB: string;
  onOuvrir: () => void;
}) {
  return (
    <CarteVerre t={t}>
      <LigneScore
        t={t}
        nomA={m.nomA}
        nomB={m.nomB}
        couleurA={couleurA}
        couleurB={couleurB}
        scoreA={m.scoreA}
        scoreB={m.scoreB}
        etat="En direct"
        direct
        heure="Reprendre ›"
        onPress={onOuvrir}
      />
    </CarteVerre>
  );
}

export function CarteMatchs({
  t,
  matchs,
  couleurA,
  couleurB,
  onOuvrir,
}: {
  t: Jetons;
  matchs: Match[];
  couleurA: string;
  couleurB: string;
  onOuvrir: (m: Match) => void;
}) {
  if (matchs.length === 0) return null;
  return (
    <CarteVerre t={t} style={s.carteMatchs}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Les matchs
      </Text>
      {matchs.map((m, i) => (
        <View key={m.id} style={i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }}>
          <LigneScore
            t={t}
            nomA={m.nomA}
            nomB={m.nomB}
            couleurA={couleurA}
            couleurB={couleurB}
            scoreA={m.scoreA}
            scoreB={m.scoreB}
            aVenir={m.aVenir}
            etat={m.etat}
            heure={m.heure}
            pied={m.aVenir || m.statut === "CANCELED" ? undefined : (m.pied ?? undefined)}
            onPress={() => onOuvrir(m)}
          />
        </View>
      ))}
    </CarteVerre>
  );
}

/// « Les cracks du soir » : le tableau du site, neuf colonnes.
export function CarteCracks({
  t,
  cracks,
  onOuvrir,
}: {
  t: Jetons;
  cracks: FicheSoiree["cracks"];
  onOuvrir: (playerId: string) => void;
}) {
  if (cracks.length === 0) return null;
  const tete = (x: string, style: object) => (
    <Text style={[style, s.tabTeteTexte, { color: jeton(t, "i2") }]}>{x}</Text>
  );
  return (
    <CarteVerre t={t} style={s.carteCracks}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Les cracks du soir
      </Text>
      <View style={[s.tabRangee, s.tabTete]}>
        <View style={{ width: 22 }} />
        <View style={{ width: 26 }} />
        {tete("Joueur", s.tabNom)}
        {tete("MJ", s.tabMj)}
        {tete("V", s.tabPetit)}
        {tete("N", s.tabPetit)}
        {tete("D", s.tabPetit)}
        {tete("B", s.tabMj)}
        {tete("PTS", s.tabPts)}
      </View>
      {cracks.map((c) => (
        <Pressable
          key={c.playerId}
          onPress={() => onOuvrir(c.playerId)}
          accessibilityRole="button"
          accessibilityLabel={`${c.rang}e, ${c.nom}, ${c.points} points, ${c.buts} but${c.buts > 1 ? "s" : ""}`}
          style={({ pressed }) => [
            s.tabRangee,
            { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[s.tabRang, { color: t.ink }]}>{c.rang}</Text>
          <Avatar nom={c.nom} photo={c.photo} t={t} taille={26} />
          <Text style={[s.tabNom, { color: t.ink }]} numberOfLines={1}>
            {c.nom}
            {c.invite ? <Text style={{ color: jeton(t, "i3") }}> (inv.)</Text> : null}
          </Text>
          <Text style={[s.tabMj, { color: t.ink }]}>{c.matchs}</Text>
          <Text style={[s.tabPetit, { color: t.ink }]}>{c.victoires}</Text>
          <Text style={[s.tabPetit, { color: t.ink }]}>{c.nuls}</Text>
          <Text style={[s.tabPetit, { color: t.ink }]}>{c.defaites}</Text>
          <Text style={[s.tabMj, { color: t.ink }]}>{c.buts}</Text>
          <Text style={[s.tabPts, { color: t.ink }]}>{c.points}</Text>
        </Pressable>
      ))}
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  titre: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingTop: 20,
    paddingBottom: 12,
  },
  enCours: { fontSize: 15, fontWeight: "500" },
  gras: { fontWeight: "600" },

  carteBilan: { paddingBottom: 0 },
  bilan: { flexDirection: "row", gap: 12, paddingTop: 2, paddingHorizontal: 16 },
  bilanCamp: { flex: 1, alignItems: "center", gap: 4, minWidth: 0 },
  bilanNom: { fontSize: 15, fontWeight: "600", maxWidth: "100%" },
  bilanCompte: {
    fontSize: 44,
    fontWeight: "800",
    lineHeight: 46,
    letterSpacing: -1.3,
    fontVariant: ["tabular-nums"],
  },
  bilanUnite: { fontSize: 13, textAlign: "center" },
  jauge: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 14,
    marginHorizontal: 18,
  },
  resume: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },

  carteMot: { paddingHorizontal: 18, paddingBottom: 18 },
  apercu: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  mot: { fontSize: 15, lineHeight: 22 },

  carteMatchs: { paddingBottom: 4 },

  // NEUF COLONNES SUR UN TÉLÉPHONE : chaque point pris aux chiffres est un
  // point rendu au nom. Les six colonnes de statistiques occupaient 158 points
  // en 17, la même taille que le nom — il en restait 91 pour « Mouhamadou »,
  // qui en fait 100. Elles passent en 13 (la légende du produit) et à leur
  // largeur juste ; « PTS » garde le corps et la graisse, c'est la colonne
  // qu'on lit. Le nom gagne trente-six points et ne se coupe plus.
  carteCracks: { paddingHorizontal: 8, paddingBottom: 8 },
  tabRangee: { flexDirection: "row", alignItems: "center", height: 54, paddingHorizontal: 4 },
  tabTete: { height: undefined, paddingBottom: 8, paddingTop: 4 },
  tabTeteTexte: { fontSize: 13, fontWeight: "600" },
  tabRang: { width: 22, fontSize: 15, fontVariant: ["tabular-nums"] },
  tabNom: { flex: 1, minWidth: 0, fontSize: 17, paddingLeft: 8 },
  tabMj: { width: 26, fontSize: 15, textAlign: "center", fontVariant: ["tabular-nums"] },
  tabPetit: { width: 22, fontSize: 15, textAlign: "center", fontVariant: ["tabular-nums"] },
  tabPts: {
    width: 36,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});
