import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CarteVerre } from "./base";
import { jeton, type Jetons } from "../lib/couleurs";

/// Les squelettes d'attente : la FORME de l'écran, avant l'écran.
///
/// Un rond qui tourne au milieu du vide ne dit rien — ni ce qui arrive, ni
/// combien de temps ça prend —, et quand la page arrive elle tombe d'un coup
/// à un autre endroit : on cherche des yeux ce qu'on lisait. Un squelette
/// répond aux deux : il occupe la place que le contenu occupera, et il
/// s'efface en dessous de lui.
///
/// Mesuré le 20 septembre 2026 sur le serveur de développement, médiane de
/// cinq tours, la BASE SUR LA MÊME MACHINE : accueil 262 ms, récap 292 ms,
/// soirées 157 ms, stats 137 ms. Au gymnase, sur un téléphone en 4G avec les
/// fonctions à Paris et la base à Francfort, c'est le même chemin plus un
/// aller-retour réseau : on compte de trois à dix fois ça. C'est la durée
/// pendant laquelle l'écran ne montrait rien.
///
/// Une seule animation pour toute la page (le contexte ci-dessous) : vingt
/// blocs qui pulsent chacun de leur côté, c'est vingt boucles natives et un
/// scintillement désaccordé. Ici tous les blocs partagent la même valeur.
/// `useNativeDriver` : l'opacité part sur le fil du rendu, la boucle ne coûte
/// rien au JavaScript qui, lui, attend la réponse du serveur.
///
/// « Réduire les animations » coupe la pulsation : le squelette reste, fixe.

const Pouls = createContext<Animated.Value | null>(null);

/// Le cadre d'une page en attente. Tout `Bloc` qu'il contient respire avec
/// lui. `accessibilityRole="progressbar"` : VoiceOver annonce un chargement
/// au lieu d'énumérer des vues vides.
export function Squelette({
  children,
  etiquette = "Chargement",
  style,
}: {
  children: React.ReactNode;
  etiquette?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const pouls = useRef(new Animated.Value(0)).current;
  const [sobre, setSobre] = useState(false);

  useEffect(() => {
    let vivant = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((r) => vivant && setSobre(r));
    const ecoute = AccessibilityInfo.addEventListener("reduceMotionChanged", setSobre);
    return () => {
      vivant = false;
      ecoute.remove();
    };
  }, []);

  useEffect(() => {
    if (sobre) {
      pouls.setValue(0);
      return;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pouls, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pouls, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [pouls, sobre]);

  return (
    <Pouls.Provider value={sobre ? null : pouls}>
      <View
        style={style}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={etiquette}
      >
        {children}
      </View>
    </Pouls.Provider>
  );
}

/// Un pavé de contenu à venir : une ligne de texte, un avatar, un chiffre.
/// `l` en fraction (« 60% ») ou en points ; `h` la hauteur ; `r` l'arrondi —
/// la moitié de la hauteur pour un rond.
export const Bloc = memo(function Bloc({
  t,
  l = "100%",
  h = 14,
  r,
  style,
}: {
  t: Jetons;
  l?: number | `${number}%`;
  h?: number;
  r?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pouls = useContext(Pouls);
  const teinte = jeton(t, "gl") || "rgba(255,255,255,0.08)";
  const forme: ViewStyle = { width: l, height: h, borderRadius: r ?? Math.min(h / 2, 8) };
  if (!pouls) {
    return <View pointerEvents="none" style={[forme, { backgroundColor: teinte, opacity: 0.7 }, style]} />;
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        forme,
        {
          backgroundColor: teinte,
          opacity: pouls.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] }),
        },
        style,
      ]}
    />
  );
});

/// Une carte de verre remplie de rangées — la forme la plus courante de
/// l'app : le tableau des stats, le vestiaire, une liste de matchs.
export function CarteSquelette({
  t,
  rangees = 5,
  hauteurRangee = 56,
  avatar = true,
  entete,
  style,
}: {
  t: Jetons;
  rangees?: number;
  hauteurRangee?: number;
  /// Le rond du visage à gauche, comme dans les listes de joueurs.
  avatar?: boolean;
  /// La ligne de titre au-dessus des rangées (le mois, la saison…).
  entete?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // Des largeurs qui varient un peu : toutes égales, ça fait un tableur, pas
  // une liste de noms.
  const largeurs = useMemo(
    () => ["62%", "48%", "70%", "54%", "66%", "44%", "58%"] as const,
    [],
  );
  return (
    <CarteVerre t={t} style={[s.carte, style]}>
      {entete && (
        <View style={s.entete}>
          <Bloc t={t} l="34%" h={12} />
          <Bloc t={t} l={38} h={12} />
        </View>
      )}
      {Array.from({ length: rangees }, (_, i) => (
        <View key={i} style={[s.rangee, { minHeight: hauteurRangee }]}>
          {avatar && <Bloc t={t} l={36} h={36} r={18} />}
          <View style={s.textes}>
            <Bloc t={t} l={largeurs[i % largeurs.length]} h={15} />
            <Bloc t={t} l="30%" h={11} />
          </View>
          <Bloc t={t} l={28} h={17} />
        </View>
      ))}
    </CarteVerre>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 18, paddingVertical: 8 },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 6,
  },
  rangee: { flexDirection: "row", alignItems: "center", gap: 12 },
  textes: { flex: 1, minWidth: 0, gap: 7 },
});
