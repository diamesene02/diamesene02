import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ecran from "../../../composants/Ecran";
import { BoutonRond, BoutonVerre, Ecusson, Poignee } from "../../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import {
  chargerMoi,
  chargerSaison,
  SessionExpiree,
  type ClubDeMoi,
  type EcranSaison,
  type EntreeCalendrier,
} from "../../../lib/api";

/// « Saison » — le calendrier de l'année, les adversaires, le bilan.
///
/// C'est l'écran du club qui joue TOUS LES LUNDIS de septembre à juillet :
/// quarante rangées, groupées par mois, qui disent d'un coup d'œil ce qui a
/// été joué, ce qui reste à saisir et à quoi il faut répondre.
///
/// Atteint par le menu de la pilule, pas par un onglet : on l'ouvre une fois
/// par mois, pas trois fois par soir.
type Vue = "calendrier" | "adversaires" | "bilan";

export default function Saison() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [d, setD] = useState<EcranSaison | null>(null);
  const [saison, setSaison] = useState<string | undefined>(undefined);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [vue, setVue] = useState<Vue>("calendrier");
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const bas = useSafeAreaInsets().bottom;

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const [moi, r] = await Promise.all([chargerMoi(), chargerSaison(id, saison)]);
      setClub(moi.clubs.find((c) => c.id === id) ?? null);
      setD(r);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [id, saison]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Une réponse donnée ou un match saisi ailleurs change une rangée du
  // calendrier : on relit à chaque retour sur l'écran.
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";
  const courante =
    d?.saisons.choix.find((c) => c.id === d.saisons.choisie)?.libelle ?? "";

  const ouvrir = (e: EntreeCalendrier) => {
    if (e.cible.quoi === "soiree")
      return router.push({ pathname: "/soiree/[id]", params: { id: e.cible.id, clubId: id } });
    if (e.cible.quoi === "match")
      return router.push({ pathname: "/recap/[id]", params: { id: e.cible.id, clubId: id } });
    // « Saisir » : la compo s'ouvre en mode « déjà joué », datée de ce lundi-là
    // et rattachée à la soirée — sinon le match ne compterait sur aucune.
    return router.push({
      pathname: "/compo",
      params: {
        clubId: id,
        quand: "deja",
        soireeId: e.cible.id,
        ...(e.cible.date ? { date: e.cible.date } : null),
      },
    });
  };

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <ScrollView
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={occupe && d != null} onRefresh={charger} tintColor={t.i2} />
        }
      >
        <View style={s.retour}>
          <BoutonRond
            t={t}
            symbole="‹"
            etiquette="Retour"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace({ pathname: "/club/[id]", params: { id } })
            }
          />
        </View>

        <View style={s.tete}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.titre, { color: t.ink }]}>Saison</Text>
            {d && <Text style={[s.sousTitre, { color: t.i2 }]}>{d.sousTitre}</Text>}
          </View>
          {d && d.saisons.choix.length > 1 && (
            <Pressable
              onPress={() => setChoixOuvert(true)}
              accessibilityLabel="Choisir la saison"
              style={({ pressed }) => [
                s.pilule,
                { borderColor: t.cb, backgroundColor: t.cdSolid },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[s.piluleTexte, { color: t.ink }]} numberOfLines={1}>
                {courante}
              </Text>
              <Text style={[s.fleche, { color: t.i2 }]}>▾</Text>
            </Pressable>
          )}
        </View>

        {occupe && !d && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
            <Text style={[s.aide, { color: t.i2 }]}>On déroule l&apos;année…</Text>
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

        {d && (
          <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>
            <View style={s.onglets}>
              {(
                [
                  ["calendrier", "Calendrier"],
                  ["adversaires", "Adversaires"],
                  ["bilan", "Bilan"],
                ] as [Vue, string][]
              ).map(([v, libelle]) => (
                <Pressable
                  key={v}
                  onPress={() => setVue(v)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: v === vue }}
                  style={s.onglet}
                >
                  <Text
                    style={[s.ongletTexte, { color: v === vue ? t.ink : t.i3 }]}
                    numberOfLines={1}
                  >
                    {libelle}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[s.filet, { borderTopColor: t.sep }]} />

            {vue === "calendrier" && (
              <View>
                {d.calendrier.vide && (
                  <Text style={[s.vide, { color: t.i2 }]}>{d.calendrier.vide}</Text>
                )}
                {d.calendrier.groupes.map((g) => (
                  <View key={g.cle}>
                    <Text style={[s.mois, { color: t.i2 }]}>{g.titre.toUpperCase()}</Text>
                    {g.entrees.map((e) => (
                      <Pressable
                        key={e.cle}
                        onPress={() => ouvrir(e)}
                        style={({ pressed }) => [
                          s.rangee,
                          { borderTopColor: t.sep },
                          e.annulee && { opacity: 0.55 },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <View style={s.date}>
                          <Text style={[s.dateJour, { color: t.i2 }]}>
                            {e.jour.replace(".", "").toUpperCase()}
                          </Text>
                          <Text style={[s.dateNumero, { color: t.ink }]}>{e.numero}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[
                              s.rangeeTitre,
                              { color: t.ink },
                              e.annulee && s.barre,
                            ]}
                            numberOfLines={1}
                          >
                            {e.titre}
                          </Text>
                          <Text style={[s.rangeeSous, { color: t.i2 }]} numberOfLines={1}>
                            {e.sous}
                          </Text>
                        </View>
                        <Text
                          style={[
                            s.etiquette,
                            {
                              color:
                                e.ton === "direct"
                                  ? t.bad
                                  : e.ton === "appel"
                                    ? t.ink
                                    : e.ton === "muet"
                                      ? t.i3
                                      : t.i2,
                            },
                          ]}
                        >
                          {e.etiquette}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}

                {d.droits.peutScorer && (
                  <View style={s.actions}>
                    <BoutonVerre
                      t={t}
                      titre="Ajouter une soirée"
                      onPress={() =>
                        router.push({ pathname: "/soiree/nouvelle", params: { clubId: id } })
                      }
                    />
                    {/* « Programmer un match » du site n'est pas porté : il
                        demande de choisir un adversaire, donc tout le carnet
                        d'adversaires, et ce club-ci joue contre lui-même tous
                        les lundis. Il reste sur le site, où il est rare. */}
                  </View>
                )}
                {d.droits.peutGerer && (
                  <View style={s.actions}>
                    <BoutonVerre
                      t={t}
                      titre="Poser toute la saison"
                      onPress={() =>
                        router.push({
                          pathname: "/calendrier",
                          params: {
                            clubId: id,
                            ...(d.lieuParDefaut ? { lieu: d.lieuParDefaut } : null),
                          },
                        })
                      }
                    />
                  </View>
                )}
              </View>
            )}

            {vue === "adversaires" && (
              <View>
                {d.adversaires.vide ? (
                  <Text style={[s.vide, { color: t.i2 }]}>{d.adversaires.vide}</Text>
                ) : (
                  <>
                    <View style={[s.tabRangee, s.tabTete]}>
                      <View style={{ width: 24 }} />
                      <View style={{ width: 36 }} />
                      <Text style={[s.tabNom, s.tabTeteTexte, { color: t.i2 }]}>Équipe</Text>
                      <Text style={[s.tabMj, s.tabTeteTexte, { color: t.i2 }]}>MJ</Text>
                      <Text style={[s.tabPetit, s.tabTeteTexte, { color: t.i2 }]}>V</Text>
                      <Text style={[s.tabPetit, s.tabTeteTexte, { color: t.i2 }]}>N</Text>
                      <Text style={[s.tabPetit, s.tabTeteTexte, { color: t.i2 }]}>D</Text>
                      <Text style={[s.tabDb, s.tabTeteTexte, { color: t.i2 }]}>DB</Text>
                      <Text style={[s.tabPts, s.tabTeteTexte, { color: t.i2 }]}>PTS</Text>
                    </View>
                    {d.adversaires.lignes.map((o) => (
                      <View
                        key={o.nom}
                        style={[s.tabRangee, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep }]}
                      >
                        <Text style={[s.tabRang, { color: t.ink }, o.club && s.gras]}>
                          {o.rang}
                        </Text>
                        <Ecusson
                          couleur={o.club ? couleurA : t.seg}
                          lettre={o.initiales}
                          taille={32}
                        />
                        <Text
                          style={[s.tabNom, { color: t.ink }, o.club && s.gras]}
                          numberOfLines={1}
                        >
                          {o.nom}
                        </Text>
                        <Text style={[s.tabMj, { color: t.ink }, o.club && s.gras]}>{o.mj}</Text>
                        <Text style={[s.tabPetit, { color: t.ink }, o.club && s.gras]}>{o.v}</Text>
                        <Text style={[s.tabPetit, { color: t.ink }, o.club && s.gras]}>{o.n}</Text>
                        <Text style={[s.tabPetit, { color: t.ink }, o.club && s.gras]}>{o.d}</Text>
                        <Text style={[s.tabDb, { color: t.ink }, o.club && s.gras]}>{o.db}</Text>
                        <Text style={[s.tabPts, { color: t.ink }]}>{o.pts}</Text>
                      </View>
                    ))}
                    <Text style={[s.note, { color: t.i3 }]}>{d.adversaires.note}</Text>
                  </>
                )}
              </View>
            )}

            {vue === "bilan" && (
              <View>
                <View style={s.chiffres}>
                  {d.bilan.chiffres.map((c) => (
                    <View key={c.l} style={{ flex: 1, alignItems: "center" }}>
                      <Text style={[s.chiffreN, { color: t.ink }]}>{c.n}</Text>
                      <Text style={[s.chiffreL, { color: t.i2 }]}>{c.l}</Text>
                    </View>
                  ))}
                </View>
                {d.bilan.lignes.map((l) => (
                  <View
                    key={l.libelle}
                    style={[s.ligneBilan, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep }]}
                  >
                    <Text style={[s.ligneLibelle, { color: t.ink }]} numberOfLines={1}>
                      {l.libelle}
                    </Text>
                    <Text style={[s.ligneValeur, { color: t.ink }]}>{l.valeur}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={choixOuvert}
        transparent
        animationType="slide"
        onRequestClose={() => setChoixOuvert(false)}
      >
        <Pressable style={s.voile} onPress={() => setChoixOuvert(false)}>
          <Pressable
            style={[s.feuille, { paddingBottom: bas + 12, backgroundColor: t.bgSolid, borderTopColor: t.ink }]}
            onPress={() => {}}
          >
            <Poignee />
            {d?.saisons.choix.map((c) => {
              const actif = c.id === d.saisons.choisie;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setChoixOuvert(false);
                    setOccupe(true);
                    setSaison(c.id);
                  }}
                  style={({ pressed }) => [
                    s.choix,
                    actif && { backgroundColor: t.seg },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[s.choixTexte, { color: t.ink }]} numberOfLines={1}>
                    {c.libelle}
                  </Text>
                  {actif && <Text style={[s.coche, { color: t.i2 }]}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </Ecran>
  );
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 },
  retour: { flexDirection: "row", paddingBottom: 8 },
  tete: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 },
  sousTitre: { fontSize: 17, marginTop: 4 },
  pilule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    maxWidth: 200,
  },
  piluleTexte: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  fleche: { fontSize: 13 },

  centre: { paddingTop: 60, alignItems: "center", gap: 12 },
  aide: { fontSize: 15 },
  erreur: { fontSize: 15, textAlign: "center", paddingTop: 24 },
  vide: { padding: 20, fontSize: 15 },

  carte: { borderRadius: 28, borderWidth: 1, marginTop: 18, paddingBottom: 8 },
  onglets: { flexDirection: "row", height: 62, alignItems: "center" },
  onglet: { flex: 1, height: 62, justifyContent: "center", paddingHorizontal: 4 },
  ongletTexte: { fontSize: 20, fontWeight: "600", letterSpacing: -0.3, textAlign: "center" },
  filet: { marginHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth },

  mois: {
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: 20,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  date: { width: 64 },
  dateJour: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  dateNumero: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 30 },
  rangeeTitre: { fontSize: 17, fontWeight: "600" },
  rangeeSous: { fontSize: 15 },
  barre: { textDecorationLine: "line-through" },
  etiquette: { fontSize: 15, fontWeight: "600" },
  actions: { gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },

  // Les neuf colonnes du site : 24/36/1fr/30/26/26/26/36/40.
  tabRangee: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 14,
  },
  tabTete: { height: undefined, paddingTop: 12, paddingBottom: 8 },
  tabTeteTexte: { fontSize: 15, fontWeight: "400" },
  tabRang: { width: 24, fontSize: 17 },
  tabNom: { flex: 1, minWidth: 0, fontSize: 17, paddingLeft: 8 },
  tabMj: { width: 30, fontSize: 17, textAlign: "center" },
  tabPetit: { width: 26, fontSize: 17, textAlign: "center" },
  tabDb: { width: 36, fontSize: 17, textAlign: "center" },
  tabPts: { width: 40, fontSize: 17, fontWeight: "700", textAlign: "center" },
  gras: { fontWeight: "700" },
  note: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, fontSize: 13 },

  chiffres: { flexDirection: "row", paddingTop: 18, paddingBottom: 6, paddingHorizontal: 8 },
  chiffreN: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5 },
  chiffreL: { fontSize: 13 },
  ligneBilan: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    marginHorizontal: 20,
  },
  ligneLibelle: { fontSize: 17, flexShrink: 1 },
  ligneValeur: { fontSize: 17, fontWeight: "600" },

  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  feuille: { borderTopWidth: 3, paddingHorizontal: 16, paddingTop: 8 },
  choix: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  choixTexte: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  coche: { fontSize: 17 },
});
