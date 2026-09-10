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
  // `actifs`, pas `joueurs.length` : la réponse porte AUSSI les archivés, par
  // conception — l'écran doit pouvoir les montrer pour les faire revenir sans
  // redemander au serveur. Compter le tableau entier faisait échouer ce test
  // dès la deuxième exécution du parcours, la fiche d'essai de la section
  // « ajouter un joueur » restant archivée au fond du vestiaire.
  ok(eff.actifs === 12, "les douze du vestiaire", `${eff.actifs} actifs sur ${eff.joueurs.length} fiches`);
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

  console.log(rates === 0 ? "\nTOUT VERT" : `\n${rates} ÉCHEC(S)`);
  process.exitCode = rates === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
