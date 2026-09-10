// Les sons du match, et l'interrupteur qui les coupe.
//
// Le web les synthétise au vol (`five-scorer/lib/audio.ts`, Web Audio). Ici
// ils sont pré-rendus : la seule implémentation Web Audio en React Native,
// `react-native-audio-api`, est explicitement hors Expo Go. Les quatre `.wav`
// d'`assets/audio/` sortent des fréquences exactes de ce fichier-là — voir
// `scripts/faire-sons.mjs`, et le test qui empêche les deux de diverger.
//
// Ce que le portage fait DISPARAÎTRE, et c'est un gain : `unlockAudio()`. Sur
// le web, aucun son ne sort avant qu'un geste de l'utilisateur ait « déverrouillé »
// le contexte audio — une cicatrice de navigateur, 12 lignes, appelée depuis la
// tuile joueur au cas où. En natif il n'y a rien à déverrouiller.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import Storage from "expo-sqlite/kv-store";

/// La même clé que le web (`localStorage`), pour que le réglage se lise pareil
/// des deux côtés le jour où on les rapprochera. Le stockage, lui, change :
/// `expo-sqlite/kv-store` est synchrone comme `localStorage`, donc le portage
/// des trois fonctions ci-dessous est à l'identique.
const CLE = "fs-sound-enabled";

export function sonActif(): boolean {
  try {
    const v = Storage.getItemSync(CLE);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function reglerSon(actif: boolean): void {
  try {
    Storage.setItemSync(CLE, actif ? "1" : "0");
  } catch {
    /* rien : un réglage perdu vaut mieux qu'un écran qui plante */
  }
}

export function basculerSon(): boolean {
  const suivant = !sonActif();
  reglerSon(suivant);
  return suivant;
}

type Nom = "but-a" | "but-b" | "annulation" | "sifflet";

/// `require` et non `import` : Metro résout les assets par `require`, et c'est
/// ce chemin-là qui embarque le fichier dans le bundle.
const FICHIERS: Record<Nom, number> = {
  "but-a": require("../../assets/audio/but-a.wav"),
  "but-b": require("../../assets/audio/but-b.wav"),
  annulation: require("../../assets/audio/annulation.wav"),
  sifflet: require("../../assets/audio/sifflet.wav"),
};

const lecteurs = new Map<Nom, AudioPlayer>();
let modeRegle = false;

/// Le mode audio, réglé une fois. Les deux valeurs sont déjà celles par défaut
/// d'expo-audio ; on les écrit quand même, parce que ce sont exactement les
/// deux qui décident si l'app sert à quelque chose au gymnase :
///
/// - `playsInSilentMode` : le téléphone du marqueur est en silencieux. Sans
///   ça, aucun son ne sort de la soirée — et le son est le seul retour qu'on
///   ait quand on regarde le jeu plutôt que l'écran.
/// - `mixWithOthers` : quelqu'un met de la musique pendant l'échauffement. Un
///   but ne doit pas la couper, juste passer par-dessus.
function reglerMode(): void {
  if (modeRegle) return;
  modeRegle = true;
  void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" });
}

/// Les lecteurs sont créés à la première demande et gardés : les quatre
/// fichiers pèsent 108 ko en tout, et créer un lecteur à chaque but ajouterait
/// une latence là où elle s'entend.
function lecteur(nom: Nom): AudioPlayer {
  let p = lecteurs.get(nom);
  if (!p) {
    p = createAudioPlayer(FICHIERS[nom]);
    lecteurs.set(nom, p);
  }
  return p;
}

/// Rejoue un son depuis le début, sans jamais faire échouer l'action qui l'a
/// demandé : un but se compte même si le haut-parleur est occupé.
///
/// `seekTo(0)` avant `play()` n'est pas décoratif : un lecteur arrivé au bout
/// y reste, et `play()` seul ne rejouerait rien au deuxième but.
function jouer(nom: Nom): void {
  if (!sonActif()) return;
  try {
    reglerMode();
    const p = lecteur(nom);
    void p.seekTo(0);
    p.play();
  } catch {
    /* rien */
  }
}

/// Le but a un son PAR CAMP : montant pour A, le même inversé pour B. Au bord
/// du terrain, le marqueur regarde le jeu, pas l'écran — l'oreille est le seul
/// canal qui reste, et il ne disait rien de qui venait de marquer.
/// (Commentaire repris de `lib/audio.ts` : c'est la raison des deux fichiers.)
export function jouerBut(camp: "A" | "B"): void {
  jouer(camp === "A" ? "but-a" : "but-b");
}

export function jouerAnnulation(): void {
  jouer("annulation");
}

/** Fin du temps réglementaire : double coup de sifflet. */
export function jouerSifflet(): void {
  jouer("sifflet");
}
