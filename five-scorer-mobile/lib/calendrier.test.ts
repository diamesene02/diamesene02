import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  cle,
  genererCalendrier,
  joursFeries,
  paques,
  saisonParDefaut,
  estTreveDeNoel,
} from "./calendrier";

const ICI = dirname(fileURLToPath(import.meta.url));
const COPIE = join(ICI, "calendrier.ts");
const ORIGINAL = join(ICI, "..", "..", "five-scorer", "lib", "calendrier.ts");

/// Le générateur de calendrier est le SEUL morceau de logique métier que les
/// deux projets partagent en copie. Il le mérite : il est pur, il n'importe
/// rien, et il porte une règle du club — on joue tous les lundis de septembre
/// à juillet, sauf les fériés et la trêve de Noël.
///
/// Une copie ne se justifie que si la divergence est impossible en silence.
/// D'où ce test, jumeau de `db/schema.test.ts` : il compare les deux fichiers
/// octet pour octet. Quand il échoue, la correction est de recopier
/// `five-scorer/lib/calendrier.ts` — jamais d'éditer la copie.
describe("la copie du générateur de calendrier", () => {
  it("est octet pour octet celle du site", () => {
    expect(readFileSync(COPIE, "utf8")).toBe(readFileSync(ORIGINAL, "utf8"));
  });
});

describe("les fériés", () => {
  // Trois dates connues, pour que le calcul de Pâques ne dérive pas en
  // silence : une liste en dur serait fausse dès la saison suivante.
  it("place Pâques au bon jour", () => {
    expect(cle(paques(2026))).toBe("2026-04-05");
    expect(cle(paques(2027))).toBe("2027-03-28");
    expect(cle(paques(2028))).toBe("2028-04-16");
  });

  it("compte onze fériés par année civile", () => {
    expect(joursFeries(2026).size).toBe(11);
    expect(joursFeries(2027).size).toBe(11);
  });

  it("nomme les deux lundis qui tombent un soir de match", () => {
    const f = joursFeries(2026);
    expect(f.get("2026-04-06")).toBe("Lundi de Pâques");
    expect(f.get("2026-05-25")).toBe("Lundi de Pentecôte");
  });
});

describe("la trêve de Noël", () => {
  // La règle est étroite et se récite : du 24 décembre au 1er janvier INCLUS.
  // Le 2 janvier, on rejoue — c'est volontaire, la liste reste modifiable date
  // par date avant création.
  it("va du 24 décembre au 1er janvier inclus", () => {
    expect(estTreveDeNoel(new Date(2026, 11, 24))).toBe(true);
    expect(estTreveDeNoel(new Date(2026, 11, 31))).toBe(true);
    expect(estTreveDeNoel(new Date(2027, 0, 1))).toBe(true);
  });

  it("s'arrête au 2 janvier", () => {
    expect(estTreveDeNoel(new Date(2027, 0, 2))).toBe(false);
  });

  it("laisse jouer le 23 décembre et les lundis de novembre", () => {
    expect(estTreveDeNoel(new Date(2026, 11, 23))).toBe(false);
    expect(estTreveDeNoel(new Date(2026, 10, 16))).toBe(false);
  });
});

describe("le calendrier d'une saison", () => {
  const options = {
    debut: new Date(2026, 8, 1), // 1er septembre 2026
    fin: new Date(2027, 6, 31),
    jourSemaine: 1 as const, // lundi
    heures: 20,
    minutes: 0,
  };

  it("ne rend que des lundis, à 20 h", () => {
    const o = genererCalendrier(options);
    expect(o.length).toBeGreaterThan(40);
    for (const x of o) {
      expect(x.date.getDay()).toBe(1);
      expect(x.date.getHours()).toBe(20);
      expect(x.date.getMinutes()).toBe(0);
    }
  });

  it("part du premier lundi à partir du début, pas avant", () => {
    const o = genererCalendrier(options);
    expect(cle(o[0].date)).toBe("2026-09-07");
  });

  it("écarte les lundis fériés EN DISANT pourquoi", () => {
    const o = genererCalendrier(options);
    const paques = o.find((x) => cle(x.date) === "2027-03-29");
    // 29 mars 2027 est un lundi ordinaire ; le lundi de Pâques 2027 est le 29.
    expect(paques?.exclu).toBe("Lundi de Pâques");
  });

  it("écarte la trêve de Noël", () => {
    const o = genererCalendrier(options);
    const treve = o.filter((x) => x.exclu === "Trêve de Noël");
    expect(treve.length).toBeGreaterThan(0);
  });

  it("peut ne rien écarter si on le lui demande", () => {
    const o = genererCalendrier({
      ...options,
      sauterFeries: false,
      sauterTreveDeNoel: false,
    });
    expect(o.every((x) => x.exclu === null)).toBe(true);
  });

  it("ne rend rien quand la fin précède le début", () => {
    expect(
      genererCalendrier({ ...options, debut: new Date(2027, 0, 1), fin: new Date(2026, 0, 1) }),
    ).toEqual([]);
  });

  // Le garde-fou : sans plafond, une borne de fin saisie à 2099 produirait
  // quatre mille soirées et autant de lignes en base.
  it("ne dépasse jamais 120 occurrences", () => {
    const o = genererCalendrier({ ...options, fin: new Date(2036, 6, 31) });
    expect(o.length).toBe(120);
  });
});

describe("les bornes proposées", () => {
  it("propose la saison en cours quand on est dedans", () => {
    const s = saisonParDefaut(new Date(2026, 10, 15)); // 15 novembre 2026
    expect(s.nom).toBe("Saison 2026-2027");
    expect(cle(s.fin)).toBe("2027-07-31");
  });

  it("rattache janvier à la saison commencée en septembre", () => {
    const s = saisonParDefaut(new Date(2027, 0, 10));
    expect(s.nom).toBe("Saison 2026-2027");
  });

  it("propose la saison à venir dès le mois d'août", () => {
    const s = saisonParDefaut(new Date(2026, 7, 20)); // 20 août 2026
    expect(s.nom).toBe("Saison 2026-2027");
    expect(cle(s.debut)).toBe("2026-09-01");
  });

  // On ne propose jamais de poser des soirées dans le passé : le début est
  // aujourd'hui dès qu'on est déjà entré dans la saison.
  it("ne remonte jamais avant aujourd'hui", () => {
    const aujourdhui = new Date(2026, 10, 15);
    const s = saisonParDefaut(aujourdhui);
    expect(s.debut.getTime()).toBe(aujourdhui.getTime());
  });
});
