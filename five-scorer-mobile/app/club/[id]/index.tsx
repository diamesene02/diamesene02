import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Ecran from "../../../composants/Ecran";
import EnTeteClub from "../../../composants/EnTeteClub";
import ErreurChargement from "../../../composants/ErreurChargement";
import FeuilleCreer from "../../../composants/FeuilleCreer";
import { CarteVerre } from "../../../composants/base";
import { Bloc, CarteSquelette, Squelette } from "../../../composants/Squelette";
import { useSommet } from "../../../composants/RetourEnHaut";
import { nomCourt } from "../../../composants/MenuClub";
import { useNoyau } from "../../../composants/Noyau";
import { useClubId, useClubMemorise } from "../../../composants/ClubCourant";
import AnnonceSucces from "../../../composants/succes/AnnonceSucces";
import Banniere from "../../../composants/accueil/Banniere";
import BlocLancement from "../../../composants/accueil/BlocLancement";
import CarteMaSaison from "../../../composants/accueil/CarteMaSaison";
import CarteMatchs from "../../../composants/accueil/CarteMatchs";
import EnTeteRepliable, { SEUIL_REPLI } from "../../../composants/accueil/EnTeteRepliable";
import FilExploits from "../../../composants/accueil/FilExploits";
import { CarteRattrapage, Rappel } from "../../../composants/accueil/Rappel";
import Tableau from "../../../composants/accueil/Tableau";
import { lancerCompoPrete } from "../../../composants/accueil/lancer";
import { fermerBanniere, lireBannieresFermees } from "../../../composants/accueil/memoire";
import {
  aideBanniere,
  lancementPossible,
  ongletAffiche,
  quandRelatifDe,
  rappelCompo,
  titreBanniere,
  vueMatchs,
  type EnDirect,
  type Onglet,
} from "../../../composants/accueil/logique";
import { JETONS_NEUTRES, jeton, type Jetons } from "../../../lib/couleurs";
import { messageErreur } from "../../../lib/erreurs";
import { leger, succes as vibrerSucces } from "../../../lib/haptique";
import type { LocalMatch } from "../../../lib/outbox/types";
import { ESPACE_BARRE } from "../../../composants/BarreOnglets";
import {
  chargerSucces,
  chargerSuccesClub,
  type SuccesClub,
  type SuccesJoueur,
} from "../../../lib/succes";
import {
  chargerAccueil,
  SessionExpiree,
  terminerMatchServeur,
  type Accueil,
  type MatchAccueil,
} from "../../../lib/api";

/// L'accueil du club — la page d'accueil du site, bloc pour bloc et dans son
/// ordre : la bannière de la prochaine soirée, les rappels (la compo à faire,
/// le calendrier vide, le match resté sur ce téléphone), ce qu'il reste à
/// rattraper, la carte des matchs et le coup d'envoi, puis « Ma saison », le
/// tableau et les exploits du club. C'est l'ordre des questions qu'on se pose
/// en ouvrant l'app : est-ce que je viens lundi, où en est la soirée, où
/// j'en suis.
///
/// Un aller-retour pour l'accueil (`GET …/accueil`), deux pour les succès,
/// lancés EN MÊME TEMPS et jamais attendus : le classement de toute une
/// carrière se calcule plus lentement que le reste, et un calcul raté ne doit
/// pas coûter l'accueil. Les cartes de succès arrivent quand elles arrivent,
/// ou pas du tout.
///
/// Le club (couleurs, droits, mon profil) vient du dernier `/api/me`, que le
/// layout du club redemande à chaque retour : le redemander ici doublait
/// l'appel.

export default function ClubAccueil() {
  const id = useClubId();
  const club = useClubMemorise();
  const { local, drain } = useNoyau();

  const [donnees, setDonnees] = useState<Accueil | null>(null);
  const [succes, setSucces] = useState<SuccesJoueur | null>(null);
  const [succesClub, setSuccesClub] = useState<SuccesClub | null>(null);
  const [enCours, setEnCours] = useState<LocalMatch | null>(null);
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  // null tant qu'on n'a pas touché aux onglets : l'onglet ouvert se déduit
  // alors de ce qu'il y a à voir (logique.ts, `vueMatchs`).
  const [ongletChoisi, setOngletChoisi] = useState<Onglet | null>(null);
  // `null` tant que le fichier des bannières fermées n'est pas lu : afficher
  // la bannière en attendant la ferait clignoter à chaque ouverture chez
  // celui qui l'avait justement masquée.
  const [fermees, setFermees] = useState<string[] | null>(null);
  const [replie, setReplie] = useState(false);
  const replieRef = useRef(false);
  // L'écran reste monté derrière les autres (le layout est un `Tabs`) : le
  // chrono en direct s'arrête et l'annonce d'un succès attend qu'on revienne.
  const [focalise, setFocalise] = useState(false);
  const [creerOuvert, setCreerOuvert] = useState(false);
  const [lance, setLance] = useState(false);

  const t: Jetons = club?.theme.sombre ?? JETONS_NEUTRES;
  const couleurA = club?.couleurA ?? "#ffffff";
  const couleurB = club?.couleurB ?? "#111111";
  const chasubles = useMemo(() => ({ a: couleurA, b: couleurB }), [couleurA, couleurB]);

  // Un chargement plus récent rend caducs les précédents : au retour d'une
  // feuille, le tirer-pour-rafraîchir et le retour sur l'écran se croisent.
  const tour = useRef(0);
  const charger = useCallback(async () => {
    if (!id) return;
    const n = ++tour.current;
    const actuel = () => n === tour.current;
    // Les succès échoués gardent ce qu'on avait : une carte d'hier vaut mieux
    // qu'une carte qui disparaît parce que le réseau a hoqueté.
    const pSucces = chargerSucces(id).then(
      (r) => actuel() && setSucces("niveau" in r ? r : null),
      () => {},
    );
    const pClub = chargerSuccesClub(id).then(
      (r) => actuel() && setSuccesClub(r),
      () => {},
    );
    try {
      const a = await chargerAccueil(id);
      if (actuel()) {
        setDonnees(a);
        setErreur(null);
      }
    } catch (e) {
      if (!actuel()) return;
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      if (actuel()) setOccupe(false);
    }
    await Promise.all([pSucces, pClub]);
  }, [id]);

  const relireLocal = useCallback(async () => {
    if (!id) return;
    try {
      setEnCours((await local.getLiveMatchOfClub(id)) ?? null);
    } catch {
      setEnCours(null);
    }
  }, [id, local]);

  // Au retour d'une feuille, un match a pu se terminer, un score changer, un
  // succès tomber : on relit à chaque fois que l'écran reprend la main.
  useFocusEffect(
    useCallback(() => {
      setFocalise(true);
      void relireLocal();
      void charger();
      return () => setFocalise(false);
    }, [relireLocal, charger]),
  );

  useEffect(() => {
    void lireBannieresFermees().then(setFermees);
  }, []);

  // L'indicateur reste là tant que TOUT n'est pas revenu : c'est lui qui dit
  // que l'écran est à jour. Avant, il se refermait aussitôt.
  const rafraichir = useCallback(async () => {
    setRafraichit(true);
    try {
      await Promise.all([charger(), relireLocal()]);
    } finally {
      setRafraichit(false);
    }
  }, [charger, relireLocal]);

  const surDefilement = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const r = e.nativeEvent.contentOffset.y > SEUIL_REPLI;
    if (r !== replieRef.current) {
      replieRef.current = r;
      setReplie(r);
    }
  }, []);

  const vue = useMemo(() => (donnees ? vueMatchs(donnees) : null), [donnees]);
  const onglet = vue ? ongletAffiche(vue, ongletChoisi) : null;

  const soiree = donnees?.soiree && !donnees.soiree.annulee ? donnees.soiree : null;
  const enDirect = donnees?.enDirect ?? null;
  const peutScorer = !!club?.peutScorer;
  const monJoueurId = club?.monJoueur?.id ?? succes?.joueur.id ?? null;
  const classement = donnees?.classement ?? [];
  const monIndex = monJoueurId ? classement.findIndex((r) => r.playerId === monJoueurId) : -1;
  // Abonné : un joueur, pas une soirée. La route ne le dit qu'à travers ma
  // présence à la soirée de la bannière, quand elle vient de l'abonnement.
  const abonne = soiree?.maPresence?.viaAbonnement === true;
  const coup = donnees?.coupDEnvoi ?? null;

  // ── Où mènent les gestes ────────────────────────────────────────────────
  const ouvrirSoiree = (soireeId: string) =>
    router.push({ pathname: "/soiree/[id]", params: { id: soireeId, clubId: id } });
  const ouvrirRecap = (matchId: string) =>
    router.push({ pathname: "/recap/[id]", params: { id: matchId, clubId: id } });
  const ouvrirFeuille = (matchId: string) =>
    router.push({ pathname: "/match/[id]", params: { id: matchId } });
  const ouvrirJoueur = (playerId: string) =>
    router.push({ pathname: "/joueur/[id]", params: { id: playerId, clubId: id } });
  const ouvrirOnglet = (o: "stats" | "matchs" | "saison") =>
    router.navigate({ pathname: `/club/[id]/${o}`, params: { id } });

  /// La feuille ne s'ouvre que si le match est sur CE téléphone : elle ne lit
  /// que la base locale, et tournait sans fin sur un match lancé ailleurs.
  /// Sinon, le récap, que le serveur sait rendre.
  const estIci = async (matchId: string) =>
    enCours?.id === matchId || (await local.getLocalMatch(matchId).catch(() => null)) != null;

  const ouvrirMatch = async (m: MatchAccueil) => {
    if (m.statut === "LIVE" && (await estIci(m.id))) ouvrirFeuille(m.id);
    else ouvrirRecap(m.id);
  };

  /// « Terminer » une feuille restée ouverte. Sur ce téléphone, c'est la
  /// feuille locale qui siffle la fin (sa file porte peut-être des buts pas
  /// encore partis). Lancée ailleurs, on la ferme côté serveur, après avoir
  /// dit avec quel score.
  const terminer = async (d: EnDirect) => {
    if (await estIci(d.id)) return ouvrirFeuille(d.id);
    Alert.alert(
      "Terminer cette feuille ?",
      `${d.nomA} ${d.scoreA}–${d.scoreB} ${d.nomB}, ${d.jourLong.toLowerCase()}. Le match comptera avec ce score.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Voir le match", onPress: () => ouvrirRecap(d.id) },
        {
          text: "Terminer",
          onPress: async () => {
            try {
              await terminerMatchServeur(id, d.id);
              vibrerSucces();
              void charger();
            } catch (e) {
              Alert.alert("La feuille n'a pas pu être terminée", messageErreur(e));
            }
          },
        },
      ],
    );
  };

  const lancer = async () => {
    const c = coup;
    if (!c || lance) return;
    setLance(true);
    try {
      const matchId = await lancerCompoPrete(local, id, club, c);
      // Le match existe sur l'appareil : on part à la feuille sans attendre
      // le serveur, la file s'en charge.
      void drain.relancer();
      vibrerSucces();
      ouvrirFeuille(matchId);
    } catch (e) {
      Alert.alert("Le match n'a pas pu démarrer", messageErreur(e));
    } finally {
      setLance(false);
    }
  };

  const fermer = (soireeId: string) => {
    leger();
    setFermees((f) => [...(f ?? []), soireeId]);
    void fermerBanniere(soireeId);
  };

  // ── Ce qui s'affiche ────────────────────────────────────────────────────
  const rappel = rappelCompo(soiree, peutScorer);
  const feuilleOuverte = peutScorer && enDirect?.retro ? enDirect : null;
  const sansResultat = peutScorer ? (donnees?.sansResultat ?? []) : [];
  // Le match de ce téléphone que le serveur ne connaît pas encore (lancé
  // hors ligne, pas encore parti). Montré même sans réseau : c'est au
  // gymnase qu'on en a besoin.
  const matchLocal = enCours && enCours.id !== enDirect?.id ? enCours : null;
  // Pas de second coup d'envoi tant qu'un match de ce soir tourne, ici ou
  // ailleurs (la règle, et ses deux moitiés, vivent dans `lancementPossible`).
  // Sans réseau, on laisse « Lancer un match » : la compo sait travailler
  // hors ligne.
  const montrerLancement =
    peutScorer && lancementPossible(enDirect, enCours) && (donnees != null || erreur != null);
  // Le jour où l'on joue : une soirée aujourd'hui, ou rien au calendrier.
  const jourDeJeu = vue?.soireeCeSoir != null || soiree == null;
  // La compo de la soirée du jour, quand le coup d'envoi vient d'elle : la
  // route ne la rend pas ailleurs.
  const equipesDuJour =
    coup && coup.source === "preparee" && vue?.soireeCeSoir && coup.soireeId === vue.soireeCeSoir.id
      ? { nomA: coup.nomA, nomB: coup.nomB, compoA: coup.compoA, compoB: coup.compoB }
      : null;

  return (
    <Ecran t={t} chasubles={chasubles}>
      <ScrollView
        ref={useSommet("index")}
        contentContainerStyle={s.defile}
        onScroll={surDefilement}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={rafraichit}
            onRefresh={() => void rafraichir()}
            tintColor={jeton(t, "i2")}
          />
        }
      >
        <EnTeteClub t={t} club={club} marque />

        <View style={s.blocs}>
          {erreur != null && (
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} />
          )}

          {/* L'attente à la forme de l'accueil : la bannière de la soirée, la
              carte des matchs, le tableau. Un rond qui tournait au milieu du
              vide ne disait ni ce qui arrivait ni combien il en restait, et la
              page tombait ensuite d'un coup — 262 ms sur la machine de
              développement, plusieurs secondes au gymnase en 4G. */}
          {occupe && !donnees && erreur == null && (
            <Squelette etiquette="On va chercher le club" style={s.attente}>
              <CarteVerre t={t} rayon={24} style={s.sqBanniere}>
                <Bloc t={t} l="46%" h={13} />
                <Bloc t={t} l="78%" h={19} />
              </CarteVerre>
              <CarteVerre t={t} style={s.sqMatchs}>
                <Bloc t={t} l="38%" h={13} />
                <View style={s.sqScore}>
                  <Bloc t={t} l={54} h={54} r={16} />
                  <Bloc t={t} l={64} h={34} r={10} />
                  <Bloc t={t} l={54} h={54} r={16} />
                </View>
                <Bloc t={t} l="62%" h={13} />
              </CarteVerre>
              <CarteSquelette t={t} rangees={4} entete />
            </Squelette>
          )}

          {soiree && fermees != null && !fermees.includes(soiree.id) && (
            <Banniere
              t={t}
              couleurA={couleurA}
              titre={titreBanniere(soiree)}
              aide={aideBanniere(soiree)}
              onPress={() => ouvrirSoiree(soiree.id)}
              onFermer={() => fermer(soiree.id)}
            />
          )}

          {/* La compo se décide trois ou quatre jours avant, sur WhatsApp. Si
              elle n'est pas faite à cinq jours, c'est LA chose à faire — et
              le rappel mène à la soirée, où elle se prépare, pas au coup
              d'envoi. Montré à qui peut scorer : c'est le droit qui ouvre la
              compo sur l'écran soirée. */}
          {soiree && rappel && (
            <Rappel
              t={t}
              titre={rappel.titre}
              aide={rappel.aide}
              onPress={() => ouvrirSoiree(soiree.id)}
            />
          )}

          {/* Aucun calendrier : la cause racine de tout le reste. */}
          {donnees && !soiree && club?.peutGerer && (
            <Rappel
              t={t}
              titre="Aucune soirée au calendrier"
              aide="Pose la saison d'un coup — une soirée par semaine, fériés exclus"
              onPress={() => ouvrirOnglet("saison")}
            />
          )}

          {matchLocal && (
            <Rappel
              t={t}
              titre={`Match en cours sur ce téléphone — ${matchLocal.teamAName} ${matchLocal.scoreA} : ${matchLocal.scoreB} ${matchLocal.teamBName}`}
              aide="Reprendre là où tu en étais"
              onPress={() => ouvrirFeuille(matchLocal.id)}
            />
          )}

          {/* La feuille qu'on a oublié de fermer : le lendemain, elle n'était
              ni de ce soir ni terminée, n'apparaissait nulle part, et
              bloquait le coup d'envoi suivant. */}
          {feuilleOuverte && (
            <CarteRattrapage
              t={t}
              titre="Feuille restée ouverte"
              rangees={[
                {
                  cle: feuilleOuverte.id,
                  quand: `${quandRelatifDe(feuilleOuverte.joueLe) ?? feuilleOuverte.jourLong} · ${feuilleOuverte.scoreA}–${feuilleOuverte.scoreB}`,
                  acte: "Terminer",
                  onPress: () => void terminer(feuilleOuverte),
                },
              ]}
            />
          )}

          {/* Une soirée jouée sans feuille. S'il existe déjà un match de ce
              jour-là sans soirée, on propose de le RANGER — jamais une
              feuille vierge, qui ferait un doublon (spec 0007). */}
          {sansResultat.length > 0 && (
            <CarteRattrapage
              t={t}
              titre={
                sansResultat.length > 1
                  ? `${sansResultat.length} soirées sans résultat`
                  : "Une soirée sans résultat"
              }
              rangees={sansResultat.map((r) => ({
                cle: r.soireeId,
                quand: r.jourLong,
                acte: r.rangerMatchId ? "Ranger le match" : "Saisir la feuille",
                onPress: () =>
                  r.rangerMatchId
                    ? ouvrirRecap(r.rangerMatchId)
                    : router.push({
                        pathname: "/compo",
                        params: { clubId: id, quand: "deja", soireeId: r.soireeId, date: r.date },
                      }),
              }))}
            />
          )}

          {vue && donnees && (
            <CarteMatchs
              t={t}
              vue={vue}
              onglet={onglet}
              onOnglet={setOngletChoisi}
              couleurA={couleurA}
              couleurB={couleurB}
              clubCourt={donnees.clubCourt ?? nomCourt(club?.nom ?? "")}
              soiree={soiree}
              horlogeActive={focalise}
              clubId={id}
              monJoueurId={club?.monJoueur?.id ?? null}
              abonne={abonne}
              equipesDuJour={equipesDuJour}
              nomsEquipes={{ a: club?.nomChasubleA ?? "A", b: club?.nomChasubleB ?? "B" }}
              ouvrirSoiree={ouvrirSoiree}
              ouvrirMatch={(m) => void ouvrirMatch(m)}
              ouvrirRecap={ouvrirRecap}
              ouvrirMatchs={() => ouvrirOnglet("matchs")}
              onRepondu={() => void charger()}
            />
          )}

          {montrerLancement && (
            <BlocLancement
              t={t}
              indice={jourDeJeu ? (coup?.indice ?? null) : null}
              jourDeJeu={jourDeJeu}
              lance={lance}
              onCoupDEnvoi={() => void lancer()}
              onComposer={() => router.push({ pathname: "/compo", params: { clubId: id } })}
              onAutres={() => {
                leger();
                setCreerOuvert(true);
              }}
            />
          )}

          {/* Seulement pour qui a déjà joué : une carte « Recrue, 0 XP »
              ne raconte rien. */}
          {succes && succes.niveau.xp > 0 && (
            <CarteMaSaison
              t={t}
              succes={succes}
              classement={classement}
              monIndex={monIndex}
              evolution={
                monJoueurId ? (succesClub?.evolutions[monJoueurId] ?? succes.classement.evolution) : null
              }
              chasubles={chasubles}
              onVoir={() => ouvrirJoueur(succes.joueur.id)}
            />
          )}

          {classement.length > 0 && (
            <Tableau
              t={t}
              classement={classement}
              evolutions={succesClub?.evolutions ?? null}
              monJoueurId={monJoueurId}
              ouvrirJoueur={ouvrirJoueur}
              ouvrirStats={() => ouvrirOnglet("stats")}
            />
          )}

          {succesClub && succesClub.fil.length > 0 && (
            <FilExploits
              t={t}
              fil={succesClub.fil}
              classement={classement}
              chasubles={chasubles}
              ouvrirJoueur={ouvrirJoueur}
              ouvrirRecap={ouvrirRecap}
              ouvrirStats={() => ouvrirOnglet("stats")}
            />
          )}
        </View>
      </ScrollView>

      <EnTeteRepliable t={t} visible={replie} />

      {/* L'annonce d'un succès neuf, pour MON joueur seulement, et seulement
          quand l'accueil est à l'écran : chargé en arrière-plan, il
          s'ouvrirait par-dessus un autre écran. */}
      {succes && id ? (
        <AnnonceSucces
          t={t}
          clubId={id}
          joueurId={succes.joueur.id}
          deblocages={focalise ? succes.deblocages : null}
          chasubles={chasubles}
          onVoir={() => ouvrirJoueur(succes.joueur.id)}
        />
      ) : null}

      {id ? (
        <FeuilleCreer
          visible={creerOuvert}
          onClose={() => setCreerOuvert(false)}
          clubId={id}
          t={t}
          peutScorer={peutScorer}
          peutGerer={!!club?.peutGerer}
          lieu={soiree?.lieu ?? donnees?.aVenir?.soiree?.lieu ?? null}
        />
      ) : null}
    </Ecran>
  );
}

const s = StyleSheet.create({
  defile: { paddingBottom: ESPACE_BARRE },
  // Les marges du site : 14 sur les côtés, comme la barre du haut. En
  // hauteur, 16 de contenu puis 18 avant la première carte — sous une barre
  // qui prend 64, la bannière tombe à 98 de la zone du statut, la mesure du
  // site. Puis 18 entre chaque bloc.
  blocs: { paddingHorizontal: 14, paddingTop: 34, gap: 18 },
  attente: { gap: 18 },
  sqBanniere: { paddingHorizontal: 20, paddingVertical: 20, gap: 12 },
  sqMatchs: { paddingHorizontal: 20, paddingVertical: 22, gap: 18 },
  sqScore: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 },
});
