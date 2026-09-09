import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useGlobalSearchParams, useLocalSearchParams } from "expo-router";
import Ecran from "../../composants/Ecran";
import { Avatar, BoutonRond, EcussonChasuble, Poignee, Segment } from "../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { themeTokens } from "../../lib/noyau/theme";
import { chargerFicheMatch, SessionExpiree, type FicheMatch } from "../../lib/api";

/// Le récap d'un match — la feuille refermée.
///
/// Le score en grand, les buteurs sous chaque chasuble, puis trois vues qu'on
/// bascule : les statistiques, la chronologie, la feuille. C'est la même
/// matière que la feuille en direct, mais lue à froid.
///
/// Écran distinct de `/match/[id]`, comme sur le site : la feuille en direct
/// lit la base LOCALE du téléphone (elle doit marcher sans réseau au bord du
/// terrain), le récap lit le serveur — un match d'il y a trois semaines n'est
/// pas sur l'appareil.
type Vue = "stats" | "chrono" | "feuille";

export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clubId } = useGlobalSearchParams<{ clubId?: string }>();
  const [fiche, setFiche] = useState<FicheMatch | null>(null);
  const [vue, setVue] = useState<Vue>("stats");
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const { chargerMoi } = await import("../../lib/api");
      const cid = clubId ?? (await chargerMoi()).clubs[0]?.id;
      if (!cid) throw new Error("Aucun club.");
      setFiche(await chargerFicheMatch(cid, id));
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [id, clubId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const couleurA = fiche?.chasubles.a ?? "#ffffff";
  const couleurB = fiche?.chasubles.b ?? "#111111";
  const t: Jetons = fiche ? themeTokens(couleurA, couleurB, "dark") : JETONS_NEUTRES;
  const a = fiche?.camps[0];
  const b = fiche?.camps[1];

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <Poignee />
      <View style={s.barre}>
        <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={() => router.back()} />
        <Text style={[s.legende, { color: t.i2 }]} numberOfLines={1}>
          {fiche?.contexte ?? fiche?.dateLongue ?? ""}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={occupe && fiche != null} onRefresh={charger} tintColor={t.i2} />
        }
      >
        {occupe && !fiche && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>Un instant…</Text>
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: "#ff453a" }]}>{erreur}</Text>}

        {fiche && a && b && (
          <>
            <View style={s.marque}>
              <Text
                style={[s.chiffre, { color: t.ink }, fiche.scoreB > fiche.scoreA && s.perd]}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {fiche.scoreA}
              </Text>
              <Text style={[s.tiret, { color: t.i3 }]}>–</Text>
              <Text
                style={[s.chiffre, { color: t.ink }, fiche.scoreA > fiche.scoreB && s.perd]}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {fiche.scoreB}
              </Text>
            </View>
            <Text style={[s.date, { color: t.i3 }]}>
              {fiche.dateCourte} · {fiche.heure}
              {fiche.dureeMin ? ` · ${fiche.dureeMin} min` : ""}
            </Text>

            <View style={s.equipes}>
              {[a, b].map((c, i) => (
                <View key={c.camp} style={s.equipe}>
                  <EcussonChasuble
                    couleur={i === 0 ? couleurA : couleurB}
                    lettre={c.lettre}
                    taille={66}
                  />
                  <Text style={[s.nomEquipe, { color: t.ink }]} numberOfLines={1}>
                    {c.nom}
                  </Text>
                  {c.bilan && <Text style={[s.bilan, { color: t.i3 }]}>{c.bilan}</Text>}
                  {c.buteurs.map((bt) => (
                    <Text key={bt.nom} style={[s.buteur, { color: t.i2 }]} numberOfLines={1}>
                      {bt.nom}
                      {bt.minutes.some((x) => x != null)
                        ? " " + bt.minutes.filter((x) => x != null).map((x) => `${x}′`).join(", ")
                        : bt.minutes.length > 1
                          ? ` ×${bt.minutes.length}`
                          : ""}
                    </Text>
                  ))}
                </View>
              ))}
            </View>

            <Segment
              t={t}
              valeur={vue}
              onChange={setVue}
              choix={[
                { valeur: "stats", libelle: "Statistiques" },
                { valeur: "chrono", libelle: "Chronologie" },
                { valeur: "feuille", libelle: "Feuille" },
              ]}
            />

            {vue === "stats" && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                {fiche.statistiques.map((st) => {
                  const total = st.a + st.b || 1;
                  return (
                    <View key={st.libelle} style={s.stat}>
                      <View style={s.statTete}>
                        <Text style={[s.statChiffre, { color: t.ink }]}>{st.a}</Text>
                        <Text style={[s.statNom, { color: t.i2 }]}>{st.libelle}</Text>
                        <Text style={[s.statChiffre, { color: t.ink }]}>{st.b}</Text>
                      </View>
                      <View style={[s.barre2, { backgroundColor: t.seg }]}>
                        <View
                          style={{
                            width: `${(st.a / total) * 100}%`,
                            backgroundColor: st.accent === "or" ? "#ffd60a" : couleurA,
                            height: 6,
                          }}
                        />
                        <View
                          style={{
                            width: `${(st.b / total) * 100}%`,
                            backgroundColor: st.accent === "or" ? "#ff453a" : couleurB,
                            height: 6,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {vue === "chrono" && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                {fiche.chronologie.length === 0 ? (
                  <Text style={[s.aide, { color: t.i2, textAlign: "center" }]}>
                    Aucun but dans ce match.
                  </Text>
                ) : (
                  fiche.chronologie.map((e, i) => (
                    <View
                      key={e.id}
                      style={[
                        s.evenement,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
                      ]}
                    >
                      <Text style={[s.minute, { color: t.i3 }]}>
                        {e.minute != null ? `${e.minute}′` : "—"}
                      </Text>
                      <View
                        style={[
                          s.pastilleCamp,
                          { backgroundColor: e.camp === "A" ? couleurA : couleurB },
                        ]}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.nomBut, { color: t.ink }]} numberOfLines={1}>
                          {e.nom}
                        </Text>
                        {e.passeur && (
                          <Text style={[s.passeur, { color: t.i3 }]} numberOfLines={1}>
                            passe de {e.passeur}
                          </Text>
                        )}
                      </View>
                      <Text style={[s.scoreCourant, { color: t.i2 }]}>
                        {e.scoreA}–{e.scoreB}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {vue === "feuille" && (
              <View style={s.feuilles}>
                {fiche.effectifs.map((ef, i) => (
                  <View
                    key={ef.camp}
                    style={[s.carte, { flex: 1, borderColor: t.cb, backgroundColor: t.cdSolid }]}
                  >
                    <Text style={[s.nomFeuille, { color: t.i2 }]} numberOfLines={1}>
                      {fiche.camps[i]?.nom}
                    </Text>
                    {ef.joueurs.map((j) => (
                      <View key={j.playerId} style={s.joueur}>
                        <Avatar
                          nom={j.nom}
                          photo={j.photo}
                          t={t}
                          anneau={i === 0 ? (t.taR ?? couleurA) : (t.tbR ?? couleurB)}
                          taille={28}
                        />
                        <Text style={[s.nomJoueur, { color: t.ink }]} numberOfLines={1}>
                          {j.nom}
                          {j.gardien ? " · G" : ""}
                        </Text>
                        {j.buts > 0 && (
                          <Text style={[s.butsJoueur, { color: t.ink }]}>{j.buts}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {fiche.homme && (
              <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
                <Text style={[s.carteTitre, { color: t.ink }]}>Homme du match</Text>
                <View style={s.homme}>
                  <Avatar
                    nom={fiche.homme.nom}
                    photo={fiche.homme.photo}
                    t={t}
                    anneau="#ffd60a"
                    taille={52}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.nomHomme, { color: t.ink }]}>{fiche.homme.nom}</Text>
                    <Text style={[s.aide, { color: t.i2 }]}>
                      {fiche.homme.buts > 0
                        ? `${fiche.homme.buts} but${fiche.homme.buts > 1 ? "s" : ""}`
                        : "Élu par le club"}
                      {fiche.homme.votes
                        ? ` · ${fiche.homme.votes.pour}/${fiche.homme.votes.total} voix`
                        : ""}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {fiche.soireeId && (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/soiree/[id]", params: { id: fiche.soireeId!, clubId } })
                }
                style={[s.lien, { borderColor: t.cb }]}
              >
                <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>
                  Voir la soirée ›
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </Ecran>
  );
}

const s = StyleSheet.create({
  barre: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  legende: { flex: 1, fontSize: 15, fontWeight: "600", textAlign: "center" },
  contenu: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 40, gap: 16 },
  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  aide: { fontSize: 14 },
  erreur: { fontSize: 15, textAlign: "center" },

  marque: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  chiffre: { fontSize: 92, fontWeight: "800", letterSpacing: -4, lineHeight: 100 },
  perd: { color: "rgba(255,255,255,0.4)" },
  tiret: { fontSize: 40, fontWeight: "300" },
  date: { fontSize: 13, textAlign: "center", marginTop: -6 },

  equipes: { flexDirection: "row", gap: 12 },
  equipe: { flex: 1, alignItems: "center", gap: 6 },
  nomEquipe: { fontSize: 20, fontWeight: "600", letterSpacing: -0.3 },
  bilan: { fontSize: 12 },
  buteur: { fontSize: 14, textAlign: "center" },

  carte: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  carteTitre: { fontSize: 17, fontWeight: "600", paddingBottom: 10 },

  stat: { paddingVertical: 8, gap: 6 },
  statTete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statChiffre: { fontSize: 17, fontWeight: "700", minWidth: 24, textAlign: "center" },
  statNom: { fontSize: 14 },
  barre2: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden" },

  evenement: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  minute: { width: 34, fontSize: 13 },
  pastilleCamp: { width: 10, height: 10, borderRadius: 5 },
  nomBut: { fontSize: 16, fontWeight: "500" },
  passeur: { fontSize: 12 },
  scoreCourant: { fontSize: 14, fontWeight: "600" },

  feuilles: { flexDirection: "row", gap: 10 },
  nomFeuille: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingBottom: 6 },
  joueur: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  nomJoueur: { flex: 1, fontSize: 15 },
  butsJoueur: { fontSize: 17, fontWeight: "700" },

  homme: { flexDirection: "row", alignItems: "center", gap: 12 },
  nomHomme: { fontSize: 20, fontWeight: "600" },

  lien: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
