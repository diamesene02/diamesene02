import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { File, Paths } from "expo-file-system";
import { chargerMoiMemorise, useClubId, useClubMemorise } from "../../../composants/ClubCourant";
import Ecran from "../../../composants/Ecran";
import EnTeteClub from "../../../composants/EnTeteClub";
import ErreurChargement from "../../../composants/ErreurChargement";
import SelecteurSaison from "../../../composants/SelecteurSaison";
import { Avatar, CarteVerre, EcussonChasuble, Onglets } from "../../../composants/base";
import { Bloc, CarteSquelette, Squelette } from "../../../composants/Squelette";
import { useSommet } from "../../../composants/RetourEnHaut";
import { IconeBallonFin, IconePasse, IconeTrophee } from "../../../composants/Icones";
import SuccesDuClub, { type Visage } from "../../../composants/joueur/SuccesDuClub";
import { jeton, JETONS_NEUTRES, type Jetons } from "../../../lib/couleurs";
import { messageErreur } from "../../../lib/erreurs";
import { leger } from "../../../lib/haptique";
import { chargerSuccesClub, type SuccesClub } from "../../../lib/succes";
import { ESPACE_BARRE } from "../../../composants/BarreOnglets";
import {
  chargerExportCsv,
  chargerStats,
  SessionExpiree,
  type ClubDeMoi,
  type EcranStats,
} from "../../../lib/api";

/// « Stats » — le même écran que celui du site, dans le même ordre.
///
/// Une carte à trois onglets (le tableau, les buteurs, la forme), les succès
/// du club, le palmarès de la période, le derby, les gardiens, les records,
/// et le bilan contre les adversaires extérieurs quand il y en a.
///
/// Tout vient d'un seul `GET .../stats` : la page web en fait une quinzaine,
/// ce qui va très bien sur un serveur. Ici, chaque aller-retour se paie en
/// secondes — et l'écran doit s'afficher entier, pas carte par carte. Les
/// succès, eux, ont leur route à part et ne dépendent pas de la saison
/// choisie : on ne les recharge pas en changeant de saison, et leur absence
/// ne retient pas le reste de l'écran.
type Vue = "tableau" | "buteurs" | "forme";

const ONGLETS: { valeur: Vue; libelle: string }[] = [
  { valeur: "tableau", libelle: "Tableau" },
  { valeur: "buteurs", libelle: "Buteurs" },
  { valeur: "forme", libelle: "Forme" },
];

export default function Stats() {
  const id = useClubId();
  const memo = useClubMemorise();
  const [club, setClub] = useState<ClubDeMoi | null>(null);
  const [d, setD] = useState<EcranStats | null>(null);
  const [saison, setSaison] = useState<string | undefined>(undefined);
  const [vue, setVue] = useState<Vue>("tableau");
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const [succesClub, setSuccesClub] = useState<SuccesClub | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  const c = club ?? memo;
  const t: Jetons = c?.theme.sombre ?? JETONS_NEUTRES;
  const monId = c?.monJoueur?.id ?? null;

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);
    try {
      const [moi, r] = await Promise.all([chargerMoiMemorise(), chargerStats(id, saison)]);
      setClub(moi.clubs.find((x) => x.id === id) ?? null);
      setD(r);
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id, saison]);

  /// Les succès du club. Une seule requête : les raretés arrivent toutes
  /// faites dans `SuccesClub.raretes`. L'écran allait auparavant chercher les
  /// badges d'un joueur — les miens, sinon ceux du premier du classement —
  /// pour en déduire un repli, soit jusqu'à deux allers-retours de plus, qui
  /// recalculent chacun tout l'historique du club.
  const chargerLesSucces = useCallback(async () => {
    if (!id) return;
    try {
      setSuccesClub(await chargerSuccesClub(id));
    } catch {
      // Un serveur sans les succès, un hoquet : la carte ne s'affiche pas, le
      // reste de l'écran ne l'attend pas.
    }
  }, [id]);

  // Un match terminé pendant qu'on était ailleurs change tout le tableau. Le
  // premier passage compte aussi comme un retour : pas besoin d'un second
  // chargement au montage.
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );
  useFocusEffect(
    useCallback(() => {
      void chargerLesSucces();
    }, [chargerLesSucces]),
  );

  const rafraichir = useCallback(async () => {
    setRafraichit(true);
    await Promise.all([charger(), chargerLesSucces()]);
    setRafraichit(false);
  }, [charger, chargerLesSucces]);

  const couleurA = c?.couleurA ?? d?.chasubles.a ?? "#ffffff";
  const couleurB = c?.couleurB ?? d?.chasubles.b ?? "#111111";
  // Stable : `Ecran` le redescend au fond de match, qui est mémoïsé.
  const chasubles = useMemo(() => ({ a: couleurA, b: couleurB }), [couleurA, couleurB]);
  const vide = d != null && d.tableau.length === 0;
  /// Ma ligne ressort dans chaque liste, comme sur le site : le mardi, on
  /// ouvre les stats pour se trouver, pas pour lire le podium. Le filet
  /// au-dessus d'elle et celui d'en dessous s'effacent sous le surlignage.
  const filet = (liste: { playerId: string }[], i: number) =>
    i > 0 && liste[i].playerId !== monId && liste[i - 1].playerId !== monId
      ? { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }
      : null;

  /// Le visage de chacun, pris dans ce que l'écran a déjà : la route des
  /// succès n'envoie pas de photo.
  ///
  /// Mémoïsé : deux tableaux concaténés et une carte reconstruite à chaque
  /// rendu — donc à chaque changement d'onglet, de saison, de rafraîchissement
  /// —, alors que rien ne bouge tant que `d` ne bouge pas.
  const visages = useMemo(() => {
    const m = new Map<string, Visage>();
    for (const l of [...(d?.tableau ?? []), ...(d?.gardiens ?? [])]) {
      if (!m.has(l.playerId)) {
        m.set(l.playerId, { photo: l.photo, camp: l.camp, initiales: l.initiales });
      }
    }
    return m;
  }, [d]);

  const ouvrirFiche = (playerId: string) =>
    router.push({ pathname: "/joueur/[id]", params: { id: playerId, clubId: id } });
  const ouvrirMatch = (matchId: string) =>
    router.push({ pathname: "/recap/[id]", params: { id: matchId, clubId: id } });

  /// « Exporter en CSV », comme le site : le même fichier (séparateur « ; »,
  /// BOM pour Excel), posé dans le cache puis confié à la feuille de partage.
  /// Android ne partage pas un fichier par `Share` : on y envoie le texte.
  async function exporter() {
    if (!id || !d || exportEnCours) return;
    setExportEnCours(true);
    leger();
    try {
      const csv = await chargerExportCsv(id, "leaderboard", d.saisons.choisie);
      const titre = `Classement — ${d.saisons.choix.find((x) => x.id === d.saisons.choisie)?.libelle ?? "toutes saisons"}`;
      if (Platform.OS === "ios") {
        const f = new File(Paths.cache, "classement.csv");
        if (f.exists) f.delete();
        f.create();
        f.write(csv);
        await Share.share({ url: f.uri, title: titre });
      } else {
        await Share.share({ message: csv, title: titre });
      }
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      Alert.alert("L'export n'a pas marché", messageErreur(e));
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <Ecran t={t} chasubles={chasubles}>
      <ScrollView
        ref={useSommet("stats")}
        contentContainerStyle={s.contenu}
        refreshControl={
          <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={t.i2} />
        }
      >
        <EnTeteClub
          t={t}
          club={c}
          titre="Stats"
          droite={
            d ? (
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

        {/* Changer de saison ne disait RIEN : le tableau de l'ancienne saison
            restait à l'écran, intact, puis les chiffres changeaient tout seuls
            quelques centaines de millisecondes plus tard (plusieurs secondes
            au gymnase). On ne savait pas si le tap avait porté, et on le
            refaisait. Le tableau s'efface à moitié le temps du calcul — il
            reste lisible, mais il se déclare périmé. */}
        <View style={[s.corps, occupe && d ? s.corpsEnAttente : null]}>
          {/* Le squelette du tableau : les onglets, l'en-tête, huit lignes de
              joueur. C'est exactement ce qui va s'afficher, et le pouce n'a
              pas à retrouver sa ligne après un saut de page. */}
          {occupe && !d && (
            <Squelette etiquette="On compte les points">
              <View style={s.sqOnglets}>
                {[86, 74, 92].map((l, i) => (
                  <Bloc key={i} t={t} l={l} h={34} r={17} />
                ))}
              </View>
              <CarteSquelette t={t} rangees={8} hauteurRangee={46} entete style={s.sqCarte} />
            </Squelette>
          )}
          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} style={s.erreur} />
          )}

          {/* L'état vide est le SQUELETTE du tableau, avec des tirets à la place
              des chiffres : une feuille vierge doit se reconnaître vierge, elle
              ne se présente pas comme une erreur. */}
          {vide && (
            <Carte t={t} rembourrage={10} bas={10}>
              <Onglets t={t} onglets={ONGLETS} actif="tableau" onChange={() => {}} />
              <View style={s.sousOnglets}>
                <EnTeteTableau t={t} />
                {[0, 1, 2].map((i) => (
                  <View key={i} style={s.rangeeTableau}>
                    <Text style={[s.tRang, { color: t.i3 }]}>—</Text>
                    <View style={{ width: 30 }} />
                    <Text style={[s.tNom, { color: t.i3 }]}>—</Text>
                    <Text style={[s.tMj, { color: t.i3 }]}>—</Text>
                    <Text style={[s.tPetit, { color: t.i3 }]}>—</Text>
                    <Text style={[s.tPetit, { color: t.i3 }]}>—</Text>
                    <Text style={[s.tPetit, { color: t.i3 }]}>—</Text>
                    <Text style={[s.tMj, { color: t.i3 }]}>—</Text>
                    <Text style={[s.tPts, { color: t.i3 }]}>—</Text>
                  </View>
                ))}
                <Text style={[s.vide, { color: t.i2 }]}>
                  Aucun match terminé sur cette période.
                  {d?.droits.peutScorer ? " " : ""}
                  {d?.droits.peutScorer && (
                    <Text
                      style={[s.lien, { color: t.ink }]}
                      onPress={() => router.push({ pathname: "/compo", params: { clubId: id } })}
                      accessibilityRole="link"
                    >
                      Lancer le premier
                    </Text>
                  )}
                </Text>
              </View>
            </Carte>
          )}

          {d && !vide && (
            <>
              {/* 10 de marge intérieure et non 12 : quatre points de plus pour
                  le nom du joueur, la seule colonne qui puisse déborder. */}
              <Carte t={t} rembourrage={10} bas={10}>
                <Onglets t={t} onglets={ONGLETS} actif={vue} onChange={setVue} />

                <View style={s.sousOnglets}>
                  {vue === "tableau" && (
                    <View>
                      <EnTeteTableau t={t} />
                      {d.tableau.map((l, i) => {
                        const moi = l.playerId === monId;
                        return (
                          <Pressable
                            key={l.playerId}
                            onPress={() => ouvrirFiche(l.playerId)}
                            accessibilityRole="button"
                            accessibilityLabel={`${l.rang}e, ${l.nom}${moi ? ", toi" : ""}, ${l.points} points`}
                            style={({ pressed }) => [
                              s.rangeeTableau,
                              filet(d.tableau, i),
                              moi && [s.moi, { backgroundColor: jeton(t, "gl") }],
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Text style={[s.tRang, { color: t.ink }]}>{l.rang}</Text>
                            <Avatar
                              nom={l.nom}
                              photo={l.photo}
                              t={t}
                              taille={30}
                              corps={11}
                              camp={l.camp}
                              initiales={l.initiales}
                            />
                            <Text style={[s.tNom, { color: t.ink }]} numberOfLines={1}>
                              {l.nom}
                              {l.invite && <Text style={{ color: t.i3 }}> (inv.)</Text>}
                              {moi && <Toi t={t} />}
                            </Text>
                            <Text style={[s.tMj, { color: t.ink }]}>{l.matchs}</Text>
                            <Text style={[s.tPetit, { color: t.ink }]}>{l.victoires}</Text>
                            <Text style={[s.tPetit, { color: t.ink }]}>{l.nuls}</Text>
                            <Text style={[s.tPetit, { color: t.ink }]}>{l.defaites}</Text>
                            <Text style={[s.tMj, { color: t.ink }]}>{l.buts}</Text>
                            <Text style={[s.tPts, { color: t.ink }]}>{l.points}</Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        onPress={() => void exporter()}
                        disabled={exportEnCours}
                        accessibilityRole="button"
                        accessibilityState={{ busy: exportEnCours }}
                        style={({ pressed }) => [
                          s.pied,
                          { borderTopColor: jeton(t, "sep") },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        {exportEnCours ? (
                          <ActivityIndicator color={t.i2} />
                        ) : (
                          <Text style={[s.piedTexte, { color: t.i2 }]}>Exporter en CSV</Text>
                        )}
                      </Pressable>
                    </View>
                  )}

                  {vue === "buteurs" && (
                    <View>
                      {d.buteurs.map((b, i) => {
                        const moi = b.playerId === monId;
                        return (
                          <Pressable
                            key={b.playerId}
                            onPress={() => ouvrirFiche(b.playerId)}
                            accessibilityRole="button"
                            accessibilityLabel={`${b.rang}e, ${b.nom}${moi ? ", toi" : ""}, ${b.buts} but${b.buts > 1 ? "s" : ""}`}
                            style={({ pressed }) => [
                              s.rangee,
                              filet(d.buteurs, i),
                              moi && [s.moi, { backgroundColor: jeton(t, "gl") }],
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Text style={[s.bRang, { color: t.ink }]}>{b.rang}</Text>
                            <Avatar
                              nom={b.nom}
                              photo={b.photo}
                              t={t}
                              taille={30}
                              corps={11}
                              camp={b.camp}
                              initiales={b.initiales}
                            />
                            <View style={s.bBloc}>
                              <Text style={[s.nom, { color: t.ink }]} numberOfLines={1}>
                                {b.nom}
                                {moi && <Toi t={t} />}
                              </Text>
                              {/* La barre se lit par rapport au MEILLEUR buteur :
                                  ce qu'on veut voir, c'est l'écart au premier. */}
                              <View style={[s.barreFond, { backgroundColor: jeton(t, "sep") }]}>
                                <View
                                  style={[
                                    s.barrePleine,
                                    {
                                      width: `${Math.round(b.part * 100)}%`,
                                      backgroundColor: anneau(t, b.camp) ?? t.i3,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                            <Text style={[s.bButs, { color: t.ink }]}>{b.buts}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {vue === "forme" && (
                    <View>
                      {d.forme.map((f, i) => {
                        const moi = f.playerId === monId;
                        return (
                          <Pressable
                            key={f.playerId}
                            onPress={() => ouvrirFiche(f.playerId)}
                            accessibilityRole="button"
                            accessibilityLabel={`${f.nom}${moi ? ", toi" : ""}, série ${f.serie}`}
                            style={({ pressed }) => [
                              s.rangee,
                              { gap: 10 },
                              filet(d.forme, i),
                              moi && [s.moi, { backgroundColor: jeton(t, "gl") }],
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Avatar
                              nom={f.nom}
                              photo={f.photo}
                              t={t}
                              taille={30}
                              corps={11}
                              camp={f.camp}
                              initiales={f.initiales}
                            />
                            <Text style={[s.nom, { color: t.ink, flex: 1 }]} numberOfLines={1}>
                              {f.nom}
                              {moi && <Toi t={t} />}
                            </Text>
                            <Forme t={t} resultats={f.forme} />
                            <Text
                              style={[
                                s.serie,
                                { color: f.serie > 0 ? t.ok : f.serie < 0 ? t.bad : t.i3 },
                              ]}
                            >
                              {f.serie > 0 ? `+${f.serie}` : f.serie < 0 ? `−${Math.abs(f.serie)}` : "—"}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              </Carte>

              {d.palmares.titres.length > 0 && (
                <Carte t={t} titre={d.palmares.titre} rembourrage={20} titreHaut={22} titreBas={10} bas={8}>
                  {d.palmares.titres.map((ti, i) => (
                    <Pressable
                      key={ti.cle}
                      onPress={() => ouvrirFiche(ti.playerId)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        s.ligneTitre,
                        i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={s.icone}>
                        {ti.icone === "trophee" && <IconeTrophee couleur={jeton(t, "or")} />}
                        {ti.icone === "ballon" && <IconeBallonFin couleur={t.ink} />}
                        {ti.icone === "passe" && <IconePasse couleur={t.ink} />}
                      </View>
                      <Text style={[s.libelle, { color: t.ink }]} numberOfLines={1}>
                        {ti.libelle}
                      </Text>
                      <Text style={[s.laureat, { color: t.ink }]} numberOfLines={1}>
                        {ti.nom} ·{" "}
                        {ti.nombre != null && ti.unite ? (
                          <>
                            {ti.nombre}
                            <Text style={[s.unite, { color: t.i2 }]}> {ti.unite}</Text>
                          </>
                        ) : (
                          ti.valeur
                        )}
                      </Text>
                    </Pressable>
                  ))}
                </Carte>
              )}

              {d.saisonsPassees.length > 0 && (
                <Carte t={t} titre="Palmarès des saisons clôturées" rembourrage={20}>
                  {d.saisonsPassees.map((h, i) => (
                    <View
                      key={h.saison}
                      style={[
                        s.saisonClose,
                        i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
                      ]}
                    >
                      <Text style={[s.saisonNom, { color: t.ink }]}>{h.saison}</Text>
                      <Text style={[s.saisonLaureats, { color: t.i2 }]}>
                        {h.vide ? "Saison sans relief." : h.lignes.join("  ·  ")}
                      </Text>
                    </View>
                  ))}
                </Carte>
              )}

              {/* Les succès : le fil des exploits, les niveaux, les raretés —
                  entre les palmarès et le derby, comme sur le site. */}
              {succesClub && (
                <SuccesDuClub
                  t={t}
                  club={succesClub}
                  monId={monId}
                  visages={visages}
                  couleurA={couleurA}
                  chasubles={chasubles}
                  onFiche={ouvrirFiche}
                  onMatch={ouvrirMatch}
                  style={s.espace}
                />
              )}

              {d.derby && (
                <Carte t={t} titre={d.derby.titre} rembourrage={16} bas={14}>
                  <View style={s.derbyCamps}>
                    <CampDerby
                      t={t}
                      couleur={couleurA}
                      lettre={d.derby.lettreA}
                      nom={d.derby.nomA}
                      compte={d.derby.victoiresA}
                      mene={d.derby.mene === "A"}
                    />
                    <View style={s.derbyMilieu}>
                      <Text style={[s.derbyNuls, { color: t.i2 }]}>
                        {d.derby.nuls} nul{d.derby.nuls > 1 ? "s" : ""}
                      </Text>
                      <Text style={[s.derbyMatchs, { color: t.i3 }]}>
                        sur {d.derby.total} match{d.derby.total > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <CampDerby
                      t={t}
                      couleur={couleurB}
                      lettre={d.derby.lettreB}
                      nom={d.derby.nomB}
                      compte={d.derby.victoiresB}
                      mene={d.derby.mene === "B"}
                    />
                  </View>

                  {/* La jauge fait 6 px : les variantes redressées, sinon la
                      part de la chasuble noire se confond avec la carte et la
                      moitié du derby disparaît. */}
                  <View style={[s.jauge, { backgroundColor: jeton(t, "sep") }]}>
                    <View style={{ flexGrow: d.derby.victoiresA, flexBasis: 0, backgroundColor: t.taR }} />
                    <View style={{ flexGrow: d.derby.nuls, flexBasis: 0, backgroundColor: t.i3 }} />
                    <View style={{ flexGrow: d.derby.victoiresB, flexBasis: 0, backgroundColor: t.tbR }} />
                  </View>

                  <View style={{ marginTop: 12 }}>
                    <LigneDerby t={t} g={d.derby.butsA} l="Buts marqués" dr={d.derby.butsB} />
                    {(d.derby.soireesA > 0 || d.derby.soireesB > 0 || d.derby.soireesPartagees > 0) && (
                      <LigneDerby
                        t={t}
                        g={d.derby.soireesA}
                        l="Soirées gagnées"
                        note={
                          d.derby.soireesPartagees > 0
                            ? ` · ${d.derby.soireesPartagees} partagée${d.derby.soireesPartagees > 1 ? "s" : ""}`
                            : undefined
                        }
                        dr={d.derby.soireesB}
                      />
                    )}
                  </View>

                  {d.derby.serie && (
                    <Text style={[s.derbySerie, { color: t.i2 }]}>{d.derby.serie}</Text>
                  )}
                </Carte>
              )}

              {d.gardiens.length > 0 && (
                <Carte t={t} titre="Les gardiens" rembourrage={12} bas={6}>
                  <View style={s.gTete}>
                    <View style={{ width: 30 }} />
                    <Text style={[s.gNomTete, { color: t.i3 }]}>Gardien</Text>
                    {["MJ", "BE", "Moy.", "CS", "%V"].map((x, i) => (
                      <Text key={x} style={[colonneG(i), s.gTeteTexte, { color: t.i3 }]}>
                        {x}
                      </Text>
                    ))}
                  </View>
                  {d.gardiens.map((g, i) => {
                    const moi = g.playerId === monId;
                    return (
                      <Pressable
                        key={g.playerId}
                        onPress={() => ouvrirFiche(g.playerId)}
                        accessibilityRole="button"
                        accessibilityLabel={`${g.nom}${moi ? ", toi" : ""}, ${g.matchs} matchs, ${g.encaisses} buts encaissés`}
                        style={({ pressed }) => [
                          s.gRangee,
                          // La première rangée a son filet : elle suit l'en-tête.
                          (i === 0 && !moi) || filet(d.gardiens, i)
                            ? { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }
                            : null,
                          moi && [s.moi, { backgroundColor: jeton(t, "gl") }],
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        {/* Sans camp, comme le site : un gardien change de
                            chasuble chaque soir, l'anneau reste neutre. */}
                        <Avatar
                          nom={g.nom}
                          photo={g.photo}
                          t={t}
                          taille={30}
                          corps={11}
                          initiales={g.initiales}
                        />
                        <Text style={[s.gNom, { color: t.ink }]} numberOfLines={1}>
                          {g.nom}
                          {moi && <Toi t={t} />}
                        </Text>
                        <Text style={[colonneG(0), { color: t.ink }]}>{g.matchs}</Text>
                        <Text style={[colonneG(1), { color: t.ink }]}>{g.encaisses}</Text>
                        <Text style={[colonneG(2), { color: t.ink, fontWeight: "700" }]}>
                          {g.moyenne.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}
                        </Text>
                        <Text style={[colonneG(3), { color: t.ink }]}>{g.cleanSheets}</Text>
                        <Text style={[colonneG(4), { color: t.ink }]}>{g.pctVictoires}</Text>
                      </Pressable>
                    );
                  })}
                  <Text style={[s.legende, { color: t.i3, borderTopColor: jeton(t, "sep") }]}>
                    BE : buts encaissés · Moy. : par match · CS : matchs sans encaisser
                  </Text>
                </Carte>
              )}

              {d.records.lignes.length > 0 && (
                <Carte t={t} titre="Les records du club" rembourrage={16} bas={6}>
                  {d.records.lignes.map((r, i) => (
                    <Pressable
                      key={r.cle}
                      disabled={!r.cible}
                      accessibilityRole={r.cible ? "button" : undefined}
                      onPress={() => {
                        if (!r.cible) return;
                        if (r.cible.quoi === "match") ouvrirMatch(r.cible.id);
                        else if (r.cible.quoi === "soiree")
                          router.push({ pathname: "/soiree/[id]", params: { id: r.cible.id, clubId: id } });
                        else ouvrirFiche(r.cible.id);
                      }}
                      style={({ pressed }) => [
                        s.record,
                        i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      {r.avatar ? (
                        <Avatar
                          nom={r.avatar.nom}
                          photo={r.avatar.photo}
                          t={t}
                          taille={38}
                          initiales={r.avatar.initiales}
                        />
                      ) : (
                        <View
                          style={[s.pastille, { backgroundColor: jeton(t, "seg"), borderColor: jeton(t, "gb") }]}
                        />
                      )}
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={[s.recordTitre, { color: t.ink }]}>{r.titre}</Text>
                        <Text style={[s.recordContexte, { color: t.i2 }]} numberOfLines={1}>
                          {r.contexte}
                        </Text>
                      </View>
                      <Text style={[s.recordValeur, { color: t.ink }]}>{r.valeur}</Text>
                    </Pressable>
                  ))}
                  {d.records.jeunesse && (
                    <Text style={[s.recordJeune, { color: t.i3, borderTopColor: jeton(t, "sep") }]}>
                      {d.records.jeunesse}
                    </Text>
                  )}
                </Carte>
              )}

              {d.adversaires && (
                <Carte t={t} titre="Bilan vs adversaires" rembourrage={20} titreHaut={22} titreBas={10} bas={8}>
                  <Text style={[s.synthese, { color: t.ink }]}>
                    <Text style={s.gras}>{d.adversaires.matchs}</Text> match
                    {d.adversaires.matchs > 1 ? "s" : ""} ·{" "}
                    <Text style={s.gras}>{d.adversaires.victoires}</Text> V ·{" "}
                    <Text style={s.gras}>{d.adversaires.nuls}</Text> N ·{" "}
                    <Text style={s.gras}>{d.adversaires.defaites}</Text> D · {d.adversaires.butsPour}
                    <Text style={{ color: t.i3 }}>:</Text>
                    {d.adversaires.butsContre} · <Text style={s.gras}>{d.adversaires.points}</Text> pts
                  </Text>
                  {d.adversaires.forme.length > 0 && (
                    <View style={s.syntheseForme}>
                      <Forme t={t} resultats={d.adversaires.forme} />
                    </View>
                  )}
                  {d.adversaires.duels.map((o) => (
                    <View
                      key={o.id}
                      style={[s.duel, { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }]}
                    >
                      <Text style={[s.nom, { color: t.ink, flex: 1 }]} numberOfLines={1}>
                        {o.nom}
                      </Text>
                      <Text style={[s.duelBilan, { color: t.i2 }]}>
                        <Text style={[s.gras, { color: t.ink }]}>{o.victoires}</Text> V ·{" "}
                        <Text style={[s.gras, { color: t.ink }]}>{o.nuls}</Text> N ·{" "}
                        <Text style={[s.gras, { color: t.ink }]}>{o.defaites}</Text> D · {o.butsPour}:
                        {o.butsContre}
                      </Text>
                      <Text
                        style={[
                          s.duelDiff,
                          { color: o.diff > 0 ? t.ok : o.diff < 0 ? t.bad : t.i3 },
                        ]}
                      >
                        {o.diff > 0 ? `+${o.diff}` : o.diff < 0 ? `−${Math.abs(o.diff)}` : "="}
                      </Text>
                    </View>
                  ))}
                </Carte>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </Ecran>
  );
}

/// « · toi » après mon nom, en maigre : le surlignage dit où, le mot dit
/// qui — un lecteur d'écran n'a que le second.
function Toi({ t }: { t: Jetons }) {
  return <Text style={[s.toi, { color: jeton(t, "i2") }]}> · toi</Text>;
}

/// L'anneau d'un avatar : la variante REDRESSÉE de la chasuble (`taR`/`tbR`),
/// pas la couleur brute. Une chasuble noire peinte telle quelle disparaît sur
/// une carte sombre — la règle est celle de `lib/theme.ts`.
function anneau(t: Jetons, c: "A" | "B" | null): string | undefined {
  return c === "A" ? t.taR : c === "B" ? t.tbR : undefined;
}

/// Une carte de l'écran : le verre du site, et le titre centré de
/// `.carte-titre` (22/600). Les marges du bas diffèrent d'une carte à l'autre
/// sur le site (stats.css) ; on les reprend une à une.
function Carte({
  t,
  titre,
  rembourrage = 12,
  titreHaut = 20,
  titreBas = 12,
  bas = 10,
  style,
  children,
}: {
  t: Jetons;
  titre?: string;
  rembourrage?: number;
  titreHaut?: number;
  titreBas?: number;
  bas?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <CarteVerre t={t} style={[s.carte, { paddingHorizontal: rembourrage, paddingBottom: bas }, style]}>
      {titre ? (
        <Text
          style={[s.carteTitre, { color: t.ink, paddingTop: titreHaut, paddingBottom: titreBas }]}
          accessibilityRole="header"
        >
          {titre}
        </Text>
      ) : null}
      {children}
    </CarteVerre>
  );
}

function EnTeteTableau({ t }: { t: Jetons }) {
  return (
    <View style={[s.rangeeTableau, s.enTete, { borderBottomColor: jeton(t, "sep") }]}>
      <View style={{ width: 22 }} />
      <View style={{ width: 30 }} />
      <Text style={[s.tNom, s.enTeteTexte, { color: t.i2 }]}>Joueur</Text>
      <Text style={[s.tMj, s.enTeteTexte, { color: t.i2 }]}>MJ</Text>
      <Text style={[s.tPetit, s.enTeteTexte, { color: t.i2 }]}>V</Text>
      <Text style={[s.tPetit, s.enTeteTexte, { color: t.i2 }]}>N</Text>
      <Text style={[s.tPetit, s.enTeteTexte, { color: t.i2 }]}>D</Text>
      <Text style={[s.tMj, s.enTeteTexte, { color: t.i2 }]}>B</Text>
      <Text style={[s.tPts, s.enTeteTexte, { color: t.i2 }]}>PTS</Text>
    </View>
  );
}

/// Les cinq cases V / N / D, dans l'ordre du temps : la plus récente à droite,
/// là où l'œil finit — c'est de là que part la série.
function Forme({ t, resultats }: { t: Jetons; resultats: ("W" | "D" | "L")[] }) {
  if (resultats.length === 0) return <Text style={{ color: t.i3 }}>—</Text>;
  return (
    <View style={s.forme}>
      {resultats.map((r, i) => (
        <View
          key={i}
          style={[s.formeCase, { backgroundColor: r === "W" ? t.ok : r === "D" ? t.seg : t.bad }]}
        >
          <Text style={[s.formeLettre, { color: r === "W" ? "#04230d" : r === "D" ? t.ink : "#fff" }]}>
            {r === "W" ? "V" : r === "D" ? "N" : "D"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CampDerby({
  t,
  couleur,
  lettre,
  nom,
  compte,
  mene,
}: {
  t: Jetons;
  couleur: string;
  lettre: string;
  nom: string;
  compte: number;
  mene: boolean;
}) {
  return (
    <View style={s.derbyCamp}>
      <EcussonChasuble couleur={couleur} lettre={lettre} taille={44} />
      <Text style={[s.derbyNom, { color: t.i2 }]} numberOfLines={1}>
        {nom}
      </Text>
      <Text style={[s.derbyCompte, { color: mene ? t.ink : t.i2 }]}>{compte}</Text>
      <Text style={[s.derbyUnite, { color: t.i2 }]}>
        victoire{compte > 1 ? "s" : ""}
      </Text>
    </View>
  );
}

function LigneDerby({
  t,
  g,
  l,
  note,
  dr,
}: {
  t: Jetons;
  g: number;
  l: string;
  note?: string;
  dr: number;
}) {
  return (
    <View style={[s.derbyLigne, { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }]}>
      <Text style={[s.derbyG, { color: t.ink }]}>{g}</Text>
      <Text style={[s.derbyL, { color: t.i2 }]} numberOfLines={1}>
        {l}
        {note && <Text style={{ color: t.i3 }}>{note}</Text>}
      </Text>
      <Text style={[s.derbyD, { color: t.ink }]}>{dr}</Text>
    </View>
  );
}

/// Les cinq colonnes de chiffres des gardiens : 26/26/34/26/30, alignées à
/// droite comme sur le site.
const LARGEURS_G = [26, 26, 34, 26, 30];
const colonneG = (i: number): TextStyle => ({
  width: LARGEURS_G[i],
  fontSize: 15,
  textAlign: "right",
  // La chasse tabulaire : « 1,8 » et « 0,4 » se posent l'un sous l'autre à la
  // virgule près, sinon la colonne des moyennes ondule.
  fontVariant: ["tabular-nums"],
});

const s = StyleSheet.create({
  contenu: { paddingBottom: ESPACE_BARRE },
  corps: { paddingHorizontal: 14 },
  // Assez effacé pour qu'on voie que ces chiffres ne sont plus les bons,
  // assez lisible pour qu'on continue de les lire.
  corpsEnAttente: { opacity: 0.45 },

  sqOnglets: { flexDirection: "row", gap: 8, paddingTop: 18 },
  sqCarte: { marginTop: 14 },
  erreur: { marginTop: 24 },
  vide: { fontSize: 17, paddingTop: 12, paddingBottom: 14, lineHeight: 23 },
  lien: { fontWeight: "600", textDecorationLine: "underline" },

  carte: { marginTop: 18 },
  espace: { marginTop: 18 },
  carteTitre: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3, textAlign: "center" },
  sousOnglets: { paddingTop: 12 },

  // Ma ligne : le verre des pilules (`.stats-rangee.moi` du site).
  moi: { borderRadius: 14 },
  toi: { fontWeight: "400" },
  gras: { fontWeight: "700" },

  // Les neuf colonnes : 22/30/1fr/28/24/24/24/28/38.
  //
  // Resserrées de 18 points par rapport au portage d'origine, et ce n'est pas
  // du grignotage : sur le téléphone d'Ibrahima, « Compte de dev » s'affichait
  // « Compte d… » parce que les huit colonnes de chiffres prenaient tout. Les
  // chiffres, eux, ne perdent rien — en CHASSE TABULAIRE (`tabular-nums`), un
  // « 1 » occupe exactement la place d'un « 8 », donc « 12 » tient dans 24
  // points là où la chasse proportionnelle demandait 26 « au cas où ».
  //
  // C'est aussi ce qui fait qu'une colonne se lit en descendant : sans elle,
  // le jour où un joueur passe à 10 matchs, toute la colonne se décale.
  rangeeTableau: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: 6,
  },
  // L'entête n'est pas une rangée de plus : 13/600, espacée, et posée sur un
  // filet. On doit voir d'un coup d'œil où commencent les données.
  enTete: { height: undefined, paddingBottom: 8, borderBottomWidth: 1 },
  enTeteTexte: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  tRang: { width: 22, fontSize: 15, fontVariant: ["tabular-nums"] },
  tNom: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "500", paddingLeft: 10 },
  tMj: { width: 28, fontSize: 17, textAlign: "center", fontVariant: ["tabular-nums"] },
  tPetit: { width: 24, fontSize: 17, textAlign: "center", fontVariant: ["tabular-nums"] },
  tPts: {
    width: 38,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  pied: {
    marginTop: 4,
    paddingTop: 14,
    paddingBottom: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
  },
  // Une action secondaire : elle s'efface (15/600) au lieu de peser autant
  // qu'un nom de joueur.
  piedTexte: { fontSize: 15, fontWeight: "600" },

  rangee: { flexDirection: "row", alignItems: "center", height: 54, paddingHorizontal: 6 },
  nom: { fontSize: 17, fontWeight: "500" },
  bRang: { width: 22, fontSize: 15, fontVariant: ["tabular-nums"] },
  bBloc: { flex: 1, minWidth: 0, paddingLeft: 10, paddingRight: 12, gap: 6 },
  barreFond: { height: 4, borderRadius: 2, overflow: "hidden" },
  barrePleine: { height: 4, borderRadius: 2 },
  bButs: { width: 44, fontSize: 22, fontWeight: "700", textAlign: "right", fontVariant: ["tabular-nums"] },

  forme: { flexDirection: "row", gap: 5 },
  formeCase: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  formeLettre: { fontSize: 12, fontWeight: "700" },
  serie: { width: 44, fontSize: 17, fontWeight: "600", textAlign: "right", fontVariant: ["tabular-nums"] },

  ligneTitre: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingVertical: 8 },
  icone: { width: 26, alignItems: "center", justifyContent: "center" },
  libelle: { flex: 1, minWidth: 0, fontSize: 17 },
  // Pas de `maxWidth` fixe : « Meilleur buteur » et « Jean-Baptiste · 14 buts »
  // se partagent la ligne au prorata de ce qu'ils demandent. Un plafond à 55 %
  // coupait le lauréat alors que le libellé, plus court, laissait de la place.
  // Le plafond reste (sinon un lauréat très long réduirait le libellé à rien,
  // sa base de flex valant zéro), mais il passe de 55 % à 62 % : « Jean-
  // Baptiste · 14 buts » tient, « Meilleur buteur » aussi.
  laureat: { fontSize: 17, fontWeight: "600", flexShrink: 1, maxWidth: "62%", textAlign: "right" },
  unite: { fontWeight: "400" },

  saisonClose: { paddingVertical: 14, gap: 4 },
  saisonNom: { fontSize: 17, fontWeight: "600" },
  saisonLaureats: { fontSize: 15, lineHeight: 21 },

  derbyCamps: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 2 },
  derbyCamp: { flex: 1, alignItems: "center", gap: 3, minWidth: 0 },
  derbyNom: { fontSize: 15, fontWeight: "600", maxWidth: "100%" },
  derbyCompte: { fontSize: 40, fontWeight: "800", letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
  derbyUnite: { fontSize: 13 },
  derbyMilieu: { alignItems: "center", gap: 2, paddingTop: 46 },
  derbyNuls: { fontSize: 15, fontWeight: "600" },
  derbyMatchs: { fontSize: 13 },
  jauge: {
    flexDirection: "row",
    height: 6,
    marginTop: 14,
    marginHorizontal: 2,
    borderRadius: 3,
    overflow: "hidden",
  },
  derbyLigne: { flexDirection: "row", alignItems: "center", minHeight: 42 },
  derbyG: { width: 44, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  derbyL: { flex: 1, fontSize: 15, textAlign: "center" },
  derbyD: { width: 44, fontSize: 15, fontWeight: "700", textAlign: "right", fontVariant: ["tabular-nums"] },
  derbySerie: { paddingTop: 12, textAlign: "center", fontSize: 13 },

  gTete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 8,
  },
  // Même tier d'entête que le tableau : 13/600 espacé, pour qu'on lise « une
  // légende de colonne » et pas « une donnée de plus ».
  gTeteTexte: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  gRangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 4,
  },
  gNomTete: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  gNom: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600" },
  legende: {
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    fontSize: 13,
  },

  record: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingVertical: 8 },
  pastille: { width: 38, height: 38, borderRadius: 19, borderWidth: 1 },
  recordTitre: { fontSize: 15, fontWeight: "600" },
  recordContexte: { fontSize: 13 },
  recordValeur: { fontSize: 19, fontWeight: "700", fontVariant: ["tabular-nums"] },
  recordJeune: {
    paddingTop: 10,
    paddingBottom: 12,
    textAlign: "center",
    fontSize: 13,
    borderTopWidth: 1,
  },

  synthese: { fontSize: 17, textAlign: "center", paddingTop: 4, paddingBottom: 14, fontVariant: ["tabular-nums"] },
  syntheseForme: { alignItems: "center", paddingBottom: 14 },
  duel: { flexDirection: "row", alignItems: "center", gap: 12, height: 54 },
  duelBilan: { fontSize: 15, fontVariant: ["tabular-nums"] },
  duelDiff: { width: 44, fontSize: 17, fontWeight: "600", textAlign: "right", fontVariant: ["tabular-nums"] },
});
