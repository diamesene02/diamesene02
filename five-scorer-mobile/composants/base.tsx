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
}: {
  nom: string;
  photo?: string | null;
  t: Jetons;
  anneau?: string;
  taille?: number;
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
        },
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={s.avatarImage} />
      ) : (
        <Text style={{ fontSize: Math.round(taille / 3), fontWeight: "700", color: t.ink }}>
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
      <Text style={[s.boutonTexte, { color: t.bf }]}>{titre}</Text>
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
      <Text style={[s.boutonTexte, { color: t.ink }]}>{titre}</Text>
    </Pressable>
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
    paddingHorizontal: 22,
  },
  boutonVerre: { borderWidth: 1, backgroundColor: "transparent" },
  boutonTexte: { fontSize: 17, fontWeight: "600" },
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
