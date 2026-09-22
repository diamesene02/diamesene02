import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../base";
import { jeton, type Jetons } from "../../lib/couleurs";

/// Une rangée de la liste « Qui joue ? » (app/compo.tsx).
///
/// Extraite de l'écran et mémoïsée, pour une raison mesurée : c'est la liste
/// la plus TAPÉE de l'app. Vingt joueurs au vestiaire, un tap chacun pour les
/// répartir (aucun → A → B, donc jusqu'à quarante taps), plus les deux noms
/// d'équipe qu'on saisit au clavier — tout cela dans le quart d'heure avant
/// le coup d'envoi, debout, d'une main.
///
/// Écrites en ligne dans le `map`, les vingt rangées se refaisaient À CHAQUE
/// tap et à CHAQUE frappe, avec leur `Avatar` et sa photo. Le `memo` de
/// l'`Avatar` n'y pouvait rien : il recevait bien les mêmes valeurs, mais la
/// rangée autour de lui, elle, n'existait pas comme composant — React
/// n'avait rien à comparer.
///
/// Compté au banc (20 joueurs, vraies photos data-URL de 30 000 caractères,
/// 600 Ko de vignettes dans l'arbre) :
///   — 20 taps de répartition : 400 rangées re-rendues → 20, soit une seule
///     par tap, celle qu'on vient de toucher ;
///   — 7 frappes dans « Nom de l'invité », qui ne concerne aucune rangée :
///     140 → 0.
/// Le nom d'équipe, lui, reste affiché par les rangées de cette équipe : il
/// les réveille, et c'est normal — elles l'écrivent.
///
/// D'où la forme des props : QUE des valeurs simples, plus un rappel stable.
/// En particulier `valeur` — le texte de droite, déjà calculé par l'écran —
/// et non `nomA`/`nomB` : taper le nom de l'équipe A ne réveille alors que
/// les rangées qui l'affichent, pas les vingt.
export type ChoixRangee = "aucun" | "A" | "B";

export default memo(function Rangee({
  t,
  id,
  nom,
  photo,
  note,
  invite,
  gardien,
  choix,
  valeur,
  separateur,
  onTourner,
}: {
  t: Jetons;
  id: string;
  nom: string;
  photo: string | null;
  /// La note d'équilibrage, de 1 à 5 — pas le niveau gagné en jouant.
  note: number;
  invite: boolean;
  gardien: boolean;
  choix: ChoixRangee;
  /// Ce qui s'affiche à droite : « — », « Joue », ou le nom de l'équipe.
  valeur: string;
  /// Le filet au-dessus : toutes les rangées sauf la première.
  separateur: boolean;
  /// Doit être stable (`useCallback`), sinon le `memo` ne sert à rien.
  onTourner: (id: string) => void;
}) {
  const pris = choix !== "aucun";
  const camp: "A" | "B" | null = choix === "aucun" ? null : choix;
  return (
    <Pressable
      onPress={() => onTourner(id)}
      accessibilityRole="button"
      accessibilityLabel={`${nom}, note ${note}${gardien ? ", gardien" : ""} : ${
        pris ? valeur : "ne joue pas"
      }`}
      style={({ pressed }) => [
        s.rangee,
        separateur && { borderTopWidth: 1, borderTopColor: jeton(t, "sep") },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Avatar nom={nom} photo={photo} t={t} camp={camp} taille={36} />
      <View style={s.libelle}>
        <Text
          style={[s.nom, { color: pris ? t.ink : jeton(t, "i2"), fontWeight: pris ? "600" : "400" }]}
          numberOfLines={1}
        >
          {nom}
          {invite ? <Text style={[s.suffixe, { color: jeton(t, "i3") }]}> (inv.)</Text> : null}
          {gardien ? <Text style={[s.suffixe, { color: jeton(t, "i3") }]}> · gardien</Text> : null}
        </Text>
        {/* « Note », pas « niveau » : le niveau est celui qu'on gagne en
            jouant (les succès). Ici c'est la note d'équilibrage, de 1 à 5. */}
        <Text style={[s.sousNom, { color: jeton(t, "i2") }]}>Note {note}</Text>
      </View>
      <Text style={[s.valeur, { color: pris ? t.ink : jeton(t, "i3") }]} numberOfLines={1}>
        {valeur}
      </Text>
    </Pressable>
  );
});

const s = StyleSheet.create({
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  libelle: { flex: 1, minWidth: 0 },
  nom: { fontSize: 17 },
  suffixe: { fontWeight: "400" },
  sousNom: { fontSize: 13 },
  valeur: { fontSize: 17, fontWeight: "600", maxWidth: "40%" },
});
