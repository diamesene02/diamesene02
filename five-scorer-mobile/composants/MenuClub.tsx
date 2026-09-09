import { useState } from "react";
import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EcussonChasuble, Poignee } from "./base";
import { CHEMINS, IconeTrait } from "./Icones";
import type { Jetons } from "../lib/couleurs";
import { PROD, type ClubDeMoi } from "../lib/api";
import { signOut } from "../lib/auth-client";

/// La pilule du club et son menu — le port de `components/ios/MenuClub.tsx`.
///
/// Sur le site, ce menu porte TOUTE la navigation. Ici il n'en porte que la
/// moitié : les quatre destinations quotidiennes (Accueil, Matchs, Soirées,
/// Stats) sont dans la barre du bas, qui est la convention du téléphone et
/// qu'on atteint au pouce. Le menu garde le reste — le profil, l'effectif, la
/// saison, les réglages, le partage, les autres clubs, la sortie.
///
/// Ce qui n'existe pas encore n'est pas affiché en grisé : une ligne qu'on
/// touche et qui ne fait rien coûte plus cher qu'une ligne absente.
export default function MenuClub({
  club,
  t,
  nomUtilisateur,
}: {
  club: ClubDeMoi;
  t: Jetons;
  nomUtilisateur: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const bas = useSafeAreaInsets().bottom;

  // « FC Lundi Soir » devient « Lundi Soir » dans la pilule, comme sur le site.
  const court = club.nom.replace(/^(FC|AS|US|SC|Five)\s+/i, "");
  const fermer = () => setOuvert(false);
  const aller = (fn: () => void) => () => {
    setOuvert(false);
    fn();
  };

  const partager = async () => {
    setOuvert(false);
    if (!club.urlPublique) return;
    try {
      // La vitrine est servie par le site en production, pas par le serveur de
      // développement : un lien « localhost » collé dans WhatsApp n'ouvre rien
      // chez personne.
      await Share.share({ message: PROD + club.urlPublique });
    } catch {
      /* partage annulé */
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOuvert(true)}
        accessibilityRole="button"
        accessibilityLabel={`Menu du club ${court}`}
        style={({ pressed }) => [
          s.pilule,
          { borderColor: t.cb, backgroundColor: t.cdSolid },
          pressed && { opacity: 0.7 },
        ]}
      >
        <EcussonChasuble couleur={club.couleurA} lettre={court[0] ?? "?"} taille={24} />
        <Text style={[s.piluleTexte, { color: t.ink }]} numberOfLines={1}>
          {court}
        </Text>
      </Pressable>

      <Modal visible={ouvert} transparent animationType="slide" onRequestClose={fermer}>
        <Pressable style={s.voile} onPress={fermer}>
          <Pressable
            style={[s.feuille, { paddingBottom: bas + 12, backgroundColor: t.bgSolid, borderTopColor: t.ink }]}
            onPress={() => {}}
          >
            <Poignee />

            <Pressable
              onPress={aller(() =>
                club.monJoueur
                  ? router.push({
                      pathname: "/joueur/[id]",
                      params: { id: club.monJoueur.id, clubId: club.id },
                    })
                  : router.push({ pathname: "/club/[id]/effectif", params: { id: club.id } }),
              )}
              style={[s.tete, { borderBottomColor: t.sep }]}
            >
              <EcussonChasuble
                couleur={club.couleurA}
                lettre={initiales(club.monJoueur?.nom ?? nomUtilisateur)}
                taille={48}
              />
              <Text style={[s.teteTexte, { color: t.i2 }]} numberOfLines={1}>
                Mon profil
              </Text>
            </Pressable>

            <Item
              t={t}
              chemin={CHEMINS.effectif}
              libelle="Effectif"
              onPress={aller(() =>
                router.push({ pathname: "/club/[id]/effectif", params: { id: club.id } }),
              )}
            />
            {club.urlPublique && (
              <Item t={t} chemin={CHEMINS.partager} libelle="Partager le club" onPress={partager} />
            )}
            <Item
              t={t}
              chemin={CHEMINS.clubs}
              libelle="Mes clubs"
              onPress={aller(() => router.push("/clubs"))}
            />
            <Item
              t={t}
              chemin={CHEMINS.sortir}
              libelle="Se déconnecter"
              danger
              onPress={aller(async () => {
                await signOut();
                router.replace("/connexion");
              })}
            />

            <Pressable onPress={fermer} style={s.fermer}>
              <Text style={[s.fermerTexte, { color: t.i2 }]}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Item({
  t,
  chemin,
  libelle,
  onPress,
  danger,
}: {
  t: Jetons;
  chemin: string;
  libelle: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const couleur = danger ? t.bad : t.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.item, pressed && { opacity: 0.6 }]}
    >
      <IconeTrait d={chemin} couleur={couleur} />
      <Text style={[s.itemTexte, { color: couleur }]}>{libelle}</Text>
    </Pressable>
  );
}

/// Les initiales, règle du site (`lib/ini.ts`) : deux lettres au plus.
function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m[0] ?? "")
    .join("")
    .toUpperCase();
}

const s = StyleSheet.create({
  pilule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    paddingLeft: 11,
    paddingRight: 18,
    maxWidth: "56%",
  },
  piluleTexte: { fontSize: 17, fontWeight: "600", flexShrink: 1 },

  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  feuille: { borderTopWidth: 3, paddingHorizontal: 16, paddingTop: 8 },
  tete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  teteTexte: { fontSize: 20, fontWeight: "600", flexShrink: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 54 },
  itemTexte: { fontSize: 17, fontWeight: "600" },
  fermer: { height: 52, alignItems: "center", justifyContent: "center" },
  fermerTexte: { fontSize: 17, fontWeight: "600" },
});
