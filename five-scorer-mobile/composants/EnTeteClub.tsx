import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import { BoutonRond, EcussonChasuble } from "./base";
import MenuClub, { HAUTEUR_PILULE, largeurPilule, largeurTexte } from "./MenuClub";
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
///
/// La barre se partage entre deux objets de largeur variable. Quand le nom du
/// club est long — « Renault Five Urban Guy » est la règle, pas l'exception —,
/// la marque se réduit à son écusson plutôt que de couper son mot : voir
/// `motTient`.
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
  const { width } = useWindowDimensions();

  // LA BARRE NE PORTE PAS DEUX TITRES.
  //
  // Avec « Renault Five Urban Guy », la pilule prenait toute la barre et la
  // marque se lisait « Fiv… ». C'est la MARQUE qui cède, et jamais à moitié :
  // le nom du club dit OÙ l'on est, celui de l'app est déjà sur l'icône qu'on
  // vient de toucher, et l'écusson « F » reste une marque à lui seul. Un mot
  // coupé, lui, ne dit rien et se voit.
  //
  // On décide sur la place réelle de l'écran plutôt qu'avec un pourcentage :
  // « Lundi Soir » garde son mot sur un iPhone ordinaire et le perd sur un
  // écran de 320, ce qui est exactement ce qu'on veut. La pastille de synchro
  // n'entre pas dans le calcul — elle est rare et passagère ; quand elle
  // paraît, c'est la pilule qui se rétrécit, comme avant.
  //
  // Au tout premier lancement, le club n'est pas encore connu : la barre porte
  // la marque entière et la place vide de la pilule, et le mot cède à l'instant
  // où la pilule arrive. C'est le seul moment où la barre bouge, et elle bouge
  // en même temps que le reste de l'écran, qui sort de son squelette.
  const motTient =
    width - 2 * MARGE_BARRE - ECART_BARRE - LARGEUR_MOT >= (c ? largeurPilule(c.nom) : 0);

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
          <Marque couleur={c?.couleurA ?? "#ffffff"} t={t} mot={motTient} />
        ) : retour ? (
          <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={revenir} />
        ) : (
          <View />
        )}
        <View style={s.droite}>
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

/// La marque de l'accueil : l'écusson carré « F » de la chasuble A (32, rayon
/// 9, comme une icône d'app) et, quand la barre a la place, « Five Scorer » en
/// 22/700.
///
/// Le lecteur d'écran annonce « Five Scorer » dans les deux cas : c'est le même
/// objet, dessiné plus ou moins court.
function Marque({ couleur, t, mot }: { couleur: string; t: Jetons; mot: boolean }) {
  return (
    <View style={s.marque} accessible accessibilityRole="header" accessibilityLabel="Five Scorer">
      <EcussonChasuble couleur={couleur} lettre="F" taille={ECUSSON_MARQUE} rayon={9} />
      {mot ? (
        <Text style={[s.marqueTexte, { color: t.ink }]} numberOfLines={1}>
          Five Scorer
        </Text>
      ) : null}
    </View>
  );
}

/// La marge de page, partagée par la barre du haut, le contenu et la barre du
/// bas : les trois s'alignent sur la même verticale.
const MARGE_BARRE = 14;
/// Ce qui sépare la marque de la pilule.
const ECART_BARRE = 8;
const ECUSSON_MARQUE = 32;
const CORPS_MARQUE = 22;
/// L'écusson, son écart et le mot : la place que la marque demande EN ENTIER.
const LARGEUR_MOT = ECUSSON_MARQUE + 8 + largeurTexte("Five Scorer", CORPS_MARQUE);

const s = StyleSheet.create({
  barre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ECART_BARRE,
    paddingTop: 12,
    paddingHorizontal: MARGE_BARRE,
  },
  // La marque ne se rétrécit PAS : elle est déjà à sa taille juste, ou réduite
  // à son écusson. C'est donc la droite — pastille de synchro et pilule — qui
  // prend ce qui reste, et la pilule qui se rétrécit le soir où la pastille
  // paraît. Sur les écrans à bouton retour (tous sauf l'accueil), rien ne
  // dispute la place et la pilule s'étale.
  droite: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  piluleLibre: { maxWidth: "100%" },
  placePilule: { height: HAUTEUR_PILULE, width: 1 },
  marque: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  marqueTexte: {
    fontSize: CORPS_MARQUE,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  // 16 de marge de page + 18 de `.stats-tete` sur le site ; 14 + 4 de côté.
  tete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 28,
    paddingHorizontal: 18,
  },
  teteTextes: { flex: 1, minWidth: 0 },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, lineHeight: 37 },
  sousTitre: { fontSize: 17, marginTop: 4 },
});
