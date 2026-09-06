// Jeu d'icônes maison — il remplace les ~75 emoji qui servaient
// d'iconographie. Un emoji en guise de titre de section est le raccourci
// qui trahit une interface générée : il change de dessin selon l'appareil,
// ignore la couleur du texte et n'appartient à aucun système graphique.
//
// Langage : tracé de 1,75 px, grille de 24, terminaisons franches — les
// lignes de craie du terrain. Tout hérite de `currentColor`, donc une
// icône prend la couleur de la chasuble ou de l'encre qui l'entoure.
//
// Le jeu reste volontairement court. La recherche est nette là-dessus :
// une icône par action est un anti-motif, le texte se lit plus vite.
// Les rangs (1, 2, 3), les séries (+3) et les libellés (Élo, Passes)
// restent en typographie — ils portent déjà leur sens.

export type IconName =
  | "ball"
  | "star"
  | "glove"
  | "pin"
  | "card"
  | "crown"
  | "coin"
  | "trophy"
  | "calendar"
  | "whistle"
  | "bolt"
  | "check"
  | "close"
  | "plus"
  | "minus"
  | "chevron"
  | "play"
  | "pause"
  | "list"
  | "undo"
  | "sound"
  | "mute";

type Props = {
  name: IconName;
  size?: number;
  className?: string;
  /** Cartons : remplit la forme au lieu de la tracer. */
  filled?: boolean;
  /** Décoratif par défaut ; passe un libellé si l'icône porte du sens seule. */
  label?: string;
};

const STROKE = 1.75;

export default function Icon({
  name,
  size = 16,
  className,
  filled = false,
  label,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {paths(name, filled)}
    </svg>
  );
}

function paths(name: IconName, filled: boolean) {
  switch (name) {
    // Ballon : le cercle et le pentagone central, comme un ballon de
    // compétition vu de face.
    case "ball":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.4l3.9 2.8-1.5 4.6h-4.8L8.1 10.2z" />
          <path d="M12 3v4.4M20.6 10.2l-4.7 0M18 20l-3.6-5.2M6 20l3.6-5.2M3.4 10.2l4.7 0" />
        </>
      );

    // Étoile — homme du match. Cinq branches, tracé net.
    case "star":
      return (
        <path
          d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z"
          fill={filled ? "currentColor" : "none"}
        />
      );

    // Gant de gardien : la paume et les quatre doigts.
    case "glove":
      return (
        <>
          <path d="M6 21v-7.5a2 2 0 0 1 2-2h1V6.5a1.5 1.5 0 0 1 3 0v5h1v-6a1.5 1.5 0 0 1 3 0v6h1V8a1.5 1.5 0 0 1 3 0v9a4 4 0 0 1-4 4z" />
          <path d="M6 16.5H3.5" />
        </>
      );

    // Repère de lieu.
    case "pin":
      return (
        <>
          <path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z" />
          <circle cx="12" cy="10.5" r="2.4" />
        </>
      );

    // Carton — la couleur vient du texte parent (jaune ou rouge).
    case "card":
      return (
        <rect
          x="6.5"
          y="3.5"
          width="11"
          height="17"
          rx="1"
          fill={filled ? "currentColor" : "none"}
        />
      );

    // Couronne — meilleur buteur.
    case "crown":
      return (
        <path
          d="M3.5 7.5l3.5 4 5-6.5 5 6.5 3.5-4V19h-17z"
          fill={filled ? "currentColor" : "none"}
        />
      );

    // Pièce — la part du terrain.
    case "coin":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M14.5 9.2a3.2 3.2 0 0 0-5 2.8 3.2 3.2 0 0 0 5 2.8" />
        </>
      );

    // Trophée — fin de saison.
    case "trophy":
      return (
        <>
          <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
          <path d="M7 5.5H4V8a3 3 0 0 0 3 3M17 5.5h3V8a3 3 0 0 1-3 3" />
          <path d="M12 14v3.5M8.5 20.5h7" />
        </>
      );

    case "calendar":
      return (
        <>
          <rect x="3.5" y="5.5" width="17" height="15" rx="1" />
          <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
        </>
      );

    // Sifflet — coup d'envoi, fin de match.
    case "whistle":
      return (
        <>
          <path d="M20.5 9.5H11l-2.2-2.2H3.5v3.4a6.3 6.3 0 1 0 12.4 1.6h4.6z" />
          <circle cx="9.6" cy="13.2" r="2.1" />
        </>
      );

    // Éclair — en direct.
    case "bolt":
      return (
        <path
          d="M13.5 2.5L5 13.5h5.5L9.5 21.5 18.5 10h-5.6z"
          fill={filled ? "currentColor" : "none"}
        />
      );

    case "check":
      return <path d="M4.5 12.5l5 5 10-11" />;

    case "close":
      return <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />;

    case "plus":
      return <path d="M12 4.5v15M4.5 12h15" />;

    case "minus":
      return <path d="M4.5 12h15" />;

    case "chevron":
      return <path d="M9 5l7 7-7 7" />;

    case "play":
      return <path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor" stroke="none" />;

    case "pause":
      return <path d="M8.5 4.5v15M15.5 4.5v15" strokeWidth={2.5} />;

    // Chronologie des événements.
    case "list":
      return <path d="M4 7h16M4 12h16M4 17h10" />;

    case "undo":
      return (
        <>
          <path d="M4 9h11a5 5 0 0 1 0 10H8" />
          <path d="M8 4.5L3.5 9 8 13.5" />
        </>
      );

    case "sound":
      return (
        <>
          <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
          <path d="M16 9a4 4 0 0 1 0 6" />
        </>
      );

    case "mute":
      return (
        <>
          <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
          <path d="M16 9.5l4 5M20 9.5l-4 5" />
        </>
      );
  }
}
