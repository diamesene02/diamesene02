// « On m'a filé un code » — la règle ne doit exister qu'une fois.
//
// Le comportement, lui, est vérifié contre un vrai serveur et une vraie base
// par `scripts/parcours-lecture.mjs` : le lien collé entier, le code seul, la
// casse, le code inconnu, l'objet passé pour un code, et le membre qui
// rejoint deux fois. Ce fichier-ci garde autre chose, que le parcours ne peut
// pas voir : que le site et l'app font entrer un membre par le MÊME code.
//
// Troisième filet du même genre après `lib/rattachement.test.ts` et
// `lib/noyau/copie-conforme.test.ts`, et pour la même raison : une règle
// recopiée passe tous les tests le jour où on la recopie, et diverge au
// premier garde ajouté d'un seul côté. Ici, celui qui manquerait est le
// rattrapage de profil joueur — son absence ne casse rien tout de suite, elle
// fait juste apparaître le nouveau venu DEUX FOIS dans le vestiaire, la fiche
// que l'admin lui avait préparée et la sienne, vide.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB = join(__dirname, "..", "..", "five-scorer");

/// Ce test relit du code source ; il doit donc lire le CODE, pas les
/// commentaires. Sans ce filtre, il tombait sur ses propres phrases — le
/// commentaire qui dit « ce qui s'appelait `ensureLinkedPlayer` », l'exemple
/// d'URL `.../join/<code>` — et annonçait une duplication qui n'existait pas.
/// Un test qui se trompe de cible ne protège rien : on l'aurait relâché.
function sansCommentaires(src: string): string {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

const action = sansCommentaires(
  readFileSync(join(WEB, "app", "actions", "club.ts"), "utf8"),
);
const regle = readFileSync(join(WEB, "lib", "rejoindre.ts"), "utf8");
const route = readFileSync(
  join(WEB, "app", "api", "rejoindre", "route.ts"),
  "utf8",
);

describe("la règle du « rejoindre » n'existe qu'à un seul endroit", () => {
  it("la server action du site délègue à lib/rejoindre.ts", () => {
    expect(action).toContain('from "@/lib/rejoindre"');
    expect(action).toMatch(/rejoindreParCode\(\{/);
  });

  it("la route de l'app délègue à la même fonction", () => {
    expect(route).toContain('from "@/lib/rejoindre"');
    expect(route).toMatch(/rejoindreParCode\(\{/);
  });

  it("ni l'une ni l'autre ne réimplémente l'entrée dans le club", () => {
    // `addMember` et la lecture par `inviteCode` : le couple qui fait entrer.
    // Il vit dans la règle, et nulle part ailleurs.
    expect(regle).toContain("addMember");
    expect(regle).toMatch(/findUnique\([\s\S]{0,80}inviteCode/);
    expect(action).not.toContain("addMember");
    expect(route).not.toContain("addMember");
    // `regenerateInviteCode` vit toujours dans la server action, et c'est très
    // bien : il ÉCRIT le code, il ne s'en sert pas pour entrer. Ce qui ne doit
    // exister qu'une fois est la LECTURE d'un club par son code.
    expect(action).not.toMatch(/findUnique\([\s\S]{0,80}inviteCode/);
    expect(route).not.toContain("inviteCode");
    // La route ne parle pas à Prisma du tout : elle traduit un motif de refus
    // en statut HTTP, c'est tout.
    expect(route).not.toContain("prisma");
  });

  it("le rattrapage de profil joueur n'a qu'une copie, et les deux appelants la partagent", () => {
    // `claimLegacy` s'en servait aussi, sous son ancien nom
    // (`ensureLinkedPlayer`). Si l'extraction avait laissé l'ancienne
    // fonction derrière elle, il y aurait deux versions de « quel joueur
    // suis-je déjà dans ce club ? » — et celle qu'on n'édite pas est celle
    // qui se trompe.
    expect(regle).toContain("export async function assurerProfilJoueur");
    expect(action).toContain("assurerProfilJoueur(");
    expect(action).not.toContain("ensureLinkedPlayer");
    expect(regle).not.toContain("ensureLinkedPlayer");
    // Le site ne crée plus de joueur de son côté : c'est la règle qui le fait.
    expect(action).not.toContain("prisma.player.create");
  });

  it("chaque refus a son statut, et aucun n'est laissé en 500", () => {
    // Un motif ajouté à la règle sans entrée dans la table sortirait en
    // `undefined` — donc en 200 côté Next, ce qui ferait passer un refus pour
    // une réussite sur le téléphone.
    const motifs = [...regle.matchAll(/motif: "([a-z_]+)"/g)].map((m) => m[1]);
    expect(motifs.length).toBeGreaterThan(0);
    const table = regle.slice(regle.indexOf("STATUT_REJOINDRE"));
    for (const motif of new Set(motifs)) {
      expect(table).toMatch(new RegExp(`\\b${motif}: \\d{3}`));
    }
  });

  it("le code venu du client est validé avant Prisma", () => {
    // Le bug déjà vécu ici : un objet passé pour un identifiant devient un
    // filtre Prisma. Sur `findUnique({ where: { inviteCode } })`, il ferait
    // désigner un club qu'on n'a jamais reçu en invitation.
    expect(regle).toContain("estId(code)");
    expect(regle.indexOf("normaliserCode")).toBeLessThan(
      regle.indexOf("prisma.club.findUnique"),
    );
  });

  it("l'app appelle la route, elle ne refait pas le tri du code", () => {
    // Le lien collé est démonté côté SERVEUR : sinon le site, lui, ne
    // saurait toujours pas quoi faire d'une URL — c'est exactement le défaut
    // qu'on vient de corriger, et le remettre côté app le rendrait invisible.
    const api = sansCommentaires(readFileSync(join(__dirname, "api.ts"), "utf8"));
    expect(api).toContain('"/api/rejoindre"');
    expect(api).not.toContain("/join/");
  });
});
