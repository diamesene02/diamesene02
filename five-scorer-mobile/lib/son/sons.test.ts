// Les quatre sons du match ne peuvent pas diverger de leur spécification.
//
// Le web synthétise au vol ; ici on pré-rend, parce que Web Audio n'existe pas
// dans Expo Go. Un fichier pré-rendu ne dit pas d'où il vient : c'est le rôle
// de ce test. Il refabrique les quatre `.wav` depuis `scripts/faire-sons.mjs`
// et les compare octet pour octet à ceux du dépôt, puis il vérifie que chaque
// fréquence et chaque durée citées par le générateur existent encore dans
// `five-scorer/lib/audio.ts`.
//
// Même intention que `lib/noyau/copie-conforme.test.ts` : la règle vit à deux
// endroits, donc quelque chose doit crier le jour où l'un des deux bouge.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Le générateur est en JavaScript pur : c'est le script qu'on lance à la main
// pour réécrire les `.wav`, et le test importe exactement ce script-là — pas
// une deuxième implémentation qui lui ressemblerait.
import { SONS, SR, fabriquer, synthetiser } from "../../scripts/faire-sons.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const AUDIO = join(ICI, "..", "..", "assets", "audio");
const SOURCE_WEB = join(ICI, "..", "..", "..", "five-scorer", "lib", "audio.ts");

type Ton = {
  freq: number;
  duration: number;
  type: string;
  gain: number;
  glideTo?: number;
  delay?: number;
};

const sons = SONS as Record<string, Ton[]>;
const NOMS = Object.keys(sons);

/** Les échantillons d'un `.wav` mono 16 bits, en flottants [-1, 1]. */
function echantillons(octets: Buffer): Float64Array {
  const n = (octets.length - 44) / 2;
  const s = new Float64Array(n);
  for (let i = 0; i < n; i++) s[i] = octets.readInt16LE(44 + i * 2) / 32767;
  return s;
}

/** Fréquence dominante d'une tranche, comptée aux passages par zéro montants. */
function hertz(s: Float64Array, debut: number, fin: number): number {
  let c = 0;
  for (let i = debut + 1; i < fin; i++) if (s[i - 1] < 0 && s[i] >= 0) c++;
  return (c / (fin - debut)) * SR;
}

describe("les quatre sons du match", () => {
  it("il y en a exactement quatre, nommés par ce qu'ils disent", () => {
    expect(NOMS.sort()).toEqual(["annulation", "but-a", "but-b", "sifflet"]);
  });

  for (const nom of NOMS) {
    it(`assets/audio/${nom}.wav est bien ce que le générateur produit`, () => {
      const depot = readFileSync(join(AUDIO, `${nom}.wav`));
      const refait = fabriquer(nom) as Buffer;
      expect(
        depot.equals(refait),
        `assets/audio/${nom}.wav a divergé de scripts/faire-sons.mjs. ` +
          `Relancer « node scripts/faire-sons.mjs », ne pas éditer le .wav.`,
      ).toBe(true);
    });

    it(`${nom}.wav est un WAV mono 16 bits à ${SR} Hz`, () => {
      const b = readFileSync(join(AUDIO, `${nom}.wav`));
      expect(b.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(b.subarray(8, 12).toString("ascii")).toBe("WAVE");
      expect(b.readUInt16LE(20)).toBe(1); // PCM, aucun décodeur à réveiller
      expect(b.readUInt16LE(22)).toBe(1); // mono
      expect(b.readUInt32LE(24)).toBe(SR);
      expect(b.readUInt16LE(34)).toBe(16);
      expect(b.readUInt32LE(40)).toBe(b.length - 44);
      expect(b.readUInt32LE(4)).toBe(b.length - 8);
    });

    it(`${nom} ne sature pas et tient sous une seconde`, () => {
      const s = echantillons(readFileSync(join(AUDIO, `${nom}.wav`)));
      let crete = 0;
      for (const v of s) crete = Math.max(crete, Math.abs(v));
      // Le gain le plus fort du son, tel que déclaré. Deux tons peuvent se
      // recouvrir : on vérifie qu'on reste sous 1, pas l'égalité exacte.
      const declare = Math.max(...sons[nom].map((t) => t.gain));
      expect(crete).toBeGreaterThan(declare * 0.9);
      expect(crete).toBeLessThan(1);
      // Un son de match se joue pendant le jeu : il doit être fini avant que
      // le regard revienne à l'écran.
      expect(s.length / SR).toBeLessThan(1);
    });
  }

  // C'est la seule raison d'avoir DEUX fichiers de but plutôt qu'un. Si les
  // deux glissaient dans le même sens, l'oreille ne dirait plus quel camp
  // vient de marquer — et personne ne s'en apercevrait en relisant le code.
  it("le but du camp A monte, celui du camp B descend", () => {
    const tranche = (nom: string, a: number, b: number) =>
      hertz(
        echantillons(readFileSync(join(AUDIO, `${nom}.wav`))),
        Math.round(a * SR),
        Math.round(b * SR),
      );
    // Avant 0,09 s : le second ton n'est pas encore entré, on mesure le glissé.
    const aDebut = tranche("but-a", 0.005, 0.03);
    const aFin = tranche("but-a", 0.06, 0.085);
    const bDebut = tranche("but-b", 0.005, 0.03);
    const bFin = tranche("but-b", 0.06, 0.085);
    expect(aFin).toBeGreaterThan(aDebut * 1.2);
    expect(bFin).toBeLessThan(bDebut * 0.8);
    // Et les deux partent bien de part et d'autre : 440 contre 880.
    expect(aDebut).toBeLessThan(bDebut);
  });

  it("la synthèse est déterministe", () => {
    for (const nom of NOMS) {
      const a = synthetiser(sons[nom]) as Float64Array;
      const b = synthetiser(sons[nom]) as Float64Array;
      expect(Array.from(a)).toEqual(Array.from(b));
    }
  });
});

describe("la spécification reste celle du web", () => {
  const web = readFileSync(SOURCE_WEB, "utf8");

  for (const nom of NOMS) {
    it(`chaque nombre de ${nom} est encore dans five-scorer/lib/audio.ts`, () => {
      for (const ton of sons[nom]) {
        for (const [champ, valeur] of Object.entries(ton)) {
          if (typeof valeur !== "number") continue;
          expect(
            web.includes(String(valeur)),
            `${nom} : ${champ} = ${valeur} n'existe plus dans lib/audio.ts. ` +
              `Le son du site a changé — corriger SONS, puis relancer ` +
              `« node scripts/faire-sons.mjs ».`,
          ).toBe(true);
        }
        expect(web).toContain(`type: "${ton.type}"`);
      }
    });
  }

  // Le garde structurel : `but-b` est le même son inversé, il ne compte pas
  // deux fois. Ajouter une couche à un son du site fait tomber ce test.
  it("autant de couches ici que d'appels à playTone sur le site", () => {
    // `playTone({` apparaît aussi à la déclaration de la fonction : on la retire.
    const appels =
      (web.match(/playTone\(\{/g) ?? []).length -
      (web.match(/function playTone\(\{/g) ?? []).length;
    const couches =
      sons["but-a"].length + sons["annulation"].length + sons["sifflet"].length;
    expect(couches).toBe(appels);
  });

  // `react-native-audio-api` est la seule implémentation Web Audio en React
  // Native, et elle est explicitement hors Expo Go. L'interdit du §3.6 vaut
  // mieux écrit dans un test que dans une phrase.
  it("aucune dépendance interdite en Expo Go", () => {
    const pkg = readFileSync(join(ICI, "..", "..", "package.json"), "utf8");
    expect(pkg).not.toContain("react-native-audio-api");
  });
});
