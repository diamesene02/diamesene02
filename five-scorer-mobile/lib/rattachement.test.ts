// « Ce joueur, c'est moi » — la règle ne doit exister qu'une fois.
//
// Le comportement, lui, est vérifié contre un vrai serveur et une vraie base
// par `scripts/parcours-lecture.mjs` (23 vérifications : les quatre refus, le
// rattachement, son DÉPLACEMENT, l'arbitrage du gérant). Ce fichier-ci garde
// autre chose, que le parcours ne peut pas voir : que le site et l'app lisent
// bien le MÊME code.
//
// C'est le même filet que `lib/noyau/copie-conforme.test.ts` et que les trois
// tests qui relisent `lib/api.ts` : une règle recopiée passe tous les tests le
// jour où on la recopie, et diverge au premier garde ajouté d'un seul côté.
// Ici le garde qui manquerait serait celui qui protège la course entre deux
// téléphones — celui qu'on ne voit pas manquer.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB = join(__dirname, "..", "..", "five-scorer");
const action = readFileSync(join(WEB, "app", "actions", "roster.ts"), "utf8");
const regle = readFileSync(join(WEB, "lib", "rattachement.ts"), "utf8");
const route = readFileSync(
  join(WEB, "app", "api", "clubs", "[clubId]", "joueurs", "[playerId]", "rattachement", "route.ts"),
  "utf8",
);

describe("la règle du rattachement n'existe qu'à un seul endroit", () => {
  it("la server action du site délègue à lib/rattachement.ts", () => {
    expect(action).toContain('from "@/lib/rattachement"');
    expect(action).toMatch(/rattacherJoueur\(\{/);
  });

  it("la route de l'app délègue à la même fonction", () => {
    expect(route).toContain('from "@/lib/rattachement"');
    expect(route).toMatch(/rattacherJoueur\(\{/);
  });

  it("ni l'une ni l'autre ne réimplémente la transaction", () => {
    // `$transaction` + `link_conflict` : la paire qui délie puis relie. Elle
    // vit dans la règle, et nulle part ailleurs — deux exemplaires, et c'est
    // le second qui oublierait de traiter l'échec comme une exception.
    expect(regle).toContain("link_conflict");
    expect(action).not.toContain("link_conflict");
    expect(route).not.toContain("link_conflict");
    expect(action).not.toContain("$transaction");
    expect(route).not.toContain("$transaction");
    // La route ne parle pas à Prisma du tout : elle traduit une garde et un
    // motif de refus en statut HTTP, c'est tout.
    expect(route).not.toContain("prisma");
  });

  it("chaque refus a son statut, et aucun n'est laissé en 500", () => {
    // Un motif ajouté à la règle sans entrée dans la table sortirait en
    // `undefined` — donc en 200 côté Next, ce qui ferait passer un refus pour
    // une réussite sur le téléphone.
    const motifs = [
      ...regle.matchAll(/motif: "([a-z_]+)"/g),
    ].map((m) => m[1]);
    expect(motifs.length).toBeGreaterThan(0);
    const table = regle.slice(regle.indexOf("STATUT_RATTACHEMENT"));
    for (const motif of new Set(motifs)) {
      expect(table).toMatch(new RegExp(`\\b${motif}: \\d{3}`));
    }
  });

  it("les identifiants venus du client sont validés avant Prisma", () => {
    // Le bug déjà vécu ici : un objet passé pour un identifiant devient un
    // filtre Prisma, et l'écriture porte sur tous les profils libres du club.
    expect(regle).toContain("idsValides(playerId, userId)");
    expect(regle.indexOf("idsValides")).toBeLessThan(regle.indexOf("prisma.member"));
  });
});
