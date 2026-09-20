import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { lisible, type Jetons } from "../lib/couleurs";
import { leger } from "../lib/haptique";

/// La barre du bas, en verre flottant.
///
/// Elle avait disparu au profit du menu de la pilule, comme sur le site. Sur
/// un téléphone c'était une perte : les quatre écrans qu'on ouvre vingt fois
/// par soirée demandaient deux gestes au lieu d'un. Elle revient donc, mais
/// posée au-dessus du contenu plutôt que collée au bord — la matière du
/// produit (verre sombre, rayon large, lueur) au lieu d'un bandeau opaque.
///
/// Les écrans qui défilent sous elle réservent `ESPACE_BARRE` en bas de leur
/// contenu, sinon la dernière ligne se cache derrière.
export const HAUTEUR_BARRE = 62;
export const ESPACE_BARRE = HAUTEUR_BARRE + 26;

export type Onglet = {
  nom: string;
  libelle: string;
  icone: "accueil" | "ballon" | "plus" | "calendrier" | "courbe";
};

export const ONGLETS: Onglet[] = [
  { nom: "index", libelle: "Accueil", icone: "accueil" },
  { nom: "matchs", libelle: "Matchs", icone: "ballon" },
  { nom: "creer", libelle: "Créer", icone: "plus" },
  { nom: "soirees", libelle: "Soirées", icone: "calendrier" },
  { nom: "stats", libelle: "Stats", icone: "courbe" },
];

function Icone({
  nom,
  couleur,
  taille = 23,
}: {
  nom: Onglet["icone"];
  couleur: string;
  taille?: number;
}) {
  const p = { stroke: couleur, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      {nom === "accueil" && (
        <>
          <Path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5h-7v5H5A1.5 1.5 0 0 1 3.5 19z" {...p} />
        </>
      )}
      {nom === "ballon" && (
        <>
          <Circle cx="12" cy="12" r="8.5" {...p} />
          <Path d="M12 7.5 15.5 10l-1.3 4h-4.4L8.5 10z" {...p} />
        </>
      )}
      {nom === "plus" && <Path d="M12 5.5v13M5.5 12h13" {...p} />}
      {nom === "calendrier" && (
        <>
          <Rect x="3.5" y="5.5" width="17" height="15" rx="3.5" {...p} />
          <Path d="M3.5 10h17M8 3.5v4M16 3.5v4" {...p} />
        </>
      )}
      {nom === "courbe" && <Path d="M5 19V9.5M12 19V4.5M19 19v-6" {...p} />}
    </Svg>
  );
}

export default function BarreOnglets({
  t,
  actif,
  onChoisir,
  couleurA,
}: {
  t: Jetons;
  /// Le nom de l'écran courant (« index », « matchs », …) ; « creer » n'en est
  /// pas un, c'est la feuille de création.
  actif: string;
  onChoisir: (nom: string) => void;
  couleurA: string;
}) {
  const bas = useSafeAreaInsets().bottom;
  const encre = useMemo(() => lisible(couleurA), [couleurA]);

  return (
    <View
      pointerEvents="box-none"
      style={[s.zone, { paddingBottom: Math.max(bas - 6, 10) }]}
    >
      <View
        style={[
          s.barre,
          {
            height: HAUTEUR_BARRE,
            backgroundColor: t.mn ?? "rgba(24,24,28,0.86)",
            borderColor: t.cb,
          },
        ]}
      >
        {ONGLETS.map((o) => {
          const estActif = o.nom === actif;
          const central = o.icone === "plus";
          const couleur = central ? encre : estActif ? t.ink : "rgba(255,255,255,0.45)";
          return (
            <Pressable
              key={o.nom}
              accessibilityRole="button"
              accessibilityLabel={central ? "Créer un match ou une soirée" : o.libelle}
              accessibilityState={{ selected: estActif }}
              onPress={() => {
                void leger();
                onChoisir(o.nom);
              }}
              style={s.onglet}
            >
              {central ? (
                <View style={[s.pastille, { backgroundColor: couleurA }]}>
                  <Icone nom={o.icone} couleur={couleur} taille={24} />
                </View>
              ) : (
                <>
                  <View style={[s.creux, estActif && { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                    <Icone nom={o.icone} couleur={couleur} />
                  </View>
                  <Text style={[s.libelle, { color: couleur }]} numberOfLines={1}>
                    {o.libelle}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  zone: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
  },
  barre: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 31,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    // L'ombre porte la barre au-dessus du contenu : sans elle, le verre se
    // confond avec une carte qui passe dessous.
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  onglet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    // 44 pt de haut au minimum : un doigt pressé, debout au bord du terrain.
    minHeight: 48,
  },
  creux: {
    width: 44,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  libelle: { fontSize: 11, fontWeight: "600" },
  pastille: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
});
