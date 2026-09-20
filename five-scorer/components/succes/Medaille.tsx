import { cn } from "@/lib/cn";
import {
  NOMS_MATIERES,
  TEINTE_LEGENDE,
  TEINTES_MATIERES,
  type IconeSucces as Cle,
  type Matiere,
} from "@/lib/succes-icones";
import IconeSucces from "./IconeSucces";
import "./succes.css";

// La médaille d'un succès : un anneau de métal, un cœur sombre, l'icône au
// milieu. C'est l'écusson du club (components/ios/Ecusson) décliné en métal —
// même disque, même ombre portée — pour qu'elle appartienne au même dessin.
//
// `matiere` à null : la médaille verrouillée, grisée aux jetons du thème. On
// y laisse l'icône : on voit ce qu'on vise.
//
// Aucun hook : utilisable dans un composant serveur comme dans un client.
export default function Medaille({
  icone,
  matiere,
  taille = 56,
  label,
  className,
}: {
  icone: Cle;
  matiere: Matiere | null;
  taille?: number;
  /// Pour un lecteur d'écran, quand la médaille est seule à porter le sens
  /// (« Buteur, or »). Décorative sinon.
  label?: string;
  className?: string;
}) {
  const style: Record<string, string | number> = { "--t": `${taille}px` };
  if (matiere && matiere !== "legende") {
    const m = TEINTES_MATIERES[matiere];
    Object.assign(style, {
      "--m-clair": m.clair,
      "--m": m.base,
      "--m-sombre": m.sombre,
      "--m-coeur": m.coeur,
      "--m-coeur-clair": m.coeurClair,
      "--m-encre": m.encre,
    });
  } else if (matiere === "legende") {
    Object.assign(style, {
      "--m-coeur": TEINTE_LEGENDE.coeur,
      "--m-coeur-clair": TEINTE_LEGENDE.coeurClair,
      "--m-encre": TEINTE_LEGENDE.encre,
    });
  }
  return (
    <span
      className={cn(
        "medaille",
        matiere === null && "verrouillee",
        matiere === "legende" && "legende",
        className,
      )}
      style={style as React.CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label ?? (matiere ? NOMS_MATIERES[matiere] : undefined)}
    >
      <span className="medaille-coeur">
        <IconeSucces icone={icone} taille={Math.round(taille * 0.5)} />
      </span>
    </span>
  );
}
