// Les endpoints de lecture de la V1, rejoués comme l'app les appelle.
//
// Frère de `parcours-connexion.mjs` (étape 10), même forme et même promesse :
// pas de Mac, pas de téléphone, pas de simulateur — un serveur `next dev` et un
// jeu d'essai (`node scripts/jeu-dessai.mjs`). Ce que ce script vérifie, c'est
// ce que l'étape 12 de MOBILE.md exige : la liste des matchs, la feuille
// complète d'un match, la compo préparée d'une soirée — puis, lot par lot, ce
// que l'étape 19+ ajoute : ici le vestiaire, la fiche d'un joueur et son
// « je viens tous les lundis ».
//
//   node scripts/jeu-dessai.mjs                  # une fois, pour peupler
//   node scripts/parcours-lecture.mjs [base]
//
// Comme l'app, on rejoue le cookie à la main : il n'y a pas de gestionnaire de
// cookies en React Native.
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const ORIGINE = process.env.ORIGINE ?? "exp://192.168.1.192:8090";
const COURRIEL = process.env.COURRIEL ?? "dev@five.local";
const MOT_DE_PASSE = process.env.MOT_DE_PASSE ?? "demo-five-2026";

let rates = 0;
const ok = (bon, quoi, detail = "") => {
  if (!bon) rates++;
  console.log(`${bon ? "  ok " : "ÉCHEC"}  ${quoi}${detail ? "  — " + detail : ""}`);
};

function cookies(res) {
  const brut =
    res.headers.getSetCookie?.() ??
    [res.headers.get("set-cookie")].filter(Boolean);
  return brut.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  console.log(`serveur ${BASE}\norigine ${ORIGINE}\n`);

  const co = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGINE },
    body: JSON.stringify({ email: COURRIEL, password: MOT_DE_PASSE }),
  });
  ok(co.ok, "la connexion aboutit", `HTTP ${co.status}`);
  if (!co.ok) return;
  const cookie = cookies(co);
  const h = { cookie, origin: ORIGINE };
  const lire = async (chemin) => {
    const res = await fetch(`${BASE}${chemin}`, { headers: h });
    return [res, res.ok ? await res.json() : null];
  };

  const [, moi] = await lire("/api/me");
  const club = moi.clubs.find((c) => c.slug === "essai-five") ?? moi.clubs[0];
  ok(Boolean(club), "le club d'essai est là", club?.nom);
  if (!club) return;
  const C = `/api/clubs/${club.id}`;

  // --- 1. La liste des matchs -----------------------------------------------

  console.log("\n— la liste des matchs —");
  const [rTous, tous] = await lire(`${C}/matches`);
  ok(rTous.ok, "GET matches répond", `HTTP ${rTous.status}`);
  ok(tous.matches.length >= 2, "sans filtre, les derniers matchs", `${tous.matches.length}`);
  ok(
    tous.matches.every((m) => typeof m.playedAt === "string" && m.playedAt.endsWith("Z")),
    "les dates sont en ISO, pas en objet Date",
  );
  ok(
    tous.matches[0].playedAt >= tous.matches[1].playedAt,
    "du plus récent au plus ancien",
    `${tous.matches[0].playedAt.slice(0, 10)} ≥ ${tous.matches[1].playedAt.slice(0, 10)}`,
  );
  ok(
    "teamAName" in tous.matches[0] && "scoreA" in tous.matches[0] && "mvpId" in tous.matches[0],
    "la forme est celle de LocalMatch (recopiable en SQLite)",
  );

  const [, ouverts] = await lire(`${C}/matches?status=LIVE,SCHEDULED`);
  ok(
    ouverts.matches.length === 1 && ouverts.matches[0].status === "LIVE",
    "« y a-t-il déjà un match ouvert ? » → un seul, et il est LIVE",
    `${ouverts.matches.length}`,
  );
  ok(
    !ouverts.matches.some((m) => m.status === "FINISHED"),
    "…et aucun match terminé ne s'y glisse",
  );

  const [rFaute] = await lire(`${C}/matches?status=LVE`);
  ok(
    rFaute.status === 400,
    "un statut inconnu est REFUSÉ, pas ignoré",
    `HTTP ${rFaute.status}`,
  );

  const [, borne] = await lire(`${C}/matches?limite=1`);
  ok(borne.matches.length === 1, "la limite est respectée", `${borne.matches.length}`);

  // --- 2. La feuille complète ------------------------------------------------

  console.log("\n— la feuille d'un match —");
  const [rF, f] = await lire(`${C}/matches/match-essai-fini`);
  ok(rF.ok, "GET matches/[id] répond", `HTTP ${rF.status}`);
  ok(f.match.scoreA === 2 && f.match.scoreB === 1, "le score y est", `${f.match.scoreA}-${f.match.scoreB}`);
  ok(f.participants.length === 12, "les douze participants", `${f.participants.length}`);
  ok(
    f.participants.every((p) => p.key === `match-essai-fini::${p.playerId}`),
    "chaque participant porte la clé composée de la table locale",
  );
  const change = f.participants.find((p) => p.team !== p.initialTeam);
  ok(
    Boolean(change),
    "le joueur qui a changé de camp garde son équipe de départ",
    change ? `${change.initialTeam} → ${change.team}` : "aucun",
  );
  ok(f.events.length === 5, "les cinq événements", `${f.events.length}`);
  ok(
    f.events.at(-1).type === "HALF_TIME" && f.events.at(-1).minute === 6,
    "l'ordre est celui de la SAISIE, pas celui des minutes",
    `dernier : ${f.events.at(-1).type} (minute ${f.events.at(-1).minute})`,
  );
  ok(
    f.events.every((e) => "assistPlayerId" in e && "createdAt" in e),
    "la forme est celle de LocalEvent",
  );
  ok(f.rsvps.length === 0, "aucun rsvp sur ce match", `${f.rsvps.length}`);
  ok(f.votes.total === 1 && f.votes.mine === f.match.mvpId, "mon vote est rendu", f.votes.mine);
  ok(
    !JSON.stringify(f.votes).includes("voterId"),
    "…mais aucun votant n'est nommé",
  );

  const [rLive, live] = await lire(`${C}/matches/match-essai-live`);
  ok(rLive.ok && live.match.status === "LIVE", "le match en cours se lit aussi", live?.match.status);

  const [rFantome] = await lire(`${C}/matches/zzz-inexistant`);
  ok(rFantome.status === 404, "un match inexistant : 404", `HTTP ${rFantome.status}`);
  const [rSale] = await lire(`${C}/matches/${encodeURIComponent('{"in":["x"]}')}`);
  ok(
    rSale.status === 404,
    "un identifiant qui n'en est pas un est rejeté avant Prisma",
    `HTTP ${rSale.status}`,
  );

  // --- 3. La compo préparée --------------------------------------------------

  console.log("\n— la compo préparée d'une soirée —");
  const [rC, compo] = await lire(`${C}/matchdays/soiree-essai/lineup`);
  ok(rC.ok, "GET matchdays/[id]/lineup répond", `HTTP ${rC.status}`);
  ok(compo.lineup.length === 12, "les douze joueurs de la compo", `${compo.lineup.length}`);
  ok(
    compo.lineup.filter((l) => l.team === "A").length === 6,
    "six d'un côté, six de l'autre",
  );
  ok(compo.lineup.filter((l) => l.isGk).length === 2, "deux gardiens");
  ok(
    compo.matchDay.teamAName === "Blanc" && compo.matchDay.teamBName === "Noir",
    "les noms d'équipes de la soirée voyagent avec elle",
    `${compo.matchDay.teamAName} / ${compo.matchDay.teamBName}`,
  );
  ok(compo.matchDay.canceled === false, "la soirée n'est pas annulée");

  const [rSoireeFantome] = await lire(`${C}/matchdays/zzz-inexistant/lineup`);
  ok(rSoireeFantome.status === 404, "une soirée inexistante : 404", `HTTP ${rSoireeFantome.status}`);

  // --- 3 bis. Le vestiaire et la fiche d'un joueur ---------------------------

  console.log("\n— l'effectif —");
  const [rEff, eff] = await lire(`${C}/effectif`);
  ok(rEff.ok, "GET effectif répond", `HTTP ${rEff.status}`);
  ok(eff.joueurs.length === 12, "les douze du vestiaire", `${eff.joueurs.length}`);
  ok(eff.sousTitre === "12 joueurs au vestiaire", "le sous-titre arrive fait", eff.sousTitre);
  ok(
    eff.joueurs.every((j) => j.initiales && j.initiales.length <= 2),
    "chaque fiche porte ses initiales, calculées par le serveur",
  );
  ok(
    !("userId" in (eff.joueurs[0] ?? {})),
    "aucun identifiant de compte ne fuit — estMoi et compteLie suffisent",
  );
  ok(
    eff.joueurs.filter((j) => j.estMoi).length === 1,
    "une seule fiche est la mienne",
    `${eff.joueurs.filter((j) => j.estMoi).length}`,
  );

  console.log("\n— la fiche d'un joueur —");
  const [rJ, fj] = await lire(`${C}/joueurs/joueur-essai-1`);
  ok(rJ.ok, "GET joueurs/[id] répond", `HTTP ${rJ.status}`);
  ok(fj.joueur.id === "joueur-essai-1", "c'est bien lui", fj.joueur.id);
  ok(
    /Niveau 3/.test(fj.joueur.sousTitre),
    "le sous-titre est assemblé côté serveur",
    fj.joueur.sousTitre,
  );
  ok(
    fj.joueur.camp === null || fj.joueur.couleur.startsWith("#"),
    "la couleur de la chasuble habituelle voyage avec la fiche",
    `${fj.joueur.camp} ${fj.joueur.couleur}`,
  );
  ok(
    fj.derniersMatchs.every(
      (m) => typeof m.date === "string" && !m.date.includes("T"),
    ),
    "les dates des derniers matchs sont déjà écrites en français",
    fj.derniersMatchs[0]?.date ?? "aucun",
  );
  ok(
    fj.derniersMatchs.every((m) => Number.isInteger(m.scoreA) && Number.isInteger(m.scoreB)),
    "les deux scores sont séparés — l'app ne découpe pas « 2-1 »",
  );
  ok(
    fj.paliers.every((pa) => pa.part >= 0 && pa.part <= 1 && pa.libelle.startsWith("encore ")),
    "chaque palier porte sa phrase et sa part de barre",
    fj.paliers[0]?.libelle ?? "aucun",
  );
  const [rJFantome] = await lire(`${C}/joueurs/joueur-qui-nexiste-pas`);
  ok(rJFantome.status === 404, "un joueur inconnu : 404", `HTTP ${rJFantome.status}`);

  console.log("\n— « je viens tous les lundis » —");
  const abonneAvant = fj.joueur.abonne;
  const poser = (valeur) =>
    fetch(`${BASE}${C}/joueurs/joueur-essai-1/abonnement`, {
      method: "POST",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ abonne: valeur }),
    });
  const rBascule = await poser(!abonneAvant);
  ok(rBascule.ok, "la bascule est acceptée", `HTTP ${rBascule.status}`);
  const [, fjApres] = await lire(`${C}/joueurs/joueur-essai-1`);
  ok(
    fjApres.joueur.abonne === !abonneAvant,
    "…et la fiche relue le confirme",
    `${abonneAvant} → ${fjApres.joueur.abonne}`,
  );
  await poser(abonneAvant); // on laisse le jeu d'essai comme on l'a trouvé
  const rMauvais = await fetch(`${BASE}${C}/joueurs/joueur-essai-1/abonnement`, {
    method: "POST",
    headers: { ...h, "content-type": "application/json" },
    body: JSON.stringify({ abonne: "oui" }),
  });
  ok(rMauvais.status === 400, "une valeur qui n'est pas un booléen : 400", `HTTP ${rMauvais.status}`);

  // --- 4. Qui n'a rien à y faire ---------------------------------------------

  const CHEMINS = [
    `${C}/matches`,
    `${C}/matches/match-essai-fini`,
    `${C}/matchdays/soiree-essai/lineup`,
    `${C}/effectif`,
    `${C}/joueurs/joueur-essai-1`,
  ];
  const nom = (c) => c.split("/").slice(4).join("/");

  // Sans cookie, la réponse ne vient même pas du handler : `middleware.ts`
  // rend 401 pour tout `/api/clubs/**` sans cookie de session. C'est le
  // contrat que l'app connaît déjà (`SessionExpiree` sur 401, lib/appel.ts).
  console.log("\n— sans cookie —");
  for (const chemin of CHEMINS) {
    const res = await fetch(`${BASE}${chemin}`, { headers: { origin: ORIGINE } });
    ok(res.status === 401, `anonyme sur ${nom(chemin)} : 401`, `HTTP ${res.status}`);
  }

  // Connecté, mais étranger au club : là, le handler répond — et il doit dire
  // « introuvable », pas « interdit ». « Interdit » confirmerait l'existence du
  // club à qui devine un identifiant.
  console.log("\n— connecté, mais pas membre —");
  const intrus = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGINE },
    body: JSON.stringify({
      email: process.env.INTRUS ?? "intrus@five.local",
      password: MOT_DE_PASSE,
    }),
  });
  ok(intrus.ok, "le second compte se connecte", `HTTP ${intrus.status}`);
  if (intrus.ok) {
    const cIntrus = cookies(intrus);
    for (const chemin of CHEMINS) {
      const res = await fetch(`${BASE}${chemin}`, {
        headers: { cookie: cIntrus, origin: ORIGINE },
      });
      ok(res.status === 404, `${nom(chemin)} : 404, pas 403`, `HTTP ${res.status}`);
    }
  }

  console.log(rates === 0 ? "\nTOUT VERT" : `\n${rates} ÉCHEC(S)`);
  process.exitCode = rates === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
