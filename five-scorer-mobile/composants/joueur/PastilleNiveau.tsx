import { View } from "react-native";
import { EcussonChasuble } from "../base";

/// Le niveau d'un joueur en petit : l'écusson de la chasuble A avec le
/// chiffre, le même que celui de la carte du niveau (composants/succes/
/// CarteNiveau.tsx), réduit à la taille d'une ligne de liste. À côté d'un
/// nom, dans l'effectif, le tableau des niveaux, la tête de la fiche.
///
/// Pas de titre à côté : « Titulaire » répété sur trente lignes ne dit plus
/// rien. Le lecteur d'écran, lui, le reçoit.
export default function PastilleNiveau({
  niveau,
  titre,
  couleur,
  taille = 20,
}: {
  niveau: number;
  titre?: string;
  /// La chasuble A du club.
  couleur: string;
  taille?: number;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={titre ? `Niveau ${niveau}, ${titre}` : `Niveau ${niveau}`}
    >
      <EcussonChasuble
        couleur={couleur}
        lettre={String(niveau)}
        taille={taille}
        // L'anneau de 4 du site mangerait la moitié d'un écusson de 20 ; la
        // lettre de 0,4 × la taille y serait illisible.
        anneau={Math.max(1.5, Math.round(taille / 10))}
        corps={Math.round(taille * 0.52)}
        ombre={false}
      />
    </View>
  );
}
