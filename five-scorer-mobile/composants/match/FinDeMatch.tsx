import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { BoutonPlein, BoutonVerre } from "../base";
import { jeton, type Jetons } from "../../lib/couleurs";
import { chargerMoiMemorise } from "../ClubCourant";
import { chargerSuccesMatch, type DeblocageJoueur } from "../../lib/succes";
import { verdict } from "./textes";

// La fin d'une feuille : le « temps plein » qui fige le score une seconde,
// puis ce qu'on fait ensuite — le match suivant, le récap, le club.

/// L'écran « Temps plein » du site (LiveMatch.tsx) : le score figé, qui
/// l'emporte, et « Touche pour continuer ». Il ne fait pas attendre : le
/// match est déjà terminé dans le téléphone quand il s'affiche, et pendant
/// qu'on le lit, la file envoie la feuille.
export function TempsPlein({
  nomA,
  nomB,
  scoreA,
  scoreB,
  retro,
  chasubles,
  onContinuer,
}: {
  nomA: string;
  nomB: string;
  scoreA: number;
  scoreB: number;
  /// Une feuille saisie après coup n'a pas de coup de sifflet : elle est
  /// « enregistrée ».
  retro: boolean;
  /// Les halos du `fond-match` : le site pose la même classe sur cet écran
  /// (`live-plein fond-match`). Le dernier écran du match garde les couleurs
  /// des deux chasubles qui viennent de jouer.
  chasubles: { a: string; b: string };
  onContinuer: () => void;
}) {
  const entree = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entree, {
      toValue: 1,
      duration: 240,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
    const phrase = `${retro ? "Feuille enregistrée" : "Temps plein"}. ${nomA} ${scoreA}, ${nomB} ${scoreB}. ${verdict(nomA, nomB, scoreA, scoreB)}.`;
    AccessibilityInfo.announceForAccessibility(phrase);
  }, [entree, retro, nomA, nomB, scoreA, scoreB]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.plein, { opacity: entree }]}>
      <LinearGradient
        colors={["#0b0b12", "#14152a", "#1b1c36"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="finHaloA" cx="0%" cy="32%" rx="60%" ry="50%" fx="0%" fy="32%">
              <Stop offset="0" stopColor={chasubles.a} stopOpacity={0.34} />
              <Stop offset="0.7" stopColor={chasubles.a} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="finHaloB" cx="100%" cy="32%" rx="60%" ry="50%" fx="100%" fy="32%">
              <Stop offset="0" stopColor={chasubles.b} stopOpacity={0.36} />
              <Stop offset="0.7" stopColor={chasubles.b} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#finHaloA)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#finHaloB)" />
        </Svg>
      </View>
      <Pressable
        style={s.pleinCorps}
        onPress={onContinuer}
        accessibilityRole="button"
        accessibilityLabel="Continuer"
      >
        <Text style={s.pleinSur}>{retro ? "Feuille enregistrée" : "Temps plein"}</Text>
        <View style={s.pleinMarque}>
          <Text
            allowFontScaling={false}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[s.pleinChiffre, scoreB > scoreA && s.perd]}
          >
            {scoreA}
          </Text>
          <View style={s.pleinTrait} />
          <Text
            allowFontScaling={false}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[s.pleinChiffre, scoreA > scoreB && s.perd]}
          >
            {scoreB}
          </Text>
        </View>
        <Text style={s.pleinVerdict}>{verdict(nomA, nomB, scoreA, scoreB)}</Text>
        <Text style={s.pleinAide}>Touche pour continuer</Text>
      </Pressable>
    </Animated.View>
  );
}

/// Le pied d'une feuille terminée, à la place d'« Annuler · Pause ·
/// Terminer ».
///
/// Le récap se lit au serveur : tant que la feuille n'y est pas partie
/// (gymnase sans réseau), on ne l'ouvre pas sur une erreur — on dit
/// pourquoi il attend. Le match suivant, lui, n'attend rien : il s'écrit sur
/// le téléphone.
///
/// Attendre et être refusé ne se disent pas pareil. Une opération refusée
/// (droit de scorer retiré pendant la soirée, match supprimé depuis le site)
/// met toute la chaîne du match de côté : elle ne repartira PAS au retour du
/// réseau, et le compte d'envois ne retombera jamais à zéro. Tant que ce pied
/// ne faisait pas la différence, il répétait « le récap s'ouvre dès qu'elle y
/// est » pour toujours, et « Voir le récap » restait désactivé à vie — une
/// promesse que rien dans l'app ne pouvait tenir. Sur un refus, on le dit, on
/// propose de réessayer, et on laisse le récap s'ouvrir : incomplet vaut
/// mieux que fermé.
export function PiedDeFin({
  t,
  suivant,
  onSuivant,
  lancement,
  recapPret,
  refusees,
  horsLigne,
  onReessayer,
  onRecap,
  onClub,
}: {
  t: Jetons;
  /// « Match suivant — mêmes équipes », « Saisir le match suivant », ou
  /// `null` quand la soirée ne continue pas.
  suivant: string | null;
  onSuivant: () => void;
  lancement: boolean;
  recapPret: boolean;
  /// Les envois de CE match que le serveur a refusés.
  refusees: number;
  horsLigne: boolean;
  /// Remet les refusés dans la file (`drain.rejouerBloquees`).
  onReessayer: () => void;
  onRecap: () => void;
  onClub: () => void;
}) {
  const refus = refusees > 0;
  const recapOuvrable = recapPret || refus;
  return (
    <View style={s.pied}>
      {suivant && <BoutonPlein t={t} titre={suivant} onPress={onSuivant} occupe={lancement} />}
      <View style={s.rangee}>
        <View style={{ flex: 1 }}>
          {suivant ? (
            <BoutonVerre t={t} titre="Voir le récap" onPress={onRecap} disabled={!recapOuvrable} />
          ) : (
            <BoutonPlein t={t} titre="Voir le récap" onPress={onRecap} disabled={!recapOuvrable} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <BoutonVerre t={t} titre="Retour au club" onPress={onClub} />
        </View>
      </View>
      {refus && <BoutonVerre t={t} titre="Réessayer l'envoi" onPress={onReessayer} />}
      {!recapPret && (
        <Text style={[s.attente, { color: jeton(t, refus ? "bad" : "i2") }]}>
          {refus
            ? `Le serveur a refusé ${refusees} envoi${refusees > 1 ? "s" : ""} : la feuille n'est pas partie. Réessaie, ou préviens un responsable du club — le récap peut être incomplet.`
            : horsLigne
              ? "Hors ligne : la feuille partira au retour du réseau, le récap suivra."
              : "La feuille part au serveur, le récap s'ouvre dès qu'elle y est."}
        </Text>
      )}
    </View>
  );
}

/// Les paliers que CE match m'a fait franchir, si le serveur les connaît
/// déjà. Pour l'annonce de fin de match : elle ne doit jamais retenir la fin
/// du match — sans réseau, ou tant que la feuille n'est pas partie, on ne
/// dit rien, et c'est l'accueil qui l'annoncera plus tard.
///
/// `actif` passe à vrai quand la feuille est arrivée au serveur (plus rien à
/// envoyer pour ce match) : avant, le serveur ne connaît pas le match
/// terminé et rendrait une liste vide — que l'annonce prendrait pour « rien
/// de neuf ».
export function useMesDeblocagesDuMatch(
  clubId: string | null | undefined,
  matchId: string | null | undefined,
  actif: boolean,
): { joueurId: string; deblocages: DeblocageJoueur[] } | null {
  const [etat, setEtat] = useState<{ joueurId: string; deblocages: DeblocageJoueur[] } | null>(
    null,
  );
  useEffect(() => {
    if (!actif || !clubId || !matchId) return;
    let vivant = true;
    void (async () => {
      try {
        const [moi, r] = await Promise.all([
          chargerMoiMemorise(),
          chargerSuccesMatch(clubId, matchId),
        ]);
        const joueurId = moi.clubs.find((c) => c.id === clubId)?.monJoueur?.id;
        if (!vivant || !joueurId) return;
        setEtat({ joueurId, deblocages: r.deblocages.filter((d) => d.playerId === joueurId) });
      } catch {
        // Un bonus, pas une étape : l'échec se tait.
      }
    })();
    return () => {
      vivant = false;
    };
  }, [clubId, matchId, actif]);
  return etat;
}

const s = StyleSheet.create({
  plein: { zIndex: 10 },
  pleinCorps: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  pleinSur: { fontSize: 17, fontWeight: "600", color: "rgba(255,255,255,0.62)" },
  // `1fr auto 1fr` du site (`.live-marque`) : chaque chiffre est centré dans
  // SA moitié, pas collé au trait. Un 4–2 se lit alors comme sur le web.
  pleinMarque: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", paddingTop: 8 },
  pleinChiffre: {
    flex: 1,
    textAlign: "center",
    fontSize: 132,
    fontWeight: "800",
    letterSpacing: -6.6,
    lineHeight: 138,
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
    transform: [{ scaleX: 0.86 }],
  },
  perd: { color: "rgba(255,255,255,0.4)" },
  pleinTrait: { width: 2, height: 70, backgroundColor: "rgba(255,255,255,0.35)" },
  pleinVerdict: { fontSize: 22, fontWeight: "600", color: "#ffffff", marginTop: 18 },
  pleinAide: { fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 24 },

  pied: { gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  rangee: { flexDirection: "row", gap: 10 },
  attente: { fontSize: 13, textAlign: "center" },
});
