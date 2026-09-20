import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, CarteVerre, EcussonChasuble, Onglets } from "../base";
import LigneExploit from "../succes/LigneExploit";
import Medaille from "../succes/Medaille";
import { dateRelative, nombre } from "../succes/textes";
import { grouperFil, nommer } from "./affichage";
import { jeton, type Jetons } from "../../lib/couleurs";
import { NOMS_MATIERES, type IconeSucces, type Matiere } from "../../lib/succes-icones";
import type { Rarete, SuccesClub } from "../../lib/succes";

type Vue = "exploits" | "niveaux" | "raretes";

export type Visage = { photo: string | null; camp: "A" | "B" | null; initiales?: string };

/// Une ligne de l'onglet « Raretés », prête à dessiner : le serveur rend la
/// rareté telle que le site la calcule (`SuccesClub.raretes`, un seul
/// `plusRares` pour les deux), l'écran ne fait que la mettre en phrase.
///
/// L'app calculait auparavant un repli à partir de `Badge.rarete` — la part
/// du club ayant le PREMIER palier — et, faute de mieux, à partir des badges
/// d'UN SEUL joueur : l'onglet du même nom ne donnait ni le même ordre, ni le
/// même métal, ni la même phrase que le site.
type Ligne = {
  cle: string;
  nom: string;
  icone: IconeSucces;
  matiere: Matiere;
  libelle: string;
  bas: string;
  /// Le seul détenteur : la ligne mène alors à sa fiche.
  seul: string | null;
};

function lignesRaretes(r: readonly Rarete[]): Ligne[] {
  return r.map((x) => ({
    cle: x.badgeId,
    nom: x.nom,
    icone: x.icone,
    matiere: x.matiere,
    libelle: x.libelle,
    bas: `${nommer(x.detenteurs.map((j) => j.nom))} · ${x.detenteurs.length} joueur${x.detenteurs.length > 1 ? "s" : ""} sur ${x.total}`,
    seul: x.detenteurs.length === 1 ? x.detenteurs[0].playerId : null,
  }));
}

/// La carte « Succès » des stats — celle du site (stats/SuccesClub.tsx) :
/// ce que le club a débloqué ces dernières semaines, les niveaux de chacun,
/// et ce que presque personne n'a.
///
/// Elle ne suit pas le sélecteur de saison : un niveau et un palier se
/// gagnent sur toute la carrière au club, ils ne repartent pas de zéro en
/// septembre. Les invités n'y sont pas (le serveur les écarte).
export default function SuccesDuClub({
  t,
  club,
  monId,
  visages,
  couleurA,
  chasubles,
  onFiche,
  onMatch,
  style,
}: {
  t: Jetons;
  /// `raretes` est facultatif : un serveur d'avant le 20 septembre 2026 ne
  /// le rend pas, et l'onglet disparaît alors plutôt que d'inventer.
  club: SuccesClub;
  monId: string | null;
  /// Photo et chasuble de chacun, prises au tableau : la route des succès
  /// n'envoie jamais de photo (20 ko pièce).
  visages: Map<string, Visage>;
  couleurA: string;
  chasubles?: { a: string; b: string };
  onFiche: (playerId: string) => void;
  onMatch: (matchId: string) => void;
  style?: object;
}) {
  const fil = grouperFil(club.fil);
  const rares = lignesRaretes(club.raretes ?? []);
  const onglets: { valeur: Vue; libelle: string }[] = [
    ...(fil.length > 0 ? [{ valeur: "exploits" as const, libelle: "Exploits" }] : []),
    { valeur: "niveaux", libelle: "Niveaux" },
    ...(rares.length > 0 ? [{ valeur: "raretes" as const, libelle: "Raretés" }] : []),
  ];
  const [choisie, setVue] = useState<Vue | null>(null);
  const vue = choisie && onglets.some((o) => o.valeur === choisie) ? choisie : onglets[0].valeur;

  if (club.niveaux.length === 0) return null;

  const anneau = (id: string) => {
    const camp = visages.get(id)?.camp;
    return camp === "A" ? t.taR : camp === "B" ? t.tbR : undefined;
  };

  return (
    <CarteVerre t={t} style={[s.carte, style]}>
      <Text style={[s.titre, { color: t.ink }]} accessibilityRole="header">
        Succès
      </Text>
      <Onglets t={t} onglets={onglets} actif={vue} onChange={setVue} />
      <View style={s.corps}>
        {vue === "exploits" &&
          fil.map(({ cle, d, joueurs }, i) => {
            const [premier] = joueurs;
            const aller = () => (d.matchId ? onMatch(d.matchId) : onFiche(premier.playerId));
            // Seul, le joueur mène la ligne : « Bakary · Buteur ». À
            // plusieurs, c'est le palier : dix noms devant « Toujours là »
            // le coupaient.
            if (joueurs.length === 1) {
              return (
                <LigneExploit
                  key={cle}
                  t={t}
                  exploit={d}
                  photo={visages.get(premier.playerId)?.photo}
                  anneau={anneau(premier.playerId)}
                  chasubles={chasubles}
                  premiere={i === 0}
                  onPress={aller}
                />
              );
            }
            const quand = dateRelative(d.le);
            const noms = nommer(joueurs.map((j) => j.nom));
            return (
              <Pressable
                key={cle}
                onPress={aller}
                accessibilityRole="button"
                accessibilityLabel={`${d.nom}, ${d.libelle}, ${NOMS_MATIERES[d.matiere]} : ${noms}, ${quand}`}
                style={({ pressed }) => [
                  s.exploit,
                  i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Avatar
                  nom={premier.nom}
                  photo={visages.get(premier.playerId)?.photo}
                  t={t}
                  anneau={anneau(premier.playerId)}
                  taille={36}
                />
                <View style={s.textes}>
                  <Text style={[s.l1, { color: jeton(t, "i2") }]} numberOfLines={1}>
                    <Text style={[s.fort, { color: t.ink }]}>{d.nom}</Text> · {d.libelle}
                  </Text>
                  <Text style={[s.l2, { color: jeton(t, "i3") }]} numberOfLines={1}>
                    {noms}
                    {quand ? ` · ${quand}` : ""}
                  </Text>
                </View>
                <Medaille icone={d.icone} matiere={d.matiere} t={t} chasubles={chasubles} taille={36} />
              </Pressable>
            );
          })}

        {vue === "niveaux" &&
          club.niveaux.map((n, i) => {
            const moi = n.playerId === monId;
            const apresMoi = i > 0 && club.niveaux[i - 1].playerId === monId;
            const v = visages.get(n.playerId);
            return (
              <Pressable
                key={n.playerId}
                onPress={() => onFiche(n.playerId)}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}e, ${n.nom}${moi ? ", toi" : ""}, niveau ${n.niveau}, ${n.titre}, ${n.xp} XP`}
                style={({ pressed }) => [
                  s.niveau,
                  i > 0 && !moi && !apresMoi && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
                  moi && [s.moi, { backgroundColor: jeton(t, "gl") }],
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[s.rang, { color: t.ink }]}>{i + 1}</Text>
                <Avatar
                  nom={n.nom}
                  photo={v?.photo}
                  t={t}
                  taille={30}
                  corps={11}
                  camp={v?.camp}
                  initiales={v?.initiales}
                />
                <View style={s.bloc}>
                  <Text style={[s.nom, { color: t.ink }]} numberOfLines={1}>
                    {n.nom}
                    {moi && <Text style={[s.toi, { color: jeton(t, "i2") }]}> · toi</Text>}
                  </Text>
                  <Text style={[s.sous, { color: jeton(t, "i2") }]} numberOfLines={1}>
                    {n.titre} · {nombre(n.xp)} XP
                  </Text>
                </View>
                <EcussonChasuble
                  couleur={couleurA}
                  lettre={String(n.niveau)}
                  taille={30}
                  anneau={2}
                  ombre={false}
                />
              </Pressable>
            );
          })}

        {vue === "raretes" &&
          rares.map((r, i) => {
            const cadre = [s.exploit, i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }];
            const etiquette = `${r.nom}, ${r.libelle}, ${NOMS_MATIERES[r.matiere]} : ${r.bas}`;
            const contenu = (
              <>
                <Medaille icone={r.icone} matiere={r.matiere} t={t} chasubles={chasubles} taille={40} />
                <View style={s.textes}>
                  <Text style={[s.l1, { color: jeton(t, "i2") }]} numberOfLines={1}>
                    <Text style={[s.fort, { color: t.ink }]}>{r.nom}</Text> · {r.libelle}
                  </Text>
                  <Text style={[s.l2, { color: jeton(t, "i3") }]} numberOfLines={1}>
                    {r.bas}
                  </Text>
                </View>
              </>
            );
            const seul = r.seul;
            return seul ? (
              <Pressable
                key={r.cle}
                onPress={() => onFiche(seul)}
                accessibilityRole="button"
                accessibilityLabel={etiquette}
                style={({ pressed }) => [...cadre, pressed && { opacity: 0.7 }]}
              >
                {contenu}
              </Pressable>
            ) : (
              <View key={r.cle} style={cadre} accessible accessibilityLabel={etiquette}>
                {contenu}
              </View>
            );
          })}
      </View>
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 16, paddingBottom: 10 },
  titre: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingTop: 22,
  },
  corps: { paddingTop: 6 },

  // Mêmes mesures que LigneExploit, qui dessine les lignes d'un seul joueur.
  exploit: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 10 },
  textes: { flex: 1, minWidth: 0, gap: 1 },
  l1: { fontSize: 15 },
  l2: { fontSize: 13 },
  fort: { fontWeight: "600" },

  // `.stats-niveau` : 24 / 30 / 1fr / auto.
  niveau: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: 6 },
  moi: { borderRadius: 14 },
  rang: { width: 24, fontSize: 17, fontVariant: ["tabular-nums"] },
  bloc: { flex: 1, minWidth: 0, gap: 1, paddingLeft: 8, paddingRight: 12 },
  nom: { fontSize: 17, fontWeight: "500" },
  toi: { fontWeight: "400" },
  sous: { fontSize: 13, fontVariant: ["tabular-nums"] },
});
