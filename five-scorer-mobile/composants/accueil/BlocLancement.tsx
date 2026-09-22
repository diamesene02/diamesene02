import { Pressable, StyleSheet, Text, View } from "react-native";
import { BoutonPlein, BoutonVerre } from "../base";
import { IconeJeu } from "../Icones";
import { jeton, type Jetons } from "../../lib/couleurs";

/// Le coup d'envoi, sous la carte des matchs (`.accueil-lancer` du site).
///
/// Avec une compo prête : « ▶ Coup d'envoi » lance le match en un tap avec
/// les équipes de jeudi, l'aide dit lesquelles, et « Composer les équipes »
/// reste là pour qui veut les refaire. Sans compo : « Lancer un match ».
///
/// Le coup d'envoi en un tap n'existe que le jour où l'on joue (une soirée
/// aujourd'hui, ou pas de calendrier du tout) — c'est l'appelant qui en
/// décide. Affiché le samedi pour la soirée du lundi, un tap distrait ouvrait
/// une feuille en direct deux jours trop tôt. Les autres jours, « Lancer un
/// match » passe en bouton de verre : on peut, mais ce n'est pas le geste du
/// jour.
///
/// Dessous, une ligne ouvre la feuille « Créer » : la saisie d'un match déjà
/// joué et la soirée à programmer. Le « + » de la barre du bas y mène aussi
/// depuis son retour ; cette ligne reste parce qu'on la LIT — le « + » se
/// devine, la phrase se lit, et c'est elle qui apprend que ces deux gestes
/// existent.
///
/// Elle était centrée, grise, et finissait par « … » : on la lisait comme une
/// phrase coupée, pas comme une porte. C'est maintenant une rangée — texte à
/// gauche, chevron à droite, 48 de haut —, la forme que prennent toutes les
/// autres destinations de l'écran.
export default function BlocLancement({
  t,
  indice,
  jourDeJeu,
  lance,
  onCoupDEnvoi,
  onComposer,
  onAutres,
}: {
  t: Jetons;
  /// La phrase sous « Coup d'envoi » (« Blanc 5 vs 5 Noir — la compo
  /// préparée pour ce soir »). `null` : pas de coup d'envoi en un tap.
  indice: string | null;
  jourDeJeu: boolean;
  /// Le match est en train de s'écrire : le bouton se fige.
  lance: boolean;
  onCoupDEnvoi: () => void;
  onComposer: () => void;
  onAutres: () => void;
}) {
  return (
    <View>
      {indice ? (
        <>
          <BoutonPlein
            t={t}
            titre="Coup d'envoi"
            icone={<IconeJeu nom="lecture" couleur={jeton(t, "bf")} taille={16} />}
            occupe={lance}
            onPress={onCoupDEnvoi}
            etiquette={`Coup d'envoi. ${indice}`}
          />
          <Text style={[s.indice, { color: jeton(t, "i2") }]}>{indice}</Text>
          <BoutonVerre t={t} titre="Composer les équipes" onPress={onComposer} style={s.composer} />
        </>
      ) : jourDeJeu ? (
        <BoutonPlein t={t} titre="Lancer un match" onPress={onComposer} />
      ) : (
        // Les jours sans match, ce n'est pas LE geste du jour — mais c'en est
        // un. En verre nu, au milieu du fond du club, il se lisait comme un
        // bouton éteint ; la lueur de la chasuble le rend actif sans lui
        // donner le plein, que garde le coup d'envoi.
        <BoutonVerre t={t} titre="Lancer un match" lueur onPress={onComposer} />
      )}
      <Pressable
        onPress={onAutres}
        accessibilityRole="button"
        accessibilityHint="Saisir un match déjà joué, programmer une soirée"
        style={({ pressed }) => [s.autres, pressed && { opacity: 0.6 }]}
      >
        <Text style={[s.autresTexte, { color: jeton(t, "i2") }]} numberOfLines={1}>
          Match déjà joué, soirée à programmer
        </Text>
        <IconeJeu nom="chevron" couleur={jeton(t, "i3")} taille={14} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  indice: { fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },
  composer: { marginTop: 12 },
  autres: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
    marginTop: 4,
    paddingHorizontal: 6,
  },
  autresTexte: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
});
