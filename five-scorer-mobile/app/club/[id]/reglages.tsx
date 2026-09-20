import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { chargerMoiMemorise, useClubId, useClubMemorise } from "../../../composants/ClubCourant";
import Ecran from "../../../composants/Ecran";
import EnTeteClub from "../../../composants/EnTeteClub";
import ErreurChargement from "../../../composants/ErreurChargement";
import Feuille from "../../../composants/Feuille";
import LigneScore from "../../../composants/LigneScore";
import { useDeconnexion } from "../../../composants/MenuClub";
import { IconeJeu } from "../../../composants/Icones";
import {
  Avatar,
  BoutonPlein,
  BoutonVerre,
  CarteVerre,
  EcussonChasuble,
  Interrupteur,
  Saisie,
} from "../../../composants/base";
import { jeton, JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import { themeTokens } from "../../../lib/noyau/theme";
import { lettre } from "../../../lib/ini";
import { messageErreur } from "../../../lib/erreurs";
import { avertissement, choix as retourChoix, succes as retourSucces } from "../../../lib/haptique";
import {
  basculerSaison,
  changerRole,
  chargerReglages,
  creerSaison,
  ecrireReglage,
  PROD,
  regenererInvitation,
  retirerMembre,
  SessionExpiree,
  type EcranReglages,
  type ReglageAEcrire,
} from "../../../lib/api";

/// « Réglages » — les listes groupées du site, portées telles quelles.
///
/// Le principe central est repris sans changement : IL N'Y A PAS DE BOUTON
/// « ENREGISTRER ». Un interrupteur, un choix ou un champ qu'on quitte part au
/// serveur tout seul. C'est le geste iOS, et c'est ce qui évite de perdre un
/// réglage changé puis oublié. L'état de l'envoi se lit sous la vitrine,
/// comme sur le site.
///
/// Les gestes qui ne se rattrapent pas — régénérer le lien d'invitation,
/// retirer un membre, ouvrir ou clôturer une saison — demandent tous une
/// confirmation qui DIT ce qui va se passer. Le site en oublie la moitié ; sur
/// un téléphone, où le doigt glisse, ce n'est pas tenable.
///
/// Une rangée du site manque, voulue : « Apparence » (sombre / clair). Tous
/// les écrans de l'app sont encore peints en sombre ; un réglage qui ne
/// changerait que celui-ci mentirait.
export default function Reglages() {
  const id = useClubId();
  const memo = useClubMemorise();
  const [d, setD] = useState<EcranReglages | null>(null);
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const [etat, setEtat] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [ouvert, setOuvert] = useState<Record<string, boolean>>({});
  const [nouvelleSaison, setNouvelleSaison] = useState("");
  const [feuille, setFeuille] = useState<null | "format" | "motm">(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deconnecter = useDeconnexion();

  const t: Jetons = d
    ? themeTokens(d.club.couleurA, d.club.couleurB, "dark")
    : (memo?.theme.sombre ?? JETONS_NEUTRES);

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      setD(await chargerReglages(id));
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );

  const rafraichir = useCallback(async () => {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }, [charger]);

  const basculer = (cle: string) => setOuvert((o) => ({ ...o, [cle]: !o[cle] }));

  /// Enregistrer un champ, et le dire. L'écran se relit ensuite, et le
  /// « moi » gardé en mémoire aussi : les couleurs changent le thème de toute
  /// l'app, et le nom la pilule du club.
  async function sauver(diff: ReglageAEcrire) {
    if (!id) return;
    setEtat({ texte: "Enregistrement…" });
    try {
      const r = await ecrireReglage(id, diff);
      if (!r.ok) {
        avertissement();
        setEtat({ texte: r.error ?? "Le serveur a refusé ce réglage.", erreur: true });
        return;
      }
      setEtat({ texte: "Enregistré" });
      if (minuteur.current) clearTimeout(minuteur.current);
      minuteur.current = setTimeout(
        () => setEtat((e) => (e?.texte === "Enregistré" ? null : e)),
        1500,
      );
      await Promise.all([charger(), chargerMoiMemorise().catch(() => null)]);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      avertissement();
      setEtat({ texte: messageErreur(e), erreur: true });
    }
  }

  const c = d?.club;
  const agenda = d ? `${PROD}${d.agenda.chemin}.ics` : "";
  const nbSaisons = d?.saisons.liste.length ?? 0;

  return (
    <Ecran t={t} chasubles={{ a: c?.couleurA ?? "#ffffff", b: c?.couleurB ?? "#111111" }}>
      <ScrollView
        contentContainerStyle={s.contenu}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={t.i2} />
        }
      >
        <EnTeteClub t={t} titre="Réglages" sousTitre={d?.sousTitre} />

        <View style={s.corps}>
          {occupe && !d && (
            <View style={s.centre}>
              <ActivityIndicator color={t.ink} />
            </View>
          )}
          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} style={s.erreur} />
          )}

          {d && c && (
            <>
              <Section t={t} titre="Club">
                <Rangee t={t} libelle="Nom" premiere>
                  <EcussonChasuble couleur={c.couleurA} lettre={lettre(c.nom)} taille={30} rayon={8} anneau={3} />
                  <ChampTexte
                    t={t}
                    valeur={c.nom}
                    etiquette="Nom du club"
                    onValider={(v) => v.trim() !== c.nom && v.trim().length > 0 && sauver({ name: v.trim() })}
                  />
                </Rangee>

                <Rangee
                  t={t}
                  libelle="Chasubles"
                  onPress={() => basculer("chasubles")}
                  valeur={`${c.nomChasubleA} · ${c.nomChasubleB}`}
                  ouvert={!!ouvert.chasubles}
                  chevron
                >
                  <View style={s.pastilles}>
                    <EcussonChasuble couleur={c.couleurA} lettre="" taille={22} anneau={2} ombre={false} />
                    <EcussonChasuble couleur={c.couleurB} lettre="" taille={22} anneau={2} ombre={false} />
                  </View>
                </Rangee>
                {ouvert.chasubles && (
                  <View style={[s.chasubles, { borderTopColor: jeton(t, "sep") }]}>
                    <Nuancier
                      t={t}
                      titre="Chasuble A"
                      nom={c.nomChasubleA}
                      courante={c.couleurA}
                      pastilles={d.choix.pastilles}
                      onChoisir={(hex) => {
                        retourChoix();
                        void sauver({ colorA: hex });
                      }}
                    />
                    <Nuancier
                      t={t}
                      titre="Chasuble B"
                      nom={c.nomChasubleB}
                      courante={c.couleurB}
                      pastilles={d.choix.pastilles}
                      onChoisir={(hex) => {
                        retourChoix();
                        void sauver({ colorB: hex });
                      }}
                    />
                    {/* L'aperçu : la ligne de score de l'accueil, en petit.
                        Choisir une couleur sur un nuancier ne dit pas ce
                        qu'elle donnera sur le terrain. */}
                    <View style={[s.apercu, { backgroundColor: jeton(t, "seg") }]}>
                      <LigneScore
                        t={t}
                        nomA={c.nomChasubleA}
                        nomB={c.nomChasubleB}
                        couleurA={c.couleurA}
                        couleurB={c.couleurB}
                        scoreA={4}
                        scoreB={2}
                        etat="Aperçu"
                        reduite
                      />
                    </View>
                  </View>
                )}

                <Rangee
                  t={t}
                  libelle="Format"
                  valeur={c.formatLibelle}
                  chevron
                  onPress={() => setFeuille("format")}
                />
                <Rangee t={t} libelle="Durée d'un match">
                  <ChampNombre
                    t={t}
                    valeur={c.dureeMatchMin}
                    etiquette="Durée d'un match en minutes"
                    onValider={(n) => n !== c.dureeMatchMin && sauver({ matchDurationMin: n })}
                  />
                  <Text style={[s.valeur, { color: t.i2 }]}>min</Text>
                </Rangee>
              </Section>

              <Section t={t} titre="La soirée">
                <Rangee
                  t={t}
                  libelle="Il faut au moins"
                  aide="En dessous, la soirée s'annonce comme menacée."
                  premiere
                >
                  <ChampNombre
                    t={t}
                    valeur={c.minJoueurs}
                    etiquette="Nombre minimum de joueurs"
                    onValider={(n) => n !== c.minJoueurs && sauver({ minJoueurs: n })}
                  />
                  <Text style={[s.valeur, { color: t.i2 }]}>joueurs</Text>
                </Rangee>
                <Rangee
                  t={t}
                  libelle="Le terrain tient"
                  aide="Au-delà, les suivants passent en liste d'attente. 0 pour ne jamais limiter."
                >
                  <ChampNombre
                    t={t}
                    valeur={c.capaciteSoiree}
                    etiquette="Capacité du terrain"
                    onValider={(n) => n !== c.capaciteSoiree && sauver({ capaciteSoiree: n })}
                  />
                  <Text style={[s.valeur, { color: t.i2 }]}>joueurs</Text>
                </Rangee>
              </Section>

              <Section t={t} titre="Match">
                <Rangee t={t} libelle="Passes décisives" aide="Demander le passeur après un but" premiere>
                  <Interrupteur
                    valeur={c.suitPasses}
                    etiquette="Passes décisives"
                    onChange={(v) => {
                      retourChoix();
                      void sauver({ trackAssists: v });
                    }}
                  />
                </Rangee>
                <Rangee t={t} libelle="Cartons" aide="Jaunes et rouges dans la chronologie">
                  <Interrupteur
                    valeur={c.suitCartons}
                    etiquette="Cartons"
                    onChange={(v) => {
                      retourChoix();
                      void sauver({ trackCards: v });
                    }}
                  />
                </Rangee>
                <Rangee t={t} libelle="Les membres peuvent scorer" aide="Sinon, admins uniquement">
                  <Interrupteur
                    valeur={c.membresPeuventScorer}
                    etiquette="Les membres peuvent scorer"
                    onChange={(v) => {
                      retourChoix();
                      void sauver({ membersCanScore: v });
                    }}
                  />
                </Rangee>
                <Rangee
                  t={t}
                  libelle="Homme du match"
                  valeur={c.modeHommeDuMatchLibelle}
                  chevron
                  onPress={() => setFeuille("motm")}
                />
              </Section>

              <Section t={t} titre="Saison">
                <Rangee
                  t={t}
                  libelle="Saison active"
                  valeur={d.saisons.active ?? "aucune"}
                  chevron
                  premiere
                  onPress={() => router.push({ pathname: "/club/[id]/saison", params: { id } })}
                />
                <Rangee t={t} libelle="Barème" aide="victoire · nul">
                  <ChampNombre
                    t={t}
                    valeur={c.pointsVictoire}
                    etiquette="Points par victoire"
                    onValider={(n) => n !== c.pointsVictoire && sauver({ pointsWin: n })}
                  />
                  <ChampNombre
                    t={t}
                    valeur={c.pointsNul}
                    etiquette="Points par nul"
                    onValider={(n) => n !== c.pointsNul && sauver({ pointsDraw: n })}
                  />
                </Rangee>
                <Rangee
                  t={t}
                  libelle="Calendrier automatique"
                  valeur={`${nbSaisons} saison${nbSaisons > 1 ? "s" : ""}`}
                  chevron
                  onPress={() => router.push({ pathname: "/club/[id]/saison", params: { id } })}
                />
              </Section>

              <Section t={t} titre="Vitrine">
                <Rangee
                  t={t}
                  libelle="Page publique"
                  aide={
                    c.publique
                      ? `${PROD}/p/${c.slug}`
                      : "Classement et résultats en lecture seule"
                  }
                  premiere
                >
                  <Interrupteur
                    valeur={c.publique}
                    etiquette="Page publique"
                    onChange={(v) => {
                      retourChoix();
                      void sauver({ isPublic: v });
                    }}
                  />
                </Rangee>
              </Section>
              <Text
                style={[s.etat, { color: etat?.erreur ? jeton(t, "bad") : jeton(t, "i3") }]}
                accessibilityLiveRegion="polite"
              >
                {etat?.texte ?? " "}
              </Text>

              <Section t={t} titre="Membres">
                <Rangee
                  t={t}
                  libelle="Inviter par lien"
                  ouvert={!!ouvert.invitation}
                  chevron
                  premiere
                  onPress={() => basculer("invitation")}
                >
                  <Text
                    style={[s.code, { color: t.ink, backgroundColor: jeton(t, "seg") }]}
                    numberOfLines={1}
                  >
                    {d.invitation.affiche}
                  </Text>
                </Rangee>
                {ouvert.invitation && (
                  <Detail t={t}>
                    <Text style={[s.aideBloc, { color: t.i2 }]}>
                      Qui ouvre ce lien rejoint le club. Il reste valable jusqu&apos;à ce
                      qu&apos;on le régénère.
                    </Text>
                    <View style={s.deuxBoutons}>
                      <BoutonPlein
                        t={t}
                        titre="Partager le lien"
                        onPress={() =>
                          void Share.share({
                            message: `Rejoins notre club sur Five Scorer : ${PROD}${d.invitation.lien}`,
                          }).catch(() => {})
                        }
                      />
                      <BoutonPlein
                        t={t}
                        danger
                        titre="Régénérer le code"
                        onPress={() =>
                          confirmer(
                            "Régénérer le code ?",
                            "L'ancien lien ne marchera plus. Tous ceux que tu as déjà envoyés, y compris sur WhatsApp, tomberont en panne.",
                            "Oui, régénérer",
                            async () => {
                              await regenererInvitation(id);
                              await charger();
                            },
                            true,
                          )
                        }
                      />
                    </View>
                  </Detail>
                )}

                <Rangee
                  t={t}
                  libelle={d.membres.sousTitre}
                  ouvert={!!ouvert.membres}
                  chevron
                  onPress={() => basculer("membres")}
                />
                {ouvert.membres && (
                  <Detail t={t}>
                    {d.membres.liste.map((m, i) => (
                      <View
                        key={m.id}
                        style={[s.membre, i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }]}
                      >
                        <Avatar nom={m.nom} t={t} taille={34} initiales={m.initiales} />
                        <View style={s.membreTextes}>
                          <Text style={[s.membreNom, { color: t.ink }]} numberOfLines={1}>
                            {m.nom}
                            {m.estMoi && <Text style={{ color: t.i3 }}> · toi</Text>}
                          </Text>
                          <Text style={[s.membreSous, { color: t.i2 }]} numberOfLines={1}>
                            {m.joueur ? `${m.joueur} · ` : ""}
                            {m.courriel}
                          </Text>
                        </View>
                        {m.estOwner ? (
                          <Text style={[s.capitaine, { color: jeton(t, "or") }]}>Capitaine</Text>
                        ) : (
                          <View style={s.actionsMembre}>
                            <PetitBouton
                              t={t}
                              titre={m.roleLibelle}
                              etiquette={
                                m.role === "admin"
                                  ? `Retirer les droits d'admin à ${m.nom}`
                                  : `Faire de ${m.nom} un admin`
                              }
                              onPress={() =>
                                confirmer(
                                  m.role === "admin"
                                    ? `Retirer les droits d'admin à ${m.nom} ?`
                                    : `Faire de ${m.nom} un admin ?`,
                                  m.role === "admin"
                                    ? "Cette personne ne pourra plus modifier les réglages ni gérer l'effectif."
                                    : "Cette personne pourra modifier les réglages, l'effectif et le calendrier.",
                                  m.role === "admin" ? "Rétrograder" : "Promouvoir",
                                  async () => {
                                    await changerRole(id, m.id, m.role === "admin" ? "member" : "admin");
                                    await charger();
                                  },
                                )
                              }
                            />
                            {!m.estMoi && (
                              <PetitBouton
                                t={t}
                                titre="Retirer"
                                danger
                                etiquette={`Retirer ${m.nom} du club`}
                                onPress={() =>
                                  confirmer(
                                    `Retirer ${m.nom} du club ?`,
                                    "Ses matchs, ses buts et ses votes restent au club — c'est son compte qui est délié. Pour revenir, il lui faudra un nouveau lien d'invitation.",
                                    "Retirer",
                                    async () => {
                                      await retirerMembre(id, m.id);
                                      await charger();
                                    },
                                    true,
                                  )
                                }
                              />
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                    <Text style={[s.aideBloc, { color: t.i3 }]}>
                      Retirer quelqu&apos;un ne supprime pas son historique : son profil
                      joueur reste au vestiaire, simplement délié de son compte.
                    </Text>
                  </Detail>
                )}

                <Rangee
                  t={t}
                  libelle="Le calendrier dans le téléphone"
                  valeur="iCal"
                  ouvert={!!ouvert.agenda}
                  chevron
                  onPress={() => basculer("agenda")}
                />
                {ouvert.agenda && (
                  <Detail t={t}>
                    <Text style={[s.aideBloc, { color: t.i2 }]}>
                      Ajoute-le à ton agenda : tous les lundis de la saison apparaissent,
                      et ton téléphone te les rappelle tout seul. Il se met à jour quand
                      le calendrier du club change.
                    </Text>
                    <View style={s.deuxBoutons}>
                      <BoutonPlein
                        t={t}
                        titre="Ajouter à mon agenda"
                        onPress={() =>
                          // webcal:// : l'agenda propose l'ABONNEMENT, là où un
                          // lien https téléchargerait un fichier figé.
                          void Linking.openURL(agenda.replace(/^https?:/, "webcal:")).catch(() =>
                            Alert.alert(
                              "Aucun agenda n'a répondu",
                              "Partage plutôt le lien et colle-le dans ton application d'agenda.",
                            ),
                          )
                        }
                      />
                      <BoutonVerre
                        t={t}
                        titre="Partager le lien"
                        onPress={() => void Share.share({ message: agenda }).catch(() => {})}
                      />
                    </View>
                    <Text style={[s.aideBloc, { color: t.i3 }]}>
                      À partager avec tout le monde : le lien ne donne accès qu&apos;aux dates
                      et au lieu, jamais aux joueurs ni aux résultats — et il ne permet pas de
                      rejoindre le club.
                    </Text>
                  </Detail>
                )}

                <Rangee
                  t={t}
                  libelle="Saisons"
                  valeur={String(nbSaisons)}
                  ouvert={!!ouvert.saisons}
                  chevron
                  onPress={() => basculer("saisons")}
                />
                {ouvert.saisons && (
                  <Detail t={t}>
                    {d.saisons.liste.map((sn, i) => (
                      <View
                        key={sn.id}
                        style={[s.saison, i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }]}
                      >
                        <View style={s.saisonTextes}>
                          <View style={s.saisonNom}>
                            <Text style={[s.saisonTitre, { color: t.ink }]} numberOfLines={1}>
                              {sn.nom}
                            </Text>
                            {sn.active && (
                              <Text style={[s.badge, { color: jeton(t, "ok"), borderColor: jeton(t, "ok") }]}>
                                active
                              </Text>
                            )}
                          </View>
                          <Text style={[s.saisonPeriode, { color: t.i2 }]} numberOfLines={1}>
                            {sn.periode}
                          </Text>
                        </View>
                        <PetitBouton
                          t={t}
                          titre={sn.active ? "Clôturer" : "Réactiver"}
                          etiquette={`${sn.active ? "Clôturer" : "Réactiver"} ${sn.nom}`}
                          onPress={() =>
                            confirmer(
                              sn.active ? "Clôturer cette saison ?" : "Réactiver cette saison ?",
                              sn.active
                                ? "Le club n'aura plus de saison en cours : les nouveaux matchs et les nouvelles soirées ne s'attacheront plus à rien."
                                : `« ${d.saisons.active ?? "La saison en cours"} » sera clôturée au passage — un club n'a jamais deux saisons ouvertes.`,
                              sn.active ? "Clôturer" : "Réactiver",
                              async () => {
                                await basculerSaison(id, sn.id, !sn.active);
                                await charger();
                              },
                            )
                          }
                        />
                      </View>
                    ))}
                    <View style={[s.saison, s.nouvelle, { borderTopColor: jeton(t, "sep") }]}>
                      <Saisie
                        t={t}
                        value={nouvelleSaison}
                        onChangeText={setNouvelleSaison}
                        placeholder="Saison 2027-2028"
                        accessibilityLabel="Nom de la nouvelle saison"
                        returnKeyType="done"
                        style={s.saisieSaison}
                      />
                      <PetitBouton
                        t={t}
                        titre="Créer"
                        disabled={nouvelleSaison.trim().length < 2}
                        etiquette="Créer la saison"
                        onPress={() =>
                          confirmer(
                            "Ouvrir une saison ?",
                            `« ${d.saisons.active ?? "La saison en cours"} » sera clôturée : un club n'a jamais deux saisons ouvertes.`,
                            "Ouvrir",
                            async () => {
                              await creerSaison(id, nouvelleSaison.trim());
                              setNouvelleSaison("");
                              await charger();
                            },
                          )
                        }
                      />
                    </View>
                    <Text style={[s.aideBloc, { color: t.i3 }]}>
                      Les nouveaux matchs s&apos;attachent automatiquement à la saison active.
                    </Text>
                  </Detail>
                )}
              </Section>
            </>
          )}

          {/* Le pied du site : se déconnecter, puis la version. Le même geste
              que dans le menu, avec le même avertissement quand des buts
              attendent encore le réseau. */}
          <View style={s.pied}>
            <BoutonPlein t={t} titre="Se déconnecter" danger onPress={() => void deconnecter()} />
          </View>
          <Text style={[s.version, { color: jeton(t, "i3") }]} selectable>
            {version()}
          </Text>
        </View>
      </ScrollView>

      {/* Les deux choix à plus de deux valeurs passent par une feuille : un
          segment à cinq pastilles ne se tape pas au pouce. */}
      <Feuille
        t={t}
        visible={feuille !== null}
        onClose={() => setFeuille(null)}
        titre={feuille === "format" ? "Format" : "Homme du match"}
      >
        <View style={s.choixListe}>
          {(feuille === "format" ? d?.choix.formats : d?.choix.hommeDuMatch)?.map((o) => {
            const actif =
              feuille === "format" ? o.valeur === c?.format : o.valeur === c?.modeHommeDuMatch;
            return (
              <Pressable
                key={o.valeur}
                onPress={() => {
                  setFeuille(null);
                  if (actif) return;
                  retourChoix();
                  void sauver(feuille === "format" ? { format: o.valeur } : { motmMode: o.valeur });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
                style={({ pressed }) => [
                  s.choix,
                  (actif || pressed) && { backgroundColor: jeton(t, "gl") },
                ]}
              >
                <Text style={[s.choixTexte, { color: t.ink }]}>{o.libelle}</Text>
                {actif && <IconeJeu nom="coche" couleur={jeton(t, "i2")} taille={16} />}
              </Pressable>
            );
          })}
        </View>
      </Feuille>
    </Ecran>
  );
}

/// « Five Scorer · app 1.0.0 · mise à jour 3f2a1c9 » : ce qu'on recopie dans
/// un message quand quelque chose cloche. L'identifiant de la mise à jour à
/// chaud dit quel code tourne vraiment — la version du binaire, elle, ne
/// bouge pas d'un correctif à l'autre.
function version(): string {
  const v = Constants.expoConfig?.version ?? "?";
  const maj =
    Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.updateId
      ? ` · mise à jour ${Updates.updateId.slice(0, 7)}`
      : Updates.isEnabled
        ? ""
        : " · développement";
  return `Five Scorer · app ${v}${maj}`;
}

/// Une confirmation qui DIT ce qui va se passer. Pas « Êtes-vous sûr ? » : la
/// conséquence, en une phrase, avant le bouton qui la déclenche. Un refus du
/// serveur se dit aussi, au lieu de ne rien faire.
function confirmer(
  titre: string,
  message: string,
  action: string,
  faire: () => Promise<void>,
  destructeur = false,
) {
  if (destructeur) avertissement();
  Alert.alert(titre, message, [
    { text: "Annuler", style: "cancel" },
    {
      text: action,
      style: destructeur ? "destructive" : "default",
      onPress: () =>
        void faire()
          .then(retourSucces)
          .catch((e: unknown) => {
            if (e instanceof SessionExpiree) return router.replace("/connexion");
            Alert.alert("Ça n'a pas marché", messageErreur(e));
          }),
    },
  ]);
}

function Section({
  t,
  titre,
  haut = 22,
  children,
}: {
  t: Jetons;
  titre: string;
  haut?: number;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={[s.section, { color: t.i2, paddingTop: haut }]} accessibilityRole="header">
        {titre.toUpperCase()}
      </Text>
      <CarteVerre t={t} rayon={22} style={s.carte}>
        {children}
      </CarteVerre>
    </View>
  );
}

function Rangee({
  t,
  libelle,
  aide,
  valeur,
  chevron,
  ouvert,
  onPress,
  premiere,
  children,
}: {
  t: Jetons;
  libelle: string;
  aide?: string;
  valeur?: string;
  /// « › », ou « ⌃ » quand la rangée est dépliée — les deux signes du site.
  chevron?: boolean;
  ouvert?: boolean;
  onPress?: () => void;
  premiere?: boolean;
  children?: React.ReactNode;
}) {
  const corps = (
    <>
      <View style={s.rangeeTextes}>
        <Text style={[s.libelle, { color: t.ink }]}>{libelle}</Text>
        {aide && <Text style={[s.aide, { color: t.i2 }]}>{aide}</Text>}
      </View>
      {children}
      {valeur !== undefined && (
        <Text style={[s.valeur, s.valeurSouple, { color: t.i2 }]} numberOfLines={1}>
          {valeur}
        </Text>
      )}
      {chevron && <Text style={[s.chevron, { color: t.i3 }]}>{ouvert ? "⌃" : "›"}</Text>}
    </>
  );
  const style: StyleProp<ViewStyle> = [
    s.rangee,
    aide ? s.rangeeAide : null,
    !premiere && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
  ];
  if (!onPress) return <View style={style}>{corps}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[libelle, valeur].filter(Boolean).join(", ")}
      accessibilityState={ouvert !== undefined ? { expanded: ouvert } : undefined}
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
    >
      {corps}
    </Pressable>
  );
}

/// Le contenu d'une rangée dépliée (`.reg-detail`) : un filet au-dessus, de
/// l'air en dessous.
function Detail({ t, children }: { t: Jetons; children: React.ReactNode }) {
  return <View style={[s.detail, { borderTopColor: jeton(t, "sep") }]}>{children}</View>;
}

/// Les petits boutons de verre des listes (rôle, retrait, saison) : 34 de
/// haut comme le site, portés à 44 au doigt par la zone de toucher.
function PetitBouton({
  t,
  titre,
  onPress,
  etiquette,
  danger,
  disabled,
}: {
  t: Jetons;
  titre: string;
  onPress: () => void;
  etiquette?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={5}
      accessibilityRole="button"
      accessibilityLabel={etiquette ?? titre}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        s.petitBouton,
        { backgroundColor: jeton(t, "gl"), borderColor: jeton(t, "gb") },
        { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[s.petitBoutonTexte, { color: danger ? jeton(t, "bad") : t.ink }]}>{titre}</Text>
    </Pressable>
  );
}

/// Un champ texte qui part au serveur quand on le quitte, pas avant : taper
/// « Renault Five » aurait sinon envoyé douze réglages, dont « R ».
function ChampTexte({
  t,
  valeur,
  etiquette,
  onValider,
}: {
  t: Jetons;
  valeur: string;
  etiquette: string;
  onValider: (v: string) => void;
}) {
  const [v, setV] = useState(valeur);
  useEffect(() => setV(valeur), [valeur]);
  return (
    <Saisie
      t={t}
      value={v}
      onChangeText={setV}
      onBlur={() => onValider(v)}
      returnKeyType="done"
      accessibilityLabel={etiquette}
      style={s.champNom}
    />
  );
}

function ChampNombre({
  t,
  valeur,
  etiquette,
  onValider,
}: {
  t: Jetons;
  valeur: number;
  etiquette: string;
  onValider: (n: number) => void;
}) {
  const [v, setV] = useState(String(valeur));
  useEffect(() => setV(String(valeur)), [valeur]);
  return (
    <Saisie
      t={t}
      value={v}
      onChangeText={(x) => setV(x.replace(/[^0-9]/g, ""))}
      onBlur={() => {
        const n = Number(v);
        if (Number.isFinite(n) && v !== "") onValider(n);
        else setV(String(valeur));
      }}
      keyboardType="number-pad"
      returnKeyType="done"
      accessibilityLabel={etiquette}
      style={s.champCourt}
    />
  );
}

function Nuancier({
  t,
  titre,
  nom,
  courante,
  pastilles,
  onChoisir,
}: {
  t: Jetons;
  titre: string;
  nom: string;
  courante: string;
  pastilles: string[];
  onChoisir: (hex: string) => void;
}) {
  return (
    <View>
      <View style={s.nuancierTitre}>
        <Text style={[s.nuancierNom, { color: t.ink }]}>{titre}</Text>
        <Text style={[s.nuancierSous, { color: t.i2 }]}>{nom}</Text>
      </View>
      <View style={s.nuancier}>
        {pastilles.map((hex) => {
          const actif = hex.toUpperCase() === courante.toUpperCase();
          return (
            <Pressable
              key={hex}
              onPress={() => !actif && onChoisir(hex)}
              accessibilityRole="button"
              accessibilityLabel={`${titre} : ${hex}`}
              accessibilityState={{ selected: actif }}
              hitSlop={3}
              style={[
                s.nuance,
                { backgroundColor: hex },
                actif
                  ? {
                      transform: [{ scale: 1.08 }],
                      boxShadow: `0 0 0 3px ${jeton(t, "bgSolid")}, 0 0 0 5px ${t.ink}`,
                    }
                  : { boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const MONO: TextStyle["fontFamily"] = Platform.select({ ios: "Menlo", default: "monospace" });

const s = StyleSheet.create({
  contenu: { paddingBottom: 60 },
  corps: { paddingHorizontal: 14 },
  centre: { paddingTop: 60, alignItems: "center" },
  erreur: { marginTop: 24 },

  // `.section-ios` : 13/600, capitales espacées, 22 au-dessus et 6 dessous.
  section: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  carte: { paddingHorizontal: 18 },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54 },
  rangeeAide: { paddingVertical: 8 },
  rangeeTextes: { flex: 1, minWidth: 0 },
  libelle: { fontSize: 17 },
  aide: { fontSize: 13, lineHeight: 17, marginTop: 2 },
  valeur: { fontSize: 17 },
  valeurSouple: { flexShrink: 1 },
  chevron: { fontSize: 17 },

  champNom: { flex: 2, minWidth: 0, textAlign: "left" },
  champCourt: { width: 84, textAlign: "right", fontVariant: ["tabular-nums"] },

  pastilles: { flexDirection: "row", gap: 6 },
  chasubles: { paddingTop: 4, paddingBottom: 16, borderTopWidth: 1 },
  nuancierTitre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  nuancierNom: { fontSize: 17, fontWeight: "600" },
  nuancierSous: { fontSize: 15 },
  nuancier: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "center" },
  nuance: { width: 38, height: 38, borderRadius: 19 },
  apercu: { marginTop: 18, borderRadius: 18, paddingVertical: 4 },

  etat: { fontSize: 13, textAlign: "right", paddingTop: 6, paddingHorizontal: 4, minHeight: 22 },
  code: {
    fontFamily: MONO,
    fontSize: 15,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    overflow: "hidden",
  },

  detail: { paddingTop: 8, paddingBottom: 14, borderTopWidth: 1 },
  aideBloc: { fontSize: 13, lineHeight: 18, paddingTop: 10 },
  deuxBoutons: { gap: 10, paddingTop: 12 },
  petitBouton: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  petitBoutonTexte: { fontSize: 15, fontWeight: "600" },

  membre: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  membreTextes: { flex: 1, minWidth: 0 },
  membreNom: { fontSize: 17, fontWeight: "600" },
  membreSous: { fontSize: 13, marginTop: 2 },
  capitaine: { fontSize: 15, fontWeight: "700" },
  actionsMembre: { flexDirection: "row", gap: 8 },

  saison: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  nouvelle: { borderTopWidth: 1 },
  saisonTextes: { flex: 1, minWidth: 0 },
  saisonNom: { flexDirection: "row", alignItems: "center", gap: 8 },
  saisonTitre: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  saisonPeriode: { fontSize: 13, marginTop: 2 },
  saisieSaison: { flex: 1 },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },

  pied: { paddingTop: 22 },
  version: { fontSize: 13, textAlign: "center", paddingTop: 16 },

  choixListe: { paddingBottom: 4 },
  choix: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  choixTexte: { fontSize: 17, fontWeight: "600" },
});
