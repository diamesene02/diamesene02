// Les trois réponses de version, rejouées comme l'app les provoque.
//
// Frère de `parcours-lecture.mjs`, même forme et même promesse : pas de Mac,
// pas de téléphone, pas de simulateur — un serveur `next dev` suffit.
//
// Ce script est le SEUL des critères de version de la spec 0004 qui soit
// vérifiable par une commande. Les deux autres — un correctif JavaScript arrivé
// sur quinze téléphones, un plantage rattrapé en plein match — se constatent
// sur un appareil, et c'est écrit dans la spec plutôt que promis ici.
//
// Aucun cookie : le verdict est posé par le middleware sur toute réponse de
// /api/clubs/**, authentifiée ou non. C'est une métadonnée de transport, pas
// un droit d'accès — et c'est précisément ce qui rend ce script possible sans
// tenir un compte de test.
//
//   node scripts/verif-version.mjs [base]

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const CHEMIN = "/api/clubs/verif-version/effectif";
const ENTETE = "x-protocole";
const VERDICT = "x-protocole-verdict";

let rates = 0;
const ok = (bon, quoi, detail = "") => {
  if (!bon) rates++;
  console.log(`${bon ? "  ok " : "ÉCHEC"}  ${quoi}${detail ? "  — " + detail : ""}`);
};

// « trop-vieux » n'est PAS dans cette liste, et c'est voulu : il est
// inatteignable tant que PROTOCOLE_MINIMUM vaut 1, puisqu'une version de
// protocole commence à 1. Le jour où le minimum monte à 2, ce script gagne la
// ligne ["1", "trop-vieux"] — et c'est ce jour-là qu'elle voudra dire quelque
// chose. Voir specs/0004-le-miroir-sait-vieillir/journal.md.
const CAS = [
  ["999", "trop-recent", "une app plus récente que le serveur"],
  ["1", "ok", "la version courante"],
  ["abc", "ok", "une valeur illisible ne pénalise personne"],
  [null, "ok", "aucun en-tête : les quinze téléphones d'aujourd'hui"],
];

async function main() {
  console.log(`serveur ${BASE}\n`);

  for (const [envoye, attendu, pourquoi] of CAS) {
    const res = await fetch(BASE + CHEMIN, {
      headers: envoye === null ? {} : { [ENTETE]: envoye },
    });
    const rendu = res.headers.get(VERDICT);
    ok(
      rendu === attendu,
      `${(envoye === null ? "(absent)" : envoye).padEnd(9)} → ${attendu}`,
      rendu === attendu ? pourquoi : `rendu « ${rendu} »`,
    );
  }

  // Le verdict ne doit JAMAIS changer le code de réponse : c'est un avis, pas
  // un refus. Sans cookie on attend 401 dans les quatre cas — et surtout le
  // même dans les quatre.
  const codes = [];
  for (const [envoye] of CAS) {
    const res = await fetch(BASE + CHEMIN, {
      headers: envoye === null ? {} : { [ENTETE]: envoye },
    });
    codes.push(res.status);
  }
  ok(
    new Set(codes).size === 1,
    "le verdict ne change jamais le code de réponse",
    codes.join(", "),
  );

  console.log(rates === 0 ? "\nTOUT VERT" : `\n${rates} ÉCHEC(S)`);
  process.exitCode = rates === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
