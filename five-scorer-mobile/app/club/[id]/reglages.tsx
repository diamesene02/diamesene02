import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useGlobalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ecran from "../../../composants/Ecran";
import { Avatar, BoutonRond, EcussonChasuble, Poignee } from "../../../composants/base";
import { JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import { themeTokens } from "../../../lib/noyau/theme";
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
/// réglage changé puis oublié. L'état de l'envoi se lit en bas de l'écran.
///
/// Les gestes qui ne se rattrapent pas — régénérer le lien d'invitation,
/// retirer un membre, ouvrir ou clôturer une saison — demandent tous une
/// confirmation qui DIT ce qui va se passer. Le site en oublie la moitié ; sur
/// un téléphone, où le doigt glisse, ce n'est pas tenable.
export default function Reglages() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [d, setD] = useState<EcranReglages | null>(null);
  const [occupe, setOccupe] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etat, setEtat] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [chasublesOuvertes, setChasublesOuvertes] = useState(false);
  const [membresOuverts, setMembresOuverts] = useState(false);
  const [saisonsOuvertes, setSaisonsOuvertes] = useState(false);
  const [invitationOuverte, setInvitationOuverte] = useState(false);
  const [nouvelleSaison, setNouvelleSaison] = useState("");
  const [feuille, setFeuille] = useState<null | "format" | "motm">(null);
  const bas = useSafeAreaInsets().bottom;
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t: Jetons = d
    ? themeTokens(d.club.couleurA, d.club.couleurB, "dark")
    : JETONS_NEUTRES;

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      setD(await chargerReglages(id));
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  }, [id]);

  useEffect(() => {
    void charger();
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [charger]);

  /// Enregistrer un champ, et le dire. L'écran se relit ensuite : les couleurs
  /// changent le thème de toute l'app, et le nom la pilule du club.
  async function sauver(diff: ReglageAEcrire) {
    if (!id) return;
    setEtat({ texte: "Enregistrement…" });
    try {
      const r = await ecrireReglage(id, diff);
      if (!r.ok) {
        setEtat({ texte: r.error ?? "Erreur", erreur: true });
        return;
      }
      setEtat({ texte: "Enregistré" });
      if (minuteur.current) clearTimeout(minuteur.current);
      minuteur.current = setTimeout(
        () => setEtat((e) => (e?.texte === "Enregistré" ? null : e)),
        1500,
      );
      await charger();
    } catch (e) {
      setEtat({ texte: e instanceof Error ? e.message : String(e), erreur: true });
    }
  }

  const c = d?.club;

  return (
    <Ecran
      t={t}
      chasubles={{ a: c?.couleurA ?? "#ffffff", b: c?.couleurB ?? "#111111" }}
    >
      <ScrollView
        contentContainerStyle={s.contenu}
        keyboardShouldPersistTaps="handled"
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

        <Text style={[s.titre, { color: t.ink }]}>Réglages</Text>
        {d && <Text style={[s.sousTitre, { color: t.i2 }]}>{d.sousTitre}</Text>}

        {occupe && !d && (
          <View style={s.centre}>
            <ActivityIndicator color={t.ink} />
          </View>
        )}
        {erreur && <Text style={[s.erreur, { color: t.bad }]}>{erreur}</Text>}

        {d && c && (
          <>
            <Section t={t} titre="Club">
              <Rangee t={t} libelle="Nom" premiere>
                <ChampInline
                  t={t}
                  valeur={c.nom}
                  onValider={(v) => v.trim() !== c.nom && sauver({ name: v.trim() })}
                />
              </Rangee>

              <Rangee
                t={t}
                libelle="Chasubles"
                onPress={() => setChasublesOuvertes((o) => !o)}
                valeur={`${c.nomChasubleA} · ${c.nomChasubleB}`}
                chevron={chasublesOuvertes ? "⌃" : "›"}
              >
                <View style={s.pastilles}>
                  <View style={[s.pastille, { backgroundColor: c.couleurA, borderColor: t.cb }]} />
                  <View style={[s.pastille, { backgroundColor: c.couleurB, borderColor: t.cb }]} />
                </View>
              </Rangee>
              {chasublesOuvertes && (
                <View style={s.chasubles}>
                  <Nuancier
                    t={t}
                    titre="Chasuble A"
                    nom={c.nomChasubleA}
                    courante={c.couleurA}
                    pastilles={d.choix.pastilles}
                    onChoisir={(hex) => sauver({ colorA: hex })}
                  />
                  <Nuancier
                    t={t}
                    titre="Chasuble B"
                    nom={c.nomChasubleB}
                    courante={c.couleurB}
                    pastilles={d.choix.pastilles}
                    onChoisir={(hex) => sauver({ colorB: hex })}
                  />
                  {/* L'aperçu : les deux écussons côte à côte, comme la ligne
                      de score de la feuille. Choisir une couleur sur un
                      nuancier ne dit pas ce qu'elle donnera sur le terrain. */}
                  <View style={s.apercu}>
                    <EcussonChasuble couleur={c.couleurA} lettre={c.nomChasubleA[0] ?? "A"} taille={54} />
                    <Text style={[s.apercuScore, { color: t.ink }]}>4 – 2</Text>
                    <EcussonChasuble couleur={c.couleurB} lettre={c.nomChasubleB[0] ?? "B"} taille={54} />
                  </View>
                </View>
              )}

              <Rangee
                t={t}
                libelle="Format"
                valeur={c.formatLibelle}
                chevron="›"
                onPress={() => setFeuille("format")}
              />
              <Rangee t={t} libelle="Durée d'un match">
                <ChampNombre
                  t={t}
                  valeur={c.dureeMatchMin}
                  onValider={(n) => n !== c.dureeMatchMin && sauver({ matchDurationMin: n })}
                />
                <Text style={[s.unite, { color: t.i2 }]}>min</Text>
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
                  onValider={(n) => n !== c.minJoueurs && sauver({ minJoueurs: n })}
                />
                <Text style={[s.unite, { color: t.i2 }]}>joueurs</Text>
              </Rangee>
              <Rangee
                t={t}
                libelle="Le terrain tient"
                aide="Au-delà, les suivants passent en liste d'attente. 0 pour ne jamais limiter."
              >
                <ChampNombre
                  t={t}
                  valeur={c.capaciteSoiree}
                  onValider={(n) => n !== c.capaciteSoiree && sauver({ capaciteSoiree: n })}
                />
                <Text style={[s.unite, { color: t.i2 }]}>joueurs</Text>
              </Rangee>
            </Section>

            <Section t={t} titre="Match">
              <Rangee t={t} libelle="Passes décisives" aide="Demander le passeur après un but" premiere>
                <Switch
                  value={c.suitPasses}
                  onValueChange={(v) => sauver({ trackAssists: v })}
                  trackColor={{ true: t.ok, false: t.seg }}
                />
              </Rangee>
              <Rangee t={t} libelle="Cartons" aide="Jaunes et rouges dans la chronologie">
                <Switch
                  value={c.suitCartons}
                  onValueChange={(v) => sauver({ trackCards: v })}
                  trackColor={{ true: t.ok, false: t.seg }}
                />
              </Rangee>
              <Rangee t={t} libelle="Les membres peuvent scorer" aide="Sinon, admins uniquement">
                <Switch
                  value={c.membresPeuventScorer}
                  onValueChange={(v) => sauver({ membersCanScore: v })}
                  trackColor={{ true: t.ok, false: t.seg }}
                />
              </Rangee>
              <Rangee
                t={t}
                libelle="Homme du match"
                valeur={c.modeHommeDuMatchLibelle}
                chevron="›"
                onPress={() => setFeuille("motm")}
              />
            </Section>

            <Section t={t} titre="Saison">
              <Rangee
                t={t}
                libelle="Saison active"
                valeur={d.saisons.active ?? "aucune"}
                chevron="›"
                premiere
                onPress={() =>
                  router.push({ pathname: "/club/[id]/saison", params: { id } })
                }
              />
              <Rangee t={t} libelle="Barème" aide="victoire · nul">
                <ChampNombre
                  t={t}
                  valeur={c.pointsVictoire}
                  onValider={(n) => n !== c.pointsVictoire && sauver({ pointsWin: n })}
                />
                <ChampNombre
                  t={t}
                  valeur={c.pointsNul}
                  onValider={(n) => n !== c.pointsNul && sauver({ pointsDraw: n })}
                />
              </Rangee>
              <Rangee
                t={t}
                libelle="Saisons"
                valeur={String(d.saisons.liste.length)}
                chevron={saisonsOuvertes ? "⌃" : "›"}
                onPress={() => setSaisonsOuvertes((o) => !o)}
              />
              {saisonsOuvertes && (
                <View style={s.deplie}>
                  {d.saisons.liste.map((sn) => (
                    <View key={sn.id} style={[s.saison, { borderTopColor: t.sep }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={s.saisonNom}>
                          <Text style={[s.saisonTitre, { color: t.ink }]} numberOfLines={1}>
                            {sn.nom}
                          </Text>
                          {sn.active && (
                            <Text style={[s.badge, { color: t.ok, borderColor: t.ok }]}>active</Text>
                          )}
                        </View>
                        <Text style={[s.saisonPeriode, { color: t.i2 }]} numberOfLines={1}>
                          {sn.periode}
                        </Text>
                      </View>
                      <Pressable
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
                        style={({ pressed }) => [
                          s.petitBouton,
                          { borderColor: t.cb },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>
                          {sn.active ? "Clôturer" : "Réactiver"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                  <View style={[s.saison, { borderTopColor: t.sep }]}>
                    <TextInput
                      value={nouvelleSaison}
                      onChangeText={setNouvelleSaison}
                      placeholder="Saison 2027-2028"
                      placeholderTextColor={t.i3}
                      style={[s.saisie, { color: t.ink, backgroundColor: t.seg, borderColor: t.cb }]}
                    />
                    <Pressable
                      disabled={nouvelleSaison.trim().length < 2}
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
                      style={({ pressed }) => [
                        s.petitBouton,
                        {
                          borderColor: t.cb,
                          opacity: nouvelleSaison.trim().length < 2 ? 0.4 : pressed ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>Créer</Text>
                    </Pressable>
                  </View>
                  <Text style={[s.aideBloc, { color: t.i3 }]}>
                    Les nouveaux matchs s&apos;attachent automatiquement à la saison active.
                  </Text>
                </View>
              )}
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
                <Switch
                  value={c.publique}
                  onValueChange={(v) => sauver({ isPublic: v })}
                  trackColor={{ true: t.ok, false: t.seg }}
                />
              </Rangee>
            </Section>

            <Section t={t} titre="Membres">
              <Rangee
                t={t}
                libelle="Inviter par lien"
                valeur={d.invitation.affiche}
                chevron={invitationOuverte ? "⌃" : "›"}
                premiere
                onPress={() => setInvitationOuverte((o) => !o)}
              />
              {invitationOuverte && (
                <View style={s.deplie}>
                  <Text style={[s.aideBloc, { color: t.i2 }]}>
                    Qui ouvre ce lien rejoint le club. Il reste valable jusqu&apos;à ce
                    qu&apos;on le régénère.
                  </Text>
                  <View style={s.deuxBoutons}>
                    <Pressable
                      onPress={() =>
                        void Share.share({ message: PROD + d.invitation.lien }).catch(() => {})
                      }
                      style={({ pressed }) => [
                        s.grandBouton,
                        { borderColor: t.cb },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={{ color: t.ink, fontSize: 17, fontWeight: "600" }}>
                        Partager le lien
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        confirmer(
                          "Régénérer le code ?",
                          "L'ancien lien ne marchera plus. Tous ceux que tu as déjà envoyés, y compris sur WhatsApp, tomberont en panne.",
                          "Oui, régénérer",
                          async () => {
                            await regenererInvitation(id);
                            await charger();
                          },
                        )
                      }
                      style={({ pressed }) => [
                        s.grandBouton,
                        { borderColor: t.cb },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={{ color: t.bad, fontSize: 17, fontWeight: "600" }}>
                        Régénérer le code
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <Rangee
                t={t}
                libelle={d.membres.sousTitre}
                chevron={membresOuverts ? "⌃" : "›"}
                onPress={() => setMembresOuverts((o) => !o)}
              />
              {membresOuverts && (
                <View style={s.deplie}>
                  {d.membres.liste.map((m) => (
                    <View key={m.id} style={[s.membre, { borderTopColor: t.sep }]}>
                      <Avatar nom={m.nom} t={t} taille={34} />
                      <View style={{ flex: 1, minWidth: 0 }}>
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
                        <Text style={[s.capitaine, { color: t.or ?? "#ffd60a" }]}>Capitaine</Text>
                      ) : (
                        <View style={s.actionsMembre}>
                          <Pressable
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
                                  await changerRole(
                                    id,
                                    m.id,
                                    m.role === "admin" ? "member" : "admin",
                                  );
                                  await charger();
                                },
                              )
                            }
                            style={({ pressed }) => [
                              s.petitBouton,
                              { borderColor: t.cb },
                              pressed && { opacity: 0.6 },
                            ]}
                          >
                            <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>
                              {m.roleLibelle}
                            </Text>
                          </Pressable>
                          {!m.estMoi && (
                            <Pressable
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
                              style={({ pressed }) => [
                                s.petitBouton,
                                { borderColor: t.cb },
                                pressed && { opacity: 0.6 },
                              ]}
                            >
                              <Text style={{ color: t.bad, fontSize: 15, fontWeight: "600" }}>
                                Retirer
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                  <Text style={[s.aideBloc, { color: t.i3 }]}>
                    Retirer quelqu&apos;un ne supprime pas son historique : son profil
                    joueur reste au vestiaire, simplement délié de son compte.
                  </Text>
                </View>
              )}

              <Rangee
                t={t}
                libelle="Le calendrier dans le téléphone"
                valeur="iCal"
                chevron="›"
                onPress={() =>
                  void Share.share({ message: PROD + d.agenda.chemin }).catch(() => {})
                }
              />
            </Section>

            <Text
              style={[
                s.etat,
                { color: etat?.erreur ? t.bad : t.i2 },
              ]}
            >
              {etat?.texte ?? " "}
            </Text>
          </>
        )}
      </ScrollView>

      {/* Les deux choix à plus de deux valeurs passent par une feuille : un
          segment à cinq pastilles ne se tape pas au pouce. */}
      <Modal
        visible={feuille !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setFeuille(null)}
      >
        <Pressable style={s.voile} onPress={() => setFeuille(null)}>
          <Pressable
            style={[
              s.feuille,
              { paddingBottom: bas + 12, backgroundColor: t.bgSolid, borderTopColor: t.ink },
            ]}
            onPress={() => {}}
          >
            <Poignee />
            {(feuille === "format" ? d?.choix.formats : d?.choix.hommeDuMatch)?.map((o) => {
              const actif =
                feuille === "format" ? o.valeur === c?.format : o.valeur === c?.modeHommeDuMatch;
              return (
                <Pressable
                  key={o.valeur}
                  onPress={() => {
                    setFeuille(null);
                    void sauver(
                      feuille === "format" ? { format: o.valeur } : { motmMode: o.valeur },
                    );
                  }}
                  style={({ pressed }) => [
                    s.choix,
                    actif && { backgroundColor: t.seg },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[s.choixTexte, { color: t.ink }]}>{o.libelle}</Text>
                  {actif && <Text style={{ color: t.i2, fontSize: 17 }}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </Ecran>
  );
}

/// Une confirmation qui DIT ce qui va se passer. Pas « Êtes-vous sûr ? » : la
/// conséquence, en une phrase, avant le bouton qui la déclenche.
function confirmer(
  titre: string,
  message: string,
  action: string,
  faire: () => Promise<void>,
  destructeur = false,
) {
  Alert.alert(titre, message, [
    { text: "Annuler", style: "cancel" },
    {
      text: action,
      style: destructeur ? "destructive" : "default",
      onPress: () => void faire(),
    },
  ]);
}

function Section({
  t,
  titre,
  children,
}: {
  t: Jetons;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={[s.section, { color: t.i2 }]}>{titre.toUpperCase()}</Text>
      <View style={[s.carte, { borderColor: t.cb, backgroundColor: t.cdSolid }]}>{children}</View>
    </View>
  );
}

function Rangee({
  t,
  libelle,
  aide,
  valeur,
  chevron,
  onPress,
  premiere,
  children,
}: {
  t: Jetons;
  libelle: string;
  aide?: string;
  valeur?: string;
  chevron?: string;
  onPress?: () => void;
  premiere?: boolean;
  children?: React.ReactNode;
}) {
  const corps = (
    <>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.libelle, { color: t.ink }]}>{libelle}</Text>
        {aide && <Text style={[s.aide, { color: t.i2 }]}>{aide}</Text>}
      </View>
      {children}
      {valeur !== undefined && (
        <Text style={[s.valeur, { color: t.i2 }]} numberOfLines={1}>
          {valeur}
        </Text>
      )}
      {chevron && <Text style={[s.chevron, { color: t.i3 }]}>{chevron}</Text>}
    </>
  );
  const style = [
    s.rangee,
    !premiere && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.sep },
  ];
  if (!onPress) return <View style={style}>{corps}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...style, pressed && { opacity: 0.6 }]}>
      {corps}
    </Pressable>
  );
}

/// Un champ texte qui part au serveur quand on le quitte, pas avant : taper
/// « Renault Five » aurait sinon envoyé douze réglages, dont « R ».
function ChampInline({
  t,
  valeur,
  onValider,
}: {
  t: Jetons;
  valeur: string;
  onValider: (v: string) => void;
}) {
  const [v, setV] = useState(valeur);
  useEffect(() => setV(valeur), [valeur]);
  return (
    <TextInput
      value={v}
      onChangeText={setV}
      onBlur={() => onValider(v)}
      returnKeyType="done"
      onSubmitEditing={() => onValider(v)}
      style={[s.champ, { color: t.ink, backgroundColor: t.seg, borderColor: t.cb }]}
    />
  );
}

function ChampNombre({
  t,
  valeur,
  onValider,
}: {
  t: Jetons;
  valeur: number;
  onValider: (n: number) => void;
}) {
  const [v, setV] = useState(String(valeur));
  useEffect(() => setV(String(valeur)), [valeur]);
  return (
    <TextInput
      value={v}
      onChangeText={(x) => setV(x.replace(/[^0-9]/g, ""))}
      onBlur={() => {
        const n = Number(v);
        if (Number.isFinite(n) && v !== "") onValider(n);
        else setV(String(valeur));
      }}
      keyboardType="number-pad"
      returnKeyType="done"
      style={[s.champCourt, { color: t.ink, backgroundColor: t.seg, borderColor: t.cb }]}
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
    <View style={{ paddingBottom: 14 }}>
      <View style={s.nuancierTitre}>
        <Text style={[s.libelle, { color: t.ink }]}>{titre}</Text>
        <Text style={[s.valeur, { color: t.i2 }]}>{nom}</Text>
      </View>
      <View style={s.nuancier}>
        {pastilles.map((hex) => {
          const actif = hex.toUpperCase() === courante.toUpperCase();
          return (
            <Pressable
              key={hex}
              onPress={() => onChoisir(hex)}
              accessibilityLabel={hex}
              style={[
                s.nuance,
                { backgroundColor: hex, borderColor: actif ? t.ink : t.cb, borderWidth: actif ? 3 : 1 },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  contenu: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 60 },
  retour: { flexDirection: "row", paddingBottom: 8 },
  titre: { fontSize: 34, fontWeight: "700", letterSpacing: -0.5, paddingHorizontal: 4 },
  sousTitre: { fontSize: 17, marginTop: 4, paddingHorizontal: 4 },
  centre: { paddingTop: 60, alignItems: "center" },
  erreur: { fontSize: 15, textAlign: "center", paddingTop: 24 },

  section: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  carte: { borderRadius: 24, borderWidth: 1, paddingHorizontal: 18 },
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
  },
  libelle: { fontSize: 17, fontWeight: "600" },
  aide: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  valeur: { fontSize: 17, flexShrink: 1 },
  chevron: { fontSize: 20 },
  unite: { fontSize: 15 },

  champ: {
    flex: 1,
    maxWidth: "55%",
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 17,
    textAlign: "right",
  },
  champCourt: {
    width: 62,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 17,
    textAlign: "center",
  },

  pastilles: { flexDirection: "row", gap: 6 },
  pastille: { width: 18, height: 18, borderRadius: 9, borderWidth: 1 },
  chasubles: { paddingTop: 6, paddingBottom: 8 },
  nuancierTitre: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 10 },
  nuancier: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  nuance: { width: 38, height: 38, borderRadius: 19 },
  apercu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingTop: 6,
    paddingBottom: 4,
  },
  apercuScore: { fontSize: 28, fontWeight: "800" },

  deplie: { paddingBottom: 12 },
  aideBloc: { fontSize: 13, lineHeight: 18, paddingTop: 10 },
  deuxBoutons: { gap: 10, paddingTop: 12 },
  grandBouton: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  petitBouton: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  membre: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  membreNom: { fontSize: 17, fontWeight: "600" },
  membreSous: { fontSize: 13, marginTop: 2 },
  capitaine: { fontSize: 15, fontWeight: "700" },
  actionsMembre: { flexDirection: "row", gap: 8 },

  saison: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saisonNom: { flexDirection: "row", alignItems: "center", gap: 8 },
  saisonTitre: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  saisonPeriode: { fontSize: 13, marginTop: 2 },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  saisie: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 17,
  },

  etat: { fontSize: 15, textAlign: "center", paddingTop: 22, minHeight: 22 },

  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  feuille: { borderTopWidth: 3, paddingHorizontal: 16, paddingTop: 8 },
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
