import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Ecran from "../../composants/Ecran";
import { BoutonPlein, BoutonRond, BoutonVerre, CarteVerre, Poignee, Segment } from "../../composants/base";
import { CHEMINS, IconeJeu, IconeTrait } from "../../composants/Icones";
import ErreurChargement from "../../composants/ErreurChargement";
import { Bloc, Squelette } from "../../composants/Squelette";
import AnnonceSucces from "../../composants/succes/AnnonceSucces";
import { chargerMoiMemorise, useClubMemorise } from "../../composants/ClubCourant";
import { useNoyau } from "../../composants/Noyau";
import Convocation from "../../composants/match/Convocation";
import DebloquesDuMatch from "../../composants/match/DebloquesDuMatch";
import {
  BlocScore,
  Buteurs,
  Equipes,
  MiniScore,
  type EtatMarque,
} from "../../composants/match/Marque";
import VoteHommeDuMatch from "../../composants/match/VoteHommeDuMatch";
import {
  CarteChrono,
  CarteFeuille,
  CarteHommeDuMatch,
  CarteStats,
} from "../../composants/match/VuesRecap";
import { rejouerDepuisLeRecap } from "../../composants/match/rejouer";
import { texteDuPartage } from "../../composants/match/textes";
import { JETONS_NEUTRES, jeton, jetonsDuClub, type Jetons } from "../../lib/couleurs";
import { messageErreur } from "../../lib/erreurs";
import { leger, succes as vibrerSucces } from "../../lib/haptique";
import { toucheFranche } from "../../lib/vibrer";
import { chargerSuccesMatch, type DeblocageJoueur } from "../../lib/succes";
import {
  API,
  PROD,
  chargerFicheMatch,
  rangerDansSoiree,
  retablirMatch,
  retirerMatch,
  SessionExpiree,
  type FicheMatch,
} from "../../lib/api";

/// Le récap d'un match — la feuille refermée, sur le fond de match du site.
///
/// Le score en grand, les écussons et les buteurs, puis trois vues qu'on
/// bascule : les statistiques, la chronologie, la feuille. Dessous, ce qu'on
/// fait d'un match fini : le partager, rejouer, voter pour l'homme du match.
///
/// Écran distinct de `/match/[id]`, comme sur le site : la feuille en direct
/// lit la base LOCALE du téléphone (elle doit marcher sans réseau au bord du
/// terrain), le récap lit le serveur — un match d'il y a trois semaines n'est
/// pas sur l'appareil.
///
/// Il sert aussi à SUIVRE un match en direct tenu sur un autre téléphone :
/// le score se relit toutes les dix secondes tant que l'écran est affiché.
/// Et, pour un match programmé, à répondre à la convocation.
type Vue = "stats" | "chrono" | "feuille";

/// Dix secondes : assez pour suivre un match de five (un but toutes les
/// deux minutes), sans tenir la radio du téléphone éveillée en continu.
const SUIVI_MS = 10_000;

/// Le défilement au-delà duquel le score se replie dans la barre du haut
/// (le seuil du site).
const REPLI_Y = 300;

/// La fiche d'un match, et le club qui la porte.
///
/// Le club vient de l'appelant ; à défaut (un lien, un vieil écran qui ne le
/// passait pas), on le cherche parmi les clubs de l'utilisateur — le premier
/// qui connaît ce match. Prendre d'office le premier club, c'était un 404
/// pour qui est dans deux clubs.
async function chargerLaFiche(
  matchId: string,
  clubId: string | undefined,
): Promise<{ cid: string; fiche: FicheMatch }> {
  if (clubId) return { cid: clubId, fiche: await chargerFicheMatch(clubId, matchId) };
  const moi = await chargerMoiMemorise();
  let derniere: unknown = new Error("Aucun club.");
  for (const c of moi.clubs) {
    try {
      return { cid: c.id, fiche: await chargerFicheMatch(c.id, matchId) };
    } catch (e) {
      if (e instanceof SessionExpiree) throw e;
      derniere = e;
    }
  }
  throw derniere;
}

export default function Recap() {
  // `fin` : on arrive de « Terminer ». C'est le seul moment où l'on annonce
  // les succès du match — la relecture d'un vieux récap n'annonce rien.
  //
  // Les paramètres de CETTE route, pas ceux de la route au premier plan : la
  // fiche d'un joueur ouverte par-dessus porte aussi un `id`.
  const { id, clubId, fin } = useLocalSearchParams<{ id: string; clubId?: string; fin?: string }>();
  const { local, drain } = useNoyau();

  const [fiche, setFiche] = useState<FicheMatch | null>(null);
  const [cid, setCid] = useState<string | null>(clubId ?? null);
  const [vue, setVue] = useState<Vue>("stats");
  const [occupe, setOccupe] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const [actionErreur, setActionErreur] = useState<string | null>(null);
  const [retrait, setRetrait] = useState(false);
  const [retablissement, setRetablissement] = useState(false);
  const [lancement, setLancement] = useState(false);
  const [rangement, setRangement] = useState(false);
  const [deblocages, setDeblocages] = useState<DeblocageJoueur[] | null>(null);
  const [majA, setMajA] = useState<Date | null>(null);
  // Ce téléphone tient-il la feuille de ce match ? Alors on la reprend au
  // lieu de la suivre.
  const [feuilleIci, setFeuilleIci] = useState(false);

  const club = useClubMemorise(cid);

  const charger = useCallback(async () => {
    if (!id) return;
    try {
      const r = await chargerLaFiche(id, clubId);
      setCid(r.cid);
      setFiche(r.fiche);
      setErreur(null);
      setMajA(new Date());
      if (r.fiche.statut === "TERMINE") {
        // Les succès sont un plus : leur échec ne touche pas au récap.
        chargerSuccesMatch(r.cid, id)
          .then((x) => setDeblocages(x.deblocages))
          .catch(() => {});
      }
    } catch (e) {
      if (e instanceof SessionExpiree) return router.replace("/connexion");
      setErreur(e);
    } finally {
      setOccupe(false);
    }
  }, [id, clubId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // La pilule et l'annonce ont besoin du club tel que `/api/me` le décrit
  // (son slug, mon joueur). Sans l'avoir en mémoire, on le demande une fois.
  useEffect(() => {
    if (cid && !club) chargerMoiMemorise().catch(() => {});
  }, [cid, club]);

  const statut = fiche?.statut;
  useFocusEffect(
    useCallback(() => {
      if (statut !== "EN_DIRECT") return;
      const h = setInterval(() => void charger(), SUIVI_MS);
      return () => clearInterval(h);
    }, [statut, charger]),
  );

  useEffect(() => {
    if (statut !== "EN_DIRECT" || !id) return;
    let vivant = true;
    void local.getLocalMatch(id).then((v) => {
      if (vivant) setFeuilleIci(v?.match.status === "LIVE");
    });
    return () => {
      vivant = false;
    };
  }, [statut, id, local]);

  async function rafraichir() {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }

  // --- L'en-tête qui se replie ---------------------------------------------
  const replie = useRef(new Animated.Value(0)).current;
  const estReplie = useRef(false);
  function surDefilement(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const bas = e.nativeEvent.contentOffset.y > REPLI_Y;
    if (bas === estReplie.current) return;
    estReplie.current = bas;
    Animated.timing(replie, { toValue: bas ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }

  // --- Les gestes ----------------------------------------------------------

  function retour() {
    if (router.canGoBack()) router.back();
    else if (cid) router.replace({ pathname: "/club/[id]", params: { id: cid } });
    else router.replace("/clubs");
  }

  /// Le texte qu'on colle dans le groupe WhatsApp, avec le lien public du
  /// récap. Pas d'image : la carte du site passe par une capture d'écran
  /// native que l'app installée n'embarque pas.
  async function partager() {
    if (!fiche) return;
    leger();
    const message = texteDuPartage(
      {
        scoreA: fiche.scoreA,
        scoreB: fiche.scoreB,
        enDirect: fiche.statut === "EN_DIRECT",
        legende: fiche.contexte ?? fiche.dateLongue,
        camps: fiche.camps,
        homme: fiche.homme?.nom ?? null,
      },
      `${PROD}/r/${fiche.id}`,
    );
    await Share.share({ message }).catch(() => {});
  }

  /// Corriger, modifier les infos, lancer un match programmé : ces écrans
  /// d'administration n'existent que sur le site. On l'ouvre dans le
  /// navigateur de l'app, puis on relit la fiche en revenant.
  async function ouvrirSite(chemin: (slug: string) => string) {
    setActionErreur(null);
    try {
      const slug =
        club?.slug ??
        (await chargerMoiMemorise()).clubs.find((c) => c.id === cid)?.slug;
      if (!slug) throw new Error("Club introuvable.");
      await WebBrowser.openBrowserAsync(API + chemin(slug));
      void charger();
    } catch (e) {
      setActionErreur(messageErreur(e));
    }
  }

  async function rejouer() {
    if (!fiche?.rejouer || !cid || lancement) return;
    setLancement(true);
    setActionErreur(null);
    try {
      const nouveau = await rejouerDepuisLeRecap({ local, drain }, cid, fiche.rejouer);
      toucheFranche();
      router.replace({ pathname: "/match/[id]", params: { id: nouveau } });
    } catch (e) {
      setLancement(false);
      setActionErreur(messageErreur(e));
    }
  }

  async function ranger() {
    if (!fiche?.soireeARanger || !cid) return;
    setRangement(true);
    setActionErreur(null);
    try {
      await rangerDansSoiree(cid, fiche.id, fiche.soireeARanger.id);
      vibrerSucces();
      await charger();
    } catch (e) {
      setActionErreur(messageErreur(e));
    } finally {
      setRangement(false);
    }
  }

  /// « Supprimer » — même geste que le site (spec 0006). On ne sait pas à
  /// l'avance ce qui va se passer : un match sans rien dessus s'efface pour
  /// de vrai, un match joué reste, marqué annulé. Le message le dit tel
  /// quel plutôt que de deviner (article V).
  function confirmerRetrait() {
    if (!fiche || !cid) return;
    Alert.alert(
      "Supprimer ce match ?",
      "S'il n'y a rien dessus, il part pour de vrai. S'il y a des buts ou une compo, il reste, marqué annulé.",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui",
          style: "destructive",
          onPress: () => {
            setRetrait(true);
            setActionErreur(null);
            void retirerMatch(cid, fiche.id)
              .then((res) => {
                if (res.geste === "supprime") {
                  retour();
                } else {
                  setRetrait(false);
                  void charger();
                }
              })
              .catch((e: unknown) => {
                setRetrait(false);
                setActionErreur(messageErreur(e));
              });
          },
        },
      ],
    );
  }

  /// « Rétablir » un match annulé (spec 0001, Q8) — le geste inverse de
  /// « Supprimer », sans confirmation : rien à perdre ici, le serveur repasse
  /// juste le match en terminé et efface la trace de l'annulation.
  function retablir() {
    if (!fiche || !cid) return;
    setRetablissement(true);
    setActionErreur(null);
    void retablirMatch(cid, fiche.id)
      .then(() => {
        setRetablissement(false);
        void charger();
      })
      .catch((e: unknown) => {
        setRetablissement(false);
        setActionErreur(messageErreur(e));
      });
  }

  // --- Le dessin -----------------------------------------------------------

  const couleurA = fiche?.chasubles.a ?? club?.couleurA ?? "#ffffff";
  const couleurB = fiche?.chasubles.b ?? club?.couleurB ?? "#111111";
  const couleurs: [string, string] = [couleurA, couleurB];
  const t: Jetons = fiche
    ? jetonsDuClub(couleurA, couleurB, "dark")
    : (club?.theme.sombre ?? JETONS_NEUTRES);
  const a = fiche?.camps[0];
  const b = fiche?.camps[1];
  const programme = fiche?.statut === "PROGRAMME";
  const etat: EtatMarque =
    fiche?.statut === "ANNULE" ? "ANNULE" : fiche?.statut === "EN_DIRECT" ? "EN_DIRECT" : "TERMINE";
  const peutPartager = !!fiche && !programme && fiche.statut !== "ANNULE";

  const monJoueurId = club?.monJoueur?.id ?? null;
  const mesDeblocages = useMemo(
    () => (deblocages && monJoueurId ? deblocages.filter((d) => d.playerId === monJoueurId) : null),
    [deblocages, monJoueurId],
  );

  const ouvrirJoueur = (playerId: string) =>
    router.push({ pathname: "/joueur/[id]", params: { id: playerId, clubId: cid ?? "" } });

  // Le vote n'a pas lieu d'être quand le capitaine a tranché : chaque tap
  // serait refusé. La carte de l'homme du match le dit déjà.
  const voteOuvert =
    !!fiche?.vote && !fiche.homme?.designeParCapitaine && fiche.vote.candidats.length > 0;

  return (
    <Ecran t={t} fond="match" chasubles={{ a: couleurA, b: couleurB }}>
      <Poignee />
      <View style={s.barre}>
        <BoutonRond t={t} symbole="‹" etiquette="Retour" onPress={retour} />
        <View style={s.centreBarre}>
          <Animated.Text
            style={[
              s.legende,
              { opacity: replie.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
            ]}
            numberOfLines={1}
          >
            {fiche?.contexte ?? fiche?.dateLongue ?? ""}
          </Animated.Text>
          {fiche && a && b && !programme && (
            <Animated.View
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[StyleSheet.absoluteFill, { opacity: replie }]}
            >
              <MiniScore
                scoreA={fiche.scoreA}
                scoreB={fiche.scoreB}
                lettres={[a.lettre, b.lettre]}
                couleurs={couleurs}
                etat={etat}
                date={fiche.dateCourte}
              />
            </Animated.View>
          )}
        </View>
        {peutPartager ? (
          <BoutonRond
            t={t}
            icone={<IconeTrait d={CHEMINS.partager} couleur={t.ink ?? "#fff"} taille={22} />}
            etiquette="Partager le récap"
            onPress={() => void partager()}
          />
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>
      <Animated.View style={[s.filetBarre, { opacity: replie }]} />

      <ScrollView
        contentContainerStyle={s.contenu}
        onScroll={surDefilement}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl refreshing={rafraichit} onRefresh={() => void rafraichir()} tintColor={t.i2} />
        }
      >
        {occupe && !fiche && <SqueletteRecap t={t} />}
        {erreur != null && !fiche && (
          <View style={s.bas}>
            <ErreurChargement t={t} erreur={erreur} onReessayer={charger} />
          </View>
        )}

        {fiche && programme && fiche.convocation && cid && (
          <View style={s.bas}>
            <Convocation
              t={t}
              clubId={cid}
              matchId={fiche.id}
              nomA={fiche.camps[0]?.nom ?? "A"}
              nomB={fiche.camps[1]?.nom ?? "B"}
              saison={fiche.saison?.nom ?? null}
              convocation={fiche.convocation}
              peutLancer={fiche.droits.peutSaisir}
              onLancer={() =>
                void ouvrirSite((slug) => `/c/${slug}/matches/new?scheduled=${fiche.id}`)
              }
              onChange={() => void charger()}
            />
            {actionErreur ? <Text style={s.erreur}>{actionErreur}</Text> : null}
          </View>
        )}

        {fiche && !programme && a && b && (
          <>
            <BlocScore scoreA={fiche.scoreA} scoreB={fiche.scoreB} etat={etat} date={fiche.dateCourte} />
            <Equipes camps={[a, b]} couleurs={couleurs} />
            <Buteurs a={a.buteurs} b={b.buteurs} />
            {/* « Corrigé le 22 sept. par Untel » : une mention de registre, pas
                un titre. Elle ouvrait l'affiche, au-dessus du score, et c'est
                la première chose qu'on lisait d'un match. Elle passe SOUS les
                buteurs, en légende — l'affiche commence par le score. */}
            {fiche.corrige && <Text style={s.corrige}>{fiche.corrige}</Text>}

            <View style={s.bas}>
              {erreur != null && <ErreurChargement t={t} erreur={erreur} onReessayer={charger} />}

              {fiche.statut === "EN_DIRECT" &&
                (feuilleIci ? (
                  <BoutonPlein
                    t={t}
                    titre="Reprendre la feuille"
                    onPress={() => router.replace({ pathname: "/match/[id]", params: { id: fiche.id } })}
                  />
                ) : (
                  <Text style={[s.suivi, { color: t.i2 }]}>
                    Ce match se joue sur un autre téléphone : le score se met à jour tout seul.
                    {majA
                      ? ` Vu à ${majA.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`
                      : ""}
                  </Text>
                ))}

              <Segment
                t={t}
                variante="grand"
                valeur={vue}
                onChange={(v) => {
                  leger();
                  setVue(v);
                }}
                choix={[
                  { valeur: "stats", libelle: "Statistiques" },
                  { valeur: "chrono", libelle: "Chronologie" },
                  { valeur: "feuille", libelle: "Feuille" },
                ]}
              />

              {fiche.homme && (
                <View style={{ marginTop: 4 }}>
                  <CarteHommeDuMatch
                    t={t}
                    homme={fiche.homme}
                    onPress={() => ouvrirJoueur(fiche.homme!.playerId)}
                  />
                </View>
              )}

              {vue === "stats" && (
                <CarteStats t={t} statistiques={fiche.statistiques} couleurs={couleurs} />
              )}
              {vue === "chrono" && (
                <CarteChrono t={t} chronologie={fiche.chronologie} couleurs={couleurs} />
              )}
              {vue === "feuille" && <CarteFeuille t={t} fiche={fiche} couleurs={couleurs} />}

              {deblocages && (
                <DebloquesDuMatch
                  t={t}
                  deblocages={deblocages}
                  chasubles={{ a: couleurA, b: couleurB }}
                  onJoueur={ouvrirJoueur}
                />
              )}

              {peutPartager && (
                <View style={s.pleins}>
                  <BoutonPlein t={t} titre="Partager" onPress={() => void partager()} />
                  {fiche.rejouer && (
                    <BoutonPlein
                      t={t}
                      titre={fiche.rejouer.libelle}
                      icone={<IconeJeu nom="lecture" couleur={jeton(t, "bf")} taille={14} />}
                      occupe={lancement}
                      onPress={() => void rejouer()}
                    />
                  )}
                </View>
              )}

              {voteOuvert && cid && (
                <VoteHommeDuMatch
                  t={t}
                  clubId={cid}
                  matchId={fiche.id}
                  vote={fiche.vote!}
                  onVote={() => void charger()}
                />
              )}

              {fiche.soireeARanger && fiche.droits.peutSaisir && (
                <CarteVerre t={t} style={s.ranger}>
                  <Text style={[s.rangerTitre, { color: t.ink }]}>
                    Ce match n&apos;appartient à aucune soirée
                  </Text>
                  <Pressable
                    onPress={() => void ranger()}
                    disabled={rangement}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      s.rangerLigne,
                      { borderTopColor: jeton(t, "sep") },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[s.rangerQuand, { color: t.ink }]} numberOfLines={1}>
                      {fiche.soireeARanger.libelle}
                    </Text>
                    <Text style={[s.rangerActe, { color: jeton(t, "i2") }]}>
                      {rangement ? "On range…" : "Ranger le match ici ›"}
                    </Text>
                  </Pressable>
                </CarteVerre>
              )}

              {fiche.droits.peutGerer && fiche.statut === "TERMINE" && (
                <View style={s.admin}>
                  <View style={s.adminGauche}>
                    <BoutonVerre
                      t={t}
                      taille="normal"
                      titre="Corriger"
                      onPress={() =>
                        void ouvrirSite((slug) => `/c/${slug}/matches/${fiche.id}/corriger`)
                      }
                    />
                    <Pressable
                      onPress={() =>
                        void ouvrirSite((slug) => `/c/${slug}/matches/${fiche.id}/edit`)
                      }
                      accessibilityRole="link"
                      hitSlop={4}
                      style={s.lienTexte}
                    >
                      <Text style={[s.petit, { color: jeton(t, "i2") }]}>Modifier les infos</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={confirmerRetrait}
                    disabled={retrait}
                    accessibilityRole="button"
                    hitSlop={4}
                    style={s.lienTexte}
                  >
                    <Text style={[s.petit, s.supprimer]}>{retrait ? "…" : "Supprimer"}</Text>
                  </Pressable>
                </View>
              )}
              {/* Celui qui a saisi la feuille n'est très souvent pas admin :
                  sans cette phrase, il constate une erreur et ne voit aucun
                  bouton, sans savoir à qui s'adresser (APRES-12). */}
              {!fiche.droits.peutGerer && fiche.statut === "TERMINE" && (
                <Text style={[s.petit, { color: jeton(t, "i2") }]}>
                  Seul un administrateur peut corriger un match terminé.
                </Text>
              )}

              {fiche.droits.peutGerer && fiche.statut === "ANNULE" && (
                <BoutonVerre
                  t={t}
                  titre={retablissement ? "…" : "Rétablir le match"}
                  disabled={retablissement}
                  onPress={retablir}
                />
              )}

              {fiche.soireeId && (
                <BoutonVerre
                  t={t}
                  taille="normal"
                  titre="Voir la soirée"
                  onPress={() =>
                    router.push({
                      pathname: "/soiree/[id]",
                      params: { id: fiche.soireeId!, clubId: cid ?? "" },
                    })
                  }
                />
              )}

              {actionErreur ? <Text style={s.erreur}>{actionErreur}</Text> : null}
            </View>
          </>
        )}
      </ScrollView>

      {fin === "1" && cid && monJoueurId && (
        <AnnonceSucces
          t={t}
          clubId={cid}
          joueurId={monJoueurId}
          deblocages={mesDeblocages}
          chasubles={{ a: couleurA, b: couleurB }}
          onVoir={() => ouvrirJoueur(monJoueurId)}
        />
      )}
    </Ecran>
  );
}

/// L'attente du récap, à la forme du récap : les deux gros chiffres, l'état
/// au milieu, les écussons de 76 et les deux colonnes de buteurs.
///
/// C'est l'écran le plus lent de l'app — la fiche du match ET les succès qu'il
/// a débloqués, 292 ms médians sur la machine de développement, plusieurs
/// secondes sur un téléphone au gymnase. Il affichait « Un instant… » au
/// milieu du vide, puis basculait d'un coup sur une page entière.
function SqueletteRecap({ t }: { t: Jetons }) {
  return (
    <Squelette etiquette="On ouvre le match" style={sq.cadre}>
      <View style={sq.marque}>
        <Bloc t={t} l={86} h={116} r={18} />
        <View style={sq.milieu}>
          <Bloc t={t} l={72} h={16} />
          <Bloc t={t} l={54} h={13} />
        </View>
        <Bloc t={t} l={86} h={116} r={18} />
      </View>
      <View style={sq.equipes}>
        {[0, 1].map((i) => (
          <View key={i} style={sq.equipe}>
            <Bloc t={t} l={76} h={76} r={22} />
            <Bloc t={t} l={92} h={18} />
            <Bloc t={t} l={64} h={13} />
          </View>
        ))}
      </View>
      <View style={sq.buteurs}>
        {[0, 1].map((i) => (
          <View key={i} style={sq.colonne}>
            <Bloc t={t} l="80%" h={15} style={i === 1 ? sq.aDroite : undefined} />
            <Bloc t={t} l="58%" h={15} style={i === 1 ? sq.aDroite : undefined} />
          </View>
        ))}
      </View>
    </Squelette>
  );
}

const sq = StyleSheet.create({
  cadre: { paddingTop: 18 },
  marque: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, gap: 12 },
  milieu: { flex: 1, alignItems: "center", gap: 8 },
  equipes: { flexDirection: "row", paddingTop: 16, paddingHorizontal: 24 },
  equipe: { flex: 1, alignItems: "center", gap: 10 },
  buteurs: { flexDirection: "row", gap: 16, paddingTop: 22, paddingHorizontal: 28 },
  colonne: { flex: 1, gap: 10 },
  aDroite: { alignSelf: "flex-end" },
});

const s = StyleSheet.create({
  barre: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  centreBarre: { flex: 1, minHeight: 44, justifyContent: "center" },
  legende: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    color: "rgba(255,255,255,0.62)",
  },
  filetBarre: { height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  contenu: { paddingBottom: 40 },
  corrige: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    paddingTop: 16,
    paddingHorizontal: 28,
  },
  // Sous les buteurs : les onglets à 28 (l'échelle d'espacement), puis les
  // cartes à 14 l'une de l'autre et à 14 des bords (`.recap-suite`).
  bas: { paddingHorizontal: 14, paddingTop: 28, gap: 14 },
  suivi: { fontSize: 15, lineHeight: 20, textAlign: "center", paddingHorizontal: 10 },
  pleins: { gap: 10, paddingTop: 4 },
  admin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  adminGauche: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  lienTexte: { minHeight: 44, justifyContent: "center" },
  petit: { fontSize: 14 },
  supprimer: { fontWeight: "700", color: "#ff453a" },
  ranger: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  rangerTitre: { fontSize: 17, fontWeight: "600", paddingBottom: 10 },
  rangerLigne: {
    minHeight: 52,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rangerQuand: { flex: 1, fontSize: 17 },
  rangerActe: { fontSize: 15, fontWeight: "600" },
  erreur: { fontSize: 15, color: "#ff453a", textAlign: "center" },
});
