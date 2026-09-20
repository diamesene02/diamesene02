// La convocation qu'on colle sur le groupe : ce qu'elle dit, et ce qu'elle
// tait.

import { describe, it, expect } from "vitest";
import { texteConvocation } from "./convocation";

const entete = "Lundi 21 septembre · 19:00 · Five Renault";
const lien = "https://five.example/c/lundi/sessions/abc";

describe("texteConvocation", () => {
  it("annonce les équipes quand la compo est faite", () => {
    const texte = texteConvocation({
      entete,
      etat: "10 présents · 2 places",
      equipes: [
        { nom: "Blanc", joueurs: ["Gaël", "Bakary", "Cédric"] },
        { nom: "Noir", joueurs: ["Karim", "Hugo"] },
      ],
      lien,
    });
    expect(texte).toBe(
      [
        entete,
        "10 présents · 2 places",
        "",
        "Blanc (3) : Gaël, Bakary, Cédric",
        "Noir (2) : Karim, Hugo",
        "",
        `Réponds ici : ${lien}`,
      ].join("\n"),
    );
  });

  it("reste une convocation tant que la compo n'est pas faite", () => {
    const texte = texteConvocation({
      entete,
      etat: "6 présents · il en manque 2",
      equipes: [
        { nom: "Blanc", joueurs: [] },
        { nom: "Noir", joueurs: [] },
      ],
      lien,
    });
    expect(texte).toBe(
      [entete, "6 présents · il en manque 2", "", `Réponds ici : ${lien}`].join("\n"),
    );
  });

  it("n'annonce pas une équipe vide d'une compo commencée", () => {
    const texte = texteConvocation({
      entete,
      etat: null,
      equipes: [
        { nom: "Blanc", joueurs: ["Gaël"] },
        { nom: "Noir", joueurs: [] },
      ],
      lien,
    });
    expect(texte).toBe(
      [entete, "", "Blanc (1) : Gaël", "", `Réponds ici : ${lien}`].join("\n"),
    );
  });
});
