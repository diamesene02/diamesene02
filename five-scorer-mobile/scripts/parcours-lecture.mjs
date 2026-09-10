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
  // Au moins les douze du jeu d'essai, et le compte relatif plutôt qu'un
  // nombre en dur : ce parcours crée des fiches témoins plus bas, et un
  // `=== 12` tombait au deuxième passage — un test qui ne passe qu'une fois
  // n'est pas un test.
  //
  // `actifs` n'est PAS `joueurs.length` : la réponse porte aussi les archivés,
  // par conception — l'écran doit pouvoir les montrer pour les faire revenir
  // sans redemander au serveur.
  ok(eff.joueurs.length >= 12, "au moins les douze du vestiaire", `${eff.joueurs.length}`);
  ok(
    eff.sousTitre === `${eff.actifs} joueur${eff.actifs > 1 ? "s" : ""} au vestiaire`,
    "le sous-titre arrive fait",
    eff.sousTitre,
  );
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

  // --- 3 bis². Ajouter et modifier une fiche ---------------------------------
  //
  // Le formulaire du vestiaire. Ce qui compte ici n'est pas « le POST répond
  // 200 » : c'est qu'un second envoi du MÊME identifiant n'inscrive pas un
  // second joueur — le geste réel étant un pouce qui retape « Enregistrer »
  // quand la réponse tarde, au bord d'un terrain.

  console.log("\n— ajouter un joueur —");
  const envoyer = (chemin, methode, corps) =>
    fetch(`${BASE}${chemin}`, {
      method: methode,
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  const neuf = `joueur-essai-neuf-${Date.now().toString(36)}`;
  const fiche = {
    id: neuf,
    nom: "  Mamadou Ndiaye  ",
    surnom: "Mams",
    niveau: 9,
    gardien: true,
  };
  const rNeuf = await envoyer(`${C}/joueurs`, "POST", fiche);
  const corpsNeuf = rNeuf.ok ? await rNeuf.json() : null;
  ok(rNeuf.ok, "POST joueurs crée la fiche", `HTTP ${rNeuf.status}`);
  ok(corpsNeuf?.joueurId === neuf, "l'identifiant du téléphone est celui de la base", corpsNeuf?.joueurId);
  ok(corpsNeuf?.initiales === "MN", "les initiales reviennent avec la réponse", corpsNeuf?.initiales);

  const [, apresNeuf] = await lire(`${C}/effectif`);
  const lui = apresNeuf.joueurs.find((j) => j.id === neuf);
  ok(Boolean(lui), "il est au vestiaire", lui?.nom);
  ok(lui?.nom === "Mamadou Ndiaye", "le nom est ébarbé", JSON.stringify(lui?.nom));
  ok(lui?.niveau === 5, "un niveau 9 est ramené à 5", String(lui?.niveau));
  ok(lui?.gardien === true, "gardien, comme demandé");

  const rRejeu = await envoyer(`${C}/joueurs`, "POST", fiche);
  const corpsRejeu = rRejeu.ok ? await rRejeu.json() : null;
  ok(rRejeu.ok && corpsRejeu?.rejeu === true, "le MÊME identifiant renvoyé n'est pas une seconde création", `HTTP ${rRejeu.status}`);
  const [, apresRejeu] = await lire(`${C}/effectif`);
  const mamadous = apresRejeu.joueurs.filter((j) => j.nom === "Mamadou Ndiaye" && !j.archive);
  ok(
    mamadous.length === 1,
    "…et le vestiaire n'a qu'un Mamadou",
    String(mamadous.length),
  );

  const rSansNom = await envoyer(`${C}/joueurs`, "POST", { surnom: "Personne" });
  ok(rSansNom.status === 400, "une fiche sans nom : 400", `HTTP ${rSansNom.status}`);
  const rIdTordu = await envoyer(`${C}/joueurs`, "POST", { id: { in: ["x"] }, nom: "Filtre" });
  ok(rIdTordu.status === 400, "un identifiant qui est un objet : 400, pas un filtre Prisma", `HTTP ${rIdTordu.status}`);

  console.log("\n— modifier une fiche —");
  const rPatch = await envoyer(`${C}/joueurs/${neuf}`, "PATCH", { surnom: "Mams le mur", niveau: 2 });
  ok(rPatch.ok, "PATCH joueurs/[id] répond", `HTTP ${rPatch.status}`);
  const [, ficheApres] = await lire(`${C}/joueurs/${neuf}`);
  ok(ficheApres.joueur.surnom === "Mams le mur", "le surnom a changé", ficheApres.joueur.surnom);
  ok(ficheApres.joueur.niveau === 2, "le niveau aussi", String(ficheApres.joueur.niveau));
  ok(ficheApres.joueur.nom === "Mamadou Ndiaye", "…et le nom, qu'on n'a pas envoyé, n'a pas bougé", ficheApres.joueur.nom);
  ok(ficheApres.joueur.estGardien === true, "…ni le fait qu'il garde");

  const rNomVide = await envoyer(`${C}/joueurs/${neuf}`, "PATCH", { nom: "   " });
  ok(rNomVide.status === 400, "un nom effacé par mégarde : 400, pas un silence", `HTTP ${rNomVide.status}`);
  const rPhotoTordue = await envoyer(`${C}/joueurs/${neuf}`, "PATCH", { photo: "data:image/svg+xml,<svg/>" });
  const [, apresPhoto] = await lire(`${C}/joueurs/${neuf}`);
  ok(
    rPhotoTordue.ok && apresPhoto.joueur.photo === null,
    "une photo qui n'est pas un JPEG en data-URL n'entre pas en base",
    JSON.stringify(apresPhoto.joueur.photo),
  );
  const rAbonneParPatch = await envoyer(`${C}/joueurs/${neuf}`, "PATCH", { abonne: true });
  const [, apresAbo] = await lire(`${C}/joueurs/${neuf}`);
  ok(
    rAbonneParPatch.status === 400 && apresAbo.joueur.abonne === false,
    "« je viens tous les lundis » ne se règle pas par ce PATCH — il a son endpoint, et le refus est DIT",
    `HTTP ${rAbonneParPatch.status}, abonne=${apresAbo.joueur.abonne}`,
  );
  const rVide = await envoyer(`${C}/joueurs/${neuf}`, "PATCH", {});
  ok(
    rVide.status === 400,
    "un corps sans rien d'écrivable : 400, jamais le 404 qui ferait croire à une fiche disparue",
    `HTTP ${rVide.status}`,
  );

  console.log("\n— archiver, puis faire revenir —");
  const rArchive = await envoyer(`${C}/joueurs/${neuf}`, "PATCH", { archive: true });
  const [, apresArchive] = await lire(`${C}/effectif`);
  ok(
    rArchive.ok && apresArchive.joueurs.find((j) => j.id === neuf)?.archive === true,
    "archivé, et toujours dans la réponse pour pouvoir revenir",
  );
  ok(
    apresArchive.actifs === apresNeuf.actifs - 1,
    "le compte du vestiaire le retire",
    `${apresNeuf.actifs} → ${apresArchive.actifs}`,
  );
  const rRetour = await envoyer(`${C}/joueurs/${neuf}`, "PATCH", { archive: false });
  const [, apresRetour] = await lire(`${C}/effectif`);
  ok(
    rRetour.ok && apresRetour.actifs === apresNeuf.actifs,
    "…et il revient au complet",
    `${apresArchive.actifs} → ${apresRetour.actifs}`,
  );
  const rArchiveTordue = await envoyer(`${C}/joueurs/${neuf}`, "PATCH", { archive: "oui" });
  ok(rArchiveTordue.status === 400, "une valeur d'archivage qui n'est pas un booléen : 400", `HTTP ${rArchiveTordue.status}`);
  const rPatchFantome = await envoyer(`${C}/joueurs/joueur-qui-nexiste-pas`, "PATCH", { niveau: 4 });
  ok(rPatchFantome.status === 404, "modifier un joueur inconnu : 404", `HTTP ${rPatchFantome.status}`);
  // On laisse la scène comme on l'a trouvée : la fiche d'essai repart au fond
  // du vestiaire. `jeu-dessai.mjs` la supprime au prochain passage.
  await envoyer(`${C}/joueurs/${neuf}`, "PATCH", { archive: true });

  // --- 3 ter. L'écran des stats ----------------------------------------------

  console.log("\n— les stats —");
  const [rSt, st] = await lire(`${C}/stats`);
  ok(rSt.ok, "GET stats répond", `HTTP ${rSt.status}`);
  ok(
    st.saisons.choix.at(-1)?.id === "all",
    "« Toutes saisons » ferme toujours la liste",
    st.saisons.choix.map((c) => c.libelle).join(" / "),
  );
  ok(
    st.tableau.every((l, i) => l.rang === i + 1),
    "le tableau arrive DÉJÀ trié, rangs à l'appui",
  );
  ok(
    st.tableau.every((l, i, a) => i === 0 || a[i - 1].points >= l.points),
    "…et il est trié aux POINTS, pas aux buts",
    st.tableau.slice(0, 3).map((l) => `${l.nom} ${l.points}`).join(" / "),
  );
  ok(
    st.tableau.every((l) => l.camp === null || l.camp === "A" || l.camp === "B"),
    "chaque ligne porte un CAMP, pas une couleur — l'anneau se peint avec le thème",
  );
  ok(
    st.buteurs.every((b, i, a) => i === 0 || a[i - 1].buts >= b.buts),
    "les buteurs vont du plus prolifique au moins",
  );
  ok(
    st.buteurs.length === 0 || st.buteurs[0].part === 1,
    "la barre du premier buteur est pleine",
    `${st.buteurs[0]?.part}`,
  );
  ok(
    st.forme.length === st.tableau.length &&
      st.forme.every((f, i) => f.playerId === st.tableau[i].playerId),
    "la forme suit l'ordre du tableau — chacun à la même place d'un onglet à l'autre",
  );
  ok(
    st.forme.every((f) => f.forme.every((r) => "WDL".includes(r))),
    "la forme ne contient que des V, N et D",
  );
  ok(
    st.records.lignes.every((r) => r.titre && r.valeur && r.contexte),
    "chaque record arrive avec sa phrase toute faite",
    `${st.records.lignes.length} record(s)`,
  );

  const [, stTout] = await lire(`${C}/stats?saison=all`);
  ok(stTout.saisons.choisie === "all", "on peut demander toutes les saisons");
  ok(
    stTout.tableau.length >= st.tableau.length,
    "…et il y a au moins autant de monde qu'en une seule",
    `${st.tableau.length} → ${stTout.tableau.length}`,
  );
  // Une saison qu'on ne connaît pas ne doit pas casser l'écran : elle retombe
  // sur la saison en cours. Un lien périmé arrive par WhatsApp, pas par un
  // attaquant.
  const [rBidon, bidon] = await lire(`${C}/stats?saison=saison-qui-nexiste-pas`);
  ok(rBidon.ok && bidon.saisons.choisie !== "saison-qui-nexiste-pas",
    "une saison inconnue retombe sur celle en cours, sans erreur",
    bidon.saisons.choisie);

  // --- 3 quater. La saison et les réglages -----------------------------------

  console.log("\n— la saison —");
  const [rSa, sa] = await lire(`${C}/saison`);
  ok(rSa.ok, "GET saison répond", `HTTP ${rSa.status}`);
  ok(
    typeof sa.sousTitre === "string" && /soirée/.test(sa.sousTitre),
    "le sous-titre arrive écrit",
    sa.sousTitre,
  );
  ok(
    sa.calendrier.groupes.every((g) => g.titre && Array.isArray(g.entrees)),
    "le calendrier est groupé par mois",
    `${sa.calendrier.groupes.length} mois`,
  );
  const toutesEntrees = sa.calendrier.groupes.flatMap((g) => g.entrees);
  ok(
    toutesEntrees.every((e) => ["direct", "appel", "muet", "neutre"].includes(e.ton)),
    "chaque rangée porte un TON, pas une couleur",
  );
  ok(
    toutesEntrees.every((e) => ["soiree", "match", "saisir"].includes(e.cible.quoi)),
    "chaque rangée sait où elle mène",
  );
  // Une soirée passée sans feuille, encore rattrapable, doit appeler la saisie
  // AVEC sa date : sinon le match saisi se date d'aujourd'hui et fausse le
  // classement de la semaine.
  const aSaisir = toutesEntrees.filter((e) => e.cible.quoi === "saisir");
  ok(
    aSaisir.every((e) => typeof e.cible.date === "string" && e.etiquette === "Saisir"),
    "« Saisir » emporte la date du lundi concerné",
    `${aSaisir.length} à rattraper`,
  );
  ok(
    sa.adversaires.lignes.length === 0 || sa.adversaires.lignes[0].rang === 1,
    "le tableau des adversaires est déjà rangé",
  );
  ok(
    /Barème du club/.test(sa.adversaires.note),
    "le barème du club est écrit, pas déduit",
    sa.adversaires.note,
  );
  ok(sa.bilan.chiffres.length === 3, "le bilan a ses trois chiffres");

  console.log("\n— les réglages —");
  const [rRe, re] = await lire(`${C}/reglages`);
  ok(rRe.ok, "GET reglages répond", `HTTP ${rRe.status}`);
  ok(re.choix.pastilles.length === 8, "les huit couleurs viennent du SERVEUR");
  ok(re.choix.formats.length === 5, "les cinq formats aussi");
  ok(
    re.invitation.affiche.length === 8 &&
      re.invitation.affiche === re.invitation.affiche.toUpperCase(),
    "le code d'invitation est montré en huit majuscules",
    re.invitation.affiche,
  );
  // Deux secrets DISTINCTS : un lien iCal finit dans quinze téléphones et
  // circule. S'il portait le code d'invitation, s'y abonner reviendrait à
  // distribuer le droit d'entrer dans le club.
  ok(
    !re.agenda.chemin.includes(re.invitation.code),
    "le jeton d'agenda n'est PAS le code d'invitation",
  );
  ok(
    re.membres.liste.every((m) => typeof m.estOwner === "boolean" && m.roleLibelle),
    "chaque membre porte son rôle en toutes lettres",
    re.membres.sousTitre,
  );

  console.log("\n— écrire un réglage —");
  const dureeAvant = re.club.dureeMatchMin;
  const ecrire = (corps) =>
    fetch(`${BASE}${C}/reglages`, {
      method: "PATCH",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });
  ok((await ecrire({ matchDurationMin: 12 })).ok, "un champ part tout seul");
  const [, re2] = await lire(`${C}/reglages`);
  ok(re2.club.dureeMatchMin === 12, "…et la relecture le confirme", `${re2.club.dureeMatchMin}`);
  // Les bornes sont SERVEUR : l'app peut mettre ce qu'elle veut dans son champ,
  // c'est ici que ça se décide.
  await ecrire({ matchDurationMin: 999 });
  const [, re3] = await lire(`${C}/reglages`);
  ok(re3.club.dureeMatchMin === 120, "999 minutes est ramené à la borne", `${re3.club.dureeMatchMin}`);
  await ecrire({ matchDurationMin: dureeAvant });
  const rCourt = await ecrire({ name: "R" });
  ok(rCourt.status === 400, "un nom d'une lettre est refusé", `HTTP ${rCourt.status}`);

  // Le rôle est validé À L'EXÉCUTION : sans ça, un admin s'envoyait « owner »
  // et devenait indéboulonnable.
  const rRole = await fetch(`${BASE}${C}/membres/faux-identifiant/`.slice(0, -1), {
    method: "PATCH",
    headers: { ...h, "content-type": "application/json" },
    body: JSON.stringify({ role: "owner" }),
  });
  ok(rRole.status === 400, "« owner » n'est pas un rôle qu'on s'attribue", `HTTP ${rRole.status}`);

  // --- 4. Qui n'a rien à y faire ---------------------------------------------

  const CHEMINS = [
    `${C}/matches`,
    `${C}/matches/match-essai-fini`,
    `${C}/matchdays/soiree-essai/lineup`,
    `${C}/effectif`,
    `${C}/joueurs/joueur-essai-1`,
    `${C}/stats`,
    `${C}/saison`,
    `${C}/reglages`,
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
    // Écrire dans le vestiaire d'un club dont on n'est pas membre : même
    // règle, et il ne suffit pas qu'un GET soit gardé — c'est le POST qui
    // ajoute une ligne en base.
    const rPostIntrus = await fetch(`${BASE}${C}/joueurs`, {
      method: "POST",
      headers: { cookie: cIntrus, origin: ORIGINE, "content-type": "application/json" },
      body: JSON.stringify({ nom: "Intrus" }),
    });
    ok(rPostIntrus.status === 404, "POST joueurs par un étranger : 404, pas 403", `HTTP ${rPostIntrus.status}`);
    const rPatchIntrus = await fetch(`${BASE}${C}/joueurs/joueur-essai-1`, {
      method: "PATCH",
      headers: { cookie: cIntrus, origin: ORIGINE, "content-type": "application/json" },
      body: JSON.stringify({ niveau: 1 }),
    });
    ok(rPatchIntrus.status === 404, "PATCH joueurs/[id] par un étranger : 404, pas 403", `HTTP ${rPatchIntrus.status}`);
    const [, intact] = await lire(`${C}/joueurs/joueur-essai-1`);
    ok(intact.joueur.niveau === 3, "…et la fiche visée n'a pas bougé", String(intact.joueur.niveau));
  }

  // --- 3 bis³. « Ce joueur, c'est moi » --------------------------------------
  //
  // Le geste du premier soir : quelqu'un rejoint le club, ouvre l'effectif et
  // revendique sa fiche. Sans lui, un membre voit son propre nom dans la liste
  // sans pouvoir s'y reconnaître — donc sans compter dans les présences, et
  // sans que « ma fiche » veuille dire quoi que ce soit sur son téléphone.
  //
  // On le rejoue avec le compte qui vit vraiment ça : `membre@five.local`,
  // membre ordinaire et sans profil. Le propriétaire du club en a déjà un (le
  // hook de `lib/auth.ts` le lui a fait), et il est admin — il ne rencontrerait
  // aucun des refus qui comptent.

  console.log("\n— « ce joueur, c'est moi » —");
  const membre = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGINE },
    body: JSON.stringify({
      email: process.env.MEMBRE ?? "membre@five.local",
      password: MOT_DE_PASSE,
    }),
  });
  ok(membre.ok, "le membre ordinaire se connecte", `HTTP ${membre.status}`);
  if (membre.ok) {
    const hm = { cookie: cookies(membre), origin: ORIGINE };
    const revendiquer = (joueurId, corps = {}) =>
      fetch(`${BASE}${C}/joueurs/${joueurId}/rattachement`, {
        method: "POST",
        headers: { ...hm, "content-type": "application/json" },
        body: JSON.stringify(corps),
      });
    const effectifDe = async (entetes) => {
      const res = await fetch(`${BASE}${C}/effectif`, { headers: entetes });
      return res.json();
    };

    const avant = await effectifDe(hm);
    ok(
      avant.aDejaUnProfil === false && avant.monJoueurId === null,
      "il arrive sans profil — c'est ce qui fait apparaître le bouton",
      `aDejaUnProfil=${avant.aDejaUnProfil}`,
    );
    ok(
      avant.peutGerer === false,
      "…et il n'est pas gérant : il ne peut revendiquer que pour lui-même",
    );

    // Les refus D'ABORD : une fois le profil pris, `aDejaUnProfil` change et
    // la scène n'est plus la même. Un invité ne se revendique pas — il n'a pas
    // de compte à lui, et le laisser faire supprimerait la seule chose qui
    // distingue un invité d'un membre.
    const rInvite = await envoyer(`${C}/joueurs`, "POST", {
      id: `joueur-essai-neuf-invite-${Date.now().toString(36)}`,
      nom: "Invité d'un soir",
      invite: true,
    });
    const { joueurId: idInvite } = await rInvite.json();
    const rRevInvite = await revendiquer(idInvite);
    ok(rRevInvite.status === 409, "un invité ne se revendique pas : 409", `HTTP ${rRevInvite.status}`);
    ok(
      (await rRevInvite.json()).error === "Un invité ne peut pas être revendiqué.",
      "…et le refus est écrit en français, prêt à afficher",
    );

    // Un archivé non plus : il a quitté le club, le reprendre le ferait
    // réapparaître dans les compositions par un chemin détourné.
    await envoyer(`${C}/joueurs/${idInvite}`, "PATCH", { invite: false, archive: true });
    const rRevArchive = await revendiquer(idInvite);
    ok(rRevArchive.status === 409, "un archivé non plus : 409", `HTTP ${rRevArchive.status}`);

    // Le profil du propriétaire est pris. Un membre ordinaire ne peut pas le
    // lui retirer : c'est un arbitrage, il revient aux gérants.
    const monProfilDuChef = avant.joueurs.find((j) => j.compteLie);
    const rRevPris = await revendiquer(monProfilDuChef.id);
    ok(
      rRevPris.status === 409,
      "un profil déjà pris : 409, et pas en douce",
      `HTTP ${rRevPris.status}`,
    );

    // Revendiquer POUR QUELQU'UN D'AUTRE est réservé aux gérants. Sans ce
    // contrôle, n'importe quel membre pourrait attribuer les fiches du club.
    const rPourUnTiers = await revendiquer("joueur-essai-2", { userId: "un-autre-compte" });
    ok(
      rPourUnTiers.status === 403,
      "revendiquer pour un tiers : 403, réservé aux admins",
      `HTTP ${rPourUnTiers.status}`,
    );
    const rIdObjet = await revendiquer("joueur-essai-2", { userId: { in: ["a", "b"] } });
    ok(
      rIdObjet.status === 400,
      "un identifiant qui est un objet : 400, pas un filtre Prisma",
      `HTTP ${rIdObjet.status}`,
    );
    const rFantome = await revendiquer("joueur-qui-nexiste-pas");
    ok(rFantome.status === 404, "un joueur inconnu : 404", `HTTP ${rFantome.status}`);

    // Et enfin le geste lui-même.
    const rPris = await revendiquer("joueur-essai-2");
    ok(rPris.ok, "« c'est moi » sur une fiche libre : accepté", `HTTP ${rPris.status}`);
    const apres = await effectifDe(hm);
    const sien = apres.joueurs.find((j) => j.id === "joueur-essai-2");
    ok(apres.aDejaUnProfil === true, "…il a maintenant un profil");
    ok(apres.monJoueurId === "joueur-essai-2", "…et c'est celui-là", apres.monJoueurId);
    ok(sien.estMoi === true && sien.compteLie === true, "…la rangée le dit des deux façons");
    ok(
      apres.joueurs.filter((j) => j.estMoi).length === 1,
      "un compte, un seul profil dans ce club",
    );

    // Un compte = un profil : en revendiquer un second doit DÉPLACER le
    // rattachement, pas en ajouter un. C'est la transaction qui délie puis
    // relie, et c'est le seul endroit du portage où un commit à moitié fait
    // laisserait quelqu'un sans fiche.
    const rDeplace = await revendiquer("joueur-essai-3");
    ok(rDeplace.ok, "revendiquer une seconde fiche : accepté", `HTTP ${rDeplace.status}`);
    const apres2 = await effectifDe(hm);
    ok(
      apres2.monJoueurId === "joueur-essai-3" &&
        apres2.joueurs.filter((j) => j.estMoi).length === 1,
      "…le rattachement a été DÉPLACÉ, pas dupliqué",
      apres2.monJoueurId,
    );
    ok(
      apres2.joueurs.find((j) => j.id === "joueur-essai-2").compteLie === false,
      "…et la première fiche est redevenue libre",
    );

    // Un gérant, lui, tranche : il peut reprendre un profil déjà pris. C'est
    // le seul recours quand deux personnes se sont réclamées de la même fiche.
    // Et c'est aussi ce qui REMET LA SCÈNE EN ÉTAT : le membre repart sans
    // profil, donc ce parcours se rejoue sans repeupler la base.
    const rArbitrage = await envoyer(`${C}/joueurs/joueur-essai-3/rattachement`, "POST", {});
    ok(rArbitrage.ok, "un gérant reprend un profil pris : accepté", `HTTP ${rArbitrage.status}`);
    const rendu = await effectifDe(hm);
    ok(
      rendu.aDejaUnProfil === false,
      "…et le membre se retrouve sans profil, comme avant",
      `monJoueurId=${rendu.monJoueurId}`,
    );
    await envoyer(`${C}/joueurs/${monProfilDuChef.id}/rattachement`, "POST", {});
    const [, remis] = await lire(`${C}/effectif`);
    ok(
      remis.monJoueurId === monProfilDuChef.id &&
        remis.joueurs.filter((j) => j.compteLie).length === 1,
      "…le gérant est revenu sur sa propre fiche, le vestiaire est comme au début",
      remis.monJoueurId,
    );

    // Un étranger au club, comme partout ailleurs : 404, jamais 403.
    if (intrus.ok) {
      const rIntrus = await fetch(`${BASE}${C}/joueurs/joueur-essai-4/rattachement`, {
        method: "POST",
        headers: { cookie: cookies(intrus), origin: ORIGINE, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      ok(
        rIntrus.status === 404,
        "rattachement par un étranger : 404, pas 403",
        `HTTP ${rIntrus.status}`,
      );
      const [, libre] = await lire(`${C}/joueurs/joueur-essai-4`);
      ok(libre.joueur.estMoi === false, "…et la fiche visée n'a bougé pour personne");
    }
  }


  // --- 3 bis⁴. Rejoindre un club --------------------------------------------
  //
  // Le geste d'AVANT tous les autres : sans lui, quelqu'un qui installe l'app
  // et se crée un compte arrive sur une liste de clubs vide, sans un seul
  // bouton pour en sortir. C'est le seul mur de l'app qui n'avait aucun
  // contournement — tous les autres écrans manquants laissaient au moins le
  // site accessible depuis un ordinateur.
  //
  // Cette section vient EN DERNIER exprès : elle fait entrer des comptes dans
  // le club, et les vérifications « un étranger reçoit 404 » ci-dessus
  // tomberaient si l'étranger était devenu membre avant elles.
  //
  // Chaque exécution fabrique ses propres comptes (horodatés) : le parcours se
  // relance sans repeupler et reste vert, ce qui ne serait pas le cas si on
  // réutilisait un compte déjà entré au tour précédent.

  console.log("\n— rejoindre un club —");

  const marque = Date.now().toString(36);

  // Le capitaine lit le code dans ses réglages : c'est le vrai chemin, celui
  // que l'écran des réglages de l'app affiche déjà.
  const [rReg, reg] = await lire(`${C}/reglages`);
  ok(rReg.ok && typeof reg?.invitation?.code === "string", "le capitaine lit le code d'invitation", `HTTP ${rReg.status}`);
  const code = reg?.invitation?.code;
  const lien = `https://five-scorer.vercel.app/join/${code}`;

  // Une fiche libre, au nom accentué, préparée par le capitaine avant que la
  // personne ne s'inscrive : c'est le cas le plus fréquent d'un vrai club, et
  // celui que `assurerProfilJoueur` existe pour rattraper.
  const nomAdopte = `Zoé ${marque}`;
  const idAdopte = `joueur-essai-neuf-adopte-${marque}`;
  const rPrep = await envoyer(`${C}/joueurs`, "POST", { id: idAdopte, nom: nomAdopte });
  ok(rPrep.ok, "le capitaine a préparé une fiche pour quelqu'un qui n'a pas encore de compte", `HTTP ${rPrep.status}`);

  const [, effAvant] = await lire(`${C}/effectif`);
  const combienAvant = effAvant.joueurs.length;

  /// Un compte tout neuf, comme après une installation depuis l'App Store.
  const inscrire = async (nom) => {
    const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGINE },
      body: JSON.stringify({
        email: `nouveau-${nom.replace(/[^a-z0-9]/gi, "").toLowerCase()}@five.local`,
        password: MOT_DE_PASSE,
        name: nom,
      }),
    });
    return [res, cookies(res)];
  };
  const rejoindre = (cookieDuCompte, corps) =>
    fetch(`${BASE}/api/rejoindre`, {
      method: "POST",
      headers: { cookie: cookieDuCompte, origin: ORIGINE, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  /// L'identifiant de la fiche créée pour l'arrivant : le ménage en a besoin.
  let ficheArrivant = null;
  const [rArrivant, cArrivant] = await inscrire(`Nouveau Venu ${marque}`);
  ok(rArrivant.ok, "un compte tout neuf s'inscrit", `HTTP ${rArrivant.status}`);

  if (rArrivant.ok && code) {
    const [, moiVide] = [null, await (await fetch(`${BASE}/api/me`, { headers: { cookie: cArrivant, origin: ORIGINE } })).json()];
    ok(
      moiVide.clubs.length === 0,
      "il n'est dans AUCUN club — c'est le mur qu'on vient d'abattre",
      `${moiVide.clubs.length} club(s)`,
    );

    // Les refus d'abord : une fois membre, la scène n'est plus la même.
    const rAnonyme = await fetch(`${BASE}/api/rejoindre`, {
      method: "POST",
      headers: { origin: ORIGINE, "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    ok(rAnonyme.status === 401, "sans session : 401, on ne rejoint pas anonymement", `HTTP ${rAnonyme.status}`);

    const rInconnu = await rejoindre(cArrivant, { code: "codequinexistepas" });
    ok(rInconnu.status === 404, "un code inconnu : 404, pas 403", `HTTP ${rInconnu.status}`);
    ok(
      (await rInconnu.json()).error === "Code d'invitation invalide.",
      "…et le refus est écrit en français, prêt à afficher",
    );

    // Le bug déjà vécu ici : un objet passé pour un identifiant devient un
    // filtre Prisma. Sur `findUnique({ where: { inviteCode } })`, il ferait
    // entrer dans un club dont on n'a jamais reçu le lien.
    const rObjet = await rejoindre(cArrivant, { code: { not: "" } });
    ok(rObjet.status === 400, "un code qui est un objet : 400, pas un filtre Prisma", `HTTP ${rObjet.status}`);

    const rVide = await rejoindre(cArrivant, {});
    ok(rVide.status === 400, "aucun code du tout : 400", `HTTP ${rVide.status}`);

    // LE cas qui compte : ce qu'on a réellement dans WhatsApp est le LIEN,
    // pas douze caractères qu'on aurait recopiés à la main.
    const rLien = await rejoindre(cArrivant, { code: lien });
    ok(rLien.ok, "le LIEN collé entier fait entrer dans le club", `HTTP ${rLien.status}`);
    const entre = rLien.ok ? await rLien.json() : {};
    ok(entre.dejaMembre === false, "…et c'est bien une première entrée");
    ok(entre.slug === club.slug, "…dans le bon club", entre.nom);

    const [, moiPlein] = [null, await (await fetch(`${BASE}/api/me`, { headers: { cookie: cArrivant, origin: ORIGINE } })).json()];
    ok(moiPlein.clubs.length === 1, "il a maintenant un club, et un seul", `${moiPlein.clubs.length}`);
    ok(
      moiPlein.clubs[0]?.monJoueur != null,
      "…et une fiche joueur, sans quoi il ne compterait dans aucune présence",
      moiPlein.clubs[0]?.monJoueur?.nom,
    );
    ficheArrivant = moiPlein.clubs[0]?.monJoueur?.id ?? null;

    // Rejouer le même lien n'est PAS une erreur : c'est le geste de quelqu'un
    // qui ne sait plus s'il a déjà rejoint. Ce qui serait grave est d'être
    // inscrit deux fois — rien en base ne l'interdit (aucun index unique sur
    // `member`), donc c'est ici que ça se voit.
    const rEncore = await rejoindre(cArrivant, { code });
    ok(rEncore.ok, "le code seul marche aussi, et rejoindre deux fois n'est pas une erreur", `HTTP ${rEncore.status}`);
    ok((await rEncore.json()).dejaMembre === true, "…le serveur le DIT au lieu d'une fausse bienvenue");

    const rMajuscules = await rejoindre(cArrivant, { code: code.toUpperCase() });
    ok(rMajuscules.ok, "le code en MAJUSCULES est accepté : un code se recopie mal", `HTTP ${rMajuscules.status}`);

    const [, moiEncore] = [null, await (await fetch(`${BASE}/api/me`, { headers: { cookie: cArrivant, origin: ORIGINE } })).json()];
    ok(
      moiEncore.clubs.length === 1,
      "…et après trois passages il n'est membre qu'UNE fois",
      `${moiEncore.clubs.length} club(s)`,
    );
  }

  // L'adoption : le nom compte, pas la casse ni les accents. Sans elle, la
  // personne apparaît DEUX fois au vestiaire — la fiche que le capitaine lui
  // avait préparée, et la sienne, vide.
  const [rZoe, cZoe] = await inscrire(`zoe ${marque}`);
  ok(rZoe.ok, "une deuxième personne s'inscrit, du nom d'une fiche déjà là", `HTTP ${rZoe.status}`);
  if (rZoe.ok && code) {
    const rEntree = await rejoindre(cZoe, { code });
    ok(rEntree.ok, "elle rejoint le club", `HTTP ${rEntree.status}`);
    const [, sonMoi] = [null, await (await fetch(`${BASE}/api/me`, { headers: { cookie: cZoe, origin: ORIGINE } })).json()];
    ok(
      sonMoi.clubs[0]?.monJoueur?.id === idAdopte,
      "…et elle ADOPTE la fiche préparée pour elle, malgré la casse et l'accent",
      `${sonMoi.clubs[0]?.monJoueur?.nom} (${sonMoi.clubs[0]?.monJoueur?.id})`,
    );
    const [, effApres] = await lire(`${C}/effectif`);
    ok(
      effApres.joueurs.length === combienAvant + 1,
      "…le vestiaire n'a grossi que d'UNE fiche pour deux arrivées",
      `${combienAvant} → ${effApres.joueurs.length}`,
    );
  }

  // --- Remettre le vestiaire comme on l'a trouvé -----------------------------
  //
  // Cette section fait entrer deux comptes, donc elle laisse deux fiches
  // RATTACHÉES derrière elle. Relancé sans repeupler, le parcours tombait alors
  // sur ses propres traces : « les douze du vestiaire » en voyait quatorze, et
  // « le vestiaire est comme au début » comptait trois comptes liés au lieu
  // d'un. Ce n'était pas un défaut du serveur, c'était le parcours qui salissait
  // derrière lui.
  //
  // On se remet en état par les endpoints de l'app, comme la section
  // précédente : il n'y a pas de « délier » (le site n'en a pas non plus), mais
  // revendiquer DÉPLACE un rattachement — le gérant reprend chaque fiche, puis
  // revient sur la sienne, et les deux fiches sont libres. Ces trois appels
  // sont eux-mêmes une vérification : ils ne peuvent réussir que si
  // l'arbitrage du gérant fonctionne.
  const [, effFin] = await lire(`${C}/effectif`);
  const maFicheDeChef = effFin.monJoueurId;
  const laissees = [idAdopte, ficheArrivant].filter(Boolean);
  for (const id of laissees) {
    await envoyer(`${C}/joueurs/${id}/rattachement`, "POST", {});
  }
  if (maFicheDeChef) {
    await envoyer(`${C}/joueurs/${maFicheDeChef}/rattachement`, "POST", {});
  }
  for (const id of laissees) {
    await envoyer(`${C}/joueurs/${id}`, "PATCH", { archive: true });
  }
  const [, effRendu] = await lire(`${C}/effectif`);
  ok(
    effRendu.actifs === 12,
    "les arrivants rangés : le vestiaire est rendu à ses douze",
    `${effRendu.actifs} actifs`,
  );
  ok(
    effRendu.joueurs.filter((j) => j.compteLie).length === 1,
    "…et un seul compte lié, comme au début",
    `${effRendu.joueurs.filter((j) => j.compteLie).length} lié(s)`,
  );
  console.log(rates === 0 ? "\nTOUT VERT" : `\n${rates} ÉCHEC(S)`);
  process.exitCode = rates === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
