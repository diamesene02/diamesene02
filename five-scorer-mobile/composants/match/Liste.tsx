import { memo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { CarteVerre } from "../base";
import { IconeJeu } from "../Icones";
import { choix as vibrerChoix } from "../../lib/haptique";
import { jeton, type Jetons } from "../../lib/couleurs";
import type { EcranMatchs } from "../../lib/api";
import { majusculesAuxMots, nombreDeMatchs } from "./textes";

// Les briques de l'écran « Les matchs » (app/club/[id]/matchs.tsx), reprises
// de la page du site : la carte des programmés, la carte d'une soirée jouée,
// la pilule de filtre. La grille d'une rangée est celle du `.ticker` du site :
// 64 | auto | le reste, 56 de haut.

const OR = "#ffd60a";
/// Le tiret du score et le « vs » des programmés : `--rule-hi` du site, un
/// trait qui sépare sans se lire.
const TRAIT = "rgba(255,255,255,0.16)";

type Programme = EcranMatchs["programmes"][number];
type Joue = EcranMatchs["joues"][number];

/// Les matchs programmés. Chaque ligne mène à la convocation : qui est là ?
/// Elle se lit — et se répond — sur l'écran du match.
export function CarteProgrammes({
  t,
  programmes,
  onOuvrir,
  style,
}: {
  t: Jetons;
  programmes: Programme[];
  onOuvrir: (matchId: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <CarteVerre t={t} style={[s.carte, style]}>
      <View style={s.tete}>
        <Text style={[s.kicker, { color: t.i2 }]}>Programmés</Text>
        <Text style={[s.compte, { color: t.i3 }]}>{programmes.length}</Text>
      </View>
      {programmes.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => onOuvrir(m.id)}
          accessibilityRole="button"
          accessibilityLabel={`${m.a.nom} contre ${m.b.nom}, ${m.jour} à ${m.heure}${
            m.lieu ? `, ${m.lieu}` : ""
          }${m.presents > 0 ? `, ${m.presents} présent${m.presents > 1 ? "s" : ""}` : ""}`}
          style={({ pressed }) => [s.ticker, pressed && { opacity: 0.7 }]}
        >
          <Text style={[s.colonne, { color: t.i2 }]} numberOfLines={1}>
            {m.jour}
          </Text>
          <Text style={[s.fort, { color: t.ink }]}>{m.heure}</Text>
          {/* Écart assumé au site : le lieu et les présents passent sur une
              seconde ligne. Sur 402 points, la ligne unique du web coupait
              « 6 présents » — l'information même d'une convocation. */}
          <View style={s.deuxLignes}>
            <Text style={[s.reste, { color: t.i2 }]} numberOfLines={1}>
              {m.a.nom}
              <Text style={{ color: TRAIT }}> vs </Text>
              {m.b.nom}
            </Text>
            {m.lieu || m.presents > 0 ? (
              <Text style={[s.sousLigne, { color: t.i3 }]} numberOfLines={1}>
                {m.lieu}
                {m.lieu && m.presents > 0 ? " · " : ""}
                {m.presents > 0 ? (
                  <Text style={{ color: jeton(t, "taInk") }}>
                    {m.presents} présent{m.presents > 1 ? "s" : ""}
                  </Text>
                ) : null}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </CarteVerre>
  );
}

/// Une soirée jouée (ou un jour sans soirée) : son titre, le compte, puis
/// une rangée par match — l'heure, le score, l'homme du match.
///
/// Mémoïsé : en juin, une saison compte une trentaine de ces cartes et près de
/// deux cents rangées, toutes montées d'un bloc dans le défilement. Sans
/// `memo`, un tirer-pour-rafraîchir, un match en direct qui bouge ou une
/// pilule effleurée les redessinait TOUTES. Le groupe ne se refait plus que
/// quand le filtre change — c'est le seul moment où il le doit.
export const CarteGroupe = memo(function CarteGroupe({
  t,
  titre,
  sousTitre,
  lignes,
  onOuvrir,
}: {
  t: Jetons;
  /// « Mardi 15 septembre » — les majuscules aux mots sont posées ici.
  titre: string;
  sousTitre: string | null;
  lignes: Joue[];
  onOuvrir: (matchId: string) => void;
}) {
  return (
    <CarteVerre t={t} style={s.carte}>
      <View style={s.tete}>
        <Text style={[s.titre, { color: t.ink }]} numberOfLines={1}>
          {majusculesAuxMots(titre)}
          {sousTitre ? <Text style={{ color: t.i3 }}> · {sousTitre}</Text> : null}
        </Text>
        <Text style={[s.compte, { color: t.i3 }]}>{nombreDeMatchs(lignes.length)}</Text>
      </View>
      {lignes.map((m) => (
        <Pressable
          key={m.id}
          onPress={() => onOuvrir(m.id)}
          accessibilityRole="button"
          accessibilityLabel={`${m.heure}, ${m.a.nom} ${m.scoreA}, ${m.b.nom} ${m.scoreB}${
            m.hommeDuMatch ? `, homme du match ${m.hommeDuMatch}` : ""
          }`}
          style={({ pressed }) => [s.ticker, pressed && { opacity: 0.7 }]}
        >
          <Text style={[s.colonne, { color: t.i2 }]}>{m.heure}</Text>
          {/* Seul le vainqueur reste blanc : le perdant ET les deux côtés
              d'un nul passent en gris. */}
          <View style={s.score}>
            <Text style={[s.fort, { color: m.vainqueur === "A" ? t.ink : t.i3 }]}>{m.scoreA}</Text>
            <Text style={[s.fort, s.tiret]}>—</Text>
            <Text style={[s.fort, { color: m.vainqueur === "B" ? t.ink : t.i3 }]}>{m.scoreB}</Text>
          </View>
          <View style={s.suite}>
            {m.adversaire ? (
              <Text style={[s.adversaire, { color: t.i2 }]} numberOfLines={1}>
                {m.adversaire}
              </Text>
            ) : null}
            {m.adversaire && m.hommeDuMatch ? (
              <Text style={[s.adversaire, { color: t.i2 }]}>·</Text>
            ) : null}
            {m.hommeDuMatch ? (
              <View style={s.homme}>
                <IconeJeu nom="etoile" couleur={OR} taille={11} plein />
                <Text style={s.nomHomme} numberOfLines={1}>
                  {m.hommeDuMatch}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ))}
    </CarteVerre>
  );
});

/// La pilule d'un filtre (`chip` du site) : verre éteinte, blanche allumée.
export function Pilule({
  t,
  libelle,
  actif,
  onPress,
}: {
  t: Jetons;
  libelle: string;
  actif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!actif) vibrerChoix();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      style={({ pressed }) => [
        s.pilule,
        actif
          ? { backgroundColor: jeton(t, "bt"), borderColor: "transparent" }
          : { backgroundColor: jeton(t, "gl"), borderColor: jeton(t, "gb") },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[s.piluleTexte, { color: actif ? jeton(t, "bf") : t.ink }]}>{libelle}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  tete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  kicker: { fontSize: 15, fontWeight: "600" },
  titre: { flex: 1, fontSize: 13, fontWeight: "600" },
  compte: { fontSize: 13, fontVariant: ["tabular-nums"] },
  ticker: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  colonne: { width: 64, fontSize: 15, fontVariant: ["tabular-nums"] },
  fort: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  reste: { flex: 1, fontSize: 15 },
  score: { flexDirection: "row", alignItems: "center" },
  tiret: { color: TRAIT, marginHorizontal: 6 },
  deuxLignes: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 8 },
  sousLigne: { fontSize: 13 },
  suite: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  adversaire: { fontSize: 15, flexShrink: 1 },
  homme: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, minWidth: 0 },
  nomHomme: { fontSize: 15, flexShrink: 1, color: OR },

  pilule: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  piluleTexte: { fontSize: 13, fontWeight: "600" },
});
