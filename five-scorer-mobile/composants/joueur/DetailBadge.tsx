import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Feuille from "../Feuille";
import { BoutonVerre } from "../base";
import Medaille from "../succes/Medaille";
import { dateCourte, quantite, resteAvantPalier } from "../succes/textes";
import { IconeJeu } from "../Icones";
import { jeton, type Jetons } from "../../lib/couleurs";
import { NOMS_MATIERES, type Matiere } from "../../lib/succes-icones";
import type { Badge } from "../../lib/succes";

const MATIERES: Matiere[] = ["bronze", "argent", "or", "platine", "legende"];

/// La matière d'un palier selon son rang — la règle du contrat : bronze,
/// argent, or, platine, puis légende ; une famille à palier unique est en or.
export function matiereDuRang(rang: number, nombre: number): Matiere {
  if (nombre === 1) return "or";
  return MATIERES[Math.min(rang, MATIERES.length) - 1];
}

/// Le détail d'une famille, quand on touche sa tuile : ce qu'elle compte,
/// tous ses paliers, ceux qu'on a, celui qu'on vise, et combien du club l'ont.
///
/// La tuile ne dit que le prochain pas ; ici on voit le chemin entier. C'est
/// la question du mardi : « il faut combien pour l'or ? ».
export default function DetailBadge({
  t,
  badge,
  chasubles,
  estMoi,
  onMatch,
  onClose,
}: {
  t: Jetons;
  /// `null` : fermée.
  badge: Badge | null;
  chasubles?: { a: string; b: string };
  /// Pour le tutoiement de la rareté (« tu es dans les 10 % »).
  estMoi?: boolean;
  /// Le récap du match qui a fait tomber le dernier palier — ce que la tuile
  /// ouvre sur le site.
  onMatch?: (matchId: string) => void;
  onClose: () => void;
}) {
  const b = badge;
  // La feuille n'a pas de hauteur à elle : huit paliers et la tête
  // dépassent un petit écran, et le haut passerait sous l'encoche.
  const hauteurMax = useWindowDimensions().height * 0.72;
  return (
    <Feuille t={t} visible={b != null} onClose={onClose}>
      {b && (
        <ScrollView
          bounces={false}
          style={[s.defile, { maxHeight: hauteurMax }]}
          contentContainerStyle={s.contenu}
        >
          <View style={s.tete}>
            <Medaille icone={b.icone} matiere={b.matiere} t={t} chasubles={chasubles} taille={88} />
            <Text style={[s.nom, { color: t.ink }]} accessibilityRole="header">
              {b.nom}
            </Text>
            <Text style={[s.description, { color: jeton(t, "i2") }]}>{b.description}</Text>
            {b.rarete != null && (
              <Text style={[s.rarete, { color: jeton(t, "i3") }]}>{phraseRarete(b.rarete, b.palier > 0, estMoi)}</Text>
            )}
          </View>

          <View style={[s.liste, { borderTopColor: jeton(t, "sep") }]}>
            {b.paliers.map((seuil, i) => {
              const rang = i + 1;
              const obtenu = rang <= b.palier;
              const vise = rang === b.palier + 1;
              const matiere = matiereDuRang(rang, b.paliers.length);
              const droite = obtenu
                ? rang === b.palier && b.obtenuLe
                  ? dateCourte(b.obtenuLe)
                  : "obtenu"
                : vise
                  ? (resteAvantPalier(b) ?? "")
                  : "";
              return (
                <View
                  key={seuil}
                  style={[s.palier, i > 0 && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") }]}
                  accessible
                  accessibilityLabel={`${quantite(b.id, seuil)}, ${NOMS_MATIERES[matiere]}, ${obtenu ? "obtenu" : vise ? droite : "à venir"}`}
                >
                  <Medaille
                    icone={b.icone}
                    matiere={obtenu ? matiere : null}
                    t={t}
                    chasubles={chasubles}
                    taille={32}
                  />
                  <View style={s.palierTextes}>
                    <Text
                      style={[s.palierSeuil, { color: obtenu || vise ? t.ink : jeton(t, "i2") }]}
                      numberOfLines={1}
                    >
                      {quantite(b.id, seuil)}
                    </Text>
                    <Text style={[s.palierMatiere, { color: jeton(t, "i3") }]}>{NOMS_MATIERES[matiere]}</Text>
                  </View>
                  {obtenu ? (
                    <View style={s.obtenu}>
                      <Text style={[s.droite, { color: jeton(t, "i2") }]}>{droite}</Text>
                      <IconeJeu nom="coche" couleur={jeton(t, "ok")} taille={16} />
                    </View>
                  ) : (
                    <Text style={[s.droite, { color: vise ? t.ink : jeton(t, "i3") }]} numberOfLines={1}>
                      {droite}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {onMatch && b.palier > 0 && b.matchId ? (
            <BoutonVerre
              t={t}
              titre="Voir le match du dernier palier"
              style={s.match}
              onPress={() => {
                const matchId = b.matchId as string;
                onClose();
                onMatch(matchId);
              }}
            />
          ) : null}
        </ScrollView>
      )}
    </Feuille>
  );
}

/// « Seul 1 joueur sur 10 l'a » se dirait mieux, mais le serveur rend une
/// PART (0..1) et le dénominateur n'est pas celui de l'effectif affiché : on
/// dit le pourcentage, qui ne ment pas.
function phraseRarete(rarete: number, possede: boolean, estMoi?: boolean): string {
  const pc = Math.round(rarete * 100);
  if (pc === 0) return "Personne au club ne l'a encore.";
  if (possede && estMoi && pc <= 25) return `Tu fais partie des ${pc} % du club qui l'ont.`;
  return `Détenu par ${pc} % du club.`;
}

const s = StyleSheet.create({
  defile: { flexGrow: 0 },
  contenu: { paddingBottom: 8 },
  tete: { alignItems: "center", paddingTop: 12, paddingBottom: 18, gap: 6 },
  nom: { marginTop: 8, fontSize: 24, fontWeight: "700", letterSpacing: -0.4, textAlign: "center" },
  description: { fontSize: 15, lineHeight: 20, textAlign: "center", paddingHorizontal: 12 },
  rarete: { fontSize: 13, textAlign: "center" },
  liste: { borderTopWidth: 1 },
  palier: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
  palierTextes: { flex: 1, minWidth: 0 },
  palierSeuil: { fontSize: 17, fontWeight: "600", fontVariant: ["tabular-nums"] },
  palierMatiere: { fontSize: 13 },
  obtenu: { flexDirection: "row", alignItems: "center", gap: 6 },
  droite: { fontSize: 13, fontVariant: ["tabular-nums"], flexShrink: 1, textAlign: "right" },
  match: { marginTop: 14 },
});
