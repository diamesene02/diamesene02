import Svg, { Path } from "react-native-svg";
import { CHEMINS_ICONES, type IconeSucces as Cle } from "../../lib/succes-icones";

/// Une icône de succès, seule : les chemins de lib/succes-icones.ts, trait de
/// 2, bouts ronds — le même dessin que le site.
export default function IconeSucces({
  icone,
  couleur,
  taille = 24,
}: {
  icone: Cle;
  couleur: string;
  taille?: number;
}) {
  const chemins = CHEMINS_ICONES[icone] ?? CHEMINS_ICONES.etoile;
  return (
    <Svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {chemins.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}
