import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { lisible, type Jetons } from "../lib/couleurs";

// Les briques du dessin, reprises du vocabulaire de l'app web : la carte de
// verre, l'écusson, l'avatar cerclé, le bouton plein et le bouton de verre.
// Elles prennent les jetons en paramètre plutôt que dans un contexte : un
// écran peut afficher deux clubs aux couleurs différentes.

export function Carte({
  t,
  titre,
  children,
  style,
}: {
  t: Jetons;
  titre?: string;
  children?: React.ReactNode;
  style?: object;
}) {
  return (
    <View
      style={[
        s.carte,
        { backgroundColor: t.cdSolid, borderColor: t.cb },
        style,
      ]}
    >
      {titre && <Text style={[s.carteTitre, { color: t.ink }]}>{titre}</Text>}
      {children}
    </View>
  );
}

export function Ecusson({
  couleur,
  lettre,
  taille = 56,
}: {
  couleur: string;
  lettre: string;
  taille?: number;
}) {
  return (
    <View
      style={[
        s.ecusson,
        {
          width: taille,
          height: taille,
          borderRadius: taille / 2,
          backgroundColor: couleur,
        },
      ]}
    >
      <Text
        style={{
          fontSize: Math.round(taille * 0.42),
          fontWeight: "800",
          color: lisible(couleur),
        }}
      >
        {lettre.toUpperCase()}
      </Text>
    </View>
  );
}

export function Avatar({
  nom,
  photo,
  t,
  anneau,
  taille = 30,
  epaisseur,
  corps,
}: {
  nom: string;
  photo?: string | null;
  t: Jetons;
  anneau?: string;
  taille?: number;
  /// L'anneau fait 2 px partout — sauf sur la fiche joueur, où le site en
  /// met 4 autour d'un avatar de 128. Un anneau de 2 px sur 128 disparaît.
  epaisseur?: number;
  /// La taille des initiales. Par défaut un tiers du cercle ; la fiche la
  /// fixe à 40 comme la maquette, sinon un avatar de 128 écrirait en 43.
  corps?: number;
}) {
  const initiales = nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        s.avatar,
        {
          width: taille,
          height: taille,
          borderRadius: taille / 2,
          backgroundColor: t.seg,
          borderColor: anneau ?? t.i3,
          ...(epaisseur != null ? { borderWidth: epaisseur } : null),
        },
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={s.avatarImage} />
      ) : (
        <Text style={{ fontSize: corps ?? Math.round(taille / 3), fontWeight: "700", color: t.ink }}>
          {initiales}
        </Text>
      )}
    </View>
  );
}

export function BoutonPlein({
  t,
  titre,
  onPress,
  disabled,
}: {
  t: Jetons;
  titre: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.bouton,
        { backgroundColor: t.bt, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[s.boutonTexte, { color: t.bf }]} numberOfLines={1} adjustsFontSizeToFit>
        {titre}
      </Text>
    </Pressable>
  );
}

export function BoutonVerre({
  t,
  titre,
  onPress,
  disabled,
}: {
  t: Jetons;
  titre: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.bouton,
        s.boutonVerre,
        { borderColor: t.cb, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[s.boutonTexte, { color: t.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {titre}
      </Text>
    </Pressable>
  );
}

/// Le sélecteur segmenté du site : une piste sombre, la pastille active en
/// clair. Deux choix, jamais plus — au-delà, ce n'est plus un segment mais un
/// menu, et ça ne se tape pas d'un pouce.
export function Segment<V extends string>({
  t,
  choix,
  valeur,
  onChange,
}: {
  t: Jetons;
  choix: { valeur: V; libelle: string }[];
  valeur: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={[s.segment, { backgroundColor: t.seg }]}>
      {choix.map((c) => {
        const actif = c.valeur === valeur;
        return (
          <Pressable
            key={c.valeur}
            onPress={() => onChange(c.valeur)}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            style={[
              s.segmentPastille,
              actif && { backgroundColor: t.bt ?? "#ffffff" },
            ]}
          >
            <Text
              style={[
                s.segmentTexte,
                { color: actif ? (t.bf ?? "#111111") : t.i2 },
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

/// Le bouton rond « en verre » de la barre du haut.
///
/// 44 × 44, comme sur le site : c'est aussi la cible minimale recommandée par
/// Apple, et on l'atteint d'un pouce en tenant le téléphone d'une main.
export function BoutonRond({
  t,
  symbole,
  onPress,
  etiquette,
}: {
  t: Jetons;
  symbole: string;
  onPress: () => void;
  etiquette?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={etiquette}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.rond,
        {
          backgroundColor: pressed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.12)",
          borderColor: "rgba(255,255,255,0.16)",
        },
      ]}
    >
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: "600" }}>{symbole}</Text>
    </Pressable>
  );
}

/// La poignée de la feuille — 40 × 5, comme sur le site.
///
/// Elle ne fait rien. Elle dit que cet écran est une feuille posée par-dessus
/// le reste, pas une page de plus : on sait d'un coup d'œil qu'on en ressort.
export function Poignee() {
  return <View style={s.poignee} />;
}

/// L'écusson d'une chasuble, avec son anneau intérieur.
///
/// Le site le dessine avec un `box-shadow` intérieur de 5 px, que React Native
/// ne connaît pas : on empile donc un cercle bordé par-dessus la couleur. Le
/// résultat est le même et l'anneau reste visible sur une chasuble blanche
/// comme sur une noire.
export function EcussonChasuble({
  couleur,
  lettre,
  taille = 76,
}: {
  couleur: string;
  lettre: string;
  taille?: number;
}) {
  return (
    <View
      style={[
        s.ecussonChasuble,
        {
          width: taille,
          height: taille,
          borderRadius: taille / 2,
          backgroundColor: couleur,
          borderWidth: Math.round(taille * 0.066),
          borderColor: "rgba(255,255,255,0.3)",
        },
      ]}
    >
      <Text
        style={{
          fontSize: Math.round(taille * 0.395),
          fontWeight: "700",
          color: lisible(couleur),
        }}
      >
        {lettre.toUpperCase()}
      </Text>
    </View>
  );
}

export function Champ({
  t,
  libelle,
  ...props
}: TextInputProps & { t: Jetons; libelle: string }) {
  return (
    <View style={s.champ}>
      <Text style={[s.champLibelle, { color: t.i2 }]}>{libelle}</Text>
      <TextInput
        placeholderTextColor={t.i3}
        {...props}
        style={[
          s.champSaisie,
          { color: t.ink, backgroundColor: t.seg, borderColor: t.cb },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  carte: { borderRadius: 26, borderWidth: 1, padding: 16 },
  carteTitre: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    paddingBottom: 8,
  },
  ecusson: { alignItems: "center", justifyContent: "center" },
  avatar: {
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: "100%", height: "100%" },
  bouton: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  boutonVerre: { borderWidth: 1, backgroundColor: "transparent" },
  boutonTexte: { fontSize: 17, fontWeight: "600" },
  segment: { flexDirection: "row", borderRadius: 22, padding: 3, gap: 3 },
  segmentPastille: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentTexte: { fontSize: 15, fontWeight: "600" },
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
    backgroundColor: "rgba(255,255,255,0.3)",
    alignSelf: "center",
    marginTop: 6,
  },
  ecussonChasuble: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  champ: { gap: 6 },
  champLibelle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  champSaisie: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 17,
  },
});
