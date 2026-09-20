import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/// Les cinq étoiles de la NOTE d'équilibrage (1 à 5), reprises du site :
/// 13 px, écart de 2, pleines en encre secondaire, vides en CONTOUR à 30 %
/// d'opacité — le site trace toutes les étoiles au trait de 1,75 et ne
/// remplit que les pleines. Une étoile vide remplie et estompée se lisait
/// comme une étoile de plus, en gris. Le chemin est celui de l'icône `star`
/// de components/Icon.tsx.
///
/// « Note », pas « niveau » : le mot « niveau » est réservé au niveau gagné
/// en jouant (les succès). Sur l'effectif les deux se suivent d'une seconde,
/// et VoiceOver annonçait « niveau 7, Taulier » puis « Niveau 3 sur 5 ».
const CHEMIN =
  "M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z";

export default function Etoiles({
  note,
  couleur,
  taille = 13,
}: {
  note: number;
  couleur: string;
  taille?: number;
}) {
  return (
    <View
      style={{ flexDirection: "row", gap: 2 }}
      accessible
      accessibilityLabel={`Note ${note} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Svg key={n} width={taille} height={taille} viewBox="0 0 24 24">
          <Path
            d={CHEMIN}
            fill={n <= note ? couleur : "none"}
            stroke={couleur}
            strokeWidth={1.75}
            strokeLinecap="square"
            strokeLinejoin="miter"
            opacity={n <= note ? 1 : 0.3}
          />
        </Svg>
      ))}
    </View>
  );
}
