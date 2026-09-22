import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { CarteVerre, EcussonChasuble, Filet, Onglets } from "../base";
import { IconeCalendrier } from "../Icones";
import LigneScore from "../LigneScore";
import { jeton, type Jetons } from "../../lib/couleurs";
import { ini, lettre } from "../../lib/ini";
import { fmt } from "../../lib/noyau/clock";
import { messageErreur } from "../../lib/erreurs";
import { choix, succes } from "../../lib/haptique";
import {
  repondrePresence,
  type Accueil,
  type MatchAccueil,
  type StatutReponse,
} from "../../lib/api";
import {
  heureDe,
  jourAbregeDe,
  jourCourtDe,
  jourLongDe,
  ligneProgramme,
  ligneReponses,
  ligneSoireeDuJour,
  quandRelatifDe,
  type Onglet,
  type Programme,
  type VueMatchs,
} from "./logique";

/// La carte des matchs de l'accueil : la dernière soirée, ce soir, à venir —
/// seuls les onglets qui ont quelque chose à montrer (logique.ts, `vueMatchs`).
/// Les dessins sont ceux du site (app/c/[slug]/page.tsx et accueil.css).
export default function CarteMatchs({
  t,
  vue,
  onglet,
  onOnglet,
  couleurA,
  couleurB,
  clubCourt,
  soiree,
  horlogeActive,
  clubId,
  monJoueurId,
  abonne,
  equipesDuJour,
  nomsEquipes,
  ouvrirSoiree,
  ouvrirMatch,
  ouvrirRecap,
  ouvrirMatchs,
  onRepondu,
}: {
  t: Jetons;
  vue: VueMatchs;
  onglet: Onglet | null;
  onOnglet: (o: Onglet) => void;
  couleurA: string;
  couleurB: string;
  /// Le camp A d'un match externe : « Lundi Soir » pour « FC Lundi Soir ».
  clubCourt: string;
  /// La soirée de la bannière : pour compter ses présents sous « À venir »
  /// quand c'est la même.
  soiree: Accueil["soiree"];
  /// Le chrono d'un match en direct ne tourne que si l'écran est affiché.
  horlogeActive: boolean;
  clubId: string;
  /// Mon profil de joueur dans ce club. Sans lui, pas de « Je serai là ».
  monJoueurId: string | null;
  /// Je suis abonné : sans réponse, je suis compté présent.
  abonne: boolean;
  /// La compo préparée de la soirée du jour, quand la route la donne (par le
  /// coup d'envoi) ; sinon on ne dit que si elle est faite.
  equipesDuJour: { nomA: string; nomB: string; compoA: number; compoB: number } | null;
  /// Les noms des chasubles du club, quand la compo du jour est inconnue.
  nomsEquipes: { a: string; b: string };
  ouvrirSoiree: (id: string) => void;
  /// Un match joué ou en cours de ce soir : la feuille s'il est sur ce
  /// téléphone, le récap sinon — c'est à l'écran d'en décider.
  ouvrirMatch: (m: MatchAccueil) => void;
  ouvrirRecap: (id: string) => void;
  ouvrirMatchs: () => void;
  onRepondu: () => void;
}) {
  const ligne = (m: MatchAccueil) =>
    m.statut === "LIVE" ? (
      <LigneDirect
        t={t}
        m={m}
        couleurA={couleurA}
        couleurB={couleurB}
        active={horlogeActive}
        onPress={() => ouvrirMatch(m)}
      />
    ) : (
      <LigneScore
        t={t}
        nomA={m.nomA}
        nomB={m.nomB}
        couleurA={couleurA}
        couleurB={couleurB}
        scoreA={m.scoreA}
        scoreB={m.scoreB}
        etat="Terminé"
        heure={m.heure ?? heureDe(m.joueLe)}
        onPress={() => ouvrirMatch(m)}
      />
    );

  let contenu: React.ReactNode = null;
  if (onglet === "derniere" && vue.derniere) {
    const d = vue.derniere;
    contenu = (
      <>
        <LigneSoiree
          t={t}
          texte={`Soirée du ${d.jourCourt ?? jourCourtDe(d.date)}`}
          onPress={d.soireeId ? () => ouvrirSoiree(d.soireeId!) : ouvrirMatchs}
        />
        {d.matchs.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Filet t={t} />}
            {ligne(m)}
          </View>
        ))}
      </>
    );
  } else if (onglet === "soir") {
    const joues = vue.joues.length;
    contenu = (
      <>
        {vue.soireeCeSoir && (
          <LigneSoiree
            t={t}
            texte={`Soirée du ${jourCourtDe(vue.soireeCeSoir.date)}`}
            onPress={() => ouvrirSoiree(vue.soireeCeSoir!.id)}
          />
        )}
        {vue.joues.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Filet t={t} />}
            {ligne(m)}
          </View>
        ))}
        {vue.programmesCeSoir.map((m, i) => (
          <View key={m.id}>
            {(joues > 0 || i > 0) && <Filet t={t} />}
            <LigneAVenir
              t={t}
              m={m}
              etat={`Match ${joues + i + 1}`}
              couleurA={couleurA}
              couleurB={couleurB}
              onPress={() => ouvrirRecap(m.id)}
            />
          </View>
        ))}
        {/* Le lundi après-midi, avant le premier match, c'est la soirée
            qu'on vient voir : qui vient, et « Je serai là ». */}
        {joues === 0 &&
          vue.programmesCeSoir.length === 0 &&
          (vue.soireeCeSoir ? (
            <BlocSoiree
              t={t}
              id={vue.soireeCeSoir.id}
              heure={vue.soireeCeSoir.heure ?? heureDe(vue.soireeCeSoir.date)}
              lieu={vue.soireeCeSoir.lieu ?? null}
              nomA={equipesDuJour?.nomA ?? nomsEquipes.a}
              nomB={equipesDuJour?.nomB ?? nomsEquipes.b}
              ligne={ligneSoireeDuJour(vue.soireeCeSoir, equipesDuJour)}
              couleurA={couleurA}
              couleurB={couleurB}
              clubId={clubId}
              monJoueurId={monJoueurId}
              initial={vue.soireeCeSoir.maReponse}
              abonne={abonne}
              ouvrirSoiree={ouvrirSoiree}
              onRepondu={onRepondu}
            />
          ) : (
            <Text style={[s.vide, { color: jeton(t, "i2") }]}>Aucun match joué pour l'instant.</Text>
          ))}
      </>
    );
  } else if (onglet === "venir") {
    const suivante = vue.suivante;
    const relatif = suivante
      ? quandRelatifDe(suivante.date, new Date(), { heure: suivante.heure })
      : null;
    const jourLong = suivante ? (suivante.jourLong ?? jourLongDe(suivante.date)) : "";
    // Serveur sans `aVenir` : on n'a que la soirée de la bannière, sans ses
    // équipes ni ses réponses. Sa ligne d'en-tête vaut mieux qu'un onglet
    // qui annonce le contraire de la bannière.
    const seule = suivante ? null : vue.soireeSansDetail;
    const seuleTexte = seule
      ? [
          quandRelatifDe(seule.date, new Date(), {
            jours: seule.joursAvant,
            heure: seule.heure,
          }),
          seule.jourLong ?? jourLongDe(seule.date),
        ]
          .filter(Boolean)
          .join(" · ")
      : "";
    contenu = (
      <>
        {suivante && (
          <>
            <LigneSoiree
              t={t}
              texte={relatif ? `${relatif} · ${jourLong}` : jourLong}
              onPress={() => ouvrirSoiree(suivante.id)}
            />
            <BlocSoiree
              t={t}
              id={suivante.id}
              heure={suivante.heure ?? heureDe(suivante.date)}
              lieu={suivante.lieu}
              nomA={suivante.nomA}
              nomB={suivante.nomB}
              ligne={ligneReponses(suivante, soiree)}
              couleurA={couleurA}
              couleurB={couleurB}
              clubId={clubId}
              monJoueurId={monJoueurId}
              initial={suivante.maReponse ?? null}
              abonne={abonne}
              ouvrirSoiree={ouvrirSoiree}
              onRepondu={onRepondu}
            />
          </>
        )}
        {seule && (
          // Seule sous les onglets, la ligne d'en-tête n'a que ses 4 points
          // de bas : la carte se refermait dessus.
          <View style={s.seule}>
            <LigneSoiree t={t} texte={seuleTexte} onPress={() => ouvrirSoiree(seule.id)} />
          </View>
        )}
        {vue.programmesPlusTard.map((m, i) => (
          <View key={m.id}>
            {(suivante || seule || i > 0) && <Filet t={t} />}
            <LigneProgramme
              t={t}
              m={m}
              couleurA={couleurA}
              couleurB={couleurB}
              clubCourt={clubCourt}
              onPress={() => ouvrirRecap(m.id)}
            />
          </View>
        ))}
      </>
    );
  }

  return (
    <CarteVerre t={t}>
      {vue.onglets.length > 0 && onglet ? (
        <>
          <Onglets
            t={t}
            onglets={vue.onglets}
            actif={onglet}
            onChange={(o) => {
              if (o !== onglet) choix();
              onOnglet(o);
            }}
          />
          {contenu}
        </>
      ) : (
        <Text style={[s.vide, { color: jeton(t, "i2") }]}>
          Aucun match joué, aucune soirée au calendrier.
        </Text>
      )}
    </CarteVerre>
  );
}

/// « 📅 Soirée du 7 sept. › » en tête d'onglet : l'icône calendrier, le texte,
/// le chevron collé au texte — pas repoussé au bord.
///
/// En retrait (15/600, `i2`) et non plus en blanc de 17 : elle redisait le
/// jour que la bannière venait d'annoncer, dans la même graisse que l'heure du
/// match juste dessous. Trois blancs qui se suivent, c'est trois titres. Elle
/// reste une destination — chevron, cible de 44 — mais elle légende.
function LigneSoiree({ t, texte, onPress }: { t: Jetons; texte: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [s.ligneSoiree, pressed && { opacity: 0.7 }]}
    >
      <IconeCalendrier couleur={jeton(t, "i2")} taille={18} />
      <Text style={[s.ligneSoireeTexte, { color: jeton(t, "i2") }]} numberOfLines={1}>
        {texte}
      </Text>
      {onPress ? <Text style={[s.chevronTexte, { color: jeton(t, "i3") }]}>›</Text> : null}
    </Pressable>
  );
}

/// Un match en direct : la ligne de score, le chrono qui tourne. Le chrono
/// part de l'heure du coup d'envoi, comme celui du site (`HorlogeDirect`) :
/// le serveur ne connaît pas les pauses de la feuille.
function LigneDirect({
  t,
  m,
  couleurA,
  couleurB,
  active,
  onPress,
}: {
  t: Jetons;
  m: MatchAccueil;
  couleurA: string;
  couleurB: string;
  active: boolean;
  onPress: () => void;
}) {
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return (
    <LigneScore
      t={t}
      nomA={m.nomA}
      nomB={m.nomB}
      couleurA={couleurA}
      couleurB={couleurB}
      scoreA={m.scoreA}
      scoreB={m.scoreB}
      etat="En direct"
      direct
      heure={fmt(Math.max(0, Date.now() - Date.parse(m.joueLe)))}
      onPress={onPress}
    />
  );
}

/// Un match programmé ce soir (`.accueil-a-venir`) : la ligne de score sans
/// chiffres, les écussons un peu effacés, « Match 3 » en gris et l'heure
/// dessous.
function LigneAVenir({
  t,
  m,
  etat,
  couleurA,
  couleurB,
  onPress,
}: {
  t: Jetons;
  m: Programme;
  etat: string;
  couleurA: string;
  couleurB: string;
  onPress: () => void;
}) {
  const heure = m.heure ?? heureDe(m.quand);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${m.nomA} contre ${m.nomB}, ${etat}, ${heure}`}
      style={({ pressed }) => [s.ligneAVenir, pressed && { opacity: 0.7 }]}
    >
      <Camp t={t} nom={m.nomA} couleur={couleurA} efface />
      <View style={s.videChiffre} />
      <View style={s.milieuAVenir}>
        <Text style={[s.etatAVenir, { color: jeton(t, "i2") }]} numberOfLines={1}>
          {etat}
        </Text>
        <Text style={[s.heureAVenir, { color: jeton(t, "i3") }]} numberOfLines={1}>
          {heure}
        </Text>
      </View>
      <View style={s.videChiffre} />
      <Camp t={t} nom={m.nomB} couleur={couleurB} efface />
    </Pressable>
  );
}

/// Un match programmé plus tard (`.accueil-prochaine.match`) : le jour et
/// l'heure, le genre et les présents. Un match externe met le club en A et
/// l'adversaire en B, sur l'écusson gris du site, à deux initiales.
function LigneProgramme({
  t,
  m,
  couleurA,
  couleurB,
  clubCourt,
  onPress,
}: {
  t: Jetons;
  m: Programme;
  couleurA: string;
  couleurB: string;
  clubCourt: string;
  onPress: () => void;
}) {
  const heure = m.heure ?? heureDe(m.quand);
  const quand = `${quandRelatifDe(m.quand, new Date(), { heure }) ?? m.jourAbrege ?? jourAbregeDe(m.quand)} · ${heure}`;
  const nomA = m.externe ? clubCourt : m.nomA;
  const detail = ligneProgramme(m);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nomA} contre ${m.nomB}, ${quand}, ${detail}`}
      style={({ pressed }) => [s.prochaine, s.programme, pressed && { opacity: 0.7 }]}
    >
      <Camp t={t} nom={nomA} couleur={couleurA} />
      <View style={s.milieuProchaine}>
        <Text style={[s.quand, { color: t.ink }]} numberOfLines={1}>
          {quand}
        </Text>
        <Text style={[s.lieu, { color: jeton(t, "i2") }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {m.externe ? (
        <View style={s.camp}>
          {/* `.ecusson.club` : radial #666 → #2a2a2e → #111, initiales en 19. */}
          <EcussonChasuble couleur="#2a2a2e" lettre={ini(m.nomB)} taille={56} corps={19} encre="#fff" />
          <Text style={[s.nomCamp, { color: jeton(t, "i2") }]} numberOfLines={1}>
            {m.nomB}
          </Text>
        </View>
      ) : (
        <Camp t={t} nom={m.nomB} couleur={couleurB} />
      )}
    </Pressable>
  );
}

/// Une soirée (`blocSoiree` du site) : écusson · heure et lieu · écusson,
/// puis qui vient et « Je serai là ». Dans « À venir », et dans « Ce soir »
/// tant qu'aucun match n'y est joué.
function BlocSoiree({
  t,
  id,
  heure,
  lieu,
  nomA,
  nomB,
  ligne,
  couleurA,
  couleurB,
  clubId,
  monJoueurId,
  initial,
  abonne,
  ouvrirSoiree,
  onRepondu,
}: {
  t: Jetons;
  id: string;
  heure: string;
  lieu: string | null;
  nomA: string;
  nomB: string;
  /// « 8 présents · Blanc 5 contre 5 Noir »
  ligne: string;
  couleurA: string;
  couleurB: string;
  clubId: string;
  monJoueurId: string | null;
  initial: StatutReponse | null;
  abonne: boolean;
  ouvrirSoiree: (id: string) => void;
  onRepondu: () => void;
}) {
  return (
    <>
      <Pressable
        onPress={() => ouvrirSoiree(id)}
        accessibilityRole="button"
        accessibilityLabel={`${nomA} contre ${nomB}, ${heure}${lieu ? `, ${lieu}` : ""}`}
        style={({ pressed }) => [s.prochaine, pressed && { opacity: 0.7 }]}
      >
        <Camp t={t} nom={nomA} couleur={couleurA} />
        <View style={s.milieuProchaine}>
          <Text style={[s.heureProchaine, { color: t.ink }]} numberOfLines={1}>
            {heure}
          </Text>
          {lieu ? (
            // « Urban Soccer Guyancourt » se lisait « Urban Soccer Guyan… » :
            // le lieu était en 15 dans une colonne serrée entre deux camps de
            // 88. Camps ramenés à 76, lieu en légende, et deux lignes en
            // dernier recours — un nom de salle ne se coupe pas.
            <Text style={[s.lieu, { color: jeton(t, "i2") }]} numberOfLines={2}>
              {lieu}
            </Text>
          ) : null}
        </View>
        <Camp t={t} nom={nomB} couleur={couleurB} />
      </Pressable>
      <View style={s.reponses}>
        <Text style={[s.reponsesTexte, { color: jeton(t, "i2") }]} numberOfLines={1}>
          {ligne}
        </Text>
        {monJoueurId && (
          <BoutonPresence
            t={t}
            clubId={clubId}
            soireeId={id}
            playerId={monJoueurId}
            initial={initial}
            abonne={abonne}
            onOuvrir={() => ouvrirSoiree(id)}
            onRepondu={onRepondu}
          />
        )}
      </View>
    </>
  );
}

/// Un camp : l'écusson de 60 et le nom dessous, sur 88 de large.
function Camp({
  t,
  nom,
  couleur,
  efface,
}: {
  t: Jetons;
  nom: string;
  couleur: string;
  efface?: boolean;
}) {
  return (
    <View style={s.camp}>
      <View style={efface && s.efface}>
        <EcussonChasuble couleur={couleur} lettre={lettre(nom)} taille={56} />
      </View>
      <Text style={[s.nomCamp, { color: jeton(t, "i2") }]} numberOfLines={1}>
        {nom}
      </Text>
    </View>
  );
}

const LIBELLES: Record<StatutReponse, string> = {
  IN: "Présent",
  MAYBE: "Peut-être",
  OUT: "Absent",
};

/// « Je serai là » en un tap (`BoutonPresence` du site). Une fois répondu, le
/// bouton devient la réponse, en couleur, qui mène à la soirée où l'on peut
/// la changer : l'accueil n'est pas l'endroit pour trois boutons.
///
/// Un abonné sans réponse est déjà compté présent : lui tendre « Je serai
/// là » lui faisait croire qu'il n'était pas inscrit, sous une bannière qui
/// le comptait. Il voit « Présent · abonné », et se désiste depuis la soirée.
function BoutonPresence({
  t,
  clubId,
  soireeId,
  playerId,
  initial,
  abonne,
  onOuvrir,
  onRepondu,
}: {
  t: Jetons;
  clubId: string;
  soireeId: string;
  playerId: string;
  /// Ma réponse EXPLICITE, si j'en ai donné une.
  initial: StatutReponse | null;
  abonne: boolean;
  onOuvrir: () => void;
  onRepondu: () => void;
}) {
  const [statut, setStatut] = useState<StatutReponse | null>(initial);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Un rechargement de l'accueil fait foi (réponse changée sur la soirée).
  useEffect(() => setStatut(initial), [initial]);

  const retenu = statut ?? (abonne ? "IN" : null);
  if (retenu) {
    const couleur =
      retenu === "IN" ? jeton(t, "ok") : retenu === "MAYBE" ? jeton(t, "or") : jeton(t, "bad");
    return (
      <Pressable
        onPress={onOuvrir}
        accessibilityRole="button"
        accessibilityLabel={`Ta réponse : ${LIBELLES[retenu]}${statut ? "" : ", par ton abonnement"}. Touche pour la changer`}
        style={({ pressed }) => [s.statutCible, pressed && { opacity: 0.6 }]}
      >
        <Text style={[s.statut, { color: couleur }]} numberOfLines={1}>
          {LIBELLES[retenu]}
          {statut ? null : <Text style={[s.via, { color: jeton(t, "i2") }]}> · abonné</Text>}
        </Text>
      </Pressable>
    );
  }

  const repondre = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await repondrePresence(clubId, soireeId, playerId, "IN");
      setStatut("IN");
      succes();
      onRepondu();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <View style={s.presence}>
      <Pressable
        onPress={() => void repondre()}
        disabled={envoi}
        accessibilityRole="button"
        accessibilityLabel="Je serai là"
        accessibilityState={{ busy: envoi }}
        style={({ pressed }) => [
          s.jeSerai,
          { backgroundColor: jeton(t, "bt") },
          pressed && { opacity: 0.85 },
        ]}
      >
        {envoi ? (
          <ActivityIndicator color={jeton(t, "bf")} />
        ) : (
          <Text style={[s.jeSeraiTexte, { color: jeton(t, "bf") }]}>Je serai là</Text>
        )}
      </Pressable>
      {erreur ? (
        <Text style={[s.erreur, { color: jeton(t, "bad") }]} numberOfLines={2}>
          {erreur}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  vide: {
    fontSize: 17,
    textAlign: "center",
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  ligneSoiree: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
    minHeight: 44,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  ligneSoireeTexte: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  seule: { paddingBottom: 12 },
  chevronTexte: { fontSize: 15 },

  // 76 et non 88 : ce sont douze points rendus au milieu, là où le lieu se
  // coupait. L'écusson de 56 y reste au large.
  camp: { width: 76, alignItems: "center", gap: 8 },
  efface: { opacity: 0.7 },
  nomCamp: { fontSize: 15, fontWeight: "500", maxWidth: 76 },

  // La prochaine soirée : 76 · 1fr · 76, padding 12 12 8.
  prochaine: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  programme: { paddingTop: 16, paddingBottom: 20 },
  // `minHeight` et non `height` : le lieu qui passe à deux lignes pousse la
  // rangée au lieu de déborder de sa boîte.
  milieuProchaine: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  heureProchaine: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  quand: { fontSize: 17, fontWeight: "600" },
  lieu: { fontSize: 13, lineHeight: 17, textAlign: "center", marginTop: 2 },

  ligneAVenir: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  videChiffre: { flex: 1 },
  milieuAVenir: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 8,
  },
  etatAVenir: { fontSize: 17, fontWeight: "600" },
  heureAVenir: { fontSize: 13, fontVariant: ["tabular-nums"] },

  reponses: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  reponsesTexte: { fontSize: 15, flexShrink: 1, minWidth: 0 },
  statutCible: { minHeight: 44, justifyContent: "center", flexShrink: 0 },
  statut: { fontSize: 15, fontWeight: "600" },
  via: { fontWeight: "400" },
  presence: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
  jeSerai: {
    height: 44,
    minWidth: 112,
    paddingHorizontal: 18,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  jeSeraiTexte: { fontSize: 15, fontWeight: "600" },
  erreur: { fontSize: 13, maxWidth: 200, textAlign: "right" },
});
