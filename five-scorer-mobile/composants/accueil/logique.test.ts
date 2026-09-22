// Le fuseau AVANT toute date : ces règles comptent des jours civils, et la
// machine qui lance les tests peut être à l'UTC.
process.env.TZ = "Europe/Paris";

import { describe, expect, it } from "vitest";
import type { Accueil, MatchAccueil } from "../../lib/api";
import type { Badge, Serie } from "../../lib/succes";
import {
  aideBanniere,
  evolutionPhrase,
  evolutionTexte,
  grouperFil,
  lancementPossible,
  lesNoms,
  ligneProgramme,
  ligneReponses,
  ligneSoireeDuJour,
  maPlace,
  ongletAffiche,
  poursuite,
  prochainPalier,
  quandRelatifDe,
  rangTexte,
  rappelCompo,
  seriePhare,
  titreBanniere,
  vueMatchs,
} from "./logique";

// Samedi 19 septembre 2026, 17 h 22 : l'heure de la capture où l'accueil
// annonçait « Dans 3 jours » pour le lundi suivant, et ouvrait un onglet
// « Ce soir » vide.
const SAMEDI = new Date(2026, 8, 19, 17, 22);
const iso = (...a: [number, number, number, number?, number?]) => new Date(...a).toISOString();

const LUNDI = iso(2026, 8, 21, 19, 0);

type Soiree = NonNullable<Accueil["soiree"]>;

function soiree(p: Partial<Soiree> = {}): Soiree {
  return {
    id: "s1",
    date: LUNDI,
    libelle: null,
    annulee: false,
    phrase: "8 présents · 4 places",
    presents: 8,
    attente: 0,
    compoFaite: false,
    maReponse: null,
    ...p,
  };
}

function match(p: Partial<MatchAccueil> = {}): MatchAccueil {
  return {
    id: "m1",
    joueLe: iso(2026, 8, 21, 20, 0),
    statut: "FINISHED",
    nomA: "Blanc",
    nomB: "Noir",
    scoreA: 3,
    scoreB: 2,
    dureeMin: 12,
    ...p,
  };
}

function accueil(p: Partial<Accueil> = {}): Accueil {
  return { saison: null, soiree: null, matchs: [], classement: [], ...p };
}

/// La soirée à venir telle que la route la détaille (`aVenir.soiree`). Le
/// samedi, c'est la MÊME soirée que celle de la bannière.
function aVenir(p: Partial<NonNullable<NonNullable<Accueil["aVenir"]>["soiree"]>> = {}) {
  return {
    soiree: {
      id: "s1",
      date: LUNDI,
      libelle: null,
      lieu: null,
      nomA: "Blanc",
      nomB: "Noir",
      compoA: 0,
      compoB: 0,
      reponses: 3,
      ...p,
    },
    matchs: [],
  };
}

describe("les dates de la bannière", () => {
  it("compte en jours civils : samedi pour lundi, c'est dans 2 jours", () => {
    // `Math.ceil` sur 2,07 jours disait « Dans 3 jours ».
    expect(aideBanniere(soiree(), SAMEDI)).toContain("Dans 2 jours");
    expect(titreBanniere(soiree(), SAMEDI)).toBe("Lundi 19:00");
  });

  it("dit « Ce soir » à partir de 17 h, « Aujourd'hui » avant", () => {
    const ceSoir = soiree({ date: iso(2026, 8, 19, 19, 0) });
    expect(titreBanniere(ceSoir, SAMEDI)).toBe("Ce soir 19:00");
    const midi = soiree({ date: iso(2026, 8, 19, 12, 30) });
    expect(titreBanniere(midi, new Date(2026, 8, 19, 10))).toBe("Aujourd'hui 12:30");
  });

  it("dit « Demain », puis le jour, puis la date au-delà d'une semaine", () => {
    expect(titreBanniere(soiree({ date: iso(2026, 8, 20, 19) }), SAMEDI)).toBe("Demain 19:00");
    expect(titreBanniere(soiree({ date: iso(2026, 8, 28, 19) }), SAMEDI)).toBe(
      "Lun. 28 sept. 19:00",
    );
  });

  // Le lieu a sa ligne à lui dans la bannière (`Banniere.tsx`) : le titre ne
  // porte plus que le quand, et ne finit plus par un point — sur « Urban
  // Soccer Guyancourt », la phrase passait sur deux lignes sous le ✕.
  it("ne met plus le lieu dans le titre : il a sa ligne", () => {
    expect(titreBanniere(soiree({ lieu: "Urban Soccer Guyancourt" }), SAMEDI)).toBe("Lundi 19:00");
  });

  it("suit le jour compté par le serveur, dans le fuseau du club", () => {
    const s = soiree({ joursAvant: 1, heure: "21:00", jourLong: "Dimanche 20 septembre" });
    expect(titreBanniere(s, SAMEDI)).toBe("Demain 21:00");
  });

  it("n'écrit « Dans N jours » qu'entre deux et six", () => {
    expect(aideBanniere(soiree({ date: iso(2026, 8, 20, 19) }), SAMEDI)).not.toContain("Dans");
    expect(aideBanniere(soiree({ date: iso(2026, 8, 28, 19) }), SAMEDI)).not.toContain("Dans");
  });
});

describe("maPlace", () => {
  it("ne promet pas de répondre à qui n'a pas de profil joueur", () => {
    expect(maPlace(soiree({ maPresence: null }))).toBe("Touche pour la soirée");
  });

  it("dit à l'abonné qu'il est déjà compté", () => {
    // « Touche pour répondre » sous « 8 présents » lui faisait croire qu'il
    // n'en faisait pas partie.
    const s = soiree({ maPresence: { statut: "IN", viaAbonnement: true } });
    expect(maPlace(s)).toBe("Tu es compté présent");
    expect(aideBanniere(s, SAMEDI)).toBe("Dans 2 jours · 8 présents · 4 places · Tu es compté présent");
  });

  it("distingue inscrit, absent, peut-être", () => {
    expect(maPlace(soiree({ maPresence: { statut: "IN", viaAbonnement: false } }))).toBe(
      "Tu es inscrit",
    );
    expect(maPlace(soiree({ maPresence: { statut: "OUT", viaAbonnement: false } }))).toBe(
      "Tu as dit absent",
    );
    expect(maPlace(soiree({ maPresence: { statut: "MAYBE", viaAbonnement: false } }))).toBe(
      "Tu as dit peut-être",
    );
  });

  it("retombe sur la réponse explicite avec un serveur qui ignore l'abonnement", () => {
    expect(maPlace(soiree({ maReponse: "IN" }))).toBe("Tu es inscrit");
    expect(maPlace(soiree({ maReponse: null }))).toBe("Touche pour répondre");
  });
});

describe("rappelCompo", () => {
  it("se tait au-delà de cinq jours : le club fait sa compo trois jours avant", () => {
    expect(rappelCompo(soiree({ date: iso(2026, 8, 28, 19) }), true, SAMEDI)).toBeNull();
    expect(rappelCompo(soiree({ date: iso(2026, 8, 24, 19) }), true, SAMEDI)).not.toBeNull();
  });

  it("dit le compte à rebours et où préparer", () => {
    const r = rappelCompo(soiree({ lieu: "Five Renault" }), true, SAMEDI);
    expect(r?.titre).toBe("Dans 2 jours — les équipes ne sont pas faites");
    expect(r?.aide).toBe("Lundi 21 septembre · Five Renault — préparer la compo maintenant");
  });

  it("dit « C'est aujourd'hui » le jour même et « Demain » la veille", () => {
    expect(rappelCompo(soiree({ date: iso(2026, 8, 19, 19) }), true, SAMEDI)?.titre).toBe(
      "C'est aujourd'hui — les équipes ne sont pas faites",
    );
    expect(rappelCompo(soiree({ date: iso(2026, 8, 20, 19) }), true, SAMEDI)?.titre).toBe(
      "Demain — les équipes ne sont pas faites",
    );
  });

  it("se tait si la compo est faite, la soirée annulée, ou qu'on ne peut pas scorer", () => {
    expect(rappelCompo(soiree({ compoFaite: true }), true, SAMEDI)).toBeNull();
    expect(rappelCompo(soiree({ annulee: true }), true, SAMEDI)).toBeNull();
    expect(rappelCompo(soiree(), false, SAMEDI)).toBeNull();
    expect(rappelCompo(null, true, SAMEDI)).toBeNull();
  });
});

describe("vueMatchs : quels onglets existent", () => {
  it("n'ouvre pas « Ce soir » un samedi où il ne se passe rien", () => {
    const v = vueMatchs(accueil({ soiree: soiree(), aVenir: aVenir() }), SAMEDI);
    expect(v.onglets.map((o) => o.valeur)).toEqual(["venir"]);
    expect(v.initial).toBe("venir");
    expect(v.soireeCeSoir).toBeNull();
  });

  it("garde « À venir » quand un serveur ancien ne détaille pas la soirée", () => {
    // Sans `aVenir`, la carte disait « aucune soirée au calendrier » juste
    // sous une bannière qui annonçait « Lundi 19:00 ».
    const v = vueMatchs(accueil({ soiree: soiree() }), SAMEDI);
    expect(v.onglets.map((o) => o.valeur)).toEqual(["venir"]);
    expect(v.soireeSansDetail?.id).toBe("s1");
  });

  it("ne double pas la soirée du jour ni celle que le serveur détaille", () => {
    expect(vueMatchs(accueil({ soiree: soiree(), aVenir: aVenir() }), SAMEDI).soireeSansDetail)
      .toBeNull();
    const ceSoir = accueil({ soiree: soiree({ date: iso(2026, 8, 19, 19) }) });
    expect(vueMatchs(ceSoir, SAMEDI).soireeSansDetail).toBeNull();
  });

  it("n'ouvre pas « Ce soir » pour une feuille restée ouverte depuis mercredi", () => {
    // Elle a sa propre carte « Feuille restée ouverte » ; ici, elle ouvrait
    // un onglet vide avec un chrono de soixante-douze heures.
    const v = vueMatchs(
      accueil({
        enDirect: {
          id: "m9",
          joueLe: iso(2026, 8, 16, 20),
          scoreA: 0,
          scoreB: 0,
          nomA: "Blanc",
          nomB: "Noir",
          soireeId: null,
          retro: true,
          jourLong: "Mercredi 16 septembre",
        },
      }),
      SAMEDI,
    );
    expect(v.onglets).toEqual([]);
    expect(v.initial).toBeNull();
  });

  it("garde dans « Ce soir » le match lancé à 23 h 30 et vu après minuit", () => {
    const minuitPasse = new Date(2026, 8, 22, 0, 20);
    const v = vueMatchs(
      accueil({
        enDirect: {
          id: "m3",
          joueLe: iso(2026, 8, 21, 23, 30),
          scoreA: 1,
          scoreB: 1,
          nomA: "Blanc",
          nomB: "Noir",
          soireeId: "s1",
          retro: false,
          jourLong: "Lundi 21 septembre",
        },
      }),
      minuitPasse,
    );
    expect(v.joues.map((m) => m.id)).toEqual(["m3"]);
    expect(v.onglets.map((o) => o.valeur)).toEqual(["soir"]);
  });

  it("range les matchs du premier au dernier, pas du plus récent", () => {
    const a = accueil({
      matchs: [
        match({ id: "m2", joueLe: iso(2026, 8, 19, 21, 0) }),
        match({ id: "m1", joueLe: iso(2026, 8, 19, 20, 0) }),
      ],
    });
    expect(vueMatchs(a, SAMEDI).joues.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("écarte de « Ce soir » un LIVE ouvert depuis plus de six heures", () => {
    const a = accueil({ matchs: [match({ id: "vieux", statut: "LIVE", joueLe: iso(2026, 8, 19, 9) })] });
    expect(vueMatchs(a, SAMEDI).joues).toEqual([]);
  });

  it("nomme l'onglet de la dernière soirée par son jour", () => {
    const a = accueil({
      derniere: { date: iso(2026, 8, 15, 20), soireeId: "s0", matchs: [match()] },
    });
    const v = vueMatchs(a, SAMEDI);
    expect(v.onglets[0]).toEqual({ valeur: "derniere", libelle: "Mardi 15" });
    // Rien aujourd'hui, rien à venir : c'est elle qui s'ouvre.
    expect(v.initial).toBe("derniere");
  });

  it("préfère « Ce soir » quand il existe", () => {
    const a = accueil({
      aVenir: { soiree: null, matchs: [] },
      soiree: soiree({ date: iso(2026, 8, 19, 19) }),
      derniere: { date: iso(2026, 8, 15, 20), soireeId: "s0", matchs: [match()] },
    });
    const v = vueMatchs(a, SAMEDI);
    expect(v.onglets.map((o) => o.valeur)).toEqual(["derniere", "soir"]);
    expect(v.initial).toBe("soir");
  });

  it("ignore une dernière soirée sans match", () => {
    const a = accueil({ derniere: { date: iso(2026, 8, 15, 20), soireeId: "s0", matchs: [] } });
    expect(vueMatchs(a, SAMEDI).onglets).toEqual([]);
  });
});

describe("ongletAffiche", () => {
  const vue = vueMatchs(
    accueil({
      soiree: soiree(),
      aVenir: aVenir(),
      derniere: { date: iso(2026, 8, 15, 20), soireeId: "s0", matchs: [match()] },
    }),
    SAMEDI,
  );

  it("garde l'onglet touché", () => {
    expect(ongletAffiche(vue, "derniere")).toBe("derniere");
  });

  it("retombe sur l'onglet d'office quand celui qu'on avait touché a disparu", () => {
    expect(ongletAffiche(vue, "soir")).toBe("venir");
    expect(ongletAffiche(vue, null)).toBe("venir");
  });
});

describe("les lignes de la carte des matchs", () => {
  it("compte les présents pour la soirée de la bannière, les réponses ailleurs", () => {
    const suivante = {
      id: "s1",
      date: LUNDI,
      libelle: null,
      lieu: null,
      nomA: "Blanc",
      nomB: "Noir",
      compoA: 5,
      compoB: 5,
      reponses: 3,
    };
    // Sans les noms des chasubles : ils sont déjà sous les écussons, et la
    // phrase se faisait couper à côté du bouton de présence.
    expect(ligneReponses(suivante, soiree())).toBe("8 présents · 5 contre 5");
    expect(ligneReponses(suivante, soiree({ id: "autre" }))).toBe("3 réponses · 5 contre 5");
    expect(ligneReponses({ ...suivante, compoA: 0, compoB: 0, reponses: 1 }, null)).toBe(
      "1 réponse · équipes à préparer",
    );
  });

  it("dit l'état de la compo du jour quand la route ne la détaille pas", () => {
    expect(ligneSoireeDuJour(soiree(), null)).toBe("8 présents · équipes à préparer");
    expect(ligneSoireeDuJour(soiree({ compoFaite: true }), null)).toBe("8 présents · compo en cours");
    expect(ligneSoireeDuJour(soiree(), { compoA: 5, compoB: 4 })).toBe("8 présents · 5 contre 4");
  });

  it("dit domicile ou extérieur pour un match externe", () => {
    const base = {
      id: "p1",
      quand: LUNDI,
      nomA: "Nous",
      nomB: "Eux",
      lieu: null,
      presents: 3,
      soireeId: null,
    };
    expect(ligneProgramme({ ...base, externe: true, domicile: true })).toBe(
      "Match externe · domicile · 3 présents",
    );
    expect(ligneProgramme({ ...base, externe: true, domicile: false })).toBe(
      "Match externe · extérieur · 3 présents",
    );
    // Serveur ancien : il ne dit pas de quel côté on joue, on n'invente pas.
    expect(ligneProgramme({ ...base, externe: true })).toBe("Match externe · 3 présents");
    expect(ligneProgramme({ ...base, externe: false, presents: 1 })).toBe(
      "Match programmé · 1 présent",
    );
  });
});

describe("quandRelatifDe", () => {
  it("se tait au-delà de six jours et avant hier : la date dit mieux", () => {
    expect(quandRelatifDe(iso(2026, 8, 26, 19), SAMEDI)).toBeNull();
    expect(quandRelatifDe(iso(2026, 8, 17, 19), SAMEDI)).toBeNull();
    expect(quandRelatifDe(iso(2026, 8, 18, 19), SAMEDI)).toBe("Hier");
  });
});

describe("le rang et son évolution", () => {
  it("écrit 1er puis 3e", () => {
    expect(rangTexte(1)).toBe("1er");
    expect(rangTexte(3)).toBe("3e");
  });

  it("tait le zéro dans le tableau, le dit dans « Ma saison »", () => {
    expect(evolutionTexte(0)).toBeNull();
    expect(evolutionTexte(0, true)).toBe("=");
    expect(evolutionTexte(2)).toBe("▲2");
    expect(evolutionTexte(-1)).toBe("▼1");
    expect(evolutionTexte(null)).toBeNull();
    expect(evolutionTexte(undefined)).toBeNull();
  });

  it("se dit en toutes lettres pour un lecteur d'écran", () => {
    expect(evolutionPhrase(2)).toBe("2 places gagnées depuis la dernière soirée");
    expect(evolutionPhrase(-1)).toBe("1 place perdue depuis la dernière soirée");
    expect(evolutionPhrase(null)).toBeNull();
  });
});

describe("poursuite", () => {
  const ligne = (playerId: string, nom: string, points: number, victoires = 0, buts = 0) => ({
    rang: 0,
    playerId,
    nom,
    photo: null,
    matchs: 10,
    victoires,
    nuls: 0,
    defaites: 0,
    buts,
    points,
  });
  const classement = [
    ligne("a", "Bakary", 21, 7, 9),
    ligne("b", "Cédric", 18, 6, 4),
    ligne("c", "Diame", 18, 5, 4),
  ];

  it("dit l'avance de celui qui mène", () => {
    expect(poursuite(classement, 0)).toMatchObject({
      titre: "Tu mènes le tableau",
      sous: "3 pts d'avance sur Cédric",
      devant: null,
    });
  });

  it("dit combien il manque, et le rang de CELUI QUI EST DEVANT", () => {
    // Le deuxième court après le premier : « 1er du tableau » désigne
    // Bakary, dont le nom est sur la même ligne. La place du joueur, elle,
    // est écrite en grand juste au-dessus.
    expect(poursuite(classement, 1)).toMatchObject({
      titre: "À 3 pts de Bakary",
      sous: "1er du tableau",
    });
  });

  it("explique le départage à égalité de points", () => {
    expect(poursuite(classement, 2)).toMatchObject({
      titre: "À égalité avec Cédric",
      sous: "2e du tableau · devant aux victoires",
    });
  });

  it("rend null pour qui n'a pas joué cette saison", () => {
    expect(poursuite(classement, -1)).toBeNull();
  });
});

describe("seriePhare", () => {
  const serie = (id: Serie["id"], enCours: number, record = enCours): Serie => ({
    id,
    nom: id,
    enCours,
    record,
  });

  it("ne fait pas une série de deux présences", () => {
    expect(seriePhare([serie("lundis", 2)])).toBeNull();
  });

  it("ne répète pas les victoires en « sans défaite » du même chiffre", () => {
    const s = seriePhare([serie("victoires", 3), serie("invincible", 3)]);
    expect(s?.id).toBe("victoires");
    expect(s?.titre).toBe("3 victoires d'affilée");
  });

  it("garde « sans défaite » quand la série y est plus longue", () => {
    expect(seriePhare([serie("victoires", 2), serie("invincible", 6)])?.id).toBe("invincible");
  });

  it("dit le record, ou qu'on est dessus", () => {
    expect(seriePhare([serie("victoires", 3, 5)])?.sous).toBe("record 5");
    expect(seriePhare([serie("victoires", 5, 5)])?.sous).toBe("c'est ton record");
  });
});

describe("prochainPalier", () => {
  const badge = (p: Partial<Badge> & Pick<Badge, "id">): Pick<
    Badge,
    "id" | "nom" | "paliers" | "palier" | "valeur" | "prochain"
  > => ({
    nom: "Buteur",
    paliers: [1, 5, 10, 25],
    palier: 1,
    valeur: 3,
    prochain: 5,
    ...p,
  });

  it("nomme la matière du palier visé", () => {
    expect(prochainPalier(badge({ id: "buteur" }), [])).toMatchObject({
      titre: "Buteur argent",
      sous: "encore 2 buts",
      part: 3 / 5,
    });
  });

  it("garde le nom seul pour une famille à palier unique", () => {
    const b = badge({ id: "remontada", nom: "Remontada", paliers: [1], palier: 0, valeur: 0, prochain: 1 });
    expect(prochainPalier(b, [])?.titre).toBe("Remontada");
  });

  it("mesure une famille de série sur la série EN COURS, pas sur le record", () => {
    // Celui qui vient de perdre sa série repart de zéro : « encore 1 » lui
    // mentirait.
    const b = badge({
      id: "serie-victoires",
      nom: "En feu",
      paliers: [3, 5, 8],
      palier: 1,
      valeur: 4,
      prochain: 5,
    });
    const r = prochainPalier(b, [{ id: "victoires", nom: "Victoires", enCours: 1, record: 4 }]);
    expect(r?.part).toBe(1 / 5);
    expect(r?.sous).toBe("encore 4 victoires d'affilée");
  });

  it("part de 1000 pour la cote, pas de zéro", () => {
    const b = badge({ id: "elo", nom: "Cote", paliers: [1100, 1200], palier: 0, valeur: 1050, prochain: 1100 });
    expect(prochainPalier(b, [])?.part).toBeCloseTo(0.5, 5);
  });

  it("rend null quand tout est pris", () => {
    expect(prochainPalier(badge({ id: "buteur", prochain: null }), [])).toBeNull();
  });
});

describe("le fil des exploits", () => {
  const exploit = (playerId: string, joueur: string, badgeId: string, palier: number, le: string) => ({
    playerId,
    joueur,
    badgeId,
    palier,
    le,
  });

  it("met sur une seule ligne le même palier franchi le même jour", () => {
    // Le soir des dixièmes soirées, le fil brut alignait cinq fois
    // « Toujours là » et ne montrait rien d'autre.
    const g = grouperFil([
      exploit("a", "Bakary", "lundis", 2, iso(2026, 8, 21, 22)),
      exploit("b", "Cédric", "lundis", 2, iso(2026, 8, 21, 22, 5)),
      exploit("c", "Diame", "buteur", 2, iso(2026, 8, 21, 22)),
    ]);
    expect(g.map((x) => x.map((e) => e.joueur))).toEqual([["Bakary", "Cédric"], ["Diame"]]);
  });

  it("sépare le même palier franchi un autre jour", () => {
    const g = grouperFil([
      exploit("a", "Bakary", "lundis", 2, iso(2026, 8, 21, 22)),
      exploit("b", "Cédric", "lundis", 2, iso(2026, 8, 14, 22)),
    ]);
    expect(g).toHaveLength(2);
  });

  it("s'arrête à cinq lignes", () => {
    const fil = Array.from({ length: 9 }, (_, i) =>
      exploit(`p${i}`, `J${i}`, `b${i}`, 1, iso(2026, 8, 21, 22)),
    );
    expect(grouperFil(fil)).toHaveLength(5);
  });
});

describe("lesNoms", () => {
  it("énumère jusqu'à trois, puis compte", () => {
    expect(lesNoms(["Bakary"])).toBe("Bakary");
    expect(lesNoms(["Bakary", "Cédric"])).toBe("Bakary et Cédric");
    expect(lesNoms(["Bakary", "Cédric", "Diame"])).toBe("Bakary, Cédric et Diame");
    expect(lesNoms(["Bakary", "Cédric", "Diame", "Éric"])).toBe("Bakary, Cédric et 2 autres");
    expect(lesNoms(["Bakary", "Cédric", "Diame", "Éric", "Fodé"])).toBe(
      "Bakary, Cédric et 3 autres",
    );
  });
});

describe("lancementPossible", () => {
  // Lundi 21 septembre 2026, 20 h 05 : on est au gymnase, la soirée commence.
  const CE_SOIR = new Date(2026, 8, 21, 20, 5);

  it("laisse lancer quand rien ne tourne", () => {
    expect(lancementPossible(null, null, CE_SOIR)).toBe(true);
  });

  it("ne relance pas par-dessus un match en direct du serveur", () => {
    expect(lancementPossible({ retro: false }, null, CE_SOIR)).toBe(false);
  });

  it("laisse lancer malgré une feuille oubliée côté serveur", () => {
    expect(lancementPossible({ retro: true }, null, CE_SOIR)).toBe(true);
  });

  it("ne relance pas par-dessus la feuille ouverte sur CE téléphone", () => {
    const debutee = iso(2026, 8, 21, 20, 0);
    expect(lancementPossible(null, { playedAt: debutee }, CE_SOIR)).toBe(false);
  });

  it("laisse lancer malgré une feuille locale de la semaine dernière", () => {
    // Le défaut : `getLiveMatchOfClub` rend n'importe quelle feuille LIVE du
    // club, et celle de lundi dernier effaçait « Lancer un match ».
    const vieille = iso(2026, 8, 14, 20, 0);
    expect(lancementPossible(null, { playedAt: vieille }, CE_SOIR)).toBe(true);
  });

  it("bloque plutôt que de lancer quand la date locale est illisible", () => {
    expect(lancementPossible(null, { playedAt: "pas une date" }, CE_SOIR)).toBe(false);
  });
});
