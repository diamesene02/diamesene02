import { describe, expect, it } from "vitest";
import { ErreurServeur, SessionExpiree } from "./appel";
import {
  detailTechnique,
  messageErreur,
  natureErreur,
  phraseHumaine,
  vautLaPeineDeReessayer,
} from "./erreurs";

// Les messages sont ceux que fabriquent réellement `joindre` et
// `appelAuthentifie` (lib/appel.ts), et les mots que nos routes rendent dans
// `{ error }`. Le test qui compte : AUCUNE adresse ne doit arriver à l'écran.

const RESEAU_IOS = new Error(
  "Impossible de joindre https://five-scorer.vercel.app/api/clubs/cm1/accueil — Network request failed",
);

describe("natureErreur", () => {
  it("reconnaît le réseau absent, enveloppé par joindre ou brut", () => {
    expect(natureErreur(RESEAU_IOS)).toBe("hors-ligne");
    expect(natureErreur(new TypeError("Network request failed"))).toBe("hors-ligne");
    expect(
      natureErreur(new Error("The Internet connection appears to be offline.")),
    ).toBe("hors-ligne");
  });

  it("distingue le délai dépassé", () => {
    const abandon = new Error("Aborted");
    abandon.name = "AbortError";
    expect(natureErreur(abandon)).toBe("delai");
    expect(
      natureErreur(new Error("Impossible de joindre http://x/api — The request timed out.")),
    ).toBe("delai");
    expect(natureErreur(new ErreurServeur(504))).toBe("delai");
  });

  it("lit le code HTTP porté par ErreurServeur", () => {
    expect(natureErreur(new SessionExpiree())).toBe("session");
    expect(natureErreur(new ErreurServeur(401))).toBe("session");
    expect(natureErreur(new ErreurServeur(403, "forbidden"))).toBe("droits");
    expect(natureErreur(new ErreurServeur(404, "introuvable"))).toBe("introuvable");
    expect(natureErreur(new ErreurServeur(409))).toBe("conflit");
    expect(natureErreur(new ErreurServeur(400, "Nom trop court."))).toBe("refus");
    expect(natureErreur(new ErreurServeur(503))).toBe("serveur");
  });

  it("retrouve le code dans un message déjà rangé en chaîne", () => {
    expect(natureErreur("Le serveur a répondu 500.")).toBe("serveur");
    expect(natureErreur("Session expirée")).toBe("session");
  });
});

describe("messageErreur", () => {
  it("n'affiche jamais d'adresse", () => {
    const m = messageErreur(RESEAU_IOS);
    expect(m).not.toMatch(/https?:|\/api\//);
    expect(m).toBe("Pas de connexion au serveur. Vérifie le réseau, puis réessaie.");
  });

  it("garde la phrase du serveur quand il en donne une", () => {
    expect(messageErreur(new ErreurServeur(403, "Réservé aux admins."))).toBe(
      "Réservé aux admins.",
    );
    expect(messageErreur(new ErreurServeur(400, "Nom trop court."))).toBe("Nom trop court.");
  });

  it("met en forme le verdict de appel.ts sur un club perdu", () => {
    const e = new ErreurServeur(
      404,
      "tu n'es plus membre de ce club — se reconnecter n'y changera rien. Tu es membre de : Five.",
    );
    expect(messageErreur(e)).toMatch(/^Tu n'es plus membre de ce club/);
  });

  it("remplace un mot-code par une phrase", () => {
    expect(messageErreur(new ErreurServeur(403, "forbidden"))).toBe(
      "Tu n'as pas les droits pour faire ça. Demande à un admin du club.",
    );
    expect(messageErreur(new ErreurServeur(404, "introuvable"))).toMatch(/^C'est introuvable/);
    expect(messageErreur(new ErreurServeur(400, "Payload invalide"))).toMatch(/^Le serveur a refusé/);
  });

  it("ne relaie pas le détail d'une panne serveur", () => {
    expect(messageErreur(new ErreurServeur(500, "PrismaClientKnownRequestError P2002"))).toBe(
      "Le serveur ne répond pas pour l'instant. Réessaie dans un moment.",
    );
  });

  it("laisse passer une phrase française déjà humaine", () => {
    const e = new Error("Aucun club public à « lundi ». Vérifie le réglage « Page publique » du club.");
    expect(messageErreur(e)).toBe(e.message);
  });

  it("masque une erreur technique inconnue", () => {
    expect(messageErreur(new Error("Unexpected token < in JSON at position 0"))).toBe(
      "Quelque chose n'a pas marché. Réessaie.",
    );
    expect(messageErreur(new Error("undefined is not a function"))).toBe(
      "Quelque chose n'a pas marché. Réessaie.",
    );
    expect(messageErreur(null)).toBe("Quelque chose n'a pas marché. Réessaie.");
  });

  it("parle des 429 et 413 à part", () => {
    expect(messageErreur(new ErreurServeur(429))).toMatch(/^Trop d'essais/);
    expect(messageErreur(new ErreurServeur(413))).toMatch(/trop lourd/);
  });
});

describe("detailTechnique", () => {
  it("rend l'original quand il diffère de la phrase", () => {
    expect(detailTechnique(RESEAU_IOS)).toBe(RESEAU_IOS.message);
  });

  it("rend null quand la phrase est déjà l'original", () => {
    expect(detailTechnique(new Error("Aucun joueur sélectionné."))).toBeNull();
    expect(detailTechnique(undefined)).toBeNull();
  });
});

describe("phraseHumaine", () => {
  it("ajoute la majuscule et le point", () => {
    expect(phraseHumaine("ce club n'est plus accessible")).toBe("Ce club n'est plus accessible.");
  });

  it("refuse les mots seuls et les adresses", () => {
    expect(phraseHumaine("introuvable")).toBeNull();
    expect(phraseHumaine("voir https://x.y/z")).toBeNull();
    expect(phraseHumaine("")).toBeNull();
  });
});

describe("vautLaPeineDeReessayer", () => {
  it("oui pour le réseau et le serveur, non pour les droits et la session", () => {
    expect(vautLaPeineDeReessayer(RESEAU_IOS)).toBe(true);
    expect(vautLaPeineDeReessayer(new ErreurServeur(502))).toBe(true);
    expect(vautLaPeineDeReessayer(new ErreurServeur(403))).toBe(false);
    expect(vautLaPeineDeReessayer(new SessionExpiree())).toBe(false);
  });
});
