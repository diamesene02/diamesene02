// Le parcours de connexion de l'app mobile, rejoué sans téléphone.
//
// Ce que l'app fait vraiment : elle appelle Better Auth depuis une origine
// `exp://` (Expo Go) ou `fivescorer://` (build), garde le cookie de session
// dans le trousseau, puis le rejoue à la main sur chaque appel — il n'y a pas
// de gestionnaire de cookies dans React Native. On reproduit ça exactement.
//
//   node scripts/parcours-connexion.mjs [base]
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const ORIGINE = process.env.ORIGINE ?? "exp://192.168.1.192:8090";
const COURRIEL = process.env.COURRIEL ?? "dev@five.local";
const MOT_DE_PASSE = process.env.MOT_DE_PASSE ?? "demo-five-2026";

let rates = 0;
const ok = (bon, quoi, detail = "") => {
  if (!bon) rates++;
  console.log(`${bon ? "  ok " : "ÉCHEC"}  ${quoi}${detail ? "  — " + detail : ""}`);
};

/// Better Auth renvoie plusieurs `Set-Cookie` ; il faut tous les rejouer, pas
/// seulement le premier (jeton de session + signature).
function cookies(res) {
  const brut = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie")].filter(Boolean);
  return brut.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  console.log(`serveur ${BASE}\norigine ${ORIGINE}\n`);

  const co = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGINE },
    body: JSON.stringify({ email: COURRIEL, password: MOT_DE_PASSE }),
  });
  const corps = await co.text();
  ok(co.status !== 403, "l'origine est acceptée", corps.slice(0, 90));
  ok(co.ok, "la connexion aboutit", `HTTP ${co.status}`);
  if (!co.ok) return;

  const cookie = cookies(co);
  ok(Boolean(cookie), "un cookie de session est délivré", cookie.split("=")[0]);

  const moi = await fetch(`${BASE}/api/me`, { headers: { cookie, origin: ORIGINE } });
  ok(moi.ok, "l'appel authentifié /api/me passe", `HTTP ${moi.status}`);
  if (!moi.ok) return;

  const data = await moi.json();
  ok(Boolean(data.utilisateur?.email), "le serveur me reconnaît", data.utilisateur?.email);
  ok(Array.isArray(data.clubs) && data.clubs.length > 0, "au moins un club", `${data.clubs?.length ?? 0}`);
  const c = data.clubs?.[0];
  if (c) {
    ok(Boolean(c.nom && c.slug), "le club est complet", `${c.nom} (${c.slug})`);
    ok(typeof c.peutScorer === "boolean", "les droits sont calculés côté serveur", `scorer=${c.peutScorer}`);
    ok(Boolean(c.theme), "le thème des chasubles est fourni", `${c.couleurA}/${c.couleurB}`);

    // Le club seul — c'est par là que l'app rafraîchira ses réglages sans
    // repasser par la connexion. Sa forme doit être celle de /api/me, au
    // caractère près : les deux réponses vont dans la même table locale.
    const un = await fetch(`${BASE}/api/clubs/${c.id}`, { headers: { cookie, origin: ORIGINE } });
    const du = un.ok ? (await un.json()).club : null;
    ok(un.ok, "GET /api/clubs/[id] répond", `HTTP ${un.status}`);
    ok(JSON.stringify(du) === JSON.stringify(c), "…dans exactement la forme de /api/me");

    const fantome = await fetch(`${BASE}/api/clubs/zzz-inexistant`, { headers: { cookie, origin: ORIGINE } });
    ok(fantome.status === 404, "un club dont je ne suis pas membre : 404, pas 403", `HTTP ${fantome.status}`);

    const eff = await fetch(`${BASE}/api/clubs/${c.id}/roster`, { headers: { cookie, origin: ORIGINE } });
    const joueurs = eff.ok ? (await eff.json()).players : [];
    ok(eff.ok, "l'effectif répond", `HTTP ${eff.status}`);
    ok(joueurs.length > 0, "l'effectif n'est pas vide", `${joueurs.length} joueurs`);
    ok(joueurs.every((j) => "abonne" in j && "isArchived" in j),
      "chaque joueur porte abonne et isArchived");
    ok(joueurs.every((j) => !("userId" in j)),
      "aucun identifiant de compte n'est exposé");
    ok(joueurs.every((j) => typeof j.estMoi === "boolean" && typeof j.compteLie === "boolean"),
      "…remplacés par estMoi et compteLie",
      `moi=${joueurs.filter((j) => j.estMoi).length} liés=${joueurs.filter((j) => j.compteLie).length}`);
    ok(joueurs.every((j) => !j.isArchived), "par défaut, aucun archivé");

    const tous = await fetch(`${BASE}/api/clubs/${c.id}/roster?archives=1`, { headers: { cookie, origin: ORIGINE } });
    const tj = tous.ok ? (await tous.json()).players : [];
    ok(tous.ok && tj.length >= joueurs.length, "?archives=1 en rend au moins autant", `${tj.length} ≥ ${joueurs.length}`);

    // La vitrine, sur le club qu'on vient de lire — et sans cookie, puisque
    // c'est justement l'écran que voit quelqu'un qui n'a pas de compte.
    const v = await fetch(`${BASE}/api/public/${c.slug}`);
    const dv = v.ok ? await v.json() : null;
    ok(v.ok, "la vitrine publique du club répond", `HTTP ${v.status}`);
    ok(Array.isArray(dv?.classement), "la vitrine porte un classement", `${dv?.classement?.length ?? 0} joueurs`);
  }

  // Sans cookie, le même appel doit être refusé. Un /api/me qui répond à tout
  // le monde, c'est un annuaire ouvert.
  const anonyme = await fetch(`${BASE}/api/me`, { headers: { origin: ORIGINE } });
  ok(anonyme.status === 401, "sans cookie, /api/me refuse", `HTTP ${anonyme.status}`);
}

main()
  .catch((e) => { rates++; console.log("ÉCHEC  " + e.message); })
  .finally(() => {
    console.log(rates === 0 ? "\nParcours complet." : `\n${rates} échec(s).`);
    process.exitCode = rates === 0 ? 0 : 1;
  });
