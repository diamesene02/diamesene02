// L'appel authentifié, éprouvé contre un serveur de papier.
//
// Trois choses seulement peuvent casser ici, et toutes les trois échouent en
// SILENCE — c'est ce qui rend ce test file plus utile que sa taille ne le
// laisse croire :
//
//   1. `credentials` autre que « omit » : sur la cible web, le navigateur
//      ajoute son propre cookie et on ne voit rien ; sur le téléphone, rien
//      n'arrive du tout.
//   2. l'en-tête `cookie` absent, ou contenant une PROMESSE (le `await`
//      oublié sur `getCookie`) : le serveur voit une requête anonyme et
//      répond 401, ce qui se lit comme « il faut se reconnecter » alors que
//      la session est parfaitement valide.
//   3. un 401 confondu avec une panne réseau : soit on renvoie au formulaire
//      de connexion quelqu'un dont le Wi-Fi a hoqueté, soit on laisse tourner
//      en rond une session révoquée.
//
// Aucune n'est visible à l'écran au moment où on la commet.

import { describe, it, expect } from "vitest";
import { ENTETE_PROTOCOLE, ENTETE_VERDICT, PROTOCOLE_COURANT } from "./protocole";
import { definirVerdict, verdictActuel } from "./protocoleClient";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  creerAppel,
  joindre,
  ErreurServeur,
  SessionExpiree,
} from "./appel";

const API = "http://192.168.1.192:3000";
const COOKIE = "better-auth.session_token=abc.def; Path=/";

type Recu = { url: string; init: RequestInit | undefined };

/// Un serveur de papier qui garde ce qu'on lui a envoyé. `reponse` décide du
/// sort de chaque requête ; par défaut il accepte tout et rend un objet.
function serveur(
  reponse: (recu: Recu, rang: number) => Response | Promise<Response> = () =>
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
) {
  const recus: Recu[] = [];
  const faux: typeof globalThis.fetch = async (entree, init) => {
    const recu = { url: String(entree), init };
    recus.push(recu);
    return reponse(recu, recus.length - 1);
  };
  return { recus, faux };
}

/// Les en-têtes tels que la fonction les a posés. Ici ce sont toujours des
/// objets simples : `creerAppel` construit lui-même le `Record`.
function entetes(recu: Recu): Record<string, string> {
  return (recu.init?.headers ?? {}) as Record<string, string>;
}

describe("la version du contrat", () => {
  it("part à CHAQUE appel, dans x-protocole", async () => {
    // Ce test manquait, et son absence avait laissé passer le vrai défaut :
    // `scripts/verif-version.mjs` éprouve le SERVEUR avec des littéraux, sans
    // jamais toucher à ce fichier. Il serait resté vert si l'app n'avait
    // envoyé aucun en-tête — et c'était le cas du drain de l'outbox.
    const s = serveur();
    const appel = creerAppel({ api: API, cookie: async () => "s=1", fetch: s.faux });
    await appel("/api/clubs/x/effectif");
    expect(entetes(s.recus[0])[ENTETE_PROTOCOLE]).toBe(String(PROTOCOLE_COURANT));
  });

  it("lit le verdict de la réponse et le donne au bandeau", async () => {
    const s = serveur(() => new Response("{}", {
      status: 200,
      headers: { [ENTETE_VERDICT]: "trop-recent" },
    }));
    const appel = creerAppel({ api: API, cookie: async () => "s=1", fetch: s.faux });
    await appel("/api/clubs/x/effectif");
    expect(verdictActuel()).toBe("trop-recent");
  });

  it("IGNORE un verdict que le serveur n'aurait pas dû envoyer", async () => {
    // Sans garde, un `as` laisserait n'importe quoi devenir le verdict courant
    // — et le bandeau afficherait une bande d'or SANS TEXTE, en permanence, sur
    // le haut de tous les écrans.
    definirVerdict("ok");
    const s = serveur(() => new Response("{}", {
      status: 200,
      headers: { [ENTETE_VERDICT]: "n'importe quoi" },
    }));
    const appel = creerAppel({ api: API, cookie: async () => "s=1", fetch: s.faux });
    await appel("/api/clubs/x/effectif");
    expect(verdictActuel()).toBe("ok");
  });
});

describe("l'appel authentifié", () => {
  it("pose credentials « omit » — jamais « include »", async () => {
    const s = serveur();
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    await appel("/api/me");

    // Pas `!== "include"` : la valeur exacte est le contrat. React Native
    // n'a pas de bocal à cookies, « include » ne ferait rien de bon et
    // « same-origin » n'a pas de sens sans origine.
    expect(s.recus[0].init?.credentials).toBe("omit");
  });

  it("rejoue le cookie du trousseau dans l'en-tête", async () => {
    const s = serveur();
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    await appel("/api/me");

    expect(entetes(s.recus[0]).cookie).toBe(COOKIE);
  });

  it("attend le cookie : jamais une promesse dans l'en-tête", async () => {
    const s = serveur();
    // Un lecteur qui prend son temps, comme le trousseau qui recolle ses
    // morceaux de 1800 caractères. Sans `await`, ce qui atterrit dans
    // l'en-tête est « [object Promise] ».
    const appel = creerAppel({
      api: API,
      cookie: () =>
        new Promise((ok) => setTimeout(() => ok(COOKIE), 5)),
      fetch: s.faux,
    });

    await appel("/api/me");

    expect(typeof entetes(s.recus[0]).cookie).toBe("string");
    expect(entetes(s.recus[0]).cookie).toBe(COOKIE);
  });

  it("n'invente pas d'en-tête cookie quand il n'y a pas de session", async () => {
    const s = serveur();
    const appel = creerAppel({
      api: API,
      cookie: async () => null,
      fetch: s.faux,
    });

    await appel("/api/me");

    // Un `cookie: "null"` ou `cookie: ""` serait pire que rien : le serveur
    // tenterait de le lire avant de rendre son 401.
    expect(entetes(s.recus[0])).not.toHaveProperty("cookie");
  });

  it("relit le cookie à CHAQUE appel, pas une fois pour toutes", async () => {
    const s = serveur();
    let jeton = "premier";
    const appel = creerAppel({
      api: API,
      cookie: async () => jeton,
      fetch: s.faux,
    });

    await appel("/api/me");
    jeton = "second"; // session renouvelée entre-temps
    await appel("/api/me");

    expect(entetes(s.recus[0]).cookie).toBe("premier");
    expect(entetes(s.recus[1]).cookie).toBe("second");
  });

  it("vise une URL absolue, préfixée par l'adresse du serveur", async () => {
    const s = serveur();
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    await appel("/api/clubs/abc/roster");

    // Il n'y a pas d'origine implicite sur un téléphone : un chemin relatif
    // ne désigne rien.
    expect(s.recus[0].url).toBe(API + "/api/clubs/abc/roster");
  });

  it("annonce du JSON, et ne déclare un content-type que s'il y a un corps", async () => {
    const s = serveur();
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    await appel("/api/me");
    await appel("/api/clubs/abc/matches", {
      method: "POST",
      body: JSON.stringify({ id: "m1" }),
    });

    expect(entetes(s.recus[0]).accept).toBe("application/json");
    expect(entetes(s.recus[0])).not.toHaveProperty("content-type");
    expect(entetes(s.recus[1])["content-type"]).toBe("application/json");
    expect(s.recus[1].init?.method).toBe("POST");
    expect(s.recus[1].init?.body).toBe(JSON.stringify({ id: "m1" }));
  });

  it("laisse le dernier mot à l'appelant sur les en-têtes", async () => {
    const s = serveur();
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    await appel("/api/clubs/abc/export", { headers: { accept: "text/csv" } });

    expect(entetes(s.recus[0]).accept).toBe("text/csv");
    // …sans perdre le cookie au passage.
    expect(entetes(s.recus[0]).cookie).toBe(COOKIE);
  });

  it("rend le JSON du serveur", async () => {
    const s = serveur(
      () => new Response(JSON.stringify({ clubs: [{ slug: "rfug" }] }), { status: 200 }),
    );
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    const moi = await appel<{ clubs: { slug: string }[] }>("/api/me");

    expect(moi.clubs[0].slug).toBe("rfug");
  });
});

describe("ce que l'appel fait des refus", () => {
  it("401 : SessionExpiree, et rien d'autre", async () => {
    const s = serveur(
      () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    // `instanceof` et pas le message : c'est sur le type que l'écran décide
    // de retourner à la connexion (app/clubs.tsx).
    await expect(appel("/api/me")).rejects.toBeInstanceOf(SessionExpiree);
    await expect(appel("/api/me")).rejects.not.toBeInstanceOf(ErreurServeur);
  });

  it("403 : une erreur ordinaire, avec son code lisible par le drain", async () => {
    const s = serveur(
      () => new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
    );
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    const e = await appel("/api/clubs/abc").catch((x: unknown) => x);

    expect(e).toBeInstanceOf(ErreurServeur);
    expect(e).not.toBeInstanceOf(SessionExpiree);
    // `status` sur l'objet, pas seulement dans la phrase : c'est ce que lit
    // `encaisserEchec` du drain pour trancher réessayable / définitif.
    expect((e as ErreurServeur).status).toBe(403);
    // Et le mot du serveur, qui dit quoi corriger.
    expect((e as ErreurServeur).message).toContain("forbidden");
  });

  it("une réponse d'erreur illisible ne masque pas le code", async () => {
    const s = serveur(() => new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const appel = creerAppel({
      api: API,
      cookie: async () => COOKIE,
      fetch: s.faux,
    });

    const e = await appel("/api/me").catch((x: unknown) => x);

    expect((e as ErreurServeur).status).toBe(502);
    expect((e as ErreurServeur).message).toContain("502");
  });

  it("une panne réseau dit QUELLE adresse a échoué", async () => {
    const faux: typeof globalThis.fetch = async () => {
      throw new TypeError("Network request failed");
    };
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: faux });

    const e = await appel("/api/me").catch((x: unknown) => x);

    // Ni SessionExpiree ni ErreurServeur : une panne réseau se retente, elle
    // ne renvoie pas au formulaire de connexion.
    expect(e).not.toBeInstanceOf(SessionExpiree);
    expect(e).not.toBeInstanceOf(ErreurServeur);
    expect((e as Error).message).toContain(API + "/api/me");
    expect((e as Error).message).toContain("Network request failed");
  });
});

describe("joindre", () => {
  it("laisse passer une réponse, même en erreur", async () => {
    const faux: typeof globalThis.fetch = async () => new Response("", { status: 404 });
    const res = await joindre(API + "/api/public/inconnu", undefined, faux);

    // `joindre` ne juge pas le code : il ne parle que de ce qui empêche
    // d'atteindre le serveur. Le 404 de la vitrine a son propre message.
    expect(res.status).toBe(404);
  });
});

describe("lib/api.ts délègue, il ne réimplémente pas", () => {
  // Le même procédé que `copie-conforme.test.ts` du noyau : ce qui protège
  // vraiment ces tests, c'est qu'ils portent sur le code réellement embarqué.
  // `lib/api.ts` n'est pas importable ici (expo-constants, expo-linking) —
  // alors on le lit. Le jour où quelqu'un y réécrit un fetch « juste pour un
  // écran », rien ci-dessus ne rougirait ; ce test-ci, si.
  const source = readFileSync(join(__dirname, "api.ts"), "utf8");

  /// Le fichier sans ses lignes de commentaire. Ce document explique ce que
  /// fait `creerAppel` — le mot « credentials » y figure donc légitimement,
  /// et un test qui le chercherait dans la prose interdirait d'expliquer le
  /// code qu'il protège.
  const code = source
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

  it("construit son appel avec creerAppel", () => {
    expect(code).toContain("creerAppel({ api: API, cookie: lireCookie })");
  });

  it("ne pose plus lui-même credentials ni en-tête cookie", () => {
    expect(code).not.toContain("credentials:");
    expect(code).not.toMatch(/entetes\.cookie/);
  });

  it("ne parle à fetch que par joindre", () => {
    // `chargerVitrine` passe par `joindre`, comme l'appel authentifié : une
    // panne d'adresse doit se raconter de la même façon sur les deux chemins.
    expect(code).not.toMatch(/(?<![\w.])fetch\s*\(/);
    expect(code).toContain("joindre(");
  });
});

describe("le 404 « introuvable » d'une route de club", () => {
  // Défaut vu en production le 12 septembre 2026 : « Le serveur a répondu 404
  // — introuvable » en travers de l'écran des soirées, sans aucune issue, alors
  // que la vraie cause était une session que le serveur ne reconnaissait plus.
  //
  // Le middleware ne juge le cookie que sur sa PRÉSENCE : un cookie périmé
  // passe, puis échoue plus loin dans getClubApiContext, qui rend `null` aussi
  // bien pour « pas de session » que pour « pas membre ». Les deux sortent en
  // 404 avec le même mot.

  const introuvable = () =>
    new Response(JSON.stringify({ error: "introuvable" }), { status: 404 });

  it("dit quoi faire, au lieu de dire « introuvable »", async () => {
    const s = serveur(introuvable);
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    await expect(appel("/api/clubs/abc/soirees")).rejects.toThrow(/reconnecte-toi/i);
  });

  it("garde le code 404 sur l'objet — le drain décide là-dessus", async () => {
    const s = serveur(introuvable);
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    const e = await appel("/api/clubs/abc/soirees").catch((x) => x);
    expect(e).toBeInstanceOf(ErreurServeur);
    expect((e as ErreurServeur).status).toBe(404);
  });

  it("ne déconnecte PAS d'office : ce n'est pas une SessionExpiree", async () => {
    // Jeter la session de quelqu'un qui a des buts en attente serait pire que
    // le message. On ne sait pas lequel des deux cas c'est.
    const s = serveur(introuvable);
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    const e = await appel("/api/clubs/abc/soirees").catch((x) => x);
    expect(e).not.toBeInstanceOf(SessionExpiree);
  });

  it("laisse tranquille un 404 qui n'est PAS sur une route de club", async () => {
    const s = serveur(introuvable);
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    await expect(appel("/api/me")).rejects.toThrow(/introuvable/);
  });

  it("laisse tranquille un 404 de club qui dit autre chose qu'« introuvable »", async () => {
    // Une route qui répond 404 pour un match effacé doit garder son propre mot.
    const s = serveur(
      () => new Response(JSON.stringify({ error: "match effacé" }), { status: 404 }),
    );
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    await expect(appel("/api/clubs/abc/matches/x")).rejects.toThrow(/match effacé/);
  });
});

describe("le 404 d'un club : l'app tranche au lieu de décrire", () => {
  // Vu en production le 13 septembre 2026 : « je me suis déconnecté plusieurs
  // fois mais j'ai toujours ça ». Le message disait « reconnecte-toi » alors
  // que se reconnecter n'y pouvait rien. getClubApiContext rend null pour deux
  // causes opposées ; /api/me les sépare, puisqu'il n'est pas sous /api/clubs/.

  const CLUB = "cmtqb33rk0004iogb6w5cvvpj";
  const chemin = `/api/clubs/${CLUB}/soirees`;

  /// Un serveur qui refuse la route de club, et répond ce qu'on veut sur /api/me.
  function serveurQuiRefuse(me: () => Response) {
    return serveur((recu) =>
      recu.url.includes("/api/me")
        ? me()
        : new Response(JSON.stringify({ error: "introuvable" }), { status: 404 }),
    );
  }

  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status });

  it("dit qu'on a été RETIRÉ du club quand il n'est pas dans la liste", async () => {
    const s = serveurQuiRefuse(() =>
      json({ clubs: [{ id: "un-autre", nom: "Les Jeudis" }] }),
    );
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    const e = (await appel(chemin).catch((x) => x)) as Error;
    expect(e.message).toMatch(/n'es plus membre de ce club/);
    // Et surtout : il ne demande PLUS de se reconnecter, puisque ça ne sert à rien.
    expect(e.message).not.toMatch(/reconnecte-toi/i);
    // Il dit où on est, lui — sinon on ne sait pas quoi faire de l'information.
    expect(e.message).toMatch(/Les Jeudis/);
  });

  it("accuse le SERVEUR, pas l'utilisateur, quand le club est bien dans la liste", async () => {
    const s = serveurQuiRefuse(() => json({ clubs: [{ id: CLUB, nom: "Le Club" }] }));
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    const e = (await appel(chemin).catch((x) => x)) as Error;
    expect(e.message).toMatch(/Ce n'est pas toi/);
  });

  it("renvoie à la connexion si /api/me répond 401", async () => {
    // Là, et seulement là, se reconnecter est la bonne réponse.
    const s = serveurQuiRefuse(() => json({ error: "non connecté" }, 401));
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    await expect(appel(chemin)).rejects.toBeInstanceOf(SessionExpiree);
  });

  it("garde son message par défaut si /api/me est injoignable", async () => {
    // Ne pas pouvoir poser la question ne doit pas transformer un 404 en
    // plantage : on retombe sur le message prudent.
    const s = serveurQuiRefuse(() => {
      throw new Error("réseau coupé");
    });
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    const e = (await appel(chemin).catch((x) => x)) as Error;
    expect(e).toBeInstanceOf(ErreurServeur);
    expect(e.message).toMatch(/reconnecte-toi/i);
  });

  it("dit « aucun club » plutôt que « plus membre de ce club » si la liste est vide", async () => {
    const s = serveurQuiRefuse(() => json({ clubs: [] }));
    const appel = creerAppel({ api: API, cookie: async () => COOKIE, fetch: s.faux });
    const e = (await appel(chemin).catch((x) => x)) as Error;
    expect(e.message).toMatch(/membre d'aucun club/);
  });
});
