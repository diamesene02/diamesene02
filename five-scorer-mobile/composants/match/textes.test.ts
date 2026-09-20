import { describe, expect, it } from "vitest";
import {
  deplacerMaVoix,
  heureDuSuivant,
  majusculesAuxMots,
  nombreDeMatchs,
  phraseRetrait,
  quoiAnnuler,
  texteDuPartage,
  trierCandidats,
  verdict,
} from "./textes";

describe("quoiAnnuler", () => {
  it("dit ce que retire le bouton", () => {
    expect(quoiAnnuler("GOAL")).toBe("le but");
    expect(quoiAnnuler("OWN_GOAL")).toBe("le but");
    expect(quoiAnnuler("HALF_TIME")).toBe("la mi-temps");
    expect(quoiAnnuler("YELLOW_CARD")).toBe("le carton");
    expect(quoiAnnuler(undefined)).toBeNull();
  });
});

describe("phraseRetrait", () => {
  it("nomme le buteur et la minute", () => {
    expect(phraseRetrait({ type: "GOAL", playerName: "Bakary", minute: 12 }, "Blanc")).toBe(
      "But de Bakary (12′) retiré",
    );
  });
  it("nomme le camp quand le but n'a pas d'auteur", () => {
    expect(phraseRetrait({ type: "GOAL", playerName: null, minute: null }, "Noir")).toBe(
      "But de Noir retiré",
    );
  });
  it("écrit le csc sans auteur sans inventer de nom", () => {
    expect(phraseRetrait({ type: "OWN_GOAL", playerName: null, minute: 8 }, "Noir")).toBe(
      "Csc (8′) retiré",
    );
  });
  it("accorde la mi-temps et le carton", () => {
    expect(phraseRetrait({ type: "HALF_TIME", playerName: null, minute: 20 }, "Blanc")).toBe(
      "Mi-temps retirée",
    );
    expect(phraseRetrait({ type: "RED_CARD", playerName: "Hugo", minute: 3 }, "Blanc")).toBe(
      "Carton rouge de Hugo (3′) retiré",
    );
  });
});

describe("majusculesAuxMots", () => {
  it("met une majuscule à chaque mot, accents compris", () => {
    expect(majusculesAuxMots("mardi 15 septembre")).toBe("Mardi 15 Septembre");
    expect(majusculesAuxMots("mercredi 2 écoles")).toBe("Mercredi 2 Écoles");
  });
});

describe("nombreDeMatchs", () => {
  it("accorde", () => {
    expect(nombreDeMatchs(1)).toBe("1 match");
    expect(nombreDeMatchs(3)).toBe("3 matchs");
  });
});

describe("heureDuSuivant", () => {
  const maintenant = Date.parse("2026-09-19T20:00:00.000Z");
  it("une demi-heure après", () => {
    expect(heureDuSuivant("2026-09-14T19:00:00.000Z", maintenant)).toBe("2026-09-14T19:30:00.000Z");
  });
  it("jamais dans le futur", () => {
    expect(heureDuSuivant("2026-09-19T19:50:00.000Z", maintenant)).toBe("2026-09-19T20:00:00.000Z");
  });
});

describe("verdict", () => {
  it("dit qui l'emporte, ou le nul", () => {
    expect(verdict("Blanc", "Noir", 2, 1)).toBe("Blanc l'emporte");
    expect(verdict("Blanc", "Noir", 0, 3)).toBe("Noir l'emporte");
    expect(verdict("Blanc", "Noir", 1, 1)).toBe("Match nul");
  });
});

describe("texteDuPartage", () => {
  const base = {
    scoreA: 2,
    scoreB: 1,
    legende: "Soirée du 7 sept. · Match 2",
    camps: [
      {
        nom: "Blanc",
        buteurs: [
          { nom: "Bakary", minutes: [3] },
          { nom: "Ismaël (csc)", minutes: [8] },
        ],
      },
      { nom: "Noir", buteurs: [{ nom: "Hugo", minutes: [5] }] },
    ],
    homme: "Bakary",
  };

  it("écrit le score, les buteurs, l'homme du match et le lien", () => {
    expect(texteDuPartage(base, "https://x/r/m1")).toBe(
      [
        "Blanc 2 – 1 Noir",
        "Soirée du 7 sept. · Match 2",
        "Blanc : Bakary 3′, Ismaël (csc) 8′",
        "Noir : Hugo 5′",
        "Homme du match : Bakary",
        "https://x/r/m1",
      ].join("\n"),
    );
  });

  it("compte les buts sans minute, et saute le camp qui n'a pas marqué", () => {
    const t = texteDuPartage(
      {
        ...base,
        scoreA: 0,
        scoreB: 2,
        legende: null,
        homme: null,
        enDirect: true,
        camps: [
          { nom: "Blanc", buteurs: [] },
          { nom: "Noir", buteurs: [{ nom: "Hugo", minutes: [null, null] }] },
        ],
      },
      "L",
    );
    expect(t).toBe(["Blanc 0 – 2 Noir (en direct)", "Noir : Hugo ×2", "L"].join("\n"));
  });
});

describe("deplacerMaVoix", () => {
  const c = [
    { playerId: "a", nom: "Bakary", voix: 2 },
    { playerId: "b", nom: "Hugo", voix: 1 },
  ];
  it("déplace la voix de l'ancien au nouveau", () => {
    expect(deplacerMaVoix(c, "a", "b").map((x) => x.voix)).toEqual([1, 2]);
  });
  it("ajoute une voix au premier vote", () => {
    expect(deplacerMaVoix(c, null, "b").map((x) => x.voix)).toEqual([2, 2]);
  });
  it("ne compte pas deux fois le même vote", () => {
    expect(deplacerMaVoix(c, "a", "a").map((x) => x.voix)).toEqual([2, 1]);
  });
  it("trie par voix puis par nom", () => {
    const t = trierCandidats([
      { nom: "Hugo", voix: 1 },
      { nom: "Bakary", voix: 1 },
      { nom: "Zoé", voix: 3 },
    ]);
    expect(t.map((x) => x.nom)).toEqual(["Zoé", "Bakary", "Hugo"]);
  });
});
