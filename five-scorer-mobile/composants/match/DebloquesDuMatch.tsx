import { Pressable, StyleSheet, Text, View } from "react-native";
import { Carte } from "../base";
import Medaille from "../succes/Medaille";
import { jeton, type Jetons } from "../../lib/couleurs";
import { NOMS_MATIERES, RANG_MATIERE } from "../../lib/succes-icones";
import type { DeblocageJoueur } from "../../lib/succes";

/// Au-delà, « et N autres » : la ligne doit tenir sur un téléphone.
const NOMS_VISIBLES = 3;

type Groupe = {
  cle: string;
  tete: DeblocageJoueur;
  joueurs: { playerId: string; nom: string }[];
};

/// Les paliers franchis, rangés par exploit : « Premiers pas » débloqué par
/// onze joueurs le soir du premier match, c'est une ligne, pas onze.
export function grouperDeblocages(deblocages: readonly DeblocageJoueur[]): Groupe[] {
  const par = new Map<string, Groupe>();
  for (const d of deblocages) {
    const cle = `${d.badgeId}:${d.palier}`;
    const g = par.get(cle);
    if (g) g.joueurs.push({ playerId: d.playerId, nom: d.joueur });
    else par.set(cle, { cle, tete: d, joueurs: [{ playerId: d.playerId, nom: d.joueur }] });
  }
  // Le plus précieux d'abord ; à matière égale, le plus rare (le moins de
  // joueurs) — c'est lui qu'on racontera.
  return [...par.values()]
    .map((g) => ({ ...g, joueurs: g.joueurs.sort((a, b) => a.nom.localeCompare(b.nom, "fr")) }))
    .sort(
      (a, b) =>
        RANG_MATIERE[b.tete.matiere] - RANG_MATIERE[a.tete.matiere] ||
        a.joueurs.length - b.joueurs.length ||
        a.tete.nom.localeCompare(b.tete.nom, "fr"),
    );
}

function lesNoms(joueurs: { nom: string }[]): string {
  if (joueurs.length <= NOMS_VISIBLES) {
    return joueurs.length === 1
      ? joueurs[0].nom
      : `${joueurs
          .slice(0, -1)
          .map((j) => j.nom)
          .join(", ")} et ${joueurs[joueurs.length - 1].nom}`;
  }
  const reste = joueurs.length - NOMS_VISIBLES;
  return `${joueurs
    .slice(0, NOMS_VISIBLES)
    .map((j) => j.nom)
    .join(", ")} et ${reste} autre${reste > 1 ? "s" : ""}`;
}

/// « Débloqués pendant ce match » : les paliers que ce match a fait franchir
/// (GET …/succes/match/<id>).
///
/// Sous le score et l'homme du match, parce que c'est la suite de l'histoire
/// qu'on raconte le mardi : « 2-1, Bakary homme du match — et son coup du
/// chapeau d'or ». Pas de date sur la ligne, contrairement au fil du club :
/// on est DANS le match, la date est en haut de l'écran. La matière la
/// remplace — c'est elle qui dit si l'exploit est rare.
///
/// Rien ne s'affiche s'il n'y a rien : une carte vide « aucun succès » ferait
/// d'un match ordinaire un match raté.
export default function DebloquesDuMatch({
  t,
  deblocages,
  chasubles,
  onJoueur,
}: {
  t: Jetons;
  deblocages: DeblocageJoueur[];
  chasubles: { a: string; b: string };
  onJoueur: (playerId: string) => void;
}) {
  if (deblocages.length === 0) return null;
  const groupes = grouperDeblocages(deblocages);
  return (
    <Carte t={t} titre="Débloqués pendant ce match" style={s.carte}>
      {groupes.map((g, i) => {
        const d = g.tete;
        const seul = g.joueurs.length === 1 ? g.joueurs[0] : null;
        const noms = lesNoms(g.joueurs);
        const contenu = (
          <>
            <Medaille icone={d.icone} matiere={d.matiere} t={t} chasubles={chasubles} taille={40} />
            <View style={s.textes}>
              {/* La matière ne s'écrit pas : la médaille la dit, et la
                  place sert mieux au libellé (« 5 triplés ») puis aux noms.
                  Elle reste dans l'étiquette du lecteur d'écran. */}
              <Text style={[s.haut, { color: jeton(t, "i2") }]} numberOfLines={1}>
                <Text style={[s.nom, { color: t.ink }]}>{d.nom}</Text> · {d.libelle}
              </Text>
              <Text style={[s.bas, { color: seul ? t.ink : jeton(t, "i2") }]} numberOfLines={2}>
                {noms}
              </Text>
            </View>
          </>
        );
        const cadre = [
          s.ligne,
          i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: jeton(t, "sep") },
        ];
        const etiquette = `${d.nom}, ${NOMS_MATIERES[d.matiere]}, ${d.libelle} : ${noms}`;
        // Un seul joueur : la ligne mène à sa fiche. Plusieurs : elle se lit,
        // on ne devine pas lequel on voulait ouvrir.
        return seul ? (
          <Pressable
            key={g.cle}
            onPress={() => onJoueur(seul.playerId)}
            accessibilityRole="button"
            accessibilityLabel={`${etiquette}. Ouvrir sa fiche`}
            style={({ pressed }) => [...cadre, pressed && { opacity: 0.7 }]}
          >
            {contenu}
          </Pressable>
        ) : (
          <View key={g.cle} style={cadre} accessible accessibilityLabel={etiquette}>
            {contenu}
          </View>
        );
      })}
    </Carte>
  );
}

const s = StyleSheet.create({
  carte: { paddingHorizontal: 20, paddingBottom: 8 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 10 },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  haut: { fontSize: 15 },
  nom: { fontWeight: "600" },
  bas: { fontSize: 15 },
});
