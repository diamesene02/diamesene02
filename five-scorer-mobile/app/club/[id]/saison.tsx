import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { chargerMoiMemorise, useClubId, useClubMemorise } from "../../../composants/ClubCourant";
import Ecran from "../../../composants/Ecran";
import EnTeteClub from "../../../composants/EnTeteClub";
import ErreurChargement from "../../../composants/ErreurChargement";
import SelecteurSaison from "../../../composants/SelecteurSaison";
import { BoutonVerre, CarteVerre, Ecusson, Onglets } from "../../../composants/base";
import { CarteSquelette, Squelette } from "../../../composants/Squelette";
import { IconeCalendrier } from "../../../composants/Icones";
import { jeton, JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import { ESPACE_BARRE } from "../../../composants/BarreOnglets";
import {
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
  const id = useClubId();
  const memo = useClubMemorise();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [d, setD] = useState<EcranSaison | null>(null);
  const [saison, setSaison] = useState<string | undefined>(undefined);
  const [vue, setVue] = useState<Vue>("calendrier");
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  // Les couleurs du dernier `/api/me` dès la première image.
  const c = club ?? memo;
  const t: Jetons = c?.theme.sombre ?? JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    try {
      const [moi, r] = await Promise.all([
        chargerMoiMemorise().catch(() => null),
        chargerSaison(id, saison),
      ]);
      if (moi) setClub(moi.clubs.find((x) => x.id === id) ?? null);
      setD(r);
      setErreur(null);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id, saison]);

  // Une réponse donnée ou un match saisi ailleurs change une rangée du
  // calendrier : on relit à chaque retour sur l'écran (et à l'arrivée).
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const couleurA = c?.couleurA ?? "#ffffff";
  const couleurB = c?.couleurB ?? "#111111";

  const ouvrir = (e: EntreeCalendrier) => {
    if (e.cible.quoi === "soiree")
      return router.push({ pathname: "/soiree/[id]", params: { id: e.cible.id, clubId: id } });
    if (e.cible.quoi === "match")
      return router.push({ pathname: "/recap/[id]", params: { id: e.cible.id, clubId: id } });
    // « Saisir » : la compo s'ouvre en mode « déjà joué », datée de ce lundi-là
    // et rattachée à la soirée — sinon le match ne compterait sur aucune.
    if (e.cible.quoi === "saisir") {
      return router.push({
        pathname: "/compo",
        params: {
          clubId: id,
          quand: "deja",
          soireeId: e.cible.id,
          ...(e.cible.date ? { date: e.cible.date } : null),
        },
      });
    }
    // Un genre de cible que cette version ne connaît pas : on ouvre la
    // soirée, jamais une feuille de création.
    //
    // « Saisir » était la branche PAR DÉFAUT jusqu'au 18 septembre 2026, et
    // c'était un piège : le jour où le serveur enverrait un genre nouveau,
    // tout téléphone pas encore mis à jour aurait ouvert une feuille vierge
    // et fabriqué un doublon. Le serveur de la spec 0007 prend soin de
    // n'envoyer que des genres connus ; cette version-ci n'a plus besoin de
    // lui faire confiance pour ça.
    return router.push({
      pathname: "/soiree/[id]",
      params: { id: e.cible.id, clubId: id },
    });
  };

  return (
    <Ecran t={t} chasubles={c ? { a: couleurA, b: couleurB } : undefined}>
      <ScrollView
        contentContainerStyle={s.defile}
        refreshControl={
          <RefreshControl
            refreshing={rafraichit}
            onRefresh={async () => {
              setRafraichit(true);
              await charger();
              setRafraichit(false);
            }}
            tintColor={t.i2}
          />
        }
      >
        <EnTeteClub
          t={t}
          club={c}
          titre="Saison"
          sousTitre={d?.sousTitre}
          droite={
            // Montrée dès qu'il existe UNE saison, comme sur le site : c'est
            // aussi elle qui dit quelle saison on regarde.
            d && d.saisons.choix.length > 0 ? (
              <SelecteurSaison
                t={t}
                choix={d.saisons.choix}
                valeur={d.saisons.choisie}
                occupe={occupe}
                onChange={(saisonId) => {
                  setOccupe(true);
                  setSaison(saisonId);
                }}
              />
            ) : undefined
          }
        />

        <View style={s.contenu}>
          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} style={{ marginTop: 18 }} />
          )}

          {/* Le squelette prend la forme de la carte de saison : les onglets,
              puis les rangées de dates. Un pavé gris de 360 disait seulement
              « quelque chose arrivera là ». */}
          {occupe && !d && (
            <Squelette etiquette="On ouvre la saison" style={s.squelette}>
              <CarteSquelette t={t} rangees={6} hauteurRangee={48} entete avatar={false} />
            </Squelette>
          )}

          {d && (
            <CarteVerre t={t} style={s.carte}>
              <Onglets
                t={t}
                actif={vue}
                onChange={setVue}
                onglets={[
                  { valeur: "calendrier", libelle: "Calendrier" },
                  { valeur: "adversaires", libelle: "Adversaires" },
                  { valeur: "bilan", libelle: "Bilan" },
                ]}
              />

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
                            { borderTopColor: jeton(t, "sep") },
                            e.annulee && { opacity: 0.55 },
                            pressed && { opacity: 0.6 },
                          ]}
                        >
                          <View style={s.date}>
                            <Text style={[s.dateJour, { color: t.i2 }]}>
                              {e.jour.toUpperCase()}
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
                          router.push({
                            pathname: "/soiree/nouvelle",
                            params: d.lieuParDefaut
                              ? { clubId: id, lieu: d.lieuParDefaut }
                              : { clubId: id },
                          })
                        }
                      />
                      {/* « Programmer un match » (poser un match contre un
                          autre club À UNE DATE FUTURE) n'est pas porté. Jouer
                          contre un adversaire se fait depuis la compo, segment
                          « Vs adversaire » ; ce qui manque ici, c'est le match
                          POSÉ d'avance : il demande son propre écran (date,
                          domicile ou extérieur) et une route qui accepte un
                          match sans joueurs, que /api/clubs/[clubId]/matches
                          refuse. Il reste sur le site. */}
                    </View>
                  )}
                  {d.droits.peutGerer && (
                    <View style={s.actionsSaison}>
                      <BoutonVerre
                        t={t}
                        titre="Poser toute la saison"
                        icone={<IconeCalendrier couleur={t.ink} taille={18} />}
                        style={{ alignSelf: "flex-start" }}
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
                          style={[s.tabRangee, { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }]}
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
                      style={[s.ligneBilan, { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }]}
                    >
                      <Text style={[s.ligneLibelle, { color: t.ink }]} numberOfLines={1}>
                        {l.libelle}
                      </Text>
                      <Text style={[s.ligneValeur, { color: t.ink }]}>{l.valeur}</Text>
                    </View>
                  ))}
                </View>
              )}
            </CarteVerre>
          )}
        </View>
      </ScrollView>
    </Ecran>
  );
}

const s = StyleSheet.create({
  defile: { paddingBottom: ESPACE_BARRE },
  contenu: { paddingHorizontal: 14 },
  vide: { padding: 20, fontSize: 15 },
  squelette: { marginTop: 18 },

  carte: { marginTop: 18, paddingBottom: 8 },

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
    borderTopWidth: 1,
  },
  date: { width: 64 },
  dateJour: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  dateNumero: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 28 },
  rangeeTitre: { fontSize: 17, fontWeight: "600" },
  rangeeSous: { fontSize: 15 },
  barre: { textDecorationLine: "line-through" },
  etiquette: { fontSize: 15, fontWeight: "600" },
  actions: { gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  actionsSaison: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },

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
});
