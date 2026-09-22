import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { BoutonRond, EcussonChasuble } from "./base";
import MenuClub from "./MenuClub";
import PastilleSynchro from "./PastilleSynchro";
import { useClubId, useClubMemorise } from "./ClubCourant";
import { jeton, type Jetons } from "../lib/couleurs";
import type { ClubDeMoi } from "../lib/api";

/// L'en-tête d'un écran du club : la barre du site (`BarreClub`) et, dessous,
/// le grand titre de l'écran.
///
/// La barre : le bouton retour en verre à gauche — ou la marque « Five
/// Scorer » sur l'accueil — et la pilule du club à droite, précédée de la
/// pastille de synchro quand quelque chose attend.
///
/// Deux navigations se partagent le téléphone depuis le 20 septembre 2026 :
/// la barre du bas (composants/BarreOnglets.tsx) porte les quatre écrans du
/// lundi soir et le « + » ; la pilule porte TOUT LE RESTE — vestiaire,
/// saison, réglages, partage, changement de club. Il faut donc la poser sur
/// CHAQUE écran du club, y compris ceux que la barre dessert : sans elle, on
/// ne sort plus des écrans qui ne sont pas des onglets.
///
/// À placer en tête du contenu qui défile (le site la fait défiler avec la
/// page), dans un conteneur SANS marge horizontale : elle porte ses 14
/// points, et le titre ses 18.
export default function EnTeteClub({
  t,
  club,
  clubId,
  titre,
  sousTitre,
  droite,
  marque,
  retour = true,
  onRetour,
  nomUtilisateur,
  style,
}: {
  t: Jetons;
  /// Le club de l'écran. À défaut, celui du dernier `/api/me` : la pilule
  /// est là dès la première image, avant la fin du chargement.
  club?: ClubDeMoi | null;
  /// Pour un écran hors du layout du club (soirée, fiche, récap), qui ne
  /// connaît pas le club par la route.
  clubId?: string | null;
  /// Le grand titre (`.titre-ecran` : 34/700), sous la barre.
  titre?: string;
  sousTitre?: string;
  /// À droite du titre : le sélecteur de saison des stats, par exemple.
  droite?: React.ReactNode;
  /// L'accueil : l'icône « F » et « Five Scorer » à la place du retour.
  marque?: boolean;
  retour?: boolean;
  /// Ce que fait le retour. Par défaut, l'écran précédent — ou l'accueil du
  /// club quand il n'y en a pas (ouvert depuis une notification, un lien).
  onRetour?: () => void;
  nomUtilisateur?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const memo = useClubMemorise(clubId);
  const c = club ?? memo;
  const idDuLayout = useClubId();
  const id = c?.id ?? clubId ?? idDuLayout;

  const revenir =
    onRetour ??
    (() => {
      if (router.canGoBack()) router.back();
      else if (id) router.replace({ pathname: "/club/[id]", params: { id } });
    });

  return (
    <View style={style}>
      <View style={s.barre}>
        {marque ? (
          <Marque couleur={c?.couleurA ?? "#ffffff"} t={t} />
        ) : retour ? (
          <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={revenir} />
        ) : (
          <View />
        )}
        <View style={[s.droite, marque ? s.droiteBornee : null]}>
          <PastilleSynchro t={t} />
          {c ? (
            <MenuClub
              club={c}
              t={t}
              nomUtilisateur={nomUtilisateur}
              stylePilule={s.piluleLibre}
            />
          ) : (
            // La place de la pilule, pour que rien ne saute quand elle arrive.
            <View style={s.placePilule} />
          )}
        </View>
      </View>
      {titre ? (
        <TitreEcran t={t} titre={titre} sousTitre={sousTitre} droite={droite} />
      ) : null}
    </View>
  );
}

/// Le grand titre d'un écran (`.titre-ecran` : 34/700, −0,5) et ce qui se
/// pose à sa droite. Pour un écran qui place sa barre lui-même.
export function TitreEcran({
  t,
  titre,
  sousTitre,
  droite,
  style,
}: {
  t: Jetons;
  titre: string;
  sousTitre?: string;
  droite?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.tete, style]}>
      <View style={s.teteTextes}>
        <Text style={[s.titre, { color: t.ink }]} numberOfLines={2} accessibilityRole="header">
          {titre}
        </Text>
        {sousTitre ? (
          <Text style={[s.sousTitre, { color: jeton(t, "i2") }]}>{sousTitre}</Text>
        ) : null}
      </View>
      {droite}
    </View>
  );
}

/// La marque de l'accueil : l'écusson carré « F » de la chasuble A (34, rayon
/// 9, comme une icône d'app) et « Five Scorer » en 26/700.
function Marque({ couleur, t }: { couleur: string; t: Jetons }) {
  return (
    <View style={s.marque} accessibilityRole="header">
      <EcussonChasuble couleur={couleur} lettre="F" taille={34} rayon={9} />
      <Text style={[s.marqueTexte, { color: t.ink }]} numberOfLines={1}>
        Five Scorer
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  barre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  // La pastille de synchro ne compte PAS dans la part de la pilule : elle est
  // large de 44 et ne se rétrécit pas. Bornée à 44 % comme sur le site, la
  // pilule tombait à 27 points de texte le soir où la pastille est là — hors
  // ligne au gymnase, justement —, et le nom du club se lisait « Lu ». Sur
  // les écrans à bouton retour (tous sauf l'accueil), rien ne dispute la
  // place : la pilule prend ce qu'il lui faut et se rétrécit d'elle-même.
  droite: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  // L'accueil : « Five Scorer » en 26/700 dispute la barre. La marque cède la
  // première (elle se coupe proprement, `numberOfLines`), mais on lui garde
  // plus du quart de la barre pour qu'il en reste quelque chose.
  droiteBornee: { maxWidth: "72%" },
  piluleLibre: { maxWidth: "100%" },
  placePilule: { height: 50, width: 1 },
  marque: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  marqueTexte: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 30,
    flexShrink: 1,
  },
  // 16 de marge de page + 18 de `.stats-tete` sur le site ; 14 + 4 de côté.
  tete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 34,
    paddingHorizontal: 18,
  },
  teteTextes: { flex: 1, minWidth: 0 },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, lineHeight: 37 },
  sousTitre: { fontSize: 17, marginTop: 6 },
});
