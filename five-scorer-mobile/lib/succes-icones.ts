// Les icônes des succès et les teintes de leurs médailles — COPIE CONFORME
// de five-scorer/lib/succes-icones.ts (l'app ne peut pas importer le site).
//
// Un seul jeu, au trait : grille de 24, trait de 2, bouts et angles ronds,
// dessiné pour se lire à 20 px. Le site le trace en <svg>, l'app avec
// react-native-svg : mêmes chemins, même médaille. Le jour où un dessin
// change, il change des deux côtés dans le même commit.

/// Les clés d'icône du contrat des succès — le même ensemble que
/// `IconeSucces` de lib/succes.ts.
export type IconeSucces =
  | "debut" | "ballon" | "passe" | "double" | "chapeau" | "feu" | "serie"
  | "etoile" | "victoire" | "eclair" | "bouclier" | "couronne" | "maillot"
  | "lundi" | "calendrier" | "remontada" | "decisif" | "ouvreur" | "gant"
  | "mur" | "fessee" | "elo" | "duo" | "veteran" | "vote" | "titre";

export type Matiere = "bronze" | "argent" | "or" | "platine" | "legende";

/// Les `d` des `<path>` de chaque icône, dans l'ordre du dessin. Les cercles
/// sont écrits en deux demi-arcs : un seul type d'élément, donc une seule
/// boucle pour les tracer, en `<svg>` comme en react-native-svg.
export const CHEMINS_ICONES: Record<IconeSucces, string[]> = {
  // Premiers pas : la chaussure à crampons, celle qu'on chausse le premier lundi.
  debut: [
    "M3 15.5V7.5a1 1 0 0 1 1-1h4l1.8 3.2H13c3.8 0 7.5 1.8 8 5v.3a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5z",
    "M6 16.5v2.5M10.5 16.5v2.5M15 16.5v2.5",
    "M3 12.5h6",
  ],
  // Le ballon de la barre du bas, avec ses cinq coutures : sans elles, un
  // cercle et un pentagone se lisent « bouton » à 20 px.
  ballon: [
    "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0",
    "M12 7.7l4.1 3-1.6 4.8h-5L7.9 10.7z",
    "M12 7.7V3M16.1 10.7l4.4-1.4M14.5 15.5l2.8 3.8M9.5 15.5l-2.8 3.8M7.9 10.7 3.5 9.3",
  ],
  // La passe : d'un joueur à l'autre, par-dessus.
  passe: [
    "M3 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0",
    "M16 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0",
    "M5.5 12.5C7 7 17 7 18.5 12.5",
    "M15.7 10.7l2.8 1.8 1.4-3",
  ],
  // Deux ballons, celui de devant masque l'autre : l'arc du fond s'arrête
  // avant de toucher, sinon les deux cercles se soudent en un « 8 ».
  double: [
    "M9.5 15a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0",
    "M14.41 8.03A5.5 5.5 0 1 0 8.03 14.41",
    "M15 12.6l2.3 1.7-.9 2.7h-2.8l-.9-2.7z",
  ],
  // Le coup du chapeau, au sens propre.
  chapeau: [
    "M7 16V6.5C7 5 9.2 4 12 4s5 1 5 2.5V16",
    "M7 12.5h10",
    "M2.5 16.5c2 1.8 5.5 2.5 9.5 2.5s7.5-.7 9.5-2.5",
  ],
  feu: [
    "M12 21a6.5 6.5 0 0 1-6.5-6.5c0-3 1.8-4.7 3.3-6.4.3 1.8 1.1 2.9 2.2 3.4-.3-3.4.9-6.3 3-8.5.4 3.3 2.2 5 3.5 6.8.9 1.3 1.5 2.8 1.5 4.7A6.5 6.5 0 0 1 12 21z",
    "M12 21c-1.7 0-3-1.2-3-2.8 0-1.8 1.5-2.8 3-4.2 1.5 1.4 3 2.4 3 4.2 0 1.6-1.3 2.8-3 2.8z",
  ],
  // Le ballon lancé : il enchaîne.
  serie: [
    "M11 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0",
    "M3 8.5h5",
    "M2 12h6",
    "M3 15.5h5",
  ],
  etoile: [
    "M12 3l2.35 6.26 6.69.3-5.24 4.18 1.78 6.45L12 16.5l-5.58 3.69 1.78-6.45-5.24-4.18 6.69-.3z",
  ],
  // La coupe du menu (« Saison »), au même dessin.
  victoire: [
    "M7 4h10v5a5 5 0 0 1-10 0z",
    "M7 5.5H4V8a3 3 0 0 0 3 3M17 5.5h3V8a3 3 0 0 1-3 3",
    "M12 14v3.5M8.5 20.5h7",
  ],
  eclair: ["M13.5 2.5 5 13.5h5.5l-1 8 9-11.5h-5.6z"],
  bouclier: ["M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6z"],
  couronne: ["M4.5 17.5 3 7.5l5 4L12 5l4 6.5 5-4-1.5 10z", "M5 21h14"],
  maillot: [
    "M9 3.5 4 5.8 2.5 10.5l3.2 1.2L7 10v10.5h10V10l1.3 1.7 3.2-1.2L20 5.8l-5-2.3c-.4 1.4-1.6 2.3-3 2.3s-2.6-.9-3-2.3z",
  ],
  // Habitué : la soirée — on joue le lundi soir.
  lundi: ["M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z", "M17 3v3M15.5 4.5h3"],
  // Toujours là : le calendrier, les cases remplies à la suite.
  calendrier: [
    "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    "M3 10h18M8 3v4M16 3v4",
    "M7.5 15h.01M12 15h.01M16.5 15h.01",
  ],
  // La courbe qui plonge puis finit plus haut qu'elle n'était partie.
  remontada: ["M3 5.5c2.5 0 3.5 12.5 7.5 12.5 3.2 0 5.8-7.5 10-13", "M14.5 4.5h6.5V11"],
  // But décisif : dans le mille. Une cage dessinée à 20 px se lisait
  // « fenêtre » ; la cible se lit du premier coup.
  decisif: [
    "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0",
    "M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0",
    "M12 12h.01",
  ],
  // Ouvreur : celui qui ouvre le score.
  ouvreur: [
    "M3 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0",
    "M12 12h9.5",
    "M17.5 12v3.5M21 12v2.5",
  ],
  // Le gant : trois doigts et non quatre — à quatre, les traits se touchent
  // à 20 px et la main devient un pavé. La sangle en fait un gant.
  gant: [
    "M6.5 14V7.2a2.25 2.25 0 0 1 4.5 0V5.2a2.25 2.25 0 0 1 4.5 0v1.5a2.25 2.25 0 0 1 4.5 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.7-2.3L3.4 14.8a1.8 1.8 0 0 1 2.7-2.3l.4.5",
    "M11 7.2V12M15.5 6.7V12",
    "M8.8 16.5h11",
  ],
  // Cage inviolée : le mur.
  mur: [
    "M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5z",
    "M3 9.7h18M3 14.3h18M12 5v4.7M7.5 9.7v4.6M16.5 9.7v4.6M12 14.3V19",
  ],
  // Correction : le maillet.
  fessee: ["M4 20l8.5-8.5", "M10.4 5.9l7.7 7.7 3-3-7.7-7.7z"],
  // La cote : un cadran et son aiguille.
  elo: ["M3.5 17a8.5 8.5 0 0 1 17 0", "M12 17l4.5-5.5", "M3.5 17h.01M20.5 17h.01"],
  duo: [
    "M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0",
    "M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1",
    "M15.5 4.6a3.5 3.5 0 0 1 0 6.8",
    "M18 14.2a5 5 0 0 1 3.5 4.8v1",
  ],
  // Les galons : une saison, un chevron.
  veteran: ["M6 9.5l6-4 6 4", "M6 14l6-4 6 4", "M6 18.5l6-4 6 4"],
  vote: [
    "M4 13h16v6.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z",
    "M8.5 13V4h7v9",
    "M10.3 8.4l1.4 1.4 2.3-2.6",
  ],
  // Palmarès : la médaille pendue à son ruban.
  titre: [
    "M7.5 3l3.2 6.3M16.5 3l-3.2 6.3M7.5 3h9",
    "M6.5 15a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0",
  ],
};

/// Les teintes d'une médaille.
///
/// L'anneau porte le métal en dégradé (clair en haut à gauche, sombre en bas à
/// droite : la lumière du plafonnier) ; le cœur est un disque sombre teinté du
/// même métal ; l'icône y est tracée en `encre`, un métal éclairci. Un cœur
/// métallique plein avec l'icône gravée en sombre a été écarté : sur de l'or
/// ou du platine, un trait sombre de 1,7 px ne se lit plus à 20 px, et la
/// médaille verrouillée — grise — ne s'en distinguait qu'à la couleur.
///
/// `legende` n'est pas ici : son anneau est le dégradé des deux chasubles du
/// club, calculé à l'affichage.
export const TEINTES_MATIERES: Record<
  Exclude<Matiere, "legende">,
  { clair: string; base: string; sombre: string; coeur: string; coeurClair: string; encre: string }
> = {
  bronze: {
    clair: "#f0c294",
    base: "#c8864a",
    sombre: "#6e4220",
    coeur: "#2b1a0d",
    coeurClair: "#4a2e17",
    encre: "#e6b88c",
  },
  argent: {
    clair: "#f5f7fb",
    base: "#c7ccd6",
    sombre: "#737a88",
    coeur: "#202329",
    coeurClair: "#373c46",
    encre: "#e3e7ee",
  },
  or: {
    clair: "#fff0b0",
    base: "#f5c542",
    sombre: "#9c7414",
    coeur: "#2b2006",
    coeurClair: "#4a3810",
    encre: "#f8d67b",
  },
  platine: {
    clair: "#eefaff",
    base: "#9fe3ff",
    sombre: "#3f8fb3",
    coeur: "#0d2530",
    coeurClair: "#1b3d4d",
    encre: "#c5eeff",
  },
};

/// La légende : un cœur neutre, l'icône en blanc — l'anneau porte déjà deux
/// couleurs, un cœur teinté en ajouterait une troisième.
export const TEINTE_LEGENDE = { coeur: "#15151a", coeurClair: "#2c2c34", encre: "#ffffff" } as const;

/// Le nom d'une matière, pour les lecteurs d'écran et les légendes.
export const NOMS_MATIERES: Record<Matiere, string> = {
  bronze: "Bronze",
  argent: "Argent",
  or: "Or",
  platine: "Platine",
  legende: "Légende",
};

/// Le rang d'une matière : de deux succès du même soir, on annonce d'abord le
/// plus précieux.
export const RANG_MATIERE: Record<Matiere, number> = {
  bronze: 1,
  argent: 2,
  or: 3,
  platine: 4,
  legende: 5,
};
