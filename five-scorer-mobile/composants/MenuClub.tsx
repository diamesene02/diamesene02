import { forwardRef, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EcussonChasuble, styleLueur } from "./base";
import { CHEMINS, IconeTrait } from "./Icones";
import { useNoyau } from "./Noyau";
import PopoverVerre, { mesurer, type Ancre } from "./PopoverVerre";
import { memoriserMoi, useMoiMemorise } from "./ClubCourant";
import { jeton, type Jetons } from "../lib/couleurs";
import { ini } from "../lib/ini";
import { leger } from "../lib/haptique";
import { chargerReglages, PROD, type ClubDeMoi } from "../lib/api";
import { messageErreur } from "../lib/erreurs";
import { signOut } from "../lib/auth-client";

/// La pilule du club et son menu — le port de `components/ios/MenuClub.tsx`.
///
/// Comme sur le site, ce menu porte TOUTE la navigation : il n'y a plus de
/// barre d'onglets en bas. Il s'ouvre en verre sous la pilule, en haut à
/// droite, et l'entrée de l'écran où l'on est est surlignée.
///
/// Les entrées et leur ordre sont ceux du site, « Matchs » et « Effectif »
/// compris. Un écart, voulu : « Mes clubs » n'apparaît que pour qui en a
/// plusieurs — pour les autres, l'écran sautait droit au club, et la ligne
/// ne faisait que clignoter. Ils ont « Rejoindre un club » à la place.
///
/// Ce qui n'existe pas n'est pas affiché en grisé : une ligne qu'on touche et
/// qui ne fait rien coûte plus cher qu'une ligne absente.
export default function MenuClub({
  club,
  t,
  nomUtilisateur,
  nombreClubs,
  stylePilule,
}: {
  club: ClubDeMoi;
  t: Jetons;
  /// Le nom du compte, pour les initiales de « Mon profil ». Lu dans le
  /// dernier `/api/me` s'il n'est pas donné.
  nomUtilisateur?: string;
  /// Combien de clubs a l'utilisateur. Lu dans le dernier `/api/me` s'il
  /// n'est pas donné.
  nombreClubs?: number;
  /// La largeur maximale de la pilule dans la rangée de l'appelant. 56 % par
  /// défaut ; `EnTeteClub` la borne lui-même et passe 100 %.
  stylePilule?: StyleProp<ViewStyle>;
}) {
  const moi = useMoiMemorise();
  const pilule = useRef<View>(null);
  const [ancre, setAncre] = useState<Ancre | null>(null);
  const haut = useSafeAreaInsets().top;
  const chemin = usePathname();
  const deconnecter = useDeconnexion();

  const court = nomCourt(club.nom);
  const nom = nomUtilisateur ?? moi?.utilisateur.nom ?? club.monJoueur?.nom ?? court;
  const plusieursClubs = (nombreClubs ?? moi?.clubs.length ?? 1) > 1;
  const actif = entreeActive(chemin, club.id);

  // Ce que « Partager » envoie, comme sur le site. Club public : sa vitrine,
  // que n'importe qui peut ouvrir. Club privé : seule l'invitation fait entrer
  // quelqu'un — un gérant la partage (« Inviter au club ») ; un membre n'a
  // rien à envoyer qui marcherait chez un non-membre, l'entrée disparaît.
  const invite = !club.urlPublique && club.peutGerer;
  const [lienInvite, setLienInvite] = useState<string | null>(null);
  const ouvert = ancre != null;

  // Le lien d'invitation se demande à l'OUVERTURE du menu, pas au toucher :
  // le partage part alors sans attendre le réseau.
  useEffect(() => {
    if (!ouvert || !invite || lienInvite) return;
    let vivant = true;
    chargerReglages(club.id)
      .then((r) => vivant && setLienInvite(r.invitation.lien))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [ouvert, invite, lienInvite, club.id]);

  const ouvrir = () => {
    leger();
    mesurer(pilule.current, (a) =>
      // Repli sans mesure : la place de la pilule dans la barre du site.
      setAncre(a ?? { x: 0, y: haut + 12, largeur: 0, hauteur: HAUTEUR_PILULE }),
    );
  };
  const fermer = () => setAncre(null);
  const puis = (fn: () => void) => () => {
    setAncre(null);
    fn();
  };

  const partager = async () => {
    setAncre(null);
    let lien = club.urlPublique;
    if (invite) {
      try {
        lien = lienInvite ?? (await chargerReglages(club.id)).invitation.lien;
      } catch (e) {
        Alert.alert("Le lien d'invitation n'a pas pu être préparé", messageErreur(e));
        return;
      }
    }
    if (!lien) return;
    // Toujours l'adresse de production : la vitrine et l'invitation ne sont
    // pas servies par le serveur de développement, et un lien « localhost »
    // collé dans WhatsApp n'ouvre rien chez personne.
    const url = PROD + lien;
    const texte = invite
      ? `Rejoins le club « ${court} » sur Five Scorer : ${url}`
      : `${court} sur Five Scorer : ${url}`;
    try {
      await Share.share({ message: texte, title: court });
    } catch {
      /* partage annulé */
    }
  };

  return (
    <>
      <PiluleClub
        ref={pilule}
        t={t}
        club={club}
        ouvert={ancre != null}
        onPress={ouvrir}
        style={stylePilule ?? s.piluleBornee}
      />

      <PopoverVerre t={t} ancre={ancre} onClose={fermer} largeur={290} ecart={-4} rayon={32}>
        <ScrollView bounces={false} style={s.defile} contentContainerStyle={s.contenu}>
          <Pressable
            onPress={puis(() =>
              club.monJoueur
                ? router.push({
                    pathname: "/joueur/[id]",
                    params: { id: club.monJoueur.id, clubId: club.id },
                  })
                : aller(club.id, "effectif", chemin),
            )}
            accessibilityRole="button"
            accessibilityLabel="Mon profil"
            style={({ pressed }) => [s.tete, pressed && { opacity: 0.6 }]}
          >
            <EcussonChasuble couleur={club.couleurA} lettre={ini(nom)} taille={48} corps={16} />
            <Text style={[s.teteTexte, { color: jeton(t, "i2") }]} numberOfLines={1}>
              Mon profil
            </Text>
          </Pressable>

          {ENTREES.filter(
            (e) =>
              (!e.gerant || club.peutGerer) &&
              (e.cle !== "partager" || !!club.urlPublique || invite),
          ).map((e) => (
            <Item
              key={e.cle}
              t={t}
              chemin={CHEMINS[e.icone]}
              carre={e.icone === "saison"}
              libelle={e.cle === "partager" && invite ? "Inviter au club" : e.libelle}
              actif={actif === e.cle}
              onPress={
                e.cle === "partager"
                  ? () => void partager()
                  : puis(() => aller(club.id, e.cle as Onglet, chemin))
              }
            />
          ))}

          {plusieursClubs ? (
            <Item
              t={t}
              chemin={CHEMINS.clubs}
              libelle="Mes clubs"
              onPress={puis(() => router.push("/clubs"))}
            />
          ) : (
            // Pour qui n'a qu'un club, c'est ICI qu'on entre dans un second :
            // l'écran « Mes clubs » saute droit au club quand il n'y en a
            // qu'un, donc quelqu'un à qui on envoie le lien d'un autre club
            // n'atteindrait jamais l'écran qui permet d'y entrer.
            <Item
              t={t}
              chemin={CHEMINS.rejoindre}
              libelle="Rejoindre un club"
              onPress={puis(() => router.push("/rejoindre"))}
            />
          )}

          <Item
            t={t}
            chemin={CHEMINS.sortir}
            libelle="Se déconnecter"
            danger
            onPress={puis(() => void deconnecter())}
          />
        </ScrollView>
      </PopoverVerre>
    </>
  );
}

/// « FC Lundi Soir » devient « Lundi Soir » dans la pilule, comme sur le site.
export function nomCourt(nom: string): string {
  return nom.replace(/^(FC|AS|US|SC|Five)\s+/i, "");
}

// ── La géométrie de la pilule ───────────────────────────────────────────────
// Elle est publique parce que la barre du haut en a besoin : c'est la largeur
// que la pilule DEMANDERAIT pour montrer le nom du club en entier qui décide
// si la marque « Five Scorer » tient encore à côté (composants/EnTeteClub).

/// 46 et non 50 : la barre porte deux objets, la pilule est une commande, pas
/// un titre. On reste très au-dessus des 44 points de cible.
export const HAUTEUR_PILULE = 46;
const ECUSSON_PILULE = 26;
const CORPS_PILULE = 16;
const GAUCHE_PILULE = 10;
const DROITE_PILULE = 16;
const ECART_PILULE = 8;

/// La chasse approchée d'un texte en police système : ~0,55 × le corps pour
/// une minuscule, ~0,68 pour une capitale, ~0,3 pour une espace.
///
/// Approchée, et volontairement un peu large : elle sert à décider si un mot
/// TIENT. Mieux vaut cacher la marque une fois de trop que la couper une fois
/// — c'est précisément le défaut qu'on répare.
export function largeurTexte(texte: string, corps: number): number {
  let n = 0;
  for (const c of texte) {
    n += c === " " ? 0.3 : c !== c.toLowerCase() ? 0.68 : 0.55;
  }
  return n * corps;
}

/// Ce que la pilule demande pour montrer le nom du club sans le couper.
export function largeurPilule(nom: string): number {
  return (
    GAUCHE_PILULE +
    ECUSSON_PILULE +
    ECART_PILULE +
    largeurTexte(nomCourt(nom), CORPS_PILULE) +
    DROITE_PILULE
  );
}

/// La pilule seule (`.verre.lueur` du site) : 46 de haut, lueur de la
/// couleur A, écusson de 26 en dégradé, le nom court du club.
export const PiluleClub = forwardRef<
  View,
  {
    t: Jetons;
    club: ClubDeMoi;
    onPress: () => void;
    ouvert?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>(function PiluleClub({ t, club, onPress, ouvert, style }, ref) {
  const court = nomCourt(club.nom);
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Menu du club ${court}`}
      accessibilityState={{ expanded: !!ouvert }}
      style={({ pressed }) => [s.pilule, styleLueur(t), style, pressed && { opacity: 0.8 }]}
    >
      <EcussonChasuble couleur={club.couleurA} lettre={court[0] ?? "?"} taille={ECUSSON_PILULE} />
      <Text style={[s.piluleTexte, { color: t.ink }]} numberOfLines={1}>
        {court}
      </Text>
    </Pressable>
  );
});

type Onglet = "index" | "matchs" | "soirees" | "saison" | "stats" | "effectif" | "reglages";
type Cle = Onglet | "partager";

/// L'ordre du site (components/ios/MenuClub.tsx).
const ENTREES: {
  cle: Cle;
  libelle: string;
  icone: keyof typeof CHEMINS;
  gerant?: boolean;
}[] = [
  { cle: "index", libelle: "Accueil", icone: "accueil" },
  { cle: "soirees", libelle: "Soirées", icone: "soirees" },
  { cle: "matchs", libelle: "Matchs", icone: "matchs" },
  { cle: "effectif", libelle: "Effectif", icone: "effectif" },
  { cle: "saison", libelle: "Saison", icone: "saison" },
  { cle: "stats", libelle: "Stats", icone: "stats" },
  { cle: "partager", libelle: "Partager", icone: "partager" },
  { cle: "reglages", libelle: "Réglages", icone: "reglages", gerant: true },
];

/// L'entrée à surligner pour l'écran affiché.
///
/// Comme le site (`pathname.startsWith`), un écran « dans » une rubrique
/// l'allume aussi : une fiche de soirée allume « Soirées », un récap ou la
/// compo « Matchs », le calendrier « Saison ». Pas la fiche d'un joueur : le
/// site n'allume « Effectif » que sur la liste elle-même.
export function entreeActive(chemin: string, clubId: string): Onglet | null {
  const base = `/club/${clubId}`;
  if (chemin === base || chemin === base + "/" || chemin === base + "/index") return "index";
  if (chemin.startsWith(base + "/")) {
    const rubrique = chemin.slice(base.length + 1).split("/")[0];
    return ENTREES.some((e) => e.cle === rubrique) ? (rubrique as Onglet) : null;
  }
  if (chemin.startsWith("/soiree/")) return "soirees";
  if (chemin.startsWith("/recap/") || chemin.startsWith("/match/") || chemin === "/compo") {
    return "matchs";
  }
  if (chemin === "/calendrier") return "saison";
  return null;
}

/// Va à un écran du club, sans empiler de doublon.
///
/// Depuis un écran du club, c'est un saut d'onglet (`navigate`). Depuis un
/// écran posé PAR-DESSUS le club (une soirée, un récap), on redescend
/// jusqu'au club au lieu d'en empiler un second exemplaire (`dismissTo`) :
/// sinon chaque passage par le menu ajoutait un club entier à la pile, et le
/// geste de retour remontait tout le chemin à l'envers.
function aller(clubId: string, onglet: Onglet, chemin: string) {
  const href =
    onglet === "index"
      ? ({ pathname: "/club/[id]", params: { id: clubId } } as const)
      : ({ pathname: `/club/[id]/${onglet}`, params: { id: clubId } } as const);
  if (chemin.startsWith(`/club/${clubId}`)) router.navigate(href);
  else router.dismissTo(href);
}

function Item({
  t,
  chemin,
  libelle,
  onPress,
  danger,
  actif,
  carre,
}: {
  t: Jetons;
  chemin: string;
  libelle: string;
  onPress: () => void;
  danger?: boolean;
  actif?: boolean;
  /// Le trophée de « Saison » est dessiné à bouts francs sur le site ; arrondi,
  /// il perd ses angles et devient un ballon.
  carre?: boolean;
}) {
  const couleur = danger ? jeton(t, "bad") : t.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!actif }}
      style={({ pressed }) => [
        s.item,
        (actif || pressed) && { backgroundColor: jeton(t, "gl") },
        pressed && !actif && { opacity: 0.8 },
      ]}
    >
      <IconeTrait d={chemin} couleur={couleur} carre={carre} />
      <Text style={[s.itemTexte, { color: couleur }]} numberOfLines={1}>
        {libelle}
      </Text>
    </Pressable>
  );
}

/// Se déconnecter, proprement — partagé entre le menu et les réglages.
///
/// Deux choses que le bouton d'origine ne faisait pas :
///
/// 1. il PRÉVIENT quand la file d'attente n'est pas vide. Une soirée saisie
///    au gymnase sans réseau vit dans la base du téléphone ; se déconnecter
///    la jetterait, et deux heures de saisie disparaîtraient sans un mot ;
///
/// 2. il VIDE la base locale. Sur un téléphone prêté, la personne suivante
///    ouvrait l'app sur le vestiaire du club précédent. C'est exactement ce
///    que fait le site avec son cache hors-ligne avant de signer la sortie.
export function useDeconnexion(): () => Promise<void> {
  const { enAttente, purger } = useNoyau();
  return async function deconnecter() {
    const { enAttente: restants, bloquees } = await enAttente().catch(() => ({
      enAttente: 0,
      bloquees: 0,
    }));
    const total = restants + bloquees;
    const partir = async () => {
      await purger();
      await signOut();
      memoriserMoi(null);
      router.replace("/connexion");
    };
    if (total === 0) return partir();
    Alert.alert(
      "Des choses ne sont pas encore parties",
      `${total} opération${total > 1 ? "s" : ""} attend${total > 1 ? "ent" : ""} le réseau. ` +
        "Se déconnecter maintenant les perdrait.",
      [
        { text: "Rester connecté", style: "cancel" },
        { text: "Se déconnecter quand même", style: "destructive", onPress: () => void partir() },
      ],
    );
  };
}

const s = StyleSheet.create({
  pilule: {
    flexDirection: "row",
    alignItems: "center",
    gap: ECART_PILULE,
    height: HAUTEUR_PILULE,
    borderRadius: HAUTEUR_PILULE / 2,
    paddingLeft: GAUCHE_PILULE,
    paddingRight: DROITE_PILULE,
    flexShrink: 1,
  },
  piluleBornee: { maxWidth: "56%" },
  piluleTexte: { fontSize: CORPS_PILULE, fontWeight: "600", flexShrink: 1 },

  defile: { flexGrow: 0, flexShrink: 1 },
  contenu: { paddingTop: 18, paddingHorizontal: 12, paddingBottom: 12 },
  tete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 14,
  },
  teteTexte: { fontSize: 20, fontWeight: "600", flexShrink: 1 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 14,
  },
  itemTexte: { fontSize: 22, fontWeight: "600", flexShrink: 1 },
});
