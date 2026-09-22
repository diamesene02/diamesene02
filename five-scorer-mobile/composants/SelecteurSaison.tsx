import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { styleLueur } from "./base";
import { IconeJeu } from "./Icones";
import PopoverVerre, { mesurer, type Ancre } from "./PopoverVerre";
import { jeton, type Jetons } from "../lib/couleurs";
import { choix as retourChoix } from "../lib/haptique";

/// Le sélecteur de saison des stats et de la saison (`.stats-saison` du
/// site) : une pilule de verre à la lueur du club, qui ouvre la liste des
/// saisons en verre juste en dessous, bord droit contre bord droit.
///
/// La feuille par le bas qu'il remplace obligeait à descendre le pouce en bas
/// de l'écran pour un choix qu'on a lancé en haut.
export default function SelecteurSaison({
  t,
  choix,
  valeur,
  onChange,
  occupe = false,
}: {
  t: Jetons;
  choix: { id: string; libelle: string }[];
  valeur: string | null;
  onChange: (id: string) => void;
  /// Le nouveau classement est en route. La flèche laisse la place au rond :
  /// c'est le seul endroit où le geste a eu lieu, c'est là qu'il doit
  /// répondre. Sans lui, changer de saison ne produisait RIEN à l'écran
  /// jusqu'à ce que les chiffres changent tout seuls.
  occupe?: boolean;
}) {
  const pilule = useRef<View>(null);
  const [ancre, setAncre] = useState<Ancre | null>(null);
  const courante = choix.find((c) => c.id === valeur)?.libelle ?? choix[0]?.libelle ?? "Saison";

  return (
    <>
      <Pressable
        ref={pilule}
        onPress={() => mesurer(pilule.current, (a) => a && setAncre(a))}
        accessibilityRole="button"
        accessibilityLabel={`Saison : ${courante}. Choisir la saison`}
        accessibilityState={{ expanded: ancre != null, busy: occupe }}
        style={({ pressed }) => [s.pilule, styleLueur(t), pressed && { opacity: 0.8 }]}
      >
        <Text style={[s.nom, { color: t.ink }]} numberOfLines={1}>
          {courante}
        </Text>
        {occupe ? (
          <ActivityIndicator size="small" color={jeton(t, "i2")} style={s.rond} />
        ) : (
          <Text style={[s.fleche, { color: jeton(t, "i2") }]}>▾</Text>
        )}
      </Pressable>

      <PopoverVerre t={t} ancre={ancre} onClose={() => setAncre(null)} largeur={240} ecart={8}>
        <ScrollView bounces={false} style={s.defile} contentContainerStyle={s.contenu}>
          {choix.map((c) => {
            const actif = c.id === valeur;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setAncre(null);
                  if (!actif) {
                    retourChoix();
                    onChange(c.id);
                  }
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
                style={({ pressed }) => [
                  s.item,
                  (actif || pressed) && { backgroundColor: jeton(t, "gl") },
                ]}
              >
                <Text style={[s.itemTexte, { color: t.ink }]} numberOfLines={1}>
                  {c.libelle}
                </Text>
                {actif && <IconeJeu nom="coche" couleur={jeton(t, "i2")} taille={16} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </PopoverVerre>
    </>
  );
}

const s = StyleSheet.create({
  pilule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    maxWidth: 200,
    flexShrink: 1,
  },
  nom: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  fleche: { fontSize: 13 },
  // La largeur de la flèche, pour que la pilule ne change pas de taille
  // pendant le calcul : un bouton qui grandit sous le pouce, c'est un bouton
  // qu'on rate au geste suivant.
  rond: { width: 13, transform: [{ scale: 0.8 }] },
  defile: { flexGrow: 0, flexShrink: 1 },
  contenu: { padding: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  itemTexte: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
});
