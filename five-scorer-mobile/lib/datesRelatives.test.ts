// Le fuseau du club, posé AVANT toute date : les tests doivent traverser un
// vrai changement d'heure, et celui de la machine qui les lance peut être
// l'UTC d'un serveur d'intégration.
process.env.TZ = "Europe/Paris";

import { describe, expect, it } from "vitest";
import { compteARebours, jourRelatif, joursEntre, majuscule, nomDuJour } from "./datesRelatives";

// Samedi 19 septembre 2026, 17 h 22 — l'heure de la capture où l'accueil
// affichait « Dans 3 jours » pour le lundi suivant.
const SAMEDI = new Date(2026, 8, 19, 17, 22);
const LUNDI_19H = new Date(2026, 8, 21, 19, 0);

describe("joursEntre", () => {
  it("compte les jours civils, pas les tranches de 24 heures", () => {
    expect(joursEntre(LUNDI_19H, SAMEDI)).toBe(2);
    expect(joursEntre(new Date(2026, 8, 21, 19), new Date(2026, 8, 21, 10))).toBe(0);
    expect(joursEntre(new Date(2026, 8, 22, 0, 5), new Date(2026, 8, 21, 23, 55))).toBe(1);
  });

  it("reste juste à travers un changement d'heure", () => {
    // Nuit du 28 au 29 mars 2027 : le dimanche ne dure que 23 heures.
    expect(joursEntre(new Date(2027, 2, 29, 0, 30), new Date(2027, 2, 27, 23, 30))).toBe(2);
    // Nuit du 24 au 25 octobre 2026 : le dimanche dure 25 heures.
    expect(joursEntre(new Date(2026, 9, 26, 0, 10), new Date(2026, 9, 24, 23, 50))).toBe(2);
  });

  it("accepte une chaîne ISO comme l'API les rend", () => {
    expect(joursEntre(LUNDI_19H.toISOString(), SAMEDI)).toBe(2);
  });

  it("compte vers le passé en négatif", () => {
    expect(joursEntre(new Date(2026, 8, 14, 21), SAMEDI)).toBe(-5);
  });
});

describe("jourRelatif", () => {
  it("dit aujourd'hui, demain, hier", () => {
    expect(jourRelatif(new Date(2026, 8, 19, 21), { maintenant: SAMEDI })).toBe("aujourd'hui");
    expect(jourRelatif(new Date(2026, 8, 20, 10), { maintenant: SAMEDI })).toBe("demain");
    expect(jourRelatif(new Date(2026, 8, 18, 10), { maintenant: SAMEDI })).toBe("hier");
  });

  it("dit ce soir pour un rendez-vous du jour après 17 h, si on le demande", () => {
    expect(jourRelatif(new Date(2026, 8, 19, 19), { maintenant: SAMEDI, ceSoir: true })).toBe(
      "ce soir",
    );
    expect(jourRelatif(new Date(2026, 8, 19, 12), { maintenant: SAMEDI, ceSoir: true })).toBe(
      "aujourd'hui",
    );
  });

  it("nomme le jour dans la semaine qui vient", () => {
    expect(jourRelatif(LUNDI_19H, { maintenant: SAMEDI })).toBe("lundi");
    expect(jourRelatif(new Date(2026, 8, 25), { maintenant: SAMEDI })).toBe("vendredi");
  });

  it("compte au-delà de six jours", () => {
    expect(jourRelatif(new Date(2026, 8, 26), { maintenant: SAMEDI })).toBe("dans 7 jours");
    expect(jourRelatif(new Date(2026, 8, 28), { maintenant: SAMEDI })).toBe("dans 9 jours");
  });

  it("dit « lundi dernier » puis « il y a N jours » vers le passé", () => {
    expect(jourRelatif(new Date(2026, 8, 14, 21), { maintenant: SAMEDI })).toBe("lundi dernier");
    expect(jourRelatif(new Date(2026, 8, 12), { maintenant: SAMEDI })).toBe("il y a 7 jours");
  });
});

describe("compteARebours", () => {
  it("donne le nombre de jours, sans nom de jour", () => {
    expect(compteARebours(LUNDI_19H, SAMEDI)).toBe("dans 2 jours");
    expect(compteARebours(new Date(2026, 8, 24), SAMEDI)).toBe("dans 5 jours");
    expect(compteARebours(new Date(2026, 8, 20), SAMEDI)).toBe("demain");
    expect(compteARebours(new Date(2026, 8, 19, 23), SAMEDI)).toBe("aujourd'hui");
    expect(compteARebours(new Date(2026, 8, 16), SAMEDI)).toBe("il y a 3 jours");
  });

  it("ne dit plus « dans 1 jour » le matin d'un lundi", () => {
    expect(compteARebours(new Date(2026, 8, 21, 19), new Date(2026, 8, 21, 10))).toBe(
      "aujourd'hui",
    );
  });
});

describe("nomDuJour et majuscule", () => {
  it("nomme le jour du téléphone", () => {
    expect(nomDuJour(SAMEDI)).toBe("samedi");
  });

  it("met la majuscule en début de phrase", () => {
    expect(majuscule("lundi dernier")).toBe("Lundi dernier");
    expect(majuscule("")).toBe("");
  });
});
