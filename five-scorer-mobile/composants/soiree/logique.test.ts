// Le fuseau du club, posé AVANT toute date.
process.env.TZ = "Europe/Paris";

import { describe, expect, it } from "vitest";
import {
  alertesCompo,
  avecDelai,
  caisse,
  compoModifiee,
  compteDesPresences,
  enumerer,
  euros,
  libelleAutres,
  lireMontant,
  placer,
  prochaineDateDeJeu,
  quandRelatif,
  statutSuivant,
  texteConvocation,
} from "./logique";

// Samedi 19 septembre 2026, 17 h 22.
const SAMEDI = new Date(2026, 8, 19, 17, 22);

describe("quandRelatif", () => {
  it("suit la règle du site", () => {
    expect(quandRelatif(new Date(2026, 8, 19, 19), SAMEDI)).toBe("Ce soir");
    expect(quandRelatif(new Date(2026, 8, 19, 12), SAMEDI)).toBe("Aujourd'hui");
    expect(quandRelatif(new Date(2026, 8, 20, 19), SAMEDI)).toBe("Demain");
    expect(quandRelatif(new Date(2026, 8, 21, 19), SAMEDI)).toBe("Dans 2 jours");
    expect(quandRelatif(new Date(2026, 8, 25, 19), SAMEDI)).toBe("Dans 6 jours");
    expect(quandRelatif(new Date(2026, 8, 18, 19), SAMEDI)).toBe("Hier");
  });

  it("se tait quand la date dit mieux", () => {
    expect(quandRelatif(new Date(2026, 8, 26, 19), SAMEDI)).toBeNull();
    expect(quandRelatif(new Date(2026, 8, 14, 19), SAMEDI)).toBeNull();
  });

  it("lit une chaîne ISO", () => {
    expect(quandRelatif(new Date(2026, 8, 21, 19).toISOString(), SAMEDI)).toBe("Dans 2 jours");
  });
});

describe("prochaineDateDeJeu", () => {
  const lundi19h = new Date(2026, 8, 14, 19, 0);

  it("reprend le jour et l'heure de la dernière soirée", () => {
    const d = prochaineDateDeJeu({ modele: lundi19h, prises: [], maintenant: SAMEDI });
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(21);
    expect(d.getHours()).toBe(19);
  });

  it("saute les jours déjà pris", () => {
    const d = prochaineDateDeJeu({ modele: lundi19h, prises: ["2026-09-21"], maintenant: SAMEDI });
    expect(d.getDate()).toBe(28);
  });

  it("le jour même, passé l'heure, propose la semaine suivante", () => {
    const lundiSoir = new Date(2026, 8, 21, 22, 0);
    const d = prochaineDateDeJeu({ modele: lundi19h, prises: [], maintenant: lundiSoir });
    expect(d.getDate()).toBe(28);
  });

  it("sans modèle, demain 19 h", () => {
    const d = prochaineDateDeJeu({ modele: null, prises: [], maintenant: SAMEDI });
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([20, 19, 0]);
  });
});

describe("l'argent", () => {
  it("écrit les euros comme la route", () => {
    expect(euros(4800)).toBe("48 €");
    expect(euros(533)).toBe("5,33 €");
    expect(euros(0)).toBe("0 €");
  });

  it("lit ce qu'on tape", () => {
    expect(lireMontant("48")).toBe(4800);
    expect(lireMontant("5,5")).toBe(550);
    expect(lireMontant(" 48 € ")).toBe(4800);
    expect(lireMontant("")).toBeNull();
    expect(lireMontant("abc")).toBe("invalide");
    expect(lireMontant("-3")).toBe("invalide");
    expect(lireMontant("1.234")).toBe("invalide");
  });

  it("recalcule la caisse", () => {
    const payeurs = [{ aPaye: true }, { aPaye: false }, { aPaye: true }];
    expect(caisse(4800, payeurs)).toEqual({ part: 1600, encaisse: 3200, pourcentage: 67 });
    // La part arrondie au centime supérieur ne fait pas dépasser le prix.
    expect(caisse(1000, [{ aPaye: true }, { aPaye: true }, { aPaye: true }])).toEqual({
      part: 334,
      encaisse: 1000,
      pourcentage: 100,
    });
    expect(caisse(null, payeurs)).toEqual({ part: null, encaisse: 0, pourcentage: 0 });
    expect(caisse(4800, [])).toEqual({ part: null, encaisse: 0, pourcentage: 0 });
  });
});

describe("les présences", () => {
  it("fait tourner le statut à partir du statut retenu", () => {
    expect(statutSuivant(null)).toBe("IN");
    expect(statutSuivant("IN")).toBe("MAYBE");
    expect(statutSuivant("MAYBE")).toBe("OUT");
    expect(statutSuivant("OUT")).toBe("IN");
  });

  it("compte comme le site", () => {
    const lignes = [
      { statut: "IN" as const, enAttente: false },
      { statut: "IN" as const, enAttente: false },
      { statut: "IN" as const, enAttente: true },
      { statut: "MAYBE" as const, enAttente: false },
      { statut: null, enAttente: false },
    ];
    expect(compteDesPresences(lignes)).toBe("2 présents · 1 en attente · 1 peut-être · 0 absent");
    expect(compteDesPresences([{ statut: "OUT", enAttente: false }])).toBe("0 présent · 1 absent");
  });

  it("dit ce qu'il y a sous « et N autres »", () => {
    const present = { statut: "IN" as const, enAttente: false };
    const muet = { statut: null, enAttente: false };
    expect(libelleAutres([present, present])).toBe("et 2 autres présents");
    expect(libelleAutres([present])).toBe("et 1 autre présent");
    expect(libelleAutres([muet, muet, muet])).toBe("et 3 sans réponse");
    expect(libelleAutres([present, muet])).toBe("et 2 autres");
  });
});

describe("la composition", () => {
  it("place comme le site : le gardien devant sa cage, puis des rangées", () => {
    expect(placer(0, false)).toEqual([]);
    expect(placer(1, true)).toEqual([{ x: 50, y: 10 }]);
    const cinq = placer(5, true);
    expect(cinq[0]).toEqual({ x: 50, y: 10 });
    expect(cinq.slice(1).map((p) => p.y)).toEqual([24, 24, 40, 40]);
    expect(cinq.slice(1).map((p) => p.x)).toEqual([30, 70, 30, 70]);
    // Six joueurs de champ : deux rangées de trois.
    expect(placer(7, true).slice(1).map((p) => p.x)).toEqual([20, 50, 80, 20, 50, 80]);
  });

  it("énumère à la française", () => {
    expect(enumerer([])).toBe("");
    expect(enumerer(["Farid"])).toBe("Farid");
    expect(enumerer(["Farid", "Lucas", "Diame"])).toBe("Farid, Lucas et Diame");
  });

  it("prévient sans bloquer", () => {
    const j = (nom: string, gardien = false, presence: "IN" | "OUT" | null = "IN") => ({
      nom,
      gardien,
      presence,
    });
    expect(alertesCompo({ equipeA: [], equipeB: [], nomA: "Blanc", nomB: "Noir" })).toEqual([]);
    expect(
      alertesCompo({
        equipeA: [j("A", true), j("B")],
        equipeB: [j("C", false, "OUT")],
        nomA: "Blanc",
        nomB: "Noir",
      }),
    ).toEqual([
      "Effectif déséquilibré : 2 contre 1.",
      "Pas de gardien chez Noir.",
      "C a dit absent.",
    ]);
    expect(
      alertesCompo({ equipeA: [j("A")], equipeB: [], nomA: "Blanc", nomB: "Noir" }),
    ).toContain("Une équipe est vide.");
  });

  it("voit ce qui a changé par rapport au serveur", () => {
    const serveur = {
      nomA: "Blanc",
      nomB: "Noir",
      joueurs: [
        { playerId: "a", camp: "A" as const, gardienSoiree: true },
        { playerId: "b", camp: "B" as const, gardienSoiree: false },
        { playerId: "c", camp: null, gardienSoiree: false },
      ],
    };
    const ecran = {
      nomA: "Blanc",
      nomB: "Noir",
      camps: { a: "A" as const, b: "B" as const },
      gardiens: { a: true, c: true },
    };
    expect(compoModifiee(ecran, serveur)).toBe(false);
    expect(compoModifiee({ ...ecran, camps: { a: "B", b: "B" } }, serveur)).toBe(true);
    expect(compoModifiee({ ...ecran, gardiens: { a: false } }, serveur)).toBe(true);
    expect(compoModifiee({ ...ecran, nomB: "Les Noirs" }, serveur)).toBe(true);
    expect(compoModifiee({ ...ecran, nomB: "Noir " }, serveur)).toBe(false);
  });
});

describe("le partage", () => {
  it("écrit la convocation du site", () => {
    expect(
      texteConvocation({
        entete: "Lundi 21 septembre · 19:00 · Five Renault",
        etat: "8 présents · 4 places",
        equipes: [
          { nom: "Blanc", joueurs: ["Gaël", "Bakary"] },
          { nom: "Noir", joueurs: [] },
        ],
        lien: "https://five-scorer.vercel.app/c/essai-five/sessions/x",
      }),
    ).toBe(
      [
        "Lundi 21 septembre · 19:00 · Five Renault",
        "8 présents · 4 places",
        "",
        "Blanc (2) : Gaël, Bakary",
        "",
        "Réponds ici : https://five-scorer.vercel.app/c/essai-five/sessions/x",
      ].join("\n"),
    );
  });

  it("reste une convocation tant que la compo n'est pas faite", () => {
    expect(texteConvocation({ entete: "Lundi", etat: null, equipes: [], lien: "L" })).toBe(
      "Lundi\n\nRéponds ici : L",
    );
  });
});

describe("avecDelai", () => {
  it("rend la valeur quand elle arrive à temps", async () => {
    await expect(avecDelai(Promise.resolve(3), 50)).resolves.toBe(3);
  });

  it("abandonne au-delà du délai", async () => {
    await expect(avecDelai(new Promise(() => {}), 10)).rejects.toThrow("timeout");
  });
});
