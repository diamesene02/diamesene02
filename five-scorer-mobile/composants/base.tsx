import { useId, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { arretsDeCrete, degradeDuVerre, jeton, lisible, type Jetons } from "../lib/couleurs";
import { ini } from "../lib/ini";
import { CHEMINS, IconeJeu, IconeRetour, IconeTrait } from "./Icones";

// Les briques du dessin, reprises du vocabulaire du site (globals.css, bloc
// « système natif ») : la carte de verre, l'écusson, l'avatar cerclé, le
// bouton plein et le bouton de verre. Elles prennent les jetons en
// paramètre plutôt que dans un contexte : un écran peut afficher deux clubs
// aux couleurs différentes.
//
// Les valeurs sont celles du site au pixel près — rayon 28, trait 1, ombres
// en `boxShadow` avec les chaînes CSS des jetons. React Native 0.86 les lit
// telles quelles (nouvelle architecture), ombre intérieure comprise : ce qui
// part par une mise à jour à chaud, sans module natif de plus.

/// Le corps de texte du site : interlettrage −0,01 em, interligne 1,3. Les
/// titres gardent leurs valeurs à eux ; c'est pour les textes courants.
export function texte(taille: number, graisse: TextStyle["fontWeight"] = "400"): TextStyle {
  return {
    fontSize: taille,
    fontWeight: graisse,
    letterSpacing: Math.round(-0.01 * taille * 100) / 100,
    lineHeight: Math.round(taille * 1.3),
  };
}

/// Les deux moitiés du jeton `cs` : le reflet intérieur du bord haut et
/// l'ombre portée. Elles ne se posent pas sur la même vue — le dégradé du
/// verre recouvrirait le reflet.
function ombresDeCarte(t: Jetons): { reflet: string; ombre: string } {
  const parts = jeton(t, "cs")
    .split(/,(?![^()]*\))/)
    .map((p) => p.trim());
  return {
    reflet: parts.filter((p) => p.startsWith("inset")).join(", "),
    ombre: parts.filter((p) => p && !p.startsWith("inset")).join(", "),
  };
}

/// La carte de verre du site (`.carte`) : dégradé du haut vers le bas, trait
/// d'un point, reflet clair sur le bord haut, ombre portée, rayon 28.
///
/// Sans marge intérieure : c'est la matière seule, pour les écrans qui
/// dessinent leurs propres rangées bord à bord. `Carte` y ajoute la marge et
/// le titre.
export function CarteVerre({
  t,
  rayon = 28,
  style,
  children,
  onPress,
  etiquette,
}: {
  t: Jetons;
  /// 28 partout ; 22 pour les listes groupées des réglages, 24 pour la
  /// bannière de l'accueil.
  rayon?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /// Toute la carte devient touchable (la bannière de la soirée, la carte
  /// « homme du match »).
  onPress?: () => void;
  etiquette?: string;
}) {
  const [haut, bas] = degradeDuVerre(t);
  const { reflet, ombre } = ombresDeCarte(t);
  // Les calques suivent l'arrondi du cadre, trait déduit : la carte ne coupe
  // pas son contenu (pas d'`overflow: hidden`, qui rognerait l'ombre).
  const interieur = Math.max(rayon - 1, 0);
  const cadre: StyleProp<ViewStyle> = [
    s.verre,
    { borderRadius: rayon, borderColor: jeton(t, "cb"), boxShadow: ombre || undefined },
    style,
  ];
  const matiere = (
    <>
      <LinearGradient
        colors={[haut, bas]}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: interieur }]}
      />
      {reflet ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: interieur, boxShadow: reflet }]}
        />
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={etiquette}
        style={({ pressed }) => [cadre, pressed && { opacity: 0.7 }]}
      >
        {matiere}
        {children}
      </Pressable>
    );
  }
  return (
    <View style={cadre}>
      {matiere}
      {children}
    </View>
  );
}

/// La carte des écrans : le verre, une marge de 16, et le titre du site
/// (`.carte-titre` : 22/600, centré).
export function Carte({
  t,
  titre,
  children,
  style,
  rayon,
  onPress,
}: {
  t: Jetons;
  titre?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  rayon?: number;
  onPress?: () => void;
}) {
  return (
    <CarteVerre t={t} rayon={rayon} onPress={onPress} style={[s.carte, style]}>
      {titre ? <Text style={[s.carteTitre, { color: t.ink }]}>{titre}</Text> : null}
      {children}
    </CarteVerre>
  );
}

/// L'écusson d'une chasuble — `.ecusson` du site, le seul dessin d'écusson.
///
/// Un dégradé radial centré à 35 % / 30 % (`crest()` de lib/theme.ts : la
/// couleur éclaircie, la couleur à 55 %, la couleur assombrie), un anneau
/// intérieur blanc à 30 % de 4 points QUELLE QUE SOIT la taille, une ombre
/// portée, la lettre en 800 à 0,4 × la taille. L'aplat qu'il remplace se
/// lisait comme une pastille ; le relief en fait un écusson.
///
/// Dessiné en react-native-svg plutôt qu'en `experimental_backgroundImage` :
/// le dégradé radial CSS de React Native est encore expérimental, et un
/// écusson qui ne se peint pas est un rond vide sur toutes les pages.
export function EcussonChasuble({
  couleur,
  lettre,
  taille = 76,
  rayon,
  anneau = 4,
  corps,
  encre,
  ombre = true,
}: {
  couleur: string;
  lettre: string;
  taille?: number;
  /// L'arrondi. Un rond par défaut ; 9 pour l'icône « F » de la marque, 8
  /// pour l'écusson de la rangée « Nom » des réglages.
  rayon?: number;
  /// L'épaisseur de l'anneau intérieur. 4 comme le site ; 5 pour les
  /// écussons de 76 du récap.
  anneau?: number;
  /// La taille de la lettre, quand ce ne sont pas 0,4 × la taille (les deux
  /// initiales de « Mon profil » : 16 sur 48).
  corps?: number;
  /// L'encre de la lettre (`taF`/`tbF`). Calculée sinon, par la même règle.
  encre?: string;
  ombre?: boolean;
}) {
  const id = "crete" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [clair, milieu, sombre] = arretsDeCrete(couleur);
  const r = Math.min(rayon ?? taille / 2, taille / 2);
  const a = Math.min(anneau, taille / 4);
  return (
    <View
      style={[
        s.ecusson,
        { width: taille, height: taille, borderRadius: r },
        ombre && { boxShadow: "0 6px 14px rgba(0,0,0,0.3)" },
      ]}
    >
      <Svg width={taille} height={taille} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* « circle at 35% 30% » : le rayon CSS par défaut va jusqu'au coin
              le plus loin, soit 95,5 % du côté depuis ce centre. */}
          <RadialGradient id={id} cx="35%" cy="30%" fx="35%" fy="30%" r="95.5%">
            <Stop offset="0" stopColor={clair} />
            <Stop offset="0.55" stopColor={milieu} />
            <Stop offset="1" stopColor={sombre} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={taille} height={taille} rx={r} ry={r} fill={`url(#${id})`} />
        {a > 0 && (
          <Rect
            x={a / 2}
            y={a / 2}
            width={taille - a}
            height={taille - a}
            rx={Math.max(r - a / 2, 0)}
            ry={Math.max(r - a / 2, 0)}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={a}
          />
        )}
      </Svg>
      <Text
        allowFontScaling={false}
        style={{
          fontSize: corps ?? Math.round(taille * 0.4),
          fontWeight: "800",
          color: encre ?? lisible(couleur),
        }}
      >
        {lettre.toUpperCase()}
      </Text>
    </View>
  );
}

/// L'ancien écusson « plat » (liste des clubs, vitrine, saison). Le site n'en
/// a qu'un : c'est désormais le même dessin, à 56 par défaut.
export function Ecusson({
  couleur,
  lettre,
  taille = 56,
}: {
  couleur: string;
  lettre: string;
  taille?: number;
}) {
  return <EcussonChasuble couleur={couleur} lettre={lettre} taille={taille} />;
}

/// L'avatar cerclé du site (`.avatar-anneau`).
///
/// Fond sombre `av`, anneau de 2 points : à la couleur de la chasuble du
/// joueur quand on la connaît (`camp`, ou `anneau` pour une couleur donnée),
/// sinon le trait de verre `gb`, très discret. Les initiales suivent
/// `lib/ini.ts` du site : deux lettres, « BA » pour Bakary — pas « B ».
export function Avatar({
  nom,
  photo,
  t,
  anneau,
  camp,
  taille = 30,
  epaisseur,
  corps,
  initiales,
}: {
  nom: string;
  photo?: string | null;
  t: Jetons;
  /// Une couleur d'anneau explicite. Prend le pas sur `camp`.
  anneau?: string;
  /// La chasuble du joueur : l'anneau prend `taR` ou `tbR`, la couleur
  /// rattrapée pour rester visible sur le fond (une chasuble noire sur un
  /// fond sombre).
  camp?: "A" | "B" | null;
  taille?: number;
  /// L'anneau fait 2 points partout (2,5 autour d'une photo) — sauf sur la
  /// fiche joueur, où le site en met 4 autour d'un avatar de 128.
  epaisseur?: number;
  /// La taille des initiales. Par défaut un tiers du cercle ; la fiche la
  /// fixe à 40 comme la maquette, sinon un avatar de 128 écrirait en 43.
  corps?: number;
  /// Les initiales déjà calculées par le serveur (plusieurs routes les
  /// rendent). Sinon, `ini(nom)`.
  initiales?: string;
}) {
  const couleurAnneau =
    anneau ??
    (camp === "A" ? (t.taR ?? t.ta) : camp === "B" ? (t.tbR ?? t.tb) : undefined) ??
    jeton(t, "gb");
  const largeur = epaisseur ?? (photo ? 2.5 : 2);
  return (
    <View
      style={[
        s.avatar,
        {
          width: taille,
          height: taille,
          borderRadius: taille / 2,
          borderWidth: largeur,
          borderColor: couleurAnneau,
          backgroundColor: photo ? jeton(t, "seg") : jeton(t, "av"),
        },
      ]}
    >
      {photo ? (
        <>
          <Image source={{ uri: photo }} style={s.avatarImage} />
          {/* Le liseré sombre du site entre l'anneau et la photo : sans lui,
              une photo claire se fond dans un anneau clair. */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, s.avatarLisere, { borderRadius: taille / 2 }]}
          />
        </>
      ) : (
        <Text
          allowFontScaling={false}
          style={{ fontSize: corps ?? Math.round(taille / 3), fontWeight: "700", color: t.ink }}
        >
          {initiales ?? ini(nom)}
        </Text>
      )}
    </View>
  );
}

/// Le bouton plein du site (`.plein`) : 52 de haut, fond `bt`, ombre portée.
export function BoutonPlein({
  t,
  titre,
  onPress,
  disabled,
  icone,
  grand,
  danger,
  occupe,
  style,
  etiquette,
}: {
  t: Jetons;
  titre: string;
  onPress: () => void;
  disabled?: boolean;
  /// Dessiné avant le titre, à 8 points (le triangle de « Coup d'envoi »).
  icone?: React.ReactNode;
  /// 56 de haut et 19 points : le bouton final de la compo.
  grand?: boolean;
  /// `.plein.danger` : fond de verre, texte `bad` (« Se déconnecter »).
  danger?: boolean;
  /// Un envoi en cours : l'indicateur remplace l'icône et le bouton se fige.
  occupe?: boolean;
  style?: StyleProp<ViewStyle>;
  etiquette?: string;
}) {
  const encre = danger ? jeton(t, "bad") : jeton(t, "bf");
  const inactif = disabled || occupe;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactif}
      accessibilityRole="button"
      accessibilityLabel={etiquette}
      accessibilityState={{ disabled: !!inactif, busy: !!occupe }}
      style={({ pressed }) => [
        s.bouton,
        grand && s.boutonGrand,
        danger
          ? { backgroundColor: jeton(t, "cdSolid"), borderWidth: 1, borderColor: jeton(t, "cb") }
          : { backgroundColor: jeton(t, "bt"), boxShadow: "0 8px 24px rgba(0,0,0,0.25)" },
        { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {occupe ? <ActivityIndicator color={encre} /> : icone}
      <Text
        style={[s.boutonTexte, grand && s.boutonTexteGrand, { color: encre }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {titre}
      </Text>
    </Pressable>
  );
}

/// Le style « lueur » du site (`.verre.lueur`) : trait de 1,5 à la couleur
/// du club, halo de 22 points. La pilule du club, le sélecteur de saison, le
/// bouton « Modifier » de la fiche.
export function styleLueur(t: Jetons): ViewStyle {
  const ring = jeton(t, "ring");
  return {
    borderWidth: 1.5,
    borderColor: ring,
    backgroundColor: jeton(t, "gl"),
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 0 22px ${ring}`,
  };
}

/// Le bouton de verre du site (`.verre`) : fond `gl` translucide, trait `gb`.
export function BoutonVerre({
  t,
  titre,
  onPress,
  disabled,
  icone,
  taille = "grand",
  lueur,
  style,
  etiquette,
}: {
  t: Jetons;
  titre: string;
  onPress: () => void;
  disabled?: boolean;
  /// Dessiné avant le titre, à 8 points (le « + » d'« Ajouter un joueur »).
  icone?: React.ReactNode;
  /// « grand » : 52 de haut (`.verre.grand`, le défaut, pleine largeur dans
  /// une colonne). « normal » : 44, pour un bouton posé dans une rangée.
  taille?: "grand" | "normal";
  /// Le halo de la couleur du club (« Modifier » sur la fiche joueur).
  lueur?: boolean;
  style?: StyleProp<ViewStyle>;
  etiquette?: string;
}) {
  const hauteur = taille === "normal" ? 44 : 52;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={etiquette}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        s.bouton,
        { height: hauteur, borderRadius: hauteur / 2, paddingHorizontal: 18 },
        lueur
          ? styleLueur(t)
          : { borderWidth: 1, borderColor: jeton(t, "gb"), backgroundColor: jeton(t, "gl") },
        { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icone}
      <Text style={[s.boutonTexte, { color: t.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {titre}
      </Text>
    </Pressable>
  );
}

/// Le sélecteur segmenté du site, en ses trois dessins.
///
/// - « large » (le défaut, `.segment.plein-large`) : piste de 44, colonnes
///   égales, la pastille active en VERRE — « Quand ? » de la compo ;
/// - « compact » (`.segment`) : piste de 36 ajustée au texte, la pastille
///   active en blanc plein — « Entre nous / Vs adversaire », « Apparence » ;
/// - « grand » : les onglets du récap, sans piste, pastilles de 48 en 20
///   points, l'active en blanc avec une ombre.
///
/// Trois choix au plus : au-delà, ce n'est plus un segment mais un menu, et
/// ça ne se tape pas d'un pouce.
export function Segment<V extends string>({
  t,
  choix,
  valeur,
  onChange,
  variante = "large",
  style,
}: {
  t: Jetons;
  choix: { valeur: V; libelle: string }[];
  valeur: V;
  onChange: (v: V) => void;
  variante?: "large" | "compact" | "grand";
  style?: StyleProp<ViewStyle>;
}) {
  const piste: StyleProp<ViewStyle> =
    variante === "grand"
      ? s.segmentGrand
      : [
          variante === "compact" ? s.segmentCompact : s.segmentLarge,
          { backgroundColor: jeton(t, "seg") },
        ];
  const fondActif: ViewStyle =
    variante === "large"
      ? { backgroundColor: jeton(t, "gl") }
      : variante === "compact"
        ? { backgroundColor: jeton(t, "bt") }
        : { backgroundColor: "#ffffff", boxShadow: "0 6px 18px rgba(0,0,0,0.3)" };
  const encreActive =
    variante === "large" ? t.ink : variante === "compact" ? jeton(t, "bf") : "#111111";
  const encreInactive = variante === "grand" ? "rgba(255,255,255,0.7)" : jeton(t, "i2");
  return (
    <View style={[piste, style]} accessibilityRole="tablist">
      {choix.map((c) => {
        const actif = c.valeur === valeur;
        return (
          <Pressable
            key={c.valeur}
            onPress={() => onChange(c.valeur)}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            style={[
              variante === "grand"
                ? s.segmentPastilleGrand
                : variante === "compact"
                  ? s.segmentPastilleCompact
                  : s.segmentPastilleLarge,
              actif && fondActif,
            ]}
          >
            <Text
              style={[
                variante === "grand"
                  ? s.segmentTexteGrand
                  : variante === "compact"
                    ? s.segmentTexteCompact
                    : s.segmentTexteLarge,
                { color: actif ? encreActive : encreInactive },
              ]}
              numberOfLines={1}
            >
              {c.libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/// Le bouton rond « en verre » de la barre du haut (`.verre.rond`).
///
/// 44 × 44, comme sur le site : c'est aussi la cible minimale recommandée par
/// Apple, et on l'atteint d'un pouce en tenant le téléphone d'une main.
///
/// Les symboles connus sont dessinés : « ‹ » devient le chevron du site
/// (12 × 20, trait de 2,5), « × » la croix, « ≡ » les trois traits. Le
/// caractère « ‹ » faisait 6 × 10 points — on le cherchait du doigt.
export function BoutonRond({
  t,
  symbole,
  icone,
  onPress,
  etiquette,
  lueur,
}: {
  t: Jetons;
  symbole?: string;
  /// Un dessin à la place du symbole (le partage du récap).
  icone?: React.ReactNode;
  onPress: () => void;
  etiquette?: string;
  lueur?: boolean;
}) {
  const encre = t.ink ?? "#ffffff";
  const dessin =
    icone ??
    (symbole === "‹" ? (
      <IconeRetour couleur={encre} />
    ) : symbole === "×" || symbole === "✕" ? (
      <IconeJeu nom="croix" couleur={encre} taille={22} epaisseur={2.2} />
    ) : symbole === "≡" ? (
      <IconeTrait d={CHEMINS.clubs} couleur={encre} taille={22} />
    ) : (
      <Text style={{ color: encre, fontSize: 17, fontWeight: "600" }}>{symbole}</Text>
    ));
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={etiquette}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.rond,
        lueur ? styleLueur(t) : { backgroundColor: jeton(t, "gl"), borderColor: jeton(t, "gb") },
        pressed && { opacity: 0.8 },
      ]}
    >
      {dessin}
    </Pressable>
  );
}

/// La poignée de la feuille — 40 × 5, en `i3`, comme `.grabber` du site.
///
/// Elle ne fait rien. Elle dit que cet écran est une feuille posée par-dessus
/// le reste, pas une page de plus : on sait d'un coup d'œil qu'on en ressort.
export function Poignee({ t }: { t?: Jetons }) {
  return <View style={[s.poignee, { backgroundColor: t?.i3 ?? "rgba(255,255,255,0.4)" }]} />;
}

/// Le champ de saisie du site : fond `seg`, sans trait, 52 de haut, rayon 14,
/// 17 points ; au focus, un contour de 2 à la couleur du club (`ring`).
///
/// Le contour est TOUJOURS là, transparent hors focus : le texte ne saute
/// pas de deux points quand on touche le champ.
export function Saisie({
  t,
  style,
  onFocus,
  onBlur,
  multiline,
  ...props
}: TextInputProps & { t: Jetons }) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      placeholderTextColor={jeton(t, "i3")}
      selectionColor={t.ink}
      multiline={multiline}
      {...props}
      onFocus={(e) => {
        setFocus(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        onBlur?.(e);
      }}
      style={[
        s.saisie,
        multiline ? s.saisieMulti : { height: 52 },
        {
          color: t.ink,
          backgroundColor: jeton(t, "seg"),
          borderColor: focus ? jeton(t, "ring") : "transparent",
        },
        style,
      ]}
    />
  );
}

/// Un champ avec son libellé au-dessus (connexion, calendrier, soirée).
export function Champ({
  t,
  libelle,
  ...props
}: TextInputProps & { t: Jetons; libelle: string }) {
  return (
    <View style={s.champ}>
      <Text style={[s.champLibelle, { color: t.i2 }]}>{libelle}</Text>
      <Saisie t={t} accessibilityLabel={libelle} {...props} />
    </View>
  );
}

/// L'interrupteur du site (`.interrupteur`) : piste éteinte
/// rgba(120,120,128,.4), allumée #34c759, pouce blanc. Le Switch natif
/// d'iOS fait déjà 51 × 31 : on ne lui change que les couleurs.
export function Interrupteur({
  valeur,
  onChange,
  etiquette,
  disabled,
}: {
  valeur: boolean;
  onChange: (v: boolean) => void;
  /// Obligatoire : un interrupteur sans libellé ne se lit pas au lecteur
  /// d'écran, et sa rangée n'est pas toujours juste à côté.
  etiquette: string;
  disabled?: boolean;
}) {
  return (
    <Switch
      value={valeur}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={etiquette}
      trackColor={{ false: "rgba(120,120,128,0.4)", true: "#34c759" }}
      ios_backgroundColor="rgba(120,120,128,0.4)"
      thumbColor="#ffffff"
    />
  );
}

/// Les onglets texte en tête de carte (`.onglets` du site) : colonnes
/// égales, 62 de haut, 20/600, l'inactif en `i3`, puis le filet.
/// « Mardi 15 · Ce soir · À venir », « Tableau · Buteurs · Forme ».
export function Onglets<V extends string>({
  t,
  onglets,
  actif,
  onChange,
}: {
  t: Jetons;
  onglets: { valeur: V; libelle: string }[];
  actif: V;
  onChange: (v: V) => void;
}) {
  return (
    <View>
      <View style={s.onglets} accessibilityRole="tablist">
        {onglets.map((o) => {
          const choisi = o.valeur === actif;
          return (
            <Pressable
              key={o.valeur}
              onPress={() => onChange(o.valeur)}
              accessibilityRole="tab"
              accessibilityState={{ selected: choisi }}
              style={s.onglet}
            >
              <Text
                style={[s.ongletTexte, { color: choisi ? t.ink : jeton(t, "i3") }]}
                numberOfLines={1}
              >
                {o.libelle}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Filet t={t} />
    </View>
  );
}

/// Le filet du site (`.filet`) : un point, en retrait de 10 de chaque côté.
/// Un point entier et non un demi-pixel : c'est ce que dessine le 1 px CSS.
export function Filet({ t, style }: { t: Jetons; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.filet, { backgroundColor: jeton(t, "sep") }, style]} />;
}

const s = StyleSheet.create({
  verre: { borderWidth: 1 },
  carte: { padding: 16 },
  carteTitre: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
    marginTop: 4,
    paddingBottom: 12,
  },
  ecusson: { alignItems: "center", justifyContent: "center" },
  avatar: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarLisere: { borderWidth: 1.5, borderColor: "rgba(0,0,0,0.25)" },
  bouton: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  boutonGrand: { height: 56, borderRadius: 28 },
  boutonTexte: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  boutonTexteGrand: { fontSize: 19 },
  segmentLarge: { flexDirection: "row", height: 44, borderRadius: 22, padding: 3 },
  segmentPastilleLarge: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentTexteLarge: { fontSize: 17, fontWeight: "600" },
  segmentCompact: {
    flexDirection: "row",
    alignSelf: "flex-start",
    height: 36,
    borderRadius: 10,
    padding: 2,
  },
  segmentPastilleCompact: {
    height: 32,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentTexteCompact: { fontSize: 15, fontWeight: "600" },
  segmentGrand: { flexDirection: "row", gap: 6 },
  segmentPastilleGrand: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  segmentTexteGrand: { fontSize: 20, fontWeight: "600", letterSpacing: -0.3 },
  rond: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  poignee: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 6,
  },
  saisie: {
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 14,
    fontSize: 17,
  },
  saisieMulti: { minHeight: 52, paddingVertical: 12, textAlignVertical: "top" },
  champ: { gap: 6 },
  champLibelle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  onglets: { flexDirection: "row", height: 62, alignItems: "center" },
  onglet: {
    flex: 1,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  ongletTexte: { fontSize: 20, fontWeight: "600", letterSpacing: -0.3 },
  filet: { height: 1, marginHorizontal: 10 },
});
