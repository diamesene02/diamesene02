import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fmt, nowElapsed } from "../../lib/noyau/clock";

/// Le milieu du tableau de marque : l'état, le chrono, la période.
///
/// **Pourquoi un composant, et pas trois lignes dans la feuille.** Le temps
/// ne vit nulle part : il se dérive de `clockElapsedMs` + `clockRunningSince`
/// à l'instant du rendu. Il faut donc redessiner deux fois par seconde. Tant
/// que ce tic était un état de l'écran, CHAQUE tic re-rendait toute la
/// feuille : les douze tuiles de joueur, leurs avatars — donc, pour chacun,
/// une photo data-URL de plusieurs dizaines de milliers de caractères
/// repoussée vers la vue native — le fond, le dégradé du club, les deux
/// cartes de verre. Deux fois par seconde, pendant une heure, sur le
/// téléphone qu'on tient d'une main au bord du terrain.
///
/// Ici, le tic ne traverse plus rien : il naît dans cette feuille de l'arbre
/// et n'en sort pas. Le reste de l'écran ne se redessine plus que quand
/// quelque chose a VRAIMENT changé — un but, une pause, un carton.
///
/// C'est exactement le motif que `LigneDirect` (accueil) tient déjà.
export default memo(function Horloge({
  elapsedMs,
  runningSince,
  limiteMs,
  periode,
  onMiTemps,
  onDepassement,
}: {
  elapsedMs: number;
  /// L'ISO du dernier départ, `null` en pause. Quand c'est `null`, rien ne
  /// bouge : on n'arme aucun minuteur.
  runningSince: string | null;
  /// Le temps réglementaire du club, en millisecondes. `null` quand le club
  /// n'en fixe pas : le chrono monte alors sans jamais rougir.
  limiteMs: number | null;
  periode: number;
  /// Le coup de sifflet de mi-temps. `undefined` en rétro : on ne siffle pas
  /// la mi-temps d'un match d'avant-hier.
  onMiTemps?: () => void;
  /// Franchissement du temps réglementaire, une seule fois par match.
  onDepassement?: () => void;
}) {
  const [, setTic] = useState(0);

  // Rien ne tourne en base : le temps se dérive des deux colonnes du chrono.
  // Un tic de 500 ms suffit, l'affichage est à la seconde.
  useEffect(() => {
    if (!runningSince) return;
    const h = setInterval(() => setTic((n) => n + 1), 500);
    return () => clearInterval(h);
  }, [runningSince]);

  const tourne = Boolean(runningSince);
  const ecoule = nowElapsed({ elapsedMs, runningSince });
  const depasse = limiteMs != null && ecoule > limiteMs;

  // Le double coup de sifflet au franchissement, une seule fois. La garde
  // `null` du premier passage est celle du site, et elle compte : sans elle,
  // rouvrir un match déjà au-delà de la limite sifflerait la fin à chaque
  // ouverture.
  const etaitDepasse = useRef<boolean | null>(null);
  useEffect(() => {
    if (etaitDepasse.current === null) {
      etaitDepasse.current = depasse;
      return;
    }
    if (depasse && !etaitDepasse.current) onDepassement?.();
    etaitDepasse.current = depasse;
  }, [depasse, onDepassement]);

  return (
    <>
      <View style={s.etatLigne}>
        <View
          style={[s.point, { backgroundColor: tourne ? "#ff453a" : "rgba(255,255,255,0.5)" }]}
        />
        <Text style={[s.etat, { color: tourne ? "#ff453a" : "rgba(255,255,255,0.7)" }]}>
          {tourne ? "En direct" : "Pause"}
        </Text>
      </View>
      <Text style={[s.horloge, depasse && s.horlogeDepassee]}>{fmt(ecoule)}</Text>
      {periode === 1 && onMiTemps ? (
        // Une pilule, pas un texte de 13 : c'est le coup de sifflet qu'on
        // donne debout, en regardant le terrain.
        <Pressable
          onPress={onMiTemps}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Siffler la mi-temps"
          style={({ pressed }) => [s.miTemps, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.periode}>1re · mi-temps ›</Text>
        </Pressable>
      ) : (
        <Text style={[s.periode, s.periodeSeule]}>{periode === 1 ? "1re" : "2de"}</Text>
      )}
    </>
  );
});

const s = StyleSheet.create({
  etatLigne: { flexDirection: "row", alignItems: "center", gap: 7 },
  point: { width: 8, height: 8, borderRadius: 4 },
  etat: { fontSize: 17, fontWeight: "600" },
  horloge: { fontSize: 17, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  horlogeDepassee: { color: "#ff453a" },
  periode: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.5)" },
  // Le coup de sifflet de mi-temps : une pilule de 36 (48 avec la marge de
  // toucher), plus un texte de 13 qu'on visait à l'aveugle.
  miTemps: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  periodeSeule: { paddingVertical: 9 },
});
