// Fabrique les quatre sons du match à partir des fréquences EXACTES de
// `five-scorer/lib/audio.ts`.
//
// Pourquoi un générateur plutôt que quatre fichiers déposés à la main : le web
// synthétise ses sons au vol (Web Audio, zéro octet d'asset). React Native n'a
// pas d'équivalent dans Expo Go — `react-native-audio-api` est explicitement
// hors Expo Go. On pré-rend donc, et `lib/audio.ts` devient la spécification.
//
// Une spécification recopiée à la main dérive. Ce fichier est la recopie, et
// `assets/audio/sons.test.ts` la garde : il refabrique les quatre fichiers et
// les compare octet pour octet à ceux du dépôt, et il vérifie que chaque
// fréquence citée ici existe encore dans le fichier du web. Le jour où
// quelqu'un change le son d'un but sur le site, le test tombe.
//
// Usage : node scripts/faire-sons.mjs   (réécrit assets/audio/*.wav)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));

/** 44,1 kHz : le sifflet monte à 1760 Hz, ses harmoniques ont besoin de place. */
export const SR = 44100;

/** Montée du gain, en secondes — `exponentialRampToValueAtTime(gain, t0 + 0.008)`. */
const ATTAQUE = 0.008;

/** Le plancher de Web Audio : on ne rampe jamais vers 0 en exponentiel. */
const SILENCE = 0.0001;

/** `osc.stop(t0 + duration + 0.02)` : la queue existe, elle est inaudible. */
const QUEUE = 0.02;

/// Les quatre sons, transcrits un par un depuis `lib/audio.ts`.
/// Les noms de champs sont ceux de `ToneOptions` du web, pour que la
/// correspondance se lise sans traduire.
export const SONS = {
  // playGoalSound("A") — le camp A monte.
  "but-a": [
    { freq: 440, glideTo: 880, duration: 0.14, type: "triangle", gain: 0.28 },
    { freq: 1320, duration: 0.12, type: "sine", gain: 0.18, delay: 0.09 },
  ],
  // playGoalSound("B") — le même, inversé. C'est tout l'intérêt : au bord du
  // terrain, l'oreille dit quel camp vient de marquer.
  "but-b": [
    { freq: 880, glideTo: 440, duration: 0.14, type: "triangle", gain: 0.28 },
    { freq: 990, duration: 0.12, type: "sine", gain: 0.18, delay: 0.09 },
  ],
  // playUndoSound() — une chute, pour que l'annulation ne ressemble à rien
  // d'autre.
  annulation: [
    { freq: 520, glideTo: 260, duration: 0.16, type: "sawtooth", gain: 0.18 },
  ],
  // playFullTimeSound() — double coup de sifflet, le second plus long.
  sifflet: [
    { freq: 1760, duration: 0.16, type: "square", gain: 0.1 },
    { freq: 1760, duration: 0.34, type: "square", gain: 0.1, delay: 0.22 },
  ],
};

/// Une table d'onde d'un cycle, limitée en bande puis normalisée à 1 — ce que
/// fait Web Audio pour ses formes intégrées. Sommer les harmoniques jusqu'à
/// Nyquist plutôt que d'échantillonner la forme idéale évite le repliement,
/// très audible sur un carré à 1760 Hz.
export function table(type, harmoniques, N = 4096) {
  const t = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const p = (2 * Math.PI * i) / N;
    let v = 0;
    if (type === "sine") {
      v = Math.sin(p);
    } else {
      for (let k = 1; k <= harmoniques; k++) {
        if (type === "square") {
          if (k % 2) v += Math.sin(k * p) / k;
        } else if (type === "sawtooth") {
          v += (k % 2 ? 1 : -1) * (Math.sin(k * p) / k);
        } else if (type === "triangle") {
          if (k % 2) v += (((k - 1) / 2) % 2 ? -1 : 1) * (Math.sin(k * p) / (k * k));
        } else {
          throw new Error(`Forme d'onde inconnue : ${type}`);
        }
      }
    }
    t[i] = v;
  }
  let max = 0;
  for (const v of t) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < N; i++) t[i] /= max;
  return t;
}

/// La rampe exponentielle de Web Audio, sur x ∈ [0, 1].
function rampe(v0, v1, x) {
  return v0 * Math.pow(v1 / v0, Math.min(1, Math.max(0, x)));
}

/// Le gain d'un ton à `u` secondes de son départ, tel que l'écrit `playTone`.
function enveloppe(u, duration, gain) {
  if (u < 0) return 0;
  if (u <= ATTAQUE) return rampe(SILENCE, gain, u / ATTAQUE);
  if (u <= duration) return rampe(gain, SILENCE, (u - ATTAQUE) / (duration - ATTAQUE));
  return SILENCE;
}

/// La fréquence instantanée : constante, ou glissée en exponentiel sur toute
/// la durée du ton (`exponentialRampToValueAtTime(glideTo, t0 + duration)`).
function frequence(u, { freq, glideTo, duration }) {
  if (!glideTo) return freq;
  return rampe(freq, glideTo, u / duration);
}

/// Mélange les tons d'un son en un seul signal flottant.
export function synthetiser(tons, sr = SR) {
  const fin = Math.max(...tons.map((x) => (x.delay ?? 0) + x.duration + QUEUE));
  const sortie = new Float64Array(Math.ceil(fin * sr));

  for (const ton of tons) {
    const { type = "sine", gain = 0.22, duration, delay = 0 } = ton;
    // La bande se calcule sur la fréquence la PLUS HAUTE du ton, glissement
    // compris : sinon un but qui monte de 440 à 880 replie en fin de course.
    const fmax = Math.max(ton.freq, ton.glideTo ?? ton.freq);
    const harmoniques = Math.max(1, Math.floor(sr / 2 / fmax));
    const onde = table(type, harmoniques);
    const N = onde.length;

    const debut = Math.round(delay * sr);
    const duree = Math.ceil((duration + QUEUE) * sr);
    let phase = 0; // en cycles, pas en radians : la lecture de table est directe
    for (let i = 0; i < duree; i++) {
      const j = debut + i;
      if (j >= sortie.length) break;
      const u = i / sr;
      // Interpolation linéaire entre deux points de la table.
      const x = phase * N;
      const i0 = Math.floor(x) % N;
      const i1 = (i0 + 1) % N;
      const f = x - Math.floor(x);
      sortie[j] += (onde[i0] * (1 - f) + onde[i1] * f) * enveloppe(u, duration, gain);
      phase += frequence(Math.min(u, duration), ton) / sr;
      phase -= Math.floor(phase);
    }
  }
  return sortie;
}

/// WAV mono 16 bits. Metro embarque `.wav` sans configuration, AVFoundation et
/// ExoPlayer le lisent sans décodeur — donc sans latence au premier but.
export function wav(signal, sr = SR) {
  const n = signal.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8, "ascii");
  buf.writeUInt32LE(16, 16); // taille du bloc fmt
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28); // octets par seconde
  buf.writeUInt16LE(2, 32); // alignement de bloc
  buf.writeUInt16LE(16, 34); // bits par échantillon
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, signal[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

/** Le fichier complet d'un son, prêt à écrire ou à comparer. */
export function fabriquer(nom) {
  const tons = SONS[nom];
  if (!tons) throw new Error(`Son inconnu : ${nom}`);
  return wav(synthetiser(tons));
}

const estPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (estPrincipal) {
  const dossier = join(ICI, "..", "assets", "audio");
  mkdirSync(dossier, { recursive: true });
  for (const nom of Object.keys(SONS)) {
    const octets = fabriquer(nom);
    writeFileSync(join(dossier, `${nom}.wav`), octets);
    const ms = Math.round(((octets.length - 44) / 2 / SR) * 1000);
    console.log(`${nom}.wav  ${octets.length} octets  ${ms} ms`);
  }
}
