import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { router, useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import Ecran from "../../composants/Ecran";
import {
  Avatar,
  BoutonPlein,
  BoutonRond,
  BoutonVerre,
  EcussonChasuble,
  Poignee,
} from "../../composants/base";
import { useNoyau } from "../../composants/Noyau";
import AnnonceSucces from "../../composants/succes/AnnonceSucces";
import BandeRetrait from "../../composants/match/BandeRetrait";
import Horloge from "../../composants/match/Horloge";
import { PiedDeFin, TempsPlein, useMesDeblocagesDuMatch } from "../../composants/match/FinDeMatch";
import { matchSuivant } from "../../composants/match/rejouer";
import { phraseRetrait, quoiAnnuler } from "../../composants/match/textes";
import { tailleDuScore } from "../../composants/match/score";
import { enregistrerPlantage } from "../../lib/plantages/fichier";
import { jetonsDuClub, JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { nowElapsed } from "../../lib/noyau/clock";
import { estRetro } from "../../lib/noyau/retro";
import type { LivePlayer } from "../../lib/match/local";
import type { LocalClub } from "../../lib/outbox/types";
import type { EtatSynchro } from "../../lib/outbox/sync";
import {
  basculerSon,
  jouerAnnulation,
  jouerBut,
  jouerSifflet,
  sonActif,
} from "../../lib/son/son";
import { toucheChoix, toucheFranche, toucheLegere } from "../../lib/vibrer";
import { succes as vibrerSucces } from "../../lib/haptique";

/// La feuille de match, reprise de celle du site (maquette « Live », tour 4).
///
/// Mêmes valeurs, relevées sur le rendu réel plutôt que réinventées : le score
/// en 132 avec le camp qui perd à 40 %, les écussons de chasuble en 76 sous
/// les chiffres, les deux cartes d'équipe en verre à rayon 24, les rangées de
/// 58, la barre du bas à trois boutons de 52.
///
/// Un tap sur un joueur = un but. Un appui long = on retire son dernier but.
/// Rien d'autre ne doit pouvoir se produire par mégarde : c'est le geste qu'on
/// fait vingt-sept fois dans une soirée, souvent d'une main, parfois debout.
///
/// Tout est écrit sur l'appareil AVANT d'être envoyé. Le score monte même sans
/// réseau ; la file s'occupe du serveur quand il revient.

/// Combien de temps l'invite « Passe décisive ? » reste à l'écran.
///
/// Quinze secondes : assez pour qu'on réponde, assez court pour ne pas gêner
/// le but suivant. Elle ne bloque jamais — le score est déjà compté.
const INVITE_MS = 15_000;

/// Le seuil de l'appui long. 500 ms, comme sur le site.
///
/// Le garde `suppressTapUntil` de 700 ms que le web traîne disparaît ici :
/// React Native n'émet pas `onPress` après un `onLongPress`, cette ceinture
/// était pour le navigateur.
const APPUI_LONG_MS = 500;

/// L'éclair de fond d'une tuile qui vient de changer de colonne.
///
/// 400 ms, comme l'animation `liveArrive` du site. En mode correction, les
/// deux colonnes se ressemblent : sans cette trace, on ne sait pas si le tap a
/// déplacé le joueur ou si on a manqué la tuile.
const ECLAIR_MS = 400;

/// Le temps de revenir sur un « Annuler » de trop — cinq secondes, comme le
/// site (`DUREE_RETOUR_MS`).
const RETOUR_MS = 5_000;

/// Le « temps plein » reste au moins une seconde (celle du site), et au plus
/// trois : le temps que la file envoie la feuille. Au-delà, on n'attend plus
/// le réseau — la fin du match ne dépend jamais de lui.
const TEMPS_PLEIN_MIN_MS = 1_000;
const TEMPS_PLEIN_MAX_MS = 3_000;

type Vue = Awaited<ReturnType<ReturnType<typeof useNoyau>["local"]["getLocalMatch"]>>;
type Evenement = NonNullable<Vue>["events"][number];
type Invite = {
  eventId: string;
  camp: "A" | "B";
  buteurId: string | null;
  genre: "passe" | "csc";
};

/// Les deux feuilles qui montent du bas : la chronologie, et le choix du
/// joueur qui prend un carton. Une seule à la fois — au bord du terrain, deux
/// panneaux superposés, c'est un but non compté.
type Feuille =
  | { genre: "chrono" }
  | { genre: "carton"; camp: "A" | "B"; carton: "YELLOW_CARD" | "RED_CARD" };

const JAUNE = "#ffd60a";
const ROUGE = "#ff453a";

export default function Match() {
  // `clubId` n'est qu'un indice, passé par la liste des matchs : il sert si
  // le match n'est PAS sur ce téléphone (voir `absent`), pour que le récap
  // n'ait pas à le deviner.
  const { id, clubId: clubIdDonne } = useLocalSearchParams<{ id: string; clubId?: string }>();
  const { local, drain } = useNoyau();

  const [vue, setVue] = useState<Vue>(null);
  // Le match n'est pas dans la base de ce téléphone : il a été lancé sur un
  // autre (le cas normal du joueur qui ouvre l'app pendant la soirée). La
  // feuille ne peut pas le tenir — elle ne connaît que ce qu'elle a écrit —,
  // et l'écran tournait sans fin sur « Un instant… », sans bouton retour ni
  // balayage. On l'envoie au récap, qui lit le serveur et suit le score.
  const [absent, setAbsent] = useState(false);
  // Ce que « Annuler » vient de retirer, cinq secondes, pour « Rétablir ».
  const [retire, setRetire] = useState<Evenement | null>(null);
  const minuteurRetrait = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La fin : le « temps plein », puis le pied de fin tant que le récap n'est
  // pas lisible au serveur.
  const [tempsPlein, setTempsPlein] = useState(false);
  const finTraitee = useRef(false);
  const idCourant = useRef(id);
  idCourant.current = id;
  const [recapPret, setRecapPret] = useState(false);
  /// Combien d'envois de CE match le serveur a refusés. Zéro = la feuille est
  /// en route (ou déjà arrivée) ; au-delà, elle est coincée sur le téléphone
  /// et il faut le dire.
  const [refusees, setRefusees] = useState(0);
  const [lancement, setLancement] = useState(false);
  // Le club vit à part : `getLocalMatch` rend la feuille, pas les réglages.
  // C'est lui qui porte les couleurs et le fait qu'on suive les passes.
  const [club, setClub] = useState<LocalClub | null>(null);
  const [etatSynchro, setEtatSynchro] = useState<EtatSynchro | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [feuille, setFeuille] = useState<Feuille | null>(null);
  const [confirmeFin, setConfirmeFin] = useState(false);
  const [mvpOuvert, setMvpOuvert] = useState(false);
  const [mvpChoisi, setMvpChoisi] = useState<string | null>(null);
  // Le mode correction de composition. Les tuiles cessent de compter des buts
  // et ne servent plus qu'à envoyer un joueur dans l'autre camp : c'est toute
  // la raison d'un mode. Un même tap ne peut pas vouloir dire deux choses
  // quand on le fait vingt-sept fois dans une soirée, souvent sans regarder.
  const [compo, setCompo] = useState(false);
  // Le vivier du club, hors de ce match : le retardataire de la 10e minute.
  const [vivier, setVivier] = useState<{ id: string; name: string }[]>([]);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  // Le garde anti-équipe-vide se déclenche par un geste ordinaire — le dernier
  // joueur d'une colonne. Muet, le tap passerait pour un bogue de l'app.
  const [refus, setRefus] = useState<string | null>(null);
  const [bouge, setBouge] = useState<string | null>(null);
  // Le réglage vit dans le stockage local ; cet état n'est là que pour
  // redessiner le bouton « Son / Muet » de la chronologie.
  const [son, setSon] = useState(true);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteurBouge = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ce qu'affiche la feuille pendant qu'elle redescend. Sans cette mémoire,
  // fermer le choix d'un carton ferait clignoter « Événements » le temps de
  // l'animation : le contenu disparaît avant le panneau.
  const derniereFeuille = useRef<Feuille | null>(null);

  const relire = useCallback(async () => {
    if (!id) return;
    const v = await local.getLocalMatch(id);
    setVue(v);
    if (!v) setAbsent(true);
  }, [id, local]);

  // « Match suivant » remplace cet écran par le même, avec un autre match :
  // si la navigation garde l'instance, tout ce qui a été tenu pour l'ancien
  // (horloge amorcée, sifflet déjà donné, fin traitée) doit repartir de zéro.
  // Déclaré AVANT les effets qui lisent ces mémoires.
  // Le sifflet déjà donné, lui, est tenu par `Horloge`, qu'une `key` sur
  // l'identifiant du match remonte : sa mémoire repart de zéro avec lui.
  useEffect(() => {
    amorce.current = false;
    finTraitee.current = false;
    setAbsent(false);
    setTempsPlein(false);
    setRecapPret(false);
    setRefusees(0);
    setLancement(false);
    setRetire(null);
    setInvite(null);
  }, [id]);

  useEffect(() => {
    void relire();
  }, [relire]);

  useEffect(() => {
    if (!absent || !id) return;
    router.replace({
      pathname: "/recap/[id]",
      params: clubIdDonne ? { id, clubId: clubIdDonne } : { id },
    });
  }, [absent, id, clubIdDonne]);

  useEffect(() => drain.abonner(setEtatSynchro), [drain]);

  const match = vue?.match;
  const clubId = match?.clubId;
  const fini = match?.status === "FINISHED";

  // Le récap se lit au serveur : il n'est lisible qu'une fois la feuille
  // partie. On le redemande à chaque mouvement de la file.
  //
  // Et on demande AUSSI ce que le serveur a refusé pour ce match : refus et
  // attente ne se racontent pas pareil. Une opération refusée (403 après
  // perte du droit de scorer, 404 sur un match supprimé depuis le site) met
  // toute la chaîne de côté et n'en sortira pas seule — le compte ne
  // retombera donc jamais à zéro. Sans cette distinction, le pied de fin
  // promettait « le récap s'ouvre dès qu'elle y est » pour toujours, et
  // « Voir le récap » restait mort.
  useEffect(() => {
    if (!fini || !id) return;
    let vivant = true;
    void Promise.all([local.pendingOpsForMatch(id), local.blockedOpsForMatch(id)]).then(
      ([reste, bloquees]) => {
        if (!vivant) return;
        setRecapPret(reste === 0);
        setRefusees(bloquees);
      },
    );
    return () => {
      vivant = false;
    };
  }, [fini, id, local, etatSynchro]);

  // L'annonce des succès de CE match, si le serveur les connaît déjà. Sur le
  // pied de fin seulement : quand le récap s'ouvre tout de suite, c'est lui
  // qui l'affiche.
  const annonce = useMesDeblocagesDuMatch(clubId, id, fini && recapPret && !tempsPlein);

  useEffect(() => {
    if (!clubId) return;
    void local.getLocalClub(clubId).then((c) => setClub(c ?? null));
  }, [local, clubId]);

  const retro = match ? estRetro(match.playedAt) : false;
  const tourne = Boolean(match?.clockRunningSince);

  // L'écran reste allumé tant qu'on est sur la feuille. Il n'y a AUCUN Wake
  // Lock dans l'app web : elle s'éteint à la 20e minute pendant qu'on regarde
  // le jeu, et il faut la réveiller pour compter un but. Une ligne, et c'est
  // la première chose qui se remarquera au club.
  useKeepAwake();

  useEffect(() => {
    setSon(sonActif());
  }, []);

  // Le double coup de sifflet au franchissement du temps réglementaire. Le
  // franchissement est repéré par `Horloge`, qui est le seul à connaître la
  // seconde où il arrive ; ici on ne fait que siffler.
  const surDepassement = useCallback(() => {
    jouerSifflet();
    toucheFranche();
  }, []);

  /// Le coup de sifflet de mi-temps, déclaré comme un rappel stable : la
  /// pilule vit dans `Horloge`, qui est mémoïsé — une fonction refaite à
  /// chaque rendu le réveillerait à chaque but.
  const idDuMatch = match?.id;
  const surMiTemps = useCallback(() => {
    if (!idDuMatch) return;
    void local.siffletMiTemps(idDuMatch).then(async (siffle) => {
      if (!siffle) return;
      toucheFranche();
      await relire();
    });
  }, [idDuMatch, local, relire]);

  // Amorcer le chrono à la première ouverture, comme le site.
  //
  // La garde rétro n'est pas un détail : sans elle, `maintenant - playedAt`
  // démarrerait le chrono d'un match d'hier à 24:00:00 — donc au-delà du temps
  // réglementaire dès l'ouverture, sirène comprise.
  const amorce = useRef(false);
  useEffect(() => {
    if (!match || match.status !== "LIVE" || amorce.current) return;
    amorce.current = true;
    if (match.clockRunningSince == null && !(match.clockElapsedMs ?? 0) && !retro) {
      void local.demarrerHorloge(match.id, Date.now() - Date.parse(match.playedAt)).then(relire);
    }
  }, [match, retro, local, relire]);

  // Le vivier se relit à chaque ouverture du mode ET après chaque changement
  // de la feuille : celui qu'on vient de faire entrer doit quitter la liste
  // des absents, sinon on le fait entrer deux fois.
  useEffect(() => {
    if (!compo) {
      setAjoutOuvert(false);
      setRefus(null);
      return;
    }
    let vivant = true;
    void local.joueursAbsentsDuMatch(id).then((v) => {
      if (vivant) setVivier(v);
    });
    return () => {
      vivant = false;
    };
  }, [compo, id, local, vue]);

  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
      if (minuteurBouge.current) clearTimeout(minuteurBouge.current);
      if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
    },
    [],
  );

  /// Quitter la feuille : vers le club du match, qu'on connaît sans réseau.
  /// Jamais vers /clubs — hors ligne, cette liste ne s'affiche pas, et on se
  /// retrouvait devant « Ça n'a pas marché » en sortant d'un match.
  const versLeClub = useCallback(() => {
    const cid = clubId ?? clubIdDonne;
    if (cid) router.replace({ pathname: "/club/[id]", params: { id: cid } });
    else if (router.canGoBack()) router.back();
    else router.replace("/clubs");
  }, [clubId, clubIdDonne]);

  if (!vue || !match) {
    // Le retour est là dès la première image : c'est un écran sans balayage
    // de retour, et une attente sans sortie est une impasse.
    return (
      <Ecran>
        <Poignee />
        <View style={s.barre}>
          <BoutonRond t={JETONS_NEUTRES} symbole="‹" etiquette="Retour" onPress={versLeClub} />
        </View>
        <View style={s.centre}>
          <ActivityIndicator color="#fff" />
          <Text style={[s.aide, { color: JETONS_NEUTRES.i2 }]}>
            {absent ? "Ce match se joue sur un autre téléphone. On va le suivre…" : "Un instant…"}
          </Text>
        </View>
      </Ecran>
    );
  }

  const couleurA = club?.colorA ?? "#ffffff";
  const couleurB = club?.colorB ?? "#111111";
  const t: Jetons = club ? jetonsDuClub(couleurA, couleurB, "dark") : JETONS_NEUTRES;
  const enJeu = match.status === "LIVE";
  // Sur un match contre un adversaire extérieur, l'équipe B n'est pas une
  // équipe du club : il n'y a personne à y envoyer, et la couche locale refuse
  // le déplacement. Le mode n'a donc pas lieu d'exister sur ces matchs.
  const corrigeable = enJeu && match.kind !== "EXTERNAL";
  const enCorrection = compo && corrigeable;

  function armerInvite(x: Invite) {
    if (minuteur.current) clearTimeout(minuteur.current);
    // Une seule bande en bas : la question du nouveau but chasse le
    // « Rétablir » de l'annulation précédente.
    effacerRetrait();
    setInvite(x);
    minuteur.current = setTimeout(() => setInvite(null), INVITE_MS);
  }

  function effacerRetrait() {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
    setRetire(null);
  }

  function armerRetrait(e: Evenement) {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
    setRetire(e);
    minuteurRetrait.current = setTimeout(() => setRetire(null), RETOUR_MS);
  }

  function fermerInvite() {
    if (minuteur.current) clearTimeout(minuteur.current);
    setInvite(null);
  }

  async function marquer(camp: "A" | "B", joueur: LivePlayer) {
    // Le son AVANT l'écriture, comme sur le site : la tuile répond au doigt,
    // pas à SQLite. Le but est déjà compté de toute façon — rien ici ne peut
    // le refuser.
    jouerBut(camp);
    toucheLegere();
    const eventId = await local.addEvent(match!.id, {
      type: "GOAL",
      team: camp,
      playerId: joueur.id,
    });
    await relire();
    void drain.relancer();
    // Jamais sur une feuille rétro : on ne demande pas qui a fait la passe
    // d'un but d'il y a trois jours.
    if (club?.trackAssists && !retro && eventId) {
      armerInvite({ eventId, camp, buteurId: joueur.id, genre: "passe" });
    }
  }

  async function contreSonCamp(campQuiConcede: "A" | "B") {
    const campCredite = campQuiConcede === "A" ? "B" : "A";
    // Le son est celui du camp CRÉDITÉ, pas de celui qui concède : l'oreille
    // doit entendre le même but que le tableau d'affichage.
    jouerBut(campCredite);
    toucheLegere();
    const eventId = await local.addEvent(match!.id, {
      type: "OWN_GOAL",
      team: campCredite,
    });
    await relire();
    void drain.relancer();
    // Le but part au bon camp tout de suite ; l'auteur se désigne après, parmi
    // ceux qui l'ont concédé.
    if (!retro && eventId) {
      armerInvite({ eventId, camp: campQuiConcede, buteurId: null, genre: "csc" });
    }
  }

  async function annulerSonDernier(joueur: LivePlayer) {
    // Le dernier but DE CE JOUEUR, lu sur la feuille affichée — celle qui se
    // relit après chaque écriture. Rien à retirer : ni son ni bande, un son
    // de retrait sur un score inchangé ferait croire à un but effacé.
    const dernier = [...vue!.events]
      .reverse()
      .find((e) => e.type === "GOAL" && e.playerId === joueur.id);
    if (!dernier) return;
    await retirer(dernier);
  }

  /// Le seul chemin qui retire un événement : le bouton « Annuler » du pied
  /// (le dernier, quel qu'il soit), l'appui long sur un joueur, chaque ligne
  /// de la chronologie. Il dit ce qui part et laisse cinq secondes pour le
  /// rétablir. La remise en première période d'une mi-temps annulée est
  /// tenue par `removeEvent` : tous les chemins en héritent.
  async function retirer(e: Evenement) {
    // Le son APRÈS : `removeEvent` peut ne rien trouver (déjà retiré depuis
    // la chronologie pendant que le doigt appuyait).
    if (!(await local.removeEvent(match!.id, e.id))) return;
    jouerAnnulation();
    toucheFranche();
    fermerInvite();
    armerRetrait(e);
    await relire();
    void drain.relancer();
  }

  /// « Rétablir » : l'événement revient tel quel — même camp, même joueur,
  /// même passe, même minute. Il porte un nouvel identifiant : l'ancien est
  /// déjà dans la file comme supprimé. Une mi-temps se resiffle, pour que la
  /// seconde période revienne avec elle.
  async function retablir() {
    const e = retire;
    if (!e) return;
    effacerRetrait();
    toucheChoix();
    try {
      if (e.type === "HALF_TIME") {
        await local.siffletMiTemps(match!.id);
      } else {
        await local.addEvent(match!.id, {
          type: e.type,
          team: e.team,
          playerId: e.playerId,
          assistPlayerId: e.assistPlayerId ?? null,
          minute: e.minute,
        });
      }
    } catch (err) {
      setRefus(err instanceof Error ? err.message : "Impossible de rétablir");
      return;
    }
    await relire();
    void drain.relancer();
  }

  async function annulerDernier() {
    const dernier = vue!.events[vue!.events.length - 1];
    if (!dernier) return;
    await retirer(dernier);
  }

  /// Un carton, pour un joueur du camp de la carte où on l'a demandé.
  ///
  /// Le score n'en bouge pas — c'est le compteur de la tuile et la
  /// chronologie qui le montrent. Retour haptique de choix : on veut savoir
  /// que c'est pris sans quitter le jeu des yeux. Pas de son — le site n'en a
  /// pas, et un carton ne se signale pas au terrain comme un but.
  async function donnerCarton(joueurId: string) {
    if (feuille?.genre !== "carton") return;
    const { camp, carton } = feuille;
    setFeuille(null);
    toucheChoix();
    await local.addEvent(match!.id, { type: carton, team: camp, playerId: joueurId });
    await relire();
    void drain.relancer();
  }

  /// L'éclair qui suit une tuile d'une colonne à l'autre.
  function signaler(joueurId: string) {
    if (minuteurBouge.current) clearTimeout(minuteurBouge.current);
    setBouge(joueurId);
    minuteurBouge.current = setTimeout(
      () => setBouge((x) => (x === joueurId ? null : x)),
      ECLAIR_MS,
    );
  }

  /// Envoie un joueur dans l'autre camp. Appelé depuis les tuiles, et
  /// uniquement en mode correction : hors de ce mode, un tap est un but.
  ///
  /// Les buts déjà marqués gardent leur camp d'origine — ils ont bien été
  /// marqués pour celui-là. C'est la couche locale qui le garantit.
  async function deplacer(joueur: LivePlayer, depuis: "A" | "B") {
    try {
      await local.movePlayerTeam(match!.id, joueur.id, depuis === "A" ? "B" : "A");
    } catch (e) {
      setRefus(e instanceof Error ? e.message : "Déplacement refusé");
      return;
    }
    setRefus(null);
    toucheChoix();
    signaler(joueur.id);
    await relire();
    void drain.relancer();
  }

  /// Le retardataire. Il arrive à la 10e minute, il n'est sur aucune feuille,
  /// et sans ce geste ses buts étaient refusés (« Joueur non inscrit »).
  async function faireEntrer(joueurId: string, camp: "A" | "B") {
    setAjoutOuvert(false);
    try {
      await local.ajouterJoueurAuMatch(match!.id, joueurId, camp);
    } catch (e) {
      setRefus(e instanceof Error ? e.message : "Entrée refusée");
      return;
    }
    setRefus(null);
    toucheChoix();
    signaler(joueurId);
    await relire();
    void drain.relancer();
  }

  async function repondreInvite(joueurId: string | null) {
    if (!invite) return;
    if (joueurId) {
      if (invite.genre === "passe") {
        await local.setEventAssist(match!.id, invite.eventId, joueurId);
      } else {
        await local.setEventScorer(match!.id, invite.eventId, joueurId);
      }
      await relire();
      void drain.relancer();
    }
    fermerInvite();
  }

  async function basculerChrono() {
    await local.basculerHorloge(match!.id);
    await relire();
  }

  /// Le bouton « Terminer » ne termine pas tout de suite : il demande d'abord
  /// la confirmation, puis — si le club élit son homme du match à la main —
  /// le MVP. En mode `VOTE` ce sont les joueurs qui votent après coup, en
  /// mode `OFF` personne : dans les deux cas on ne demande rien ici.
  function demanderFin() {
    setConfirmeFin(false);
    if (club?.motmMode === "ADMIN") {
      setMvpChoisi(null);
      setMvpOuvert(true);
    } else {
      void terminer(null);
    }
  }

  /// Terminer ne ramène plus à la liste des clubs : il fige le score (« temps
  /// plein »), envoie la feuille pendant qu'on le lit, puis ouvre le récap si
  /// le serveur l'a reçue — sinon le pied de fin, qui propose le match
  /// suivant sans attendre personne.
  async function terminer(mvpId: string | null) {
    setMvpOuvert(false);
    // Le temps joué se relit à l'instant du coup de sifflet final, et non
    // dans une valeur dérivée au dernier rendu : depuis que l'horloge tient
    // son propre tic, le rendu de la feuille peut dater de plusieurs minutes.
    const jouees = nowElapsed({
      elapsedMs: match!.clockElapsedMs ?? 0,
      runningSince: match!.clockRunningSince ?? null,
    });
    await local.finishMatch(match!.id, mvpId, Math.round(jouees / 60_000) || null);
    // Après l'écriture, jamais avant : un « c'est fait » démenti par une
    // erreur est pire que rien.
    vibrerSucces();
    fermerInvite();
    effacerRetrait();
    finTraitee.current = false;
    setTempsPlein(true);
    await relire();
    const envoi = drain.relancer().catch(() => {});
    const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    await Promise.race([
      Promise.all([envoi, attendre(TEMPS_PLEIN_MIN_MS)]),
      attendre(TEMPS_PLEIN_MAX_MS),
    ]);
    await apresTempsPlein(match!.id);
  }

  /// La suite du temps plein — au bout du délai, ou au toucher. Une seule
  /// fois : le toucher et le délai arrivent souvent tous les deux. Et pour le
  /// bon match : si l'on a déjà lancé le suivant, le délai de l'ancien ne doit
  /// pas ouvrir son récap par-dessus.
  async function apresTempsPlein(matchId: string) {
    if (finTraitee.current || idCourant.current !== matchId) return;
    finTraitee.current = true;
    const reste = await local.pendingOpsForMatch(matchId);
    if (idCourant.current !== matchId) return;
    if (reste === 0 && clubId) {
      router.replace({ pathname: "/recap/[id]", params: { id: matchId, clubId, fin: "1" } });
      return;
    }
    setTempsPlein(false);
  }

  async function lancerSuivant() {
    if (lancement) return;
    setLancement(true);
    try {
      const nouveau = await matchSuivant(
        { local, drain },
        match!,
        { teamA: vue!.teamA, teamB: vue!.teamB },
        retro,
      );
      toucheFranche();
      router.replace({ pathname: "/match/[id]", params: { id: nouveau } });
    } catch (e) {
      setLancement(false);
      setRefus(e instanceof Error ? e.message : "Le match suivant n'a pas pu partir");
    }
  }

  const equipes = [
    { camp: "A" as const, nom: match.teamAName, couleur: couleurA, joueurs: vue.teamA },
    { camp: "B" as const, nom: match.teamBName, couleur: couleurB, joueurs: vue.teamB },
  ];

  if (feuille) derniereFeuille.current = feuille;
  const contenu = feuille ?? derniereFeuille.current;

  const candidats = !invite
    ? []
    : invite.genre === "passe"
      ? (invite.camp === "A" ? vue.teamA : vue.teamB).filter((p) => p.id !== invite.buteurId)
      : invite.camp === "A"
        ? vue.teamA
        : vue.teamB;

  return (
    <Ecran t={t} chasubles={{ a: couleurA, b: couleurB }}>
      <Poignee />

      <View style={s.barre}>
        <BoutonRond t={t} symbole="‹" etiquette="Retour au club" onPress={versLeClub} />
        <Text style={s.legende} numberOfLines={1}>
          {legende(match.playedAt)} · {retro ? "Feuille" : "Match"}
        </Text>
        <View style={s.droite}>
          <Pastille etat={etatSynchro} />
          <BoutonRond
            t={t}
            symbole="≡"
            etiquette="Événements du match"
            onPress={() => setFeuille({ genre: "chrono" })}
          />
        </View>
      </View>

      {/* Le tableau de marque. Le camp qui perd s'efface à 40 % : à deux
          mètres, on doit savoir qui mène sans lire les chiffres. */}
      <View style={s.marque}>
        <Chiffre valeur={match.scoreA} perd={match.scoreB > match.scoreA} />
        <View style={s.milieu}>
          {enJeu && !retro ? (
            // Le chrono tient son propre tic (composants/match/Horloge.tsx) :
            // il se redessine deux fois par seconde sans rien réveiller
            // au-dessus de lui.
            <Horloge
              // « Match suivant » garde l'écran et change l'identifiant : la
              // `key` remonte l'horloge, donc sa mémoire du sifflet déjà
              // donné. Sans elle, le match suivant hériterait du précédent.
              key={match.id}
              elapsedMs={match.clockElapsedMs ?? 0}
              runningSince={match.clockRunningSince ?? null}
              limiteMs={club?.matchDurationMin != null ? club.matchDurationMin * 60_000 : null}
              periode={match.period ?? 1}
              onMiTemps={surMiTemps}
              onDepassement={surDepassement}
            />
          ) : (
            <Text style={[s.etat, { color: "rgba(255,255,255,0.7)" }]}>
              {match.status === "FINISHED" ? "Terminé" : "Saisie"}
            </Text>
          )}
        </View>
        <Chiffre valeur={match.scoreB} perd={match.scoreA > match.scoreB} />
      </View>

      {/* Les écussons sous le score, comme sur le site : au five, l'équipe
          n'a pas de nom, elle a une chasuble. */}
      <View style={s.equipes}>
        {equipes.map((e) => (
          <View key={e.camp} style={s.equipe}>
            {/* 64 et non 76 : sous un score de 132, l'écusson n'a pas à
                rivaliser avec lui — et les douze points rendus descendent
                d'autant la première tuile de joueur, qui est ce qu'on tape. */}
            <EcussonChasuble couleur={e.couleur} lettre={e.nom[0] ?? "?"} taille={64} />
            <Text style={[s.nomEquipe, { color: t.ink }]} numberOfLines={1}>
              {e.nom}
            </Text>
          </View>
        ))}
      </View>

      {/* Corriger la compo est un moment distinct du match, avec sa propre
          bande : jamais sur une rangée de joueur. C'est ce qui garde la rangée
          entièrement dédiée au but. */}
      {enCorrection && (
        <View style={[s.bandeau, { borderColor: t.cb }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.bandeauTitre, { color: t.ink }]}>Corriger la composition</Text>
            <Text style={[s.bandeauAide, { color: t.i2 }]}>
              Tape un joueur pour l&apos;envoyer dans l&apos;autre équipe. Aucun but ne
              se compte tant que ce bandeau est là.
            </Text>
          </View>
          <Pressable
            onPress={() => setCompo(false)}
            style={({ pressed }) => [
              s.termine,
              { backgroundColor: t.bt, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[s.termineTexte, { color: t.bf }]}>Terminé</Text>
          </Pressable>
        </View>
      )}

      {refus && (enCorrection || !compo) && (
        <Text style={[s.refus, { color: ROUGE }]}>{refus}</Text>
      )}

      <ScrollView contentContainerStyle={s.corps}>
        {/* Le retardataire, au-dessus des colonnes comme sur le site : c'est
            une liste de noms, elle doit pouvoir défiler avec le reste. */}
        {enCorrection && vivier.length > 0 && (
          <View style={s.ajout}>
            {ajoutOuvert ? (
              <>
                <Text style={[s.ajoutTitre, { color: t.ink }]}>
                  Il arrive en retard — dans quelle équipe ?
                </Text>
                {vivier.map((v) => (
                  <View key={v.id} style={s.ajoutLigne}>
                    <Text style={[s.ajoutNom, { color: t.ink }]} numberOfLines={1}>
                      {v.name}
                    </Text>
                    {equipes.map((e) => (
                      <Pressable
                        key={e.camp}
                        onPress={() => void faireEntrer(v.id, e.camp)}
                        style={({ pressed }) => [
                          s.ajoutBouton,
                          { backgroundColor: e.couleur, opacity: pressed ? 0.8 : 1 },
                        ]}
                      >
                        <Text
                          style={[
                            s.ajoutBoutonTexte,
                            { color: e.camp === "A" ? (t.taF ?? "#fff") : (t.tbF ?? "#fff") },
                          ]}
                          numberOfLines={1}
                        >
                          {e.nom}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ))}
                <Pressable onPress={() => setAjoutOuvert(false)} style={s.entree} hitSlop={6}>
                  <Text style={[s.entreeTexte, { color: t.i2 }]}>Fermer</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => setAjoutOuvert(true)} style={s.entree} hitSlop={6}>
                <Text style={[s.entreeTexte, { color: t.i2 }]}>+ Faire entrer un joueur</Text>
              </Pressable>
            )}
          </View>
        )}
        <View style={s.cartes}>
          {equipes.map((e) => (
            <View key={e.camp} style={s.carte}>
              {e.joueurs.map((j, i) => (
                <Pressable
                  key={j.id}
                  onPress={() =>
                    enCorrection ? void deplacer(j, e.camp) : void marquer(e.camp, j)
                  }
                  onLongPress={enCorrection ? undefined : () => void annulerSonDernier(j)}
                  delayLongPress={APPUI_LONG_MS}
                  disabled={!enJeu}
                  accessibilityLabel={
                    enCorrection
                      ? `${j.name} — envoyer dans l'autre équipe`
                      : `${j.name} — but (maintenir pour annuler)`
                  }
                  style={({ pressed }) => [
                    s.joueur,
                    i > 0 && s.separe,
                    bouge === j.id && s.arrive,
                    pressed && { backgroundColor: e.couleur + "33" },
                  ]}
                >
                  <Avatar
                    nom={j.name}
                    photo={j.photo}
                    t={t}
                    anneau={e.camp === "A" ? (t.taR ?? couleurA) : (t.tbR ?? couleurB)}
                    taille={30}
                  />
                  <Text style={[s.nomJoueur, { color: t.ink }]} numberOfLines={1}>
                    {j.name}
                  </Text>
                  {/* En correction, la tuile ne dit plus qu'une chose : de
                      quel côté ce tap enverrait le joueur. Les buts et les
                      cartons se liraient comme des cibles. */}
                  {enCorrection ? (
                    <Text style={[s.fleche, { color: t.i2 }]}>
                      {e.camp === "A" ? "→" : "←"}
                    </Text>
                  ) : (
                    <>
                      {/* Qui est déjà averti, qui est sorti : ça se lit sur la
                          tuile, pas en ouvrant la chronologie. */}
                      {j.yellow > 0 && <Marque couleur={JAUNE} nombre={j.yellow} />}
                      {j.red > 0 && <Marque couleur={ROUGE} nombre={j.red} />}
                      <Text style={[s.buts, { color: t.ink }]}>{j.goals || ""}</Text>
                    </>
                  )}
                </Pressable>
              ))}
              {!enCorrection && (
                <>
              <Pressable
                onPress={() => void contreSonCamp(e.camp)}
                disabled={!enJeu}
                accessibilityLabel={`Contre son camp — but pour ${
                  e.camp === "A" ? match.teamBName : match.teamAName
                }`}
                style={({ pressed }) => [
                  s.csc,
                  s.separe,
                  pressed && { backgroundColor: "rgba(255,255,255,0.08)" },
                ]}
              >
                <Text style={s.cscTexte}>Contre son camp</Text>
              </Pressable>
              {/* Les cartons, seulement si le club les suit : un club qui n'en
                  donne jamais n'a pas besoin de deux cibles de plus sous le
                  pouce pendant qu'il compte les buts. */}
              {club?.trackCards && (
                <View style={[s.cartons, s.separe]}>
                  {(
                    [
                      ["YELLOW_CARD", JAUNE, "jaune"],
                      ["RED_CARD", ROUGE, "rouge"],
                    ] as const
                  ).map(([carton, couleur, mot]) => (
                    // La cible fait 44 × 44 ; le carton dessiné reste à ses
                    // proportions d'arbitre, au milieu. À 15 × 21, on le
                    // manquait debout, d'un pouce.
                    <Pressable
                      key={carton}
                      onPress={() => setFeuille({ genre: "carton", camp: e.camp, carton })}
                      disabled={!enJeu}
                      accessibilityRole="button"
                      accessibilityLabel={`Carton ${mot} pour ${e.nom}`}
                      style={({ pressed }) => [s.cibleCarton, pressed && { opacity: 0.6 }]}
                    >
                      <View style={[s.carton, { backgroundColor: couleur }]} />
                    </Pressable>
                  ))}
                </View>
              )}
                </>
              )}
            </View>
          ))}
        </View>
        {corrigeable && !compo && (
          <Pressable onPress={() => setCompo(true)} style={s.entree} hitSlop={6}>
            <Text style={[s.entreeTexte, { color: t.i2 }]}>Corriger la composition ›</Text>
          </Pressable>
        )}
      </ScrollView>

      {retire && !invite && (
        <BandeRetrait
          t={t}
          phrase={phraseRetrait(retire, retire.team === "B" ? match.teamBName : match.teamAName)}
          onRetablir={() => void retablir()}
        />
      )}

      {invite && (
        <View style={s.invite}>
          <Text style={[s.inviteTitre, { color: t.ink }]}>
            {invite.genre === "passe" ? "Passe décisive ?" : "Qui l'a mis ?"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.choix}
          >
            {candidats.map((p) => (
              <Pressable key={p.id} onPress={() => void repondreInvite(p.id)} style={s.pastille}>
                <Text style={{ color: t.ink, fontSize: 15, fontWeight: "600" }}>{p.name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => void repondreInvite(null)} style={s.pastille}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" }}>
                {invite.genre === "passe" ? "Sans passe" : "Sans préciser"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {enJeu && (
        <View style={s.pied}>
          <View style={{ flex: 1 }}>
            <BoutonAnnuler
              t={t}
              dernier={vue.events[vue.events.length - 1]}
              onPress={() => void annulerDernier()}
            />
          </View>
          {!retro && (
            <View style={{ flex: 1 }}>
              <BoutonVerre
                t={t}
                titre={tourne ? "Pause" : "Reprendre"}
                onPress={() => void basculerChrono()}
              />
            </View>
          )}
          <View style={{ flex: 1.3 }}>
            <BoutonPlein
              t={t}
              titre={retro ? "Enregistrer" : "Terminer"}
              onPress={() => setConfirmeFin(true)}
            />
          </View>
        </View>
      )}

      {/* Le pied d'une feuille terminée. « Match suivant » quand la soirée
          continue : un match en direct (le lundi ne s'arrête pas après un
          match), ou une feuille rattrapée DANS une soirée. */}
      {fini && !tempsPlein && (
        <PiedDeFin
          t={t}
          suivant={
            !retro
              ? "Match suivant — mêmes équipes"
              : match.matchDayId
                ? "Saisir le match suivant"
                : null
          }
          onSuivant={() => void lancerSuivant()}
          lancement={lancement}
          recapPret={recapPret}
          refusees={refusees}
          horsLigne={etatSynchro?.enLigne === false}
          onReessayer={() => void drain.rejouerBloquees()}
          onRecap={() =>
            router.replace({
              pathname: "/recap/[id]",
              params: { id: match.id, clubId: match.clubId },
            })
          }
          onClub={versLeClub}
        />
      )}

      {tempsPlein && (
        <TempsPlein
          nomA={match.teamAName}
          nomB={match.teamBName}
          scoreA={match.scoreA}
          scoreB={match.scoreB}
          retro={retro}
          chasubles={{ a: couleurA, b: couleurB }}
          onContinuer={() => void apresTempsPlein(match.id)}
        />
      )}

      {annonce && (
        <AnnonceSucces
          t={t}
          clubId={match.clubId}
          joueurId={annonce.joueurId}
          deblocages={annonce.deblocages}
          chasubles={{ a: couleurA, b: couleurB }}
          onVoir={() =>
            router.push({
              pathname: "/joueur/[id]",
              params: { id: annonce.joueurId, clubId: match.clubId },
            })
          }
        />
      )}

      <Modal
        visible={confirmeFin}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmeFin(false)}
      >
        <View style={s.voile}>
          <View style={[s.boite, { backgroundColor: t.cdSolid, borderColor: t.cb }]}>
            <Text style={[s.boiteTitre, { color: t.ink }]}>
              {retro ? "Enregistrer ce match ?" : "Terminer ce match ?"}
            </Text>
            <Text style={[s.aide, { color: t.i2, textAlign: "center" }]}>
              {match.teamAName} {match.scoreA} — {match.scoreB} {match.teamBName}
            </Text>
            {/* Ce que le bouton va faire, avant qu'il le fasse. Le club qui
                élit son homme du match à la main voyait un « Terminer » qui
                ne terminait pas : une seconde fenêtre s'ouvrait derrière,
                avec vingt noms, alors qu'on rangeait déjà le téléphone. */}
            <Text style={[s.boiteSuite, { color: t.i3 ?? t.i2 }]}>
              {club?.motmMode === "ADMIN"
                ? "Tu éliras l'homme du match juste après."
                : "Le score part au club, et le récap s'ouvre."}
            </Text>
            <View style={{ height: 16 }} />
            <BoutonPlein
              t={t}
              titre={
                club?.motmMode === "ADMIN"
                  ? "Élire le MVP"
                  : retro
                    ? "Enregistrer"
                    : "Terminer"
              }
              onPress={demanderFin}
            />
            <View style={{ height: 10 }} />
            <BoutonVerre t={t} titre="Pas encore" onPress={() => setConfirmeFin(false)} />
          </View>
        </View>
      </Modal>

      {/* L'élection de l'homme du match, quand c'est le marqueur qui tranche.
          Facultative : on peut terminer sans élire personne — un match sans
          MVP vaut mieux qu'un MVP donné au hasard pour sortir de l'écran. */}
      <Modal
        visible={mvpOuvert}
        transparent
        animationType="slide"
        onRequestClose={() => setMvpOuvert(false)}
      >
        <View style={s.voileBas}>
          <View style={[s.feuille, { backgroundColor: t.cdSolid, borderColor: t.cb }]}>
            <Poignee />
            <Text style={[s.feuilleTitre, { color: t.ink }]}>Élire le MVP</Text>
            <Text style={[s.aide, { color: t.i2 }]}>
              Facultatif — tu peux terminer sans MVP.
            </Text>
            <ScrollView style={s.liste} contentContainerStyle={{ paddingVertical: 8 }}>
              {[...vue.teamA, ...vue.teamB].map((p) => {
                const choisi = mvpChoisi === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setMvpChoisi(choisi ? null : p.id)}
                    style={[
                      s.ligneChoix,
                      choisi && { backgroundColor: "rgba(255,255,255,0.12)", borderColor: t.bt },
                    ]}
                  >
                    <Avatar nom={p.name} photo={p.photo} t={t} taille={30} />
                    <Text style={[s.nomJoueur, { color: t.ink }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {choisi && <Text style={[s.etoile, { color: t.bt }]}>★</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={s.pied}>
              <View style={{ flex: 1 }}>
                <BoutonVerre t={t} titre="Retour" onPress={() => setMvpOuvert(false)} />
              </View>
              <View style={{ flex: 1.3 }}>
                <BoutonPlein t={t} titre="Terminer" onPress={() => void terminer(mvpChoisi)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* La chronologie et le choix du joueur qui prend un carton : deux
          contenus, une seule feuille qui monte du bas. */}
      <Modal
        visible={feuille !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setFeuille(null)}
      >
        <Pressable style={s.voileBas} onPress={() => setFeuille(null)}>
          {/* Le contenu ne referme pas la feuille quand on le touche : on
              tape des noms dedans. */}
          <Pressable
            style={[s.feuille, { backgroundColor: t.cdSolid, borderColor: t.cb }]}
            onPress={() => {}}
          >
            <Poignee />
            {contenu?.genre === "carton" ? (
              <>
                <View style={s.feuilleTete}>
                  <View
                    style={[
                      s.carton,
                      { backgroundColor: contenu.carton === "YELLOW_CARD" ? JAUNE : ROUGE },
                    ]}
                  />
                  <Text style={[s.feuilleTitre, { color: t.ink }]}>
                    {contenu.carton === "YELLOW_CARD" ? "Carton jaune pour…" : "Carton rouge pour…"}
                  </Text>
                </View>
                <ScrollView style={s.liste} contentContainerStyle={{ paddingVertical: 8 }}>
                  {(contenu.camp === "A" ? vue.teamA : vue.teamB).map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => void donnerCarton(p.id)}
                      style={({ pressed }) => [
                        s.ligneChoix,
                        pressed && { backgroundColor: "rgba(255,255,255,0.12)" },
                      ]}
                    >
                      <Avatar nom={p.name} photo={p.photo} t={t} taille={30} />
                      <Text style={[s.nomJoueur, { color: t.ink }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={s.feuilleTete}>
                  <Text style={[s.feuilleTitre, { color: t.ink }]}>Événements</Text>
                  {/* Le son se coupe ici et nulle part ailleurs, comme sur le
                      site : c'est le seul panneau qu'on ouvre sans être en
                      train de compter un but. Le mettre sur la barre du bas,
                      c'est le couper par mégarde à la place d'annuler. */}
                  <View style={s.feuilleActions}>
                    <BoutonVerre
                      t={t}
                      titre={son ? "Son" : "Muet"}
                      onPress={() => setSon(basculerSon())}
                    />
                    <BoutonRond
                      t={t}
                      symbole="×"
                      etiquette="Fermer"
                      onPress={() => setFeuille(null)}
                    />
                  </View>
                </View>
                {vue.events.length === 0 ? (
                  <Text style={[s.aide, { color: t.i2, paddingVertical: 24, textAlign: "center" }]}>
                    Rien pour l&apos;instant. Ça va venir.
                  </Text>
                ) : (
                  <ScrollView style={s.liste} contentContainerStyle={{ paddingBottom: 8 }}>
                    {/* Le plus récent en haut : c'est celui qu'on vient de
                        taper, donc celui qu'on vient de se tromper. */}
                    {[...vue.events].reverse().map((e, i) => (
                      <View
                        key={e.id}
                        style={[
                          s.evenement,
                          i > 0 && { borderTopWidth: 1, borderTopColor: t.sep },
                        ]}
                      >
                        <Text style={[s.minute, { color: t.i2 }]}>
                          {e.minute != null ? `${e.minute}′` : "—"}
                        </Text>
                        {e.type === "HALF_TIME" ? (
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[s.nomEvenement, { color: t.i2 }]}>— Mi-temps —</Text>
                          </View>
                        ) : (
                          <>
                            <Marqueur type={e.type} camp={e.team} couleurA={couleurA} couleurB={couleurB} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[s.nomEvenement, { color: t.ink }]} numberOfLines={1}>
                                {nomDeLigne(e, match.teamAName, match.teamBName)}
                              </Text>
                              {e.assistName && (
                                <Text style={[s.passeur, { color: t.i3 }]} numberOfLines={1}>
                                  passe de {e.assistName}
                                </Text>
                              )}
                            </View>
                          </>
                        )}
                        <Pressable
                          onPress={() => void retirer(e)}
                          disabled={!enJeu}
                          accessibilityRole="button"
                          accessibilityLabel={`Annuler ${quoiAnnuler(e.type) ?? "cet événement"}${
                            e.playerName ? ` de ${e.playerName}` : ""
                          }`}
                          style={s.cibleAnnuler}
                        >
                          <Text style={[s.annuler, { color: enJeu ? ROUGE : t.i3 }]}>Annuler</Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
                {/* La bande du pied est cachée par cette feuille : elle se
                    répète ici, pour qu'un retrait fait depuis la liste se
                    rattrape aussi sans la refermer. */}
                {retire && (
                  <View style={s.retraitFeuille}>
                    <BandeRetrait
                      t={t}
                      phrase={phraseRetrait(
                        retire,
                        retire.team === "B" ? match.teamBName : match.teamAName,
                      )}
                      onRetablir={() => void retablir()}
                    />
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Ecran>
  );
}

/// « Annuler », et ce qu'il retire en petit dessous : « le but », « le
/// carton », « la mi-temps » (le bouton du site). Seul, le mot se lisait
/// « annuler le match » — et il est collé à « Pause ».
function BoutonAnnuler({
  t,
  dernier,
  onPress,
}: {
  t: Jetons;
  dernier: Evenement | undefined;
  onPress: () => void;
}) {
  const quoi = quoiAnnuler(dernier?.type);
  return (
    <Pressable
      onPress={onPress}
      disabled={!dernier}
      accessibilityRole="button"
      accessibilityLabel={
        dernier
          ? `Annuler ${quoi}${dernier.playerName ? ` de ${dernier.playerName}` : ""}`
          : "Rien à annuler"
      }
      accessibilityState={{ disabled: !dernier }}
      style={({ pressed }) => [
        s.annulerPied,
        { backgroundColor: t.gl ?? "rgba(255,255,255,0.12)", borderColor: t.gb ?? "rgba(255,255,255,0.16)" },
        { opacity: !dernier ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={t.ink ?? "#ffffff"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M4 9h11a5 5 0 0 1 0 10H8" />
        <Path d="M8 4.5L3.5 9 8 13.5" />
      </Svg>
      <View style={s.annulerTextes}>
        <Text style={[s.annulerMot, { color: t.ink }]} numberOfLines={1}>
          Annuler
        </Text>
        {quoi ? (
          <Text style={[s.annulerQuoi, { color: t.i2 }]} numberOfLines={1}>
            {quoi}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/// Ce que dit une ligne de chronologie.
///
/// Un csc est crédité à l'équipe qui en profite : sans auteur, on nomme le
/// camp qui l'a concédé — « csc de Rouges » — plutôt que de laisser une ligne
/// sans sujet.
function nomDeLigne(
  e: { type: string; team: "A" | "B"; playerName: string | null },
  nomA: string,
  nomB: string,
): string {
  if (e.playerName) return e.type === "OWN_GOAL" ? `${e.playerName} (csc)` : e.playerName;
  if (e.type === "OWN_GOAL") return `csc de ${e.team === "B" ? nomA : nomB}`;
  return e.team === "B" ? nomB : nomA;
}

/// La pastille de gauche d'une ligne : la chasuble du camp pour un but, le
/// carton lui-même pour un carton. La forme suffit à distinguer les deux d'un
/// coup d'œil, sans légende.
function Marqueur({
  type,
  camp,
  couleurA,
  couleurB,
}: {
  type: string;
  camp: "A" | "B";
  couleurA: string;
  couleurB: string;
}) {
  if (type === "YELLOW_CARD" || type === "RED_CARD") {
    return <View style={[s.carton, { backgroundColor: type === "YELLOW_CARD" ? JAUNE : ROUGE }]} />;
  }
  return <View style={[s.pastilleCamp, { backgroundColor: camp === "A" ? couleurA : couleurB }]} />;
}

/// Le compteur de cartons d'une tuile : le carton, et son nombre s'il y en a
/// plusieurs.
function Marque({ couleur, nombre }: { couleur: string; nombre: number }) {
  return (
    <View style={s.marqueCarton}>
      <View style={[s.cartonPetit, { backgroundColor: couleur }]} />
      {nombre > 1 && <Text style={[s.marqueNombre, { color: couleur }]}>{nombre}</Text>}
    </View>
  );
}

/// « mer. 9 sept. » — la même légende que la barre du site.
function legende(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Match";
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/// Le tableau de marque. La taille se calcule (`tailleDuScore`) : un score à
/// deux chiffres tient dans sa colonne sans qu'on demande à UIKit de réduire
/// le texte — au récap, cette réduction automatique a déjà peint un 2 à 1 en
/// une dizaine de points. Le chiffre qu'on lit à deux mètres, entre deux
/// actions, ne doit dépendre de rien.
function Chiffre({ valeur, perd }: { valeur: number; perd: boolean }) {
  return (
    <Text
      allowFontScaling={false}
      style={[s.chiffre, tailleDuScore(valeur, 132), perd && s.chiffrePerd]}
      numberOfLines={1}
    >
      {valeur}
    </Text>
  );
}

/// L'état de la file, en trois mots.
///
/// Ce qui compte au bord du terrain n'est pas le détail mais la réponse à une
/// seule question : « est-ce que ce que je viens de taper est parti ? »
function Pastille({ etat }: { etat: EtatSynchro | null }) {
  if (!etat) return <View style={{ width: 92 }} />;
  const texte = etat.reconnexionRequise
    ? "Reconnecte-toi"
    : etat.bloquees > 0
      ? `${etat.bloquees} refusée${etat.bloquees > 1 ? "s" : ""}`
      : etat.enAttente > 0
        ? `${etat.enAttente} à envoyer`
        : !etat.enLigne
          ? "Hors ligne"
          : "À jour";
  const alerte = etat.reconnexionRequise || etat.bloquees > 0;
  return (
    <Text
      style={[s.pastilleTexte, { color: alerte ? ROUGE : "rgba(255,255,255,0.62)" }]}
      numberOfLines={1}
    >
      {texte}
    </Text>
  );
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  aide: { fontSize: 15 },

  barre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  legende: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
  },
  // « À jour », « 2 à envoyer », « Hors ligne » : la réponse à « est-ce que
  // mon but est parti ? ». À 13 points en 0,5 d'opacité, on ne la lisait pas
  // au soleil — 600 et l'encre secondaire du produit.
  pastilleTexte: { width: 92, fontSize: 13, fontWeight: "600", textAlign: "right" },
  droite: { flexDirection: "row", alignItems: "center", gap: 8 },

  marque: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  chiffre: {
    flex: 1,
    fontWeight: "800",
    textAlign: "center",
    color: "#ffffff",
    // Chasse tabulaire : le 1 occupe la place du 8, donc le score ne se
    // décale plus d'un point à chaque but.
    fontVariant: ["tabular-nums"],
  },
  chiffrePerd: { color: "rgba(255,255,255,0.4)" },
  milieu: { alignItems: "center", gap: 4, paddingHorizontal: 8, minWidth: 116 },
  // Le reste du milieu (le point, le chrono, la pilule de mi-temps) vit
  // maintenant dans composants/match/Horloge.tsx, avec ses styles.
  etat: { fontSize: 17, fontWeight: "600" },

  equipes: { flexDirection: "row", paddingHorizontal: 24, paddingTop: 4 },
  equipe: { flex: 1, alignItems: "center", gap: 8, minWidth: 0 },
  nomEquipe: { fontSize: 22, fontWeight: "600", letterSpacing: -0.3 },

  corps: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  cartes: { flexDirection: "row", gap: 10 },
  carte: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.085)",
    overflow: "hidden",
    minWidth: 0,
  },
  // Deux colonnes sur un téléphone de 393 : une tuile fait 177 points, dont
  // 157 utiles. Chaque point pris à la marge, à l'écart et à l'avatar est un
  // point rendu au NOM — et les prénoms du club sont longs (« Abdoulaye »,
  // « Mouhamadou »). Marge 12 → 10, écart 10 → 8, avatar 34 → 30 : le nom
  // passe de 89 à 97 points, et le compteur de buts en gagne quatre au
  // passage sans que le nom en perde.
  joueur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 58,
    paddingHorizontal: 10,
  },
  separe: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)" },
  nomJoueur: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "500" },
  // Le compteur de buts est le deuxième chiffre de l'écran, après le score :
  // c'est lui qu'on relit entre deux actions. En 24/800 et en chasse
  // tabulaire, avec sa colonne réservée — le nom ne recule plus d'un point
  // quand le premier but tombe.
  buts: {
    fontSize: 24,
    fontWeight: "800",
    minWidth: 18,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  csc: { height: 46, alignItems: "center", justifyContent: "center" },
  // 0,66 et non 0,55 : c'est une cible qu'on vise en plein soleil, pas une
  // légende.
  cscTexte: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.66)" },

  // Un carton se dessine : un rectangle de couleur aux proportions d'un
  // carton d'arbitre. Aucune icône à charger, aucune police à attendre.
  cartons: { flexDirection: "row", height: 44, alignItems: "center", justifyContent: "center", gap: 8 },
  cibleCarton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  carton: { width: 15, height: 21, borderRadius: 3 },
  cartonPetit: { width: 9, height: 13, borderRadius: 2 },
  marqueCarton: { flexDirection: "row", alignItems: "center", gap: 2 },
  marqueNombre: { fontSize: 12, fontWeight: "700" },

  // Le mode correction : le bandeau, la bande du retardataire, l'entrée.
  // Valeurs relevées sur `.live-compo`, `.live-ajout` et `.live-compo-entree`.
  bandeau: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  bandeauTitre: { fontSize: 17, fontWeight: "600" },
  bandeauAide: { fontSize: 13 },
  termine: { height: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  termineTexte: { fontSize: 17, fontWeight: "600" },
  refus: { fontSize: 13, fontWeight: "600", paddingHorizontal: 20, paddingTop: 8 },
  // La tuile qui vient de changer de colonne. Le site l'anime en fondu depuis
  // un fond clair ; ici c'est le même fond, tenu 400 ms puis retiré — sans
  // Reanimated, qu'un éclair de cette durée ne justifie pas.
  arrive: { backgroundColor: "rgba(255,255,255,0.25)" },
  fleche: { fontSize: 20, fontWeight: "600", minWidth: 14, textAlign: "right" },
  ajout: {
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  ajoutTitre: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  ajoutLigne: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  ajoutNom: { flex: 1, minWidth: 0, fontSize: 17 },
  ajoutBouton: {
    height: 44,
    maxWidth: 110,
    paddingHorizontal: 12,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  // Le nom de l'équipe est écrit SUR la chasuble : 15 en 700 pour qu'il tienne
  // le contraste d'un orange vif comme d'un noir. À 13 en 600, on visait un
  // bouton dont on ne lisait pas l'étiquette.
  ajoutBoutonTexte: { fontSize: 15, fontWeight: "700" },
  entree: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 6,
  },
  entreeTexte: { fontSize: 15, fontWeight: "600" },

  invite: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(14,14,24,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  inviteTitre: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  choix: { gap: 8, paddingRight: 14 },
  pastille: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  pied: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
  },

  voile: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  boite: { width: "100%", maxWidth: 340, borderRadius: 26, borderWidth: 1, padding: 20 },
  boiteTitre: { fontSize: 20, fontWeight: "600", textAlign: "center", paddingBottom: 8 },
  // La phrase qui dit la suite, sous le score : plus petite que lui, pour
  // qu'on lise d'abord le score et ensuite ce qui va se passer.
  boiteSuite: { fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 8 },

  // Les feuilles qui montent du bas. Elles s'arrêtent à 78 % de l'écran : on
  // doit toujours voir le score derrière, c'est lui qui dit où on en est.
  voileBas: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  feuille: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    maxHeight: "78%",
  },
  feuilleTete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 4,
  },
  feuilleActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  feuilleTitre: { fontSize: 20, fontWeight: "600", paddingVertical: 8 },
  liste: { flexGrow: 0 },
  ligneChoix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 54,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  etoile: { fontSize: 20 },

  // La chronologie est le panneau qu'on ouvre pour RATTRAPER une erreur : la
  // minute est ce qui permet de reconnaître le bon événement. À 13 points
  // dans l'encre tertiaire, on la cherchait. En 15, tabulaire, les minutes
  // s'alignent en colonne et se lisent d'un coup.
  evenement: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  minute: { width: 38, fontSize: 15, fontVariant: ["tabular-nums"] },
  pastilleCamp: { width: 10, height: 10, borderRadius: 5 },
  // 17 et 13 : le corps et la légende du produit. 16 et 12 n'appartenaient à
  // aucune des deux échelles.
  nomEvenement: { fontSize: 17, fontWeight: "500" },
  passeur: { fontSize: 13 },
  annuler: { fontSize: 15, fontWeight: "600" },
  cibleAnnuler: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  retraitFeuille: { paddingTop: 8, marginHorizontal: -14 },

  // « Annuler » du pied : le verre de 52 du site, l'icône de retour, et ce
  // qu'il retire en 12 sous le mot.
  annulerPied: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  annulerTextes: { alignItems: "flex-start", flexShrink: 1 },
  annulerMot: { fontSize: 17, fontWeight: "600", lineHeight: 19 },
  annulerQuoi: { fontSize: 12, fontWeight: "500", lineHeight: 14 },
});

/// Ce qu'on montre quand la feuille plante en plein match.
///
/// Expo Router reconnaît un export nommé `ErrorBoundary` par fichier de route :
/// il n'y a rien à câbler dans `_layout.tsx`. Il n'y en a qu'UN dans toute
/// l'app, ici, et c'est délibéré (spec 0004, Q6) : la feuille est le seul écran
/// qu'on tient à une main pendant qu'on joue, et le seul dont le plantage coûte
/// une soirée. Les autres écrans suivront dans leur propre lot.
///
/// **Rien n'est perdu, et c'est le message principal.** La feuille ne vit pas
/// dans l'état de React : elle est dans SQLite, écrite à chaque but. « Reprendre
/// la feuille » relit la base, et les buts déjà saisis sont là.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = JETONS_NEUTRES;

  useEffect(() => {
    // Le rapport reste sur le téléphone. Rien ne part chez un tiers
    // (constitution, article VI). `enregistrerPlantage` n'échoue jamais : une
    // exception ici remplacerait cet écran par un écran blanc, c'est-à-dire
    // qu'elle transformerait un plantage rattrapé en plantage définitif.
    void enregistrerPlantage(error, "la feuille de match");
  }, [error]);

  return (
    <Ecran>
      <View style={sPanne.contenu}>
        <Text style={[sPanne.titre, { color: t.ink }]}>La feuille s'est arrêtée</Text>
        <Text style={[sPanne.aide, { color: t.i2 }]}>
          Rien n'est perdu : les buts déjà saisis sont dans le téléphone.
          Reprends la feuille — elle se relit depuis la base.
        </Text>
        <BoutonPlein t={t} titre="Reprendre la feuille" onPress={retry} />
        <Text style={[sPanne.technique, { color: t.i3 }]}>{error.message}</Text>
      </View>
    </Ecran>
  );
}

const sPanne = StyleSheet.create({
  contenu: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  titre: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  aide: { fontSize: 16, textAlign: "center", lineHeight: 22 },
  technique: { fontSize: 12, textAlign: "center", marginTop: 6 },
});
