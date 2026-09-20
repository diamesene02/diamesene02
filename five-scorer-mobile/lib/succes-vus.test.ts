import { beforeEach, describe, expect, it, vi } from "vitest";

// Le module natif n'existe pas sous Node : un disque en mémoire le remplace,
// avec la même surface que ce que succes-vus.ts touche (exists, text, write).
const disque = new Map<string, string>();
let disquePlein = false;

vi.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : "docs")).join("/");
    }
    get exists() {
      return disque.has(this.uri);
    }
    async text() {
      const v = disque.get(this.uri);
      if (v === undefined) throw new Error("absent");
      return v;
    }
    write(contenu: string) {
      if (disquePlein) throw new Error("disque plein");
      disque.set(this.uri, contenu);
    }
  }
  return { File, Paths: { document: {} } };
});

const { aAnnoncer, cleVu, lireVus, marquerVus, nouveauxDeblocages } = await import("./succes-vus");

type M = "bronze" | "argent" | "or" | "platine" | "legende";
const d = (badgeId: string, palier: number, matiere: M, le: string) => ({ badgeId, palier, matiere, le });

const LUNDI = "2026-09-14T20:30:00.000Z";
const LUNDI_AVANT = "2026-09-07T20:30:00.000Z";

beforeEach(() => {
  disque.clear();
  disquePlein = false;
});

describe("aAnnoncer — la règle pure", () => {
  it("ne dit rien sans état : c'est le premier passage", () => {
    expect(aAnnoncer([d("buteur", 1, "bronze", LUNDI)], null)).toEqual([]);
  });

  it("n'annonce que ce qui n'est pas déjà vu", () => {
    const etat = { depuis: "2026-09-01T00:00:00.000Z", cles: ["buteur:1"] };
    const r = aAnnoncer([d("buteur", 1, "bronze", LUNDI_AVANT), d("passeur", 1, "bronze", LUNDI)], etat);
    expect(r.map(cleVu)).toEqual(["passeur:1"]);
  });

  it("d'une même famille, garde le palier le plus haut", () => {
    const etat = { depuis: "2026-09-01T00:00:00.000Z", cles: [] };
    const r = aAnnoncer([d("buteur", 2, "argent", LUNDI), d("buteur", 3, "or", LUNDI), d("buteur", 1, "bronze", LUNDI)], etat);
    expect(r.map(cleVu)).toEqual(["buteur:3"]);
  });

  it("le plus récent d'abord, puis le plus précieux le même soir", () => {
    const etat = { depuis: "2026-09-01T00:00:00.000Z", cles: [] };
    const r = aAnnoncer(
      [d("passeur", 1, "bronze", LUNDI), d("serie", 1, "bronze", LUNDI_AVANT), d("centurion", 4, "platine", LUNDI)],
      etat,
    );
    expect(r.map(cleVu)).toEqual(["centurion:4", "passeur:1", "serie:1"]);
  });

  it("n'exhume pas ce qui précède le premier passage de plus d'une semaine", () => {
    // Premier passage le 20 : un palier daté du 14 (feuille restée ouverte)
    // s'annonce, un palier du mois d'août (famille ajoutée depuis) non.
    const etat = { depuis: "2026-09-20T10:00:00.000Z", cles: [] };
    const r = aAnnoncer([d("electeur", 1, "bronze", "2026-08-10T20:00:00.000Z"), d("triple", 1, "bronze", LUNDI)], etat);
    expect(r.map(cleVu)).toEqual(["triple:1"]);
  });

  it("n'annonce jamais une perte : une clé vue et absente ne produit rien", () => {
    const etat = { depuis: "2026-09-01T00:00:00.000Z", cles: ["triple:1", "buteur:2"] };
    expect(aAnnoncer([d("buteur", 1, "bronze", LUNDI_AVANT)], etat)).toEqual([]);
  });
});

describe("le fichier", () => {
  it("premier passage : marque tout en silence, puis n'annonce que le neuf", async () => {
    const acquis = [d("buteur", 1, "bronze", LUNDI_AVANT), d("premiers-pas", 1, "or", LUNDI_AVANT)];
    expect(await nouveauxDeblocages("club1", "joueur1", acquis)).toEqual([]);
    expect((await lireVus("club1", "joueur1"))?.cles.sort()).toEqual(["buteur:1", "premiers-pas:1"]);

    const neuf = d("buteur", 2, "argent", new Date().toISOString());
    const r = await nouveauxDeblocages("club1", "joueur1", [neuf, ...acquis]);
    expect(r.map(cleVu)).toEqual(["buteur:2"]);

    // Tant qu'on ne l'a pas marqué, il reste à annoncer…
    expect((await nouveauxDeblocages("club1", "joueur1", [neuf, ...acquis])).length).toBe(1);
    // …et une fois marqué, plus jamais.
    await marquerVus("club1", "joueur1", [neuf, ...acquis].map(cleVu));
    expect(await nouveauxDeblocages("club1", "joueur1", [neuf, ...acquis])).toEqual([]);
  });

  it("marquer ajoute sans retirer ni déplacer le premier passage", async () => {
    await marquerVus("c", "j", ["a:1"]);
    const avant = await lireVus("c", "j");
    await marquerVus("c", "j", ["b:1"]);
    const apres = await lireVus("c", "j");
    expect(apres?.cles.sort()).toEqual(["a:1", "b:1"]);
    expect(apres?.depuis).toBe(avant?.depuis);
  });

  it("un joueur et un club ne voient pas l'état des autres", async () => {
    await marquerVus("c", "j1", ["buteur:1"]);
    expect(await lireVus("c", "j2")).toBeNull();
    expect(await lireVus("autre", "j1")).toBeNull();
  });

  it("un fichier abîmé vaut un premier passage, sans lever", async () => {
    await marquerVus("c", "j", ["x:1"]);
    for (const k of disque.keys()) disque.set(k, "{pas du json");
    expect(await lireVus("c", "j")).toBeNull();
    expect(await nouveauxDeblocages("c", "j", [d("buteur", 1, "bronze", new Date().toISOString())])).toEqual([]);
  });

  it("un disque qui refuse d'écrire ne fait rien lever et n'annonce rien", async () => {
    disquePlein = true;
    await expect(marquerVus("c", "j", ["a:1"])).resolves.toBeUndefined();
    expect(await nouveauxDeblocages("c", "j", [d("buteur", 1, "bronze", new Date().toISOString())])).toEqual([]);
  });

  it("un identifiant exotique ne sort pas du nom de fichier", async () => {
    await marquerVus("../club", "a/b", ["x:1"]);
    expect([...disque.keys()].every((k) => !k.includes("../") && !k.includes("a/b"))).toBe(true);
  });
});
