// Prouver, sans téléphone, que ce qui part passe `photoValide`.
//
// Trois choses se vérifient ici, et aucune n'a besoin d'un appareil :
//   1. la copie du contrat n'a pas divergé du serveur ;
//   2. l'arithmétique du base64 — le tiers en trop — est juste ;
//   3. la chaîne d'encodage rend bien une data-URL JPEG carrée de 256 px
//      qui passe le contrôle du serveur, boucle de repli comprise.
//
// Ce que ce test NE prouve pas : que l'appareil photo s'ouvre, que le HEIC se
// décode, que la mémoire tient sur un Android d'entrée de gamme. Cela se voit
// au simulateur, pas ici.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  OCTETS_MAX,
  PHOTO_MAX,
  PHOTO_PREFIXE,
  QUALITE,
  carreCentre,
  enDataUrl,
  encoderSousPlafond,
  mesurerJpeg,
  photoValide,
} from "./contrat";

const ICI = dirname(fileURLToPath(import.meta.url));
const SERVEUR = join(
  ICI,
  "..",
  "..",
  "..",
  "five-scorer",
  "lib",
  "roster-serveur.ts",
);

/// Un vrai JPEG carré de 256 px, tel qu'en produit la chaîne.
const JPEG = readFileSync(join(ICI, "essai-256.jpg"));

describe("le contrat du serveur", () => {
  it("PHOTO_MAX et le préfixe sont ceux de roster.ts", () => {
    const source = readFileSync(SERVEUR, "utf8");

    const plafond = source.match(/const PHOTO_MAX = ([\d_]+);/);
    expect(plafond, "PHOTO_MAX introuvable dans roster.ts").not.toBeNull();
    expect(Number(plafond![1].replace(/_/g, ""))).toBe(PHOTO_MAX);

    const prefixe = source.match(/v\.startsWith\("([^"]+)"\)/);
    expect(prefixe, "startsWith introuvable dans photoValide").not.toBeNull();
    expect(prefixe![1]).toBe(PHOTO_PREFIXE);

    // Le test échoue si le serveur ajoute une condition qu'on ne connaît pas.
    const corps = source.match(/function photoValide\(v: string\): boolean \{\n(.*)\n\}/);
    expect(corps![1].trim()).toBe(
      "return v.startsWith(\"data:image/jpeg;base64,\") && v.length <= PHOTO_MAX;",
    );
  });
});

describe("le tiers en trop du base64", () => {
  it("OCTETS_MAX est le dernier poids qui tient sous le plafond", () => {
    const juste = enDataUrl(Buffer.alloc(OCTETS_MAX).toString("base64"));
    expect(juste.length).toBeLessThanOrEqual(PHOTO_MAX);
    expect(photoValide(juste)).toBe(true);

    const unDeTrop = enDataUrl(Buffer.alloc(OCTETS_MAX + 1).toString("base64"));
    expect(unDeTrop.length).toBeGreaterThan(PHOTO_MAX);
    expect(photoValide(unDeTrop)).toBe(false);
  });

  it("149 982 octets, pas 200 000", () => {
    expect(OCTETS_MAX).toBe(149_982);
  });
});

describe("le carré centré", () => {
  it("prend le milieu d'un paysage", () => {
    expect(carreCentre(4032, 3024)).toEqual({
      originX: 504,
      originY: 0,
      width: 3024,
      height: 3024,
    });
  });

  it("prend le milieu d'un portrait", () => {
    expect(carreCentre(3024, 4032)).toEqual({
      originX: 0,
      originY: 504,
      width: 3024,
      height: 3024,
    });
  });

  it("ne bouge pas un carré", () => {
    expect(carreCentre(256, 256)).toEqual({
      originX: 0,
      originY: 0,
      width: 256,
      height: 256,
    });
  });
});

describe("ce qui part", () => {
  it("est une data-URL JPEG carrée de 256 px, acceptée par le serveur", async () => {
    // L'encodeur natif est remplacé par le fichier d'essai : on teste
    // l'assemblage et le contrôle, pas la bibliothèque d'Expo.
    const url = await encoderSousPlafond(async (q) => {
      expect(q).toBe(QUALITE); // le premier essai suffit
      return JPEG.toString("base64");
    });

    expect(photoValide(url)).toBe(true);

    const octets = Buffer.from(url.slice(PHOTO_PREFIXE.length), "base64");
    expect(octets.equals(JPEG)).toBe(true); // aller-retour sans perte
    expect(mesurerJpeg(octets)).toEqual({ largeur: 256, hauteur: 256 });

    // L'ordre de grandeur annoncé : une dizaine de kilo-octets.
    expect(octets.length).toBeLessThan(60_000);
  });

  it("baisse la qualité plutôt que d'envoyer une photo refusée", async () => {
    const essais: number[] = [];
    const url = await encoderSousPlafond(async (q) => {
      essais.push(q);
      // Trop lourd aux deux premières qualités, acceptable à la troisième.
      const poids = q > 0.5 ? OCTETS_MAX + 1 : OCTETS_MAX;
      return Buffer.alloc(poids).toString("base64");
    });

    expect(essais).toEqual([0.82, 0.6, 0.45]);
    expect(photoValide(url)).toBe(true);
  });

  it("refuse tout haut si même la dernière qualité dépasse", async () => {
    await expect(
      encoderSousPlafond(async () =>
        Buffer.alloc(OCTETS_MAX + 1).toString("base64"),
      ),
    ).rejects.toThrow(/trop lourde/);
  });

  it("rejette ce qui n'est pas un JPEG", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(mesurerJpeg(png)).toBeNull();
    // Le serveur, lui, ne regarde que le préfixe : d'où le contrôle ici.
    expect(photoValide("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
  });
});

describe("le découpage ne peut pas être sauté par inadvertance", () => {
  // `preparer` prenait `largeur = 0, hauteur = 0` par défaut. Un appel qui les
  // omettait sautait le découpage en silence et passait droit au
  // `resize({width, height})` — le visage aplati que ce découpage existe
  // justement pour éviter. Un paramètre qu'on peut oublier n'est pas un
  // garde-fou.
  //
  // On relit le fichier plutôt que de l'importer : `choisir.ts` tire trois
  // modules Expo qui n'existent pas hors du téléphone, et ce test-ci tient à
  // rester pur.
  it("exige les deux dimensions", () => {
    const src = readFileSync(join(ICI, "choisir.ts"), "utf8");
    expect(src).not.toMatch(/largeur\s*=\s*0/);
    expect(src).not.toMatch(/hauteur\s*=\s*0/);
    expect(src).toContain("Dimensions de l'image inconnues.");
  });
});
