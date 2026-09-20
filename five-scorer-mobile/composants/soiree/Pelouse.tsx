import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { EcussonChasuble } from "../base";
import { ini } from "../../lib/ini";
import { placer, type Camp, type Statut } from "./logique";

/// Un joueur posé sur la pelouse.
export type JoueurPelouse = {
  playerId: string;
  nom: string;
  photo: string | null;
  niveau: number;
  /// Gardien de CETTE soirée : il se place devant sa cage et porte « G ».
  gardien: boolean;
  /// Ce qu'il a répondu (abonnement compris) : un absent placé s'estompe.
  presence: Statut | null;
};

const HAUTEUR = 520;
/// Sous le trait de 2 : les positions se comptent dans le cadre, comme les
/// pourcentages CSS du site.
const INTERIEUR = HAUTEUR - 4;
const LARGEUR_JOUEUR = 96;
const BANDE = 43;

/// La pelouse de la compo — le dessin de `.pelouse` du site : bandes tondues,
/// ligne médiane, rond central de 96, deux surfaces de 180 × 64. L'équipe A
/// dans la moitié haute, la B dans la moitié basse, chacune avec son gardien
/// devant sa cage. Les positions viennent de `placer`, le même calcul que le
/// site : une compo préparée sur l'un se lit pareil sur l'autre.
///
/// Un tap fait passer le joueur dans l'autre équipe : il traverse la ligne
/// médiane, et un éclair blanc dit où il a atterri. Sur le site, le même tap
/// le renvoyait hors compo au deuxième coup — pour repasser de B en A, il
/// fallait aller le rechercher sous la pelouse.
export default function Pelouse({
  equipeA,
  equipeB,
  couleurA,
  couleurB,
  nomA,
  nomB,
  modifiable,
  vide,
  eclair,
  onTap,
  onAppuiLong,
}: {
  equipeA: JoueurPelouse[];
  equipeB: JoueurPelouse[];
  couleurA: string;
  couleurB: string;
  nomA: string;
  nomB: string;
  modifiable: boolean;
  /// Le texte au milieu d'une pelouse vide.
  vide: string;
  /// Le dernier joueur déplacé : son avatar s'éclaire un instant.
  eclair: { playerId: string; n: number } | null;
  onTap: (playerId: string, camp: Camp) => void;
  onAppuiLong: (playerId: string, camp: Camp) => void;
}) {
  const [largeur, setLargeur] = useState(0);
  const lueur = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!eclair) return;
    lueur.setValue(1);
    Animated.timing(lueur, { toValue: 0, duration: 650, useNativeDriver: true }).start();
  }, [eclair, lueur]);

  const posA = placer(equipeA.length, equipeA[0]?.gardien ?? false);
  const posB = placer(equipeB.length, equipeB[0]?.gardien ?? false);

  const joueur = (j: JoueurPelouse, camp: Camp, pos: { x: number; y: number }) => {
    const y = camp === "A" ? pos.y : 100 - pos.y;
    const autre = camp === "A" ? nomB : nomA;
    const presence =
      j.presence === "OUT" ? ", a dit absent" : j.presence === "MAYBE" ? ", peut-être" : "";
    return (
      <Pressable
        key={j.playerId}
        onPress={modifiable ? () => onTap(j.playerId, camp) : undefined}
        onLongPress={modifiable ? () => onAppuiLong(j.playerId, camp) : undefined}
        disabled={!modifiable}
        accessibilityRole="button"
        accessibilityLabel={`${j.nom}, ${camp === "A" ? nomA : nomB}${j.gardien ? ", gardien" : ""}${presence}`}
        accessibilityHint={
          modifiable ? `Touche pour le passer chez ${autre}. Appui long pour d'autres choix.` : undefined
        }
        style={({ pressed }) => [
          s.joueur,
          {
            left: (largeur * pos.x) / 100 - LARGEUR_JOUEUR / 2,
            // Le centre du bloc avatar + nom (77 de haut) sur la position :
            // le `translate(-50%, -50%)` du site.
            top: (INTERIEUR * y) / 100 - 38,
          },
          j.presence === "OUT" && { opacity: 0.45 },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View>
          {eclair?.playerId === j.playerId && (
            <Animated.View
              pointerEvents="none"
              style={[
                s.eclair,
                {
                  opacity: lueur,
                  transform: [
                    { scale: lueur.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1] }) },
                  ],
                },
              ]}
            />
          )}
          <View style={s.avatar}>
            <EcussonChasuble
              couleur={camp === "A" ? couleurA : couleurB}
              lettre={j.photo ? "" : ini(j.nom)}
              taille={54}
              anneau={3}
              corps={16}
              ombre={false}
            />
            {j.photo ? (
              // La photo en retrait de 4 : le fond de chasuble reste visible
              // tout autour, et c'est lui qui dit l'équipe.
              <Image source={{ uri: j.photo }} style={s.photo} />
            ) : null}
          </View>
          <View style={s.niveau}>
            <Text allowFontScaling={false} style={s.niveauTexte}>
              {j.gardien ? "G" : j.niveau}
            </Text>
          </View>
        </View>
        <Text allowFontScaling={false} style={s.nom} numberOfLines={1}>
          {j.nom}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={s.pelouse} onLayout={(e) => setLargeur(e.nativeEvent.layout.width - 4)}>
      <LinearGradient colors={["#1f7a3a", "#166330"]} style={StyleSheet.absoluteFill} />
      {Array.from({ length: Math.ceil(HAUTEUR / (BANDE * 2)) }, (_, i) => (
        <View key={i} style={[s.bande, { top: i * BANDE * 2 }]} />
      ))}
      <View style={s.mediane} />
      <View style={s.rond} />
      <View style={[s.surface, s.surfaceHaut]} />
      <View style={[s.surface, s.surfaceBas]} />

      {equipeA.length + equipeB.length === 0 ? (
        <View style={s.videCadre} pointerEvents="none">
          <Text style={s.videTexte}>{vide}</Text>
        </View>
      ) : null}

      {largeur > 0 && (
        <>
          {equipeA.map((j, i) => joueur(j, "A", posA[i]))}
          {equipeB.map((j, i) => joueur(j, "B", posB[i]))}
        </>
      )}
    </View>
  );
}

const TRAIT = "rgba(255,255,255,0.35)";

const s = StyleSheet.create({
  pelouse: {
    height: HAUTEUR,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: TRAIT,
    overflow: "hidden",
  },
  bande: {
    position: "absolute",
    left: 0,
    right: 0,
    height: BANDE,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  mediane: {
    position: "absolute",
    left: 0,
    right: 0,
    top: INTERIEUR / 2 - 1,
    height: 2,
    backgroundColor: TRAIT,
  },
  rond: {
    position: "absolute",
    left: "50%",
    top: INTERIEUR / 2 - 48,
    marginLeft: -48,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: TRAIT,
  },
  surface: {
    position: "absolute",
    left: "50%",
    marginLeft: -90,
    width: 180,
    height: 64,
    borderWidth: 2,
    borderColor: TRAIT,
  },
  surfaceHaut: { top: -2, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  surfaceBas: { bottom: -2, borderTopLeftRadius: 10, borderTopRightRadius: 10 },

  videCadre: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  videTexte: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  joueur: {
    position: "absolute",
    width: LARGEUR_JOUEUR,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    boxShadow: "0 6px 14px rgba(0,0,0,0.4)",
  },
  photo: {
    position: "absolute",
    left: 4,
    top: 4,
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  eclair: {
    position: "absolute",
    left: -5,
    top: -5,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#ffffff",
    boxShadow: "0 0 16px rgba(255,255,255,0.8)",
  },
  niveau: {
    position: "absolute",
    right: -4,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
  },
  niveauTexte: { fontSize: 12, fontWeight: "800", color: "#0b3b1a" },
  nom: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    maxWidth: LARGEUR_JOUEUR,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
