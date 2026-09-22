import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import type { Jetons } from "../../lib/couleurs";
import { succes as vibrerSucces } from "../../lib/haptique";
import { NOMS_MATIERES, TEINTES_MATIERES, type Matiere } from "../../lib/succes-icones";
import { cleVu, marquerVus, nouveauxDeblocages } from "../../lib/succes-vus";
import { BoutonPlein, MOUVEMENT } from "../base";
import { couleursClub } from "./commun";
import Medaille from "./Medaille";
import type { DeblocageAffiche } from "./types";

/// L'annonce d'un succès neuf — celle du site (components/succes/AnnonceSucces.tsx) :
/// la carte qui monte en fondu, la médaille qui arrive en ressort, douze
/// éclats aux couleurs du club, et le retour haptique « réussite » du Taptic
/// Engine au moment où la médaille se pose. Une fois par palier et par
/// téléphone (lib/succes-vus.ts), jamais au premier passage, jamais pour une
/// perte.
///
/// À monter UNIQUEMENT pour le joueur lié à l'utilisateur : sur la fiche d'un
/// autre, elle annoncerait ses succès à lui — et les marquerait vus.
///
/// `deblocages` à `null` tant que les données ne sont pas arrivées : un
/// tableau vide pendant le chargement passerait pour « aucun succès », le
/// premier passage l'enregistrerait, et tout serait annoncé au chargement
/// suivant.
///
/// Pas de flou d'arrière-plan : expo-blur n'est pas dans le binaire installé
/// (et une mise à jour à chaud ne peut pas l'y ajouter). La carte est donc
/// opaque, sur un voile sombre — comme celle du site.

/// Les éclats du site : mêmes angles, mêmes distances, mêmes délais.
const ECLATS = Array.from({ length: 12 }, (_, i) => ({
  angle: ((i * 30 + (i % 2 ? 11 : -7)) * Math.PI) / 180,
  distance: 72 + ((i * 37) % 30),
  famille: i % 3,
  delai: 120 + (i % 4) * 25,
}));

const TAILLE_MEDAILLE = 112;

/// La médaille part un peu après la carte : elle se pose DANS une carte déjà
/// là, sinon les deux arrivent l'une sur l'autre et on ne voit ni l'une ni
/// l'autre. Le retour haptique suit du temps d'un toucher.
const DELAI_MEDAILLE = 80;

function teinte(m: Matiere, clubA: string): string {
  return m === "legende" ? clubA : TEINTES_MATIERES[m].base;
}

export default function AnnonceSucces({
  t,
  clubId,
  joueurId,
  deblocages,
  chasubles,
  onVoir,
}: {
  t: Jetons;
  clubId: string;
  joueurId: string;
  /// `SuccesJoueur.deblocages`, ou `null` tant qu'ils ne sont pas chargés.
  deblocages: readonly DeblocageAffiche[] | null;
  chasubles?: { a: string; b: string };
  /// « Voir mes succès » : l'écran choisit où mener. L'annonce est déjà
  /// fermée et marquée vue quand il est appelé.
  onVoir: () => void;
}) {
  const [liste, setListe] = useState<DeblocageAffiche[]>([]);
  const courants = useRef(deblocages);
  useEffect(() => {
    courants.current = deblocages;
  });

  // La signature plutôt que le tableau : un écran qui reconstruit la liste à
  // chaque rendu ne doit pas relire le fichier à chaque fois.
  const signature = deblocages ? deblocages.map(cleVu).join(",") : null;
  useEffect(() => {
    const d = courants.current;
    if (signature === null || !d) return;
    let vivant = true;
    void nouveauxDeblocages(clubId, joueurId, d).then((l) => {
      if (vivant && l.length > 0) setListe(l);
    });
    return () => {
      vivant = false;
    };
  }, [clubId, joueurId, signature]);

  const fermer = useCallback(() => {
    void marquerVus(clubId, joueurId, (courants.current ?? []).map(cleVu));
    setListe([]);
  }, [clubId, joueurId]);

  const voir = useCallback(() => {
    fermer();
    onVoir();
  }, [fermer, onVoir]);

  if (liste.length === 0) return null;
  return <Scene t={t} liste={liste} chasubles={chasubles} onFermer={fermer} onVoir={voir} />;
}

/// La scène elle-même, montée seulement quand il y a quelque chose à dire :
/// ses valeurs animées naissent à zéro à chaque annonce.
function Scene({
  t,
  liste,
  chasubles,
  onFermer,
  onVoir,
}: {
  t: Jetons;
  liste: DeblocageAffiche[];
  chasubles?: { a: string; b: string };
  onFermer: () => void;
  onVoir: () => void;
}) {
  const [tete, ...autres] = liste;
  const club = couleursClub(t, chasubles);
  const couleurs = [club.a, club.b, teinte(tete.matiere, club.a)];

  const voile = useRef(new Animated.Value(0)).current;
  const carte = useRef(new Animated.Value(0)).current;
  const medaille = useRef(new Animated.Value(0)).current;
  const eclats = useRef(ECLATS.map(() => new Animated.Value(0))).current;
  const [reduit, setReduit] = useState(false);

  useEffect(() => {
    let vivant = true;
    const annonce = `${liste.length > 1 ? `${liste.length} nouveaux succès` : "Nouveau succès"} : ${tete.nom}, ${tete.libelle}`;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((sansMouvement) => {
        if (!vivant) return;
        setReduit(sansMouvement);
        AccessibilityInfo.announceForAccessibility(annonce);
        if (sansMouvement) {
          // Un fondu court, rien qui bouge.
          medaille.setValue(1);
          Animated.parallel([
            Animated.timing(voile, { toValue: 1, duration: MOUVEMENT.rapide, useNativeDriver: true }),
            Animated.timing(carte, { toValue: 1, duration: MOUVEMENT.rapide, useNativeDriver: true }),
          ]).start();
          vibrerSucces();
          return;
        }
        Animated.parallel([
          Animated.timing(voile, { toValue: 1, duration: MOUVEMENT.voile, useNativeDriver: true }),
          Animated.timing(carte, {
            toValue: 1,
            duration: MOUVEMENT.scene,
            easing: MOUVEMENT.courbe,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(DELAI_MEDAILLE),
            Animated.spring(medaille, {
              toValue: 1,
              ...MOUVEMENT.ressortMedaille,
              useNativeDriver: true,
            }),
          ]),
          ...eclats.map((v, i) =>
            Animated.sequence([
              Animated.delay(ECLATS[i].delai),
              Animated.timing(v, {
                toValue: 1,
                duration: MOUVEMENT.eclat,
                easing: MOUVEMENT.courbeEclat,
                useNativeDriver: true,
              }),
            ]),
          ),
        ]).start();
        // Le retour haptique tombe quand la médaille atteint sa taille, pas à
        // l'ouverture : c'est elle qu'on doit sentir arriver.
        setTimeout(() => {
          if (vivant) vibrerSucces();
        }, DELAI_MEDAILLE + MOUVEMENT.toucher);
      });
    return () => {
      vivant = false;
    };
    // Une seule fois par scène : la liste ne change pas tant qu'elle est montée.
  }, []);

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onFermer}>
      <View style={s.cadre}>
        <Animated.View style={[StyleSheet.absoluteFill, s.voile, { opacity: voile }]}>
          {/* Le voile ferme au toucher ; pour un lecteur d'écran, c'est le
              bouton de la carte qui le dit — une seule commande « Fermer ». */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} accessible={false} />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            s.carte,
            { backgroundColor: t.bgSolid ?? "#0b0b0e", borderColor: t.cb },
            {
              opacity: carte,
              transform: [
                { translateY: carte.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                { scale: carte.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            },
          ]}
        >
          {/* Le teint du verre des cartes, posé sur le fond uni du club. */}
          <View style={[StyleSheet.absoluteFill, s.teint, { backgroundColor: t.cdSolid }]} pointerEvents="none" />

          <Pressable
            onPress={onFermer}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={4}
            style={({ pressed }) => [
              s.fermer,
              { backgroundColor: pressed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.12)", borderColor: t.gb ?? t.cb },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round">
              <Path d="M6 6l12 12M18 6 6 18" />
            </Svg>
          </Pressable>

          <View style={s.scene} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Animated.View
              style={[
                s.halo,
                { opacity: medaille.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35], extrapolate: "clamp" }) },
              ]}
            >
              <Svg width={190} height={190}>
                <Defs>
                  <RadialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
                    <Stop offset="0" stopColor={couleurs[2]} stopOpacity={1} />
                    <Stop offset="0.65" stopColor={couleurs[2]} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={95} cy={95} r={95} fill="url(#halo)" />
              </Svg>
            </Animated.View>
            {!reduit &&
              ECLATS.map((e, i) => {
                const v = eclats[i];
                const cos = Math.cos(e.angle);
                const sin = Math.sin(e.angle);
                return (
                  <Animated.View
                    key={i}
                    style={[
                      s.eclat,
                      {
                        backgroundColor: couleurs[e.famille],
                        opacity: v.interpolate({ inputRange: [0, 0.12, 0.65, 1], outputRange: [0, 1, 1, 0] }),
                        transform: [
                          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [cos * 20, cos * e.distance] }) },
                          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [sin * 20, sin * e.distance] }) },
                          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) },
                        ],
                      },
                    ]}
                  />
                );
              })}
            <Animated.View
              style={{
                opacity: medaille.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
                transform: [{ scale: medaille.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
              }}
            >
              <Medaille icone={tete.icone} matiere={tete.matiere} t={t} chasubles={chasubles} taille={TAILLE_MEDAILLE} />
            </Animated.View>
          </View>

          <Text style={[s.sur, { color: t.i2 }]}>
            {liste.length > 1 ? `${liste.length} nouveaux succès` : "Nouveau succès"}
          </Text>
          <Text style={[s.nom, { color: t.ink }]} accessibilityRole="header">
            {tete.nom}
          </Text>
          <Text style={[s.libelle, { color: t.i2 }]}>
            {NOMS_MATIERES[tete.matiere]} · {tete.libelle}
          </Text>

          {autres.length > 0 && (
            <View style={[s.autres, { borderTopColor: t.sep }]}>
              {autres.slice(0, 3).map((d) => (
                <View key={cleVu(d)} style={s.autre}>
                  <Medaille icone={d.icone} matiere={d.matiere} t={t} chasubles={chasubles} taille={32} />
                  <Text style={[s.autreTexte, { color: t.i2 }]} numberOfLines={1}>
                    <Text style={[s.autreNom, { color: t.ink }]}>{d.nom}</Text> · {d.libelle}
                  </Text>
                </View>
              ))}
              {autres.length > 3 && (
                <Text style={[s.plus, { color: t.i3 }]}>
                  et {autres.length - 3} autre{autres.length - 3 > 1 ? "s" : ""}
                </Text>
              )}
            </View>
          )}

          <View style={s.bouton}>
            <BoutonPlein t={t} titre="Voir mes succès" onPress={onVoir} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  cadre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  voile: { backgroundColor: "rgba(0,0,0,0.5)" },
  carte: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 30 },
    elevation: 24,
  },
  teint: { borderRadius: 28 },
  fermer: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scene: { height: 150, width: "100%", alignItems: "center", justifyContent: "center", marginTop: 4, marginBottom: 10 },
  halo: { position: "absolute", width: 190, height: 190 },
  eclat: { position: "absolute", width: 9, height: 9, borderRadius: 4.5 },
  sur: { fontSize: 13, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  nom: { marginTop: 4, fontSize: 28, fontWeight: "700", letterSpacing: -0.4, textAlign: "center" },
  libelle: { marginTop: 6, fontSize: 17, textAlign: "center" },
  autres: { alignSelf: "stretch", marginTop: 16, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  autre: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 2 },
  autreTexte: { flex: 1, fontSize: 15 },
  autreNom: { fontWeight: "600" },
  plus: { paddingLeft: 44, paddingVertical: 6, fontSize: 15 },
  bouton: { alignSelf: "stretch", marginTop: 20 },
});
