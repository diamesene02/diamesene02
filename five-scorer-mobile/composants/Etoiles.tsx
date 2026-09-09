import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/// Les cinq étoiles du niveau, reprises du site : 13 px, écart de 2, pleines
/// en encre secondaire, vides à 30 % d'opacité. Le chemin est celui de
/// l'icône `star` de components/Icon.tsx, au trait près.
const CHEMIN =
  "M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z";

export default function Etoiles({
  niveau,
  couleur,
  taille = 13,
}: {
  niveau: number;
  couleur: string;
  taille?: number;
}) {
  return (
    <View
      style={{ flexDirection: "row", gap: 2 }}
      accessibilityLabel={`Niveau ${niveau} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Svg key={n} width={taille} height={taille} viewBox="0 0 24 24">
          <Path d={CHEMIN} fill={couleur} opacity={n <= niveau ? 1 : 0.3} />
        </Svg>
      ))}
    </View>
  );
}
