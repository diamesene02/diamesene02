import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
import { JETONS_NEUTRES, type Jetons } from "../../lib/couleurs";
import { themeTokens } from "../../lib/noyau/theme";
import { fmt, nowElapsed } from "../../lib/noyau/clock";
import { estRetro } from "../../lib/noyau/retro";
import type { LivePlayer } from "../../lib/match/local";
import type { LocalClub } from "../../lib/outbox/types";
import type { EtatSynchro } from "../../lib/outbox/sync";

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

type Vue = Awaited<ReturnType<ReturnType<typeof useNoyau>["local"]["getLocalMatch"]>>;
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { local, drain } = useNoyau();

  const [vue, setVue] = useState<Vue>(null);
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
  const [, setTic] = useState(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteurBouge = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ce qu'affiche la feuille pendant qu'elle redescend. Sans cette mémoire,
  // fermer le choix d'un carton ferait clignoter « Événements » le temps de
  // l'animation : le contenu disparaît avant le panneau.
  const derniereFeuille = useRef<Feuille | null>(null);

  const relire = useCallback(async () => {
    if (!id) return;
    setVue(await local.getLocalMatch(id));
  }, [id, local]);

  useEffect(() => {
    void relire();
  }, [relire]);

  useEffect(() => drain.abonner(setEtatSynchro), [drain]);

  const match = vue?.match;
  const clubId = match?.clubId;

  useEffect(() => {
    if (!clubId) return;
    void local.getLocalClub(clubId).then((c) => setClub(c ?? null));
  }, [local, clubId]);

  const retro = match ? estRetro(match.playedAt) : false;
  const tourne = Boolean(match?.clockRunningSince);

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

  // Rien ne tourne en base : le temps se dérive des deux colonnes du chrono.
  // Un tic de 500 ms suffit, l'affichage est à la seconde.
  useEffect(() => {
    if (!tourne || retro) return;
    const h = setInterval(() => setTic((n) => n + 1), 500);
    return () => clearInterval(h);
  }, [tourne, retro]);

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
    },
    [],
  );

  if (!vue || !match) {
    return (
      <Ecran>
        <View style={s.centre}>
          <ActivityIndicator color="#fff" />
          <Text style={[s.aide, { color: JETONS_NEUTRES.i2 }]}>Un instant…</Text>
        </View>
      </Ecran>
    );
  }

  const couleurA = club?.colorA ?? "#ffffff";
  const couleurB = club?.colorB ?? "#111111";
  const t: Jetons = club ? themeTokens(couleurA, couleurB, "dark") : JETONS_NEUTRES;
  const ecoule = nowElapsed({
    elapsedMs: match.clockElapsedMs ?? 0,
    runningSince: match.clockRunningSince ?? null,
  });
  const depasse =
    club?.matchDurationMin != null && ecoule > club.matchDurationMin * 60_000;
  const enJeu = match.status === "LIVE";
  // Sur un match contre un adversaire extérieur, l'équipe B n'est pas une
  // équipe du club : il n'y a personne à y envoyer, et la couche locale refuse
  // le déplacement. Le mode n'a donc pas lieu d'exister sur ces matchs.
  const corrigeable = enJeu && match.kind !== "EXTERNAL";
  const enCorrection = compo && corrigeable;

  function armerInvite(x: Invite) {
    if (minuteur.current) clearTimeout(minuteur.current);
    setInvite(x);
    minuteur.current = setTimeout(() => setInvite(null), INVITE_MS);
  }

  function fermerInvite() {
    if (minuteur.current) clearTimeout(minuteur.current);
    setInvite(null);
  }

  async function marquer(camp: "A" | "B", joueur: LivePlayer) {
    Vibration.vibrate(12);
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
    Vibration.vibrate(12);
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
    if (!(await local.undoLastGoalOf(match!.id, joueur.id))) return;
    Vibration.vibrate(30);
    fermerInvite();
    await relire();
    void drain.relancer();
  }

  /// Annule un événement précis — le bouton « Annuler » de la barre du bas
  /// (le dernier, quel qu'il soit) et chaque ligne de la chronologie passent
  /// par ici. La remise en première période d'une mi-temps annulée est tenue
  /// par `removeEvent` : les deux chemins en héritent, sans la réécrire.
  async function annulerEvenement(eventId: string) {
    if (!(await local.removeEvent(match!.id, eventId))) return;
    Vibration.vibrate(30);
    if (invite?.eventId === eventId) fermerInvite();
    await relire();
    void drain.relancer();
  }

  async function annulerDernier() {
    const dernier = vue!.events[vue!.events.length - 1];
    if (!dernier) return;
    await annulerEvenement(dernier.id);
  }

  /// Un carton, pour un joueur du camp de la carte où on l'a demandé.
  ///
  /// Le score n'en bouge pas — c'est le compteur de la tuile et la
  /// chronologie qui le montrent. Vibration courte : on veut savoir que c'est
  /// pris sans quitter le jeu des yeux.
  async function donnerCarton(joueurId: string) {
    if (feuille?.genre !== "carton") return;
    const { camp, carton } = feuille;
    setFeuille(null);
    Vibration.vibrate(18);
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
    Vibration.vibrate(18);
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
    Vibration.vibrate(18);
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

  async function siffler() {
    if (await local.siffletMiTemps(match!.id)) {
      Vibration.vibrate(30);
      await relire();
    }
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

  async function terminer(mvpId: string | null) {
    setMvpOuvert(false);
    await local.finishMatch(match!.id, mvpId, Math.round(ecoule / 60_000) || null);
    void drain.relancer();
    router.replace("/clubs");
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
        <BoutonRond
          t={t}
          symbole="‹"
          etiquette="Retour"
          onPress={() => router.replace("/clubs")}
        />
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
            <>
              <View style={s.etatLigne}>
                <View
                  style={[
                    s.point,
                    { backgroundColor: tourne ? "#ff453a" : "rgba(255,255,255,0.5)" },
                  ]}
                />
                <Text
                  style={[s.etat, { color: tourne ? "#ff453a" : "rgba(255,255,255,0.7)" }]}
                >
                  {tourne ? "En direct" : "Pause"}
                </Text>
              </View>
              <Text style={[s.horloge, depasse && { color: "#ff453a" }]}>{fmt(ecoule)}</Text>
              <Pressable onPress={() => void siffler()} hitSlop={8} disabled={(match.period ?? 1) >= 2}>
                <Text style={s.periode}>
                  {(match.period ?? 1) === 1 ? "1re · mi-temps ›" : "2de"}
                </Text>
              </Pressable>
            </>
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
            <EcussonChasuble couleur={e.couleur} lettre={e.nom[0] ?? "?"} />
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

      {enCorrection && refus && (
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
                    taille={34}
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
                    <Pressable
                      key={carton}
                      onPress={() => setFeuille({ genre: "carton", camp: e.camp, carton })}
                      disabled={!enJeu}
                      accessibilityLabel={`Carton ${mot} pour ${e.nom}`}
                      hitSlop={6}
                      style={({ pressed }) => [s.carton, { backgroundColor: couleur }, pressed && { opacity: 0.6 }]}
                    />
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
            <BoutonVerre
              t={t}
              titre="Annuler"
              onPress={() => void annulerDernier()}
              disabled={vue.events.length === 0}
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
            <View style={{ height: 16 }} />
            <BoutonPlein
              t={t}
              titre={retro ? "Enregistrer" : "Terminer"}
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
                  <BoutonRond
                    t={t}
                    symbole="×"
                    etiquette="Fermer"
                    onPress={() => setFeuille(null)}
                  />
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
                        <Text style={[s.minute, { color: t.i3 }]}>
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
                          onPress={() => void annulerEvenement(e.id)}
                          disabled={!enJeu}
                          hitSlop={8}
                          accessibilityLabel="Annuler cet événement"
                        >
                          <Text style={[s.annuler, { color: enJeu ? ROUGE : t.i3 }]}>Annuler</Text>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Ecran>
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

function Chiffre({ valeur, perd }: { valeur: number; perd: boolean }) {
  return (
    <Text style={[s.chiffre, perd && s.chiffrePerd]} numberOfLines={1} adjustsFontSizeToFit>
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
      style={[s.pastilleTexte, { color: alerte ? "#ff453a" : "rgba(255,255,255,0.5)" }]}
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
  pastilleTexte: { width: 92, fontSize: 13, textAlign: "right" },
  droite: { flexDirection: "row", alignItems: "center", gap: 8 },

  marque: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  chiffre: {
    flex: 1,
    fontSize: 132,
    fontWeight: "800",
    letterSpacing: -6.6,
    lineHeight: 138,
    textAlign: "center",
    color: "#ffffff",
  },
  chiffrePerd: { color: "rgba(255,255,255,0.4)" },
  milieu: { alignItems: "center", gap: 4, paddingHorizontal: 8, minWidth: 116 },
  etatLigne: { flexDirection: "row", alignItems: "center", gap: 7 },
  point: { width: 8, height: 8, borderRadius: 4 },
  etat: { fontSize: 17, fontWeight: "600" },
  horloge: { fontSize: 17, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  periode: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.5)" },

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
  joueur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 58,
    paddingHorizontal: 12,
  },
  separe: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  nomJoueur: { flex: 1, fontSize: 17, fontWeight: "500" },
  buts: { fontSize: 22, fontWeight: "700", minWidth: 14, textAlign: "right" },
  csc: { height: 46, alignItems: "center", justifyContent: "center" },
  cscTexte: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.55)" },

  // Un carton se dessine : un rectangle de couleur aux proportions d'un
  // carton d'arbitre. Aucune icône à charger, aucune police à attendre.
  cartons: { flexDirection: "row", height: 44, alignItems: "center", justifyContent: "center", gap: 18 },
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
  ajoutNom: { flex: 1, minWidth: 0, fontSize: 15 },
  ajoutBouton: {
    height: 34,
    maxWidth: 110,
    paddingHorizontal: 12,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  ajoutBoutonTexte: { fontSize: 13, fontWeight: "600" },
  entree: { alignSelf: "center", paddingVertical: 4, paddingHorizontal: 12, marginTop: 10 },
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
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
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

  evenement: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  minute: { width: 34, fontSize: 13 },
  pastilleCamp: { width: 10, height: 10, borderRadius: 5 },
  nomEvenement: { fontSize: 16, fontWeight: "500" },
  passeur: { fontSize: 12 },
  annuler: { fontSize: 15, fontWeight: "600" },
});
