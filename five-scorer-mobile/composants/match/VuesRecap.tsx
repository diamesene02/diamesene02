import { StyleSheet, Text, View } from "react-native";
import { Avatar, Carte, CarteVerre, EcussonChasuble } from "../base";
import { IconeJeu } from "../Icones";
import type { Jetons } from "../../lib/couleurs";
import type { FicheMatch } from "../../lib/api";

// Les trois vues du récap (Statistiques, Chronologie, Feuille) et la carte de
// l'homme du match, reprises de RecapView.tsx : mêmes titres de carte, mêmes
// rangées, mêmes filets. Le fond est toujours le fond de match sombre — les
// encres secondaires sont donc écrites en blanc à opacité, comme sur le site.

const OR = "#ffd60a";
const FILET = "rgba(255,255,255,0.12)";

/// Les barres de duel : deux pistes séparées qui partent du centre, celle de
/// A vers la gauche, celle de B vers la droite. Une piste unique où A et B se
/// suivaient donnait, à 1-0, une barre entièrement à la couleur de A.
export function CarteStats({
  t,
  statistiques,
  couleurs,
}: {
  t: Jetons;
  statistiques: FicheMatch["statistiques"];
  couleurs: [string, string];
}) {
  return (
    <Carte t={t} titre="Statistiques" style={s.carte}>
      {statistiques.map((st) => {
        const total = st.a + st.b;
        const part = (n: number): `${number}%` =>
          total ? `${Math.round((n / total) * 100)}%` : "0%";
        return (
          <View
            key={st.libelle}
            style={s.duel}
            accessible
            accessibilityLabel={`${st.libelle} : ${st.a} à ${st.b}`}
          >
            <View style={s.chiffres}>
              <Text style={[s.chiffreDuel, { textAlign: "left" }]}>{st.a}</Text>
              <Text style={s.libelleDuel} numberOfLines={1}>
                {st.libelle}
              </Text>
              <Text style={[s.chiffreDuel, { textAlign: "right" }]}>{st.b}</Text>
            </View>
            <View style={s.barres}>
              <View style={[s.piste, { flexDirection: "row-reverse" }]}>
                <View style={[s.plein, { width: part(st.a), backgroundColor: couleurs[0] }]} />
              </View>
              <View style={s.piste}>
                {/* Les cartons : la barre de B en or, comme le site. */}
                <View
                  style={[
                    s.plein,
                    { width: part(st.b), backgroundColor: st.accent === "or" ? OR : couleurs[1] },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </Carte>
  );
}

/// Chaque but avec le score qu'il a fait, le plus récent en haut (l'ordre du
/// serveur). Le passeur et « ajouté après coup » sur la même ligne, après un
/// tiret : une rangée par but, pas deux.
export function CarteChrono({
  t,
  chronologie,
  couleurs,
}: {
  t: Jetons;
  chronologie: FicheMatch["chronologie"];
  couleurs: [string, string];
}) {
  return (
    <Carte t={t} titre="Chronologie" style={s.carte}>
      {chronologie.length === 0 ? (
        <Text style={s.vide}>Aucun but.</Text>
      ) : (
        chronologie.map((e) => (
          <View key={e.id} style={s.but}>
            <Text style={s.minute}>{e.minute != null ? `${e.minute}′` : "—"}</Text>
            <View style={s.qui}>
              <View
                style={[s.pastille, { backgroundColor: e.camp === "A" ? couleurs[0] : couleurs[1] }]}
              />
              <Text style={s.nomBut} numberOfLines={1}>
                {e.nom}
                {e.passeur ? <Text style={s.note}> — passe de {e.passeur}</Text> : null}
                {e.apresCoup ? <Text style={s.note}> — ajouté après coup</Text> : null}
              </Text>
            </View>
            <Text style={s.courant}>
              {e.scoreA}–{e.scoreB}
            </Text>
          </View>
        ))
      )}
    </Carte>
  );
}

/// Les deux effectifs côte à côte, sous un seul titre. Chaque tête de
/// colonne porte l'écusson de sa chasuble : on sait de quel côté on lit sans
/// relever les yeux.
export function CarteFeuille({
  t,
  fiche,
  couleurs,
}: {
  t: Jetons;
  fiche: Pick<FicheMatch, "effectifs" | "camps">;
  couleurs: [string, string];
}) {
  return (
    <Carte t={t} titre="Feuille de match" style={s.carteFeuille}>
      <View style={s.effectifs}>
        {fiche.effectifs.map((ef, i) => {
          const camp = fiche.camps[i];
          return (
            <View key={ef.camp} style={s.effectif}>
              <View style={s.tete}>
                <EcussonChasuble
                  couleur={couleurs[i]}
                  lettre={camp?.lettre ?? "?"}
                  taille={22}
                  anneau={2}
                  ombre={false}
                />
                <Text style={s.nomColonne} numberOfLines={1}>
                  {camp?.nom}
                </Text>
              </View>
              {ef.joueurs.length === 0 && <Text style={s.vide}>—</Text>}
              {ef.joueurs.map((j) => (
                <View key={j.playerId} style={s.joueur}>
                  <Avatar
                    nom={j.nom}
                    photo={j.photo}
                    initiales={j.initiales}
                    t={t}
                    camp={ef.camp}
                    taille={30}
                  />
                  <Text style={s.nomJoueur} numberOfLines={1}>
                    {j.nom}
                  </Text>
                  {j.buts > 0 && <Text style={s.butsJoueur}>{j.buts}</Text>}
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </Carte>
  );
}

/// L'homme du match : l'avatar cerclé à la couleur de SON équipe, ce qu'il a
/// fait, le nombre de voix, et l'étoile. Toute la carte mène à sa fiche.
export function CarteHommeDuMatch({
  t,
  homme,
  onPress,
}: {
  t: Jetons;
  homme: NonNullable<FicheMatch["homme"]>;
  onPress?: () => void;
}) {
  const detail = [
    homme.buts > 0 ? `${homme.buts} but${homme.buts > 1 ? "s" : ""}` : null,
    homme.votes && homme.votes.total > 0
      ? `${homme.votes.pour} vote${homme.votes.pour > 1 ? "s" : ""} sur ${homme.votes.total}`
      : null,
    // Q6 (spec 0001) : la désignation à la main ferme le vote, et le dit.
    homme.designeParCapitaine ? "désigné par le capitaine" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <CarteVerre
      t={t}
      onPress={onPress}
      etiquette={`Homme du match : ${homme.nom}${detail ? `, ${detail}` : ""}. Ouvrir sa fiche`}
      style={s.homme}
    >
      <Avatar nom={homme.nom} photo={homme.photo} t={t} camp={homme.camp} taille={60} />
      <View style={s.corpsHomme}>
        <Text style={s.legendeHomme}>Homme du match</Text>
        <Text style={s.nomHomme} numberOfLines={1}>
          {homme.nom}
        </Text>
        {detail ? <Text style={s.detailHomme}>{detail}</Text> : null}
      </View>
      <IconeJeu nom="etoile" couleur={OR} taille={28} plein epaisseur={1.5} />
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  // `.recap-carte-corps` : 20 de côté, 8 en bas ; le titre garde ses 20 en
  // haut (16 de la carte + 4 du titre).
  carte: { paddingHorizontal: 20, paddingBottom: 8 },
  carteFeuille: { paddingHorizontal: 20, paddingBottom: 14 },

  duel: { paddingVertical: 10, gap: 8 },
  chiffres: { flexDirection: "row", alignItems: "center" },
  chiffreDuel: {
    width: 56,
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
  },
  libelleDuel: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "500",
    color: "rgba(255,255,255,0.62)",
  },
  barres: { flexDirection: "row", gap: 6 },
  piste: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    flexDirection: "row",
  },
  plein: { height: 6, borderRadius: 3 },

  vide: { paddingTop: 14, paddingBottom: 12, fontSize: 15, color: "rgba(255,255,255,0.55)" },
  but: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: FILET,
  },
  minute: { width: 44, fontSize: 17, color: "rgba(255,255,255,0.55)", fontVariant: ["tabular-nums"] },
  qui: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  nomBut: { flex: 1, fontSize: 17, color: "#ffffff" },
  note: { color: "rgba(255,255,255,0.5)" },
  courant: { fontSize: 17, fontWeight: "600", color: "#ffffff", fontVariant: ["tabular-nums"] },

  effectifs: { flexDirection: "row", gap: 16 },
  effectif: { flex: 1, minWidth: 0 },
  tete: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
  nomColonne: { flex: 1, fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.62)" },
  joueur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: FILET,
  },
  nomJoueur: { flex: 1, fontSize: 17, color: "#ffffff" },
  butsJoueur: { fontSize: 17, fontWeight: "700", color: "#ffffff" },

  homme: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  corpsHomme: { flex: 1, minWidth: 0 },
  legendeHomme: { fontSize: 15, color: "rgba(255,255,255,0.55)" },
  nomHomme: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, color: "#ffffff" },
  detailHomme: { fontSize: 15, color: "rgba(255,255,255,0.62)" },
});
