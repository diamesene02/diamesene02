// Service worker de Five Scorer.
//
// Ce qu'il sait, et que le précédent ignorait :
//
// 1. Une navigation CLIENT de Next (Link, router.push) n'est pas une
//    navigation : c'est un fetch avec l'en-tête RSC. Non intercepté, il
//    échouait lentement hors-ligne, puis Next retombait en navigation dure —
//    vers une URL que personne n'avait jamais mise en cache. Ici, un fetch RSC
//    hors-ligne échoue VITE (503 en 4 s au plus) pour que la navigation dure
//    arrive tout de suite, et la navigation dure a un repli utile.
//
// 2. Un cache par URL ne peut pas servir la page d'un match créé hors-ligne :
//    son URL n'a jamais existé. Le repli, pour tout ce qui ressemble à un
//    match, est la COQUILLE du club (/c/:slug/play), identique pour tous les
//    matchs, pré-cachée à chaque visite en ligne. Elle lit le match dans
//    IndexedDB.
//
// 3. Une réponse REDIRIGÉE mise en cache est inutilisable pour une navigation
//    (le navigateur la refuse). L'ancien repli sur "/" en était une — pour un
//    utilisateur connecté, "/" redirige vers son club. Rien de redirigé n'est
//    jamais stocké, et "/" n'est plus un repli.
//
// 4. Aucun fetch n'attend plus que quelques secondes. En réseau DÉGRADÉ — le
//    vrai cas du gymnase, pire que l'absence de réseau — l'ancienne version
//    laissait un écran noir sans issue.
//
// 5. Le cache porte le numéro du build : un déploiement évince l'ancien.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `fs-${VERSION}`;
const DERNIER_CLUB = "/__dernier-club";

const STATIQUE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/fonts/archivo-var.woff2",
  "/hors-ligne",
];

const DELAI_NAV = 4000;
const DELAI_RSC = 4000;
const DELAI_API = 6000;

function avecDelai(req, ms, init) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(req, Object.assign({}, init, { signal: ctrl.signal })).finally(() =>
    clearTimeout(t),
  );
}

function estHtml(res) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("text/html");
}

/// Ne stocke que ce qui pourra être resservi : une réponse OK, non redirigée.
async function stocker(cle, res) {
  if (!res || !res.ok || res.redirected) return false;
  const cache = await caches.open(CACHE);
  await cache.put(cle, res.clone());
  return true;
}

/// Met en cache les ressources dont une page a besoin pour VIVRE.
///
/// Mettre le HTML en cache ne suffit pas : ses scripts et sa feuille de style
/// sont des fichiers séparés, aux noms hachés par le build. Sans eux, la page
/// arrive hors-ligne mais reste inerte — du texte non hydraté, des boutons
/// morts. Une coquille de match dans cet état ne compte aucun but.
async function precacherRessources(html) {
  const refs = new Set();
  const re = /\/_next\/static\/[A-Za-z0-9._~\/-]+?\.(?:js|css)/g;
  let m;
  while ((m = re.exec(html)) !== null) refs.add(m[0]);
  await Promise.all(
    [...refs].map(async (url) => {
      try {
        if (await caches.match(url)) return;
        // Résolue contre l'origine : une URL relative ne fait pas une Request.
        const abs = new URL(url, self.location.origin).href;
        const res = await avecDelai(new Request(abs), 8000);
        await stocker(url, res);
      } catch {}
    }),
  );
  return refs.size;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      for (const url of STATIQUE) {
        try {
          const res = await avecDelai(new Request(url, { cache: "reload" }), 8000);
          await stocker(url, res);
        } catch {
          // Une ressource manquante ne doit pas empêcher l'installation.
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cles = await caches.keys();
      await Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "PRECACHE" && Array.isArray(msg.urls)) {
    event.waitUntil(
      (async () => {
        for (const brut of msg.urls) {
          // Résolue contre l'origine : la clé de cache doit être la même que
          // celle qu'une navigation produira (le chemin), sans ambiguïté.
          const url = new URL(brut, self.location.origin);
          try {
            const res = await avecDelai(
              new Request(url.href, { credentials: "same-origin", cache: "reload" }),
              8000,
            );
            if (estHtml(res)) {
              const copie = res.clone();
              if (await stocker(url.pathname, res)) {
                await precacherRessources(await copie.text());
              }
            }
          } catch {}
        }
      })(),
    );
  } else if (msg.type === "LAST_CLUB" && typeof msg.slug === "string") {
    event.waitUntil(
      caches
        .open(CACHE)
        .then((c) =>
          c.put(
            DERNIER_CLUB,
            new Response(JSON.stringify({ slug: msg.slug }), {
              headers: { "content-type": "application/json" },
            }),
          ),
        ),
    );
  } else if (msg.type === "PURGE") {
    // Déconnexion : rien de l'utilisateur précédent ne doit rester servable
    // à la personne suivante sur le même appareil.
    event.waitUntil(caches.delete(CACHE));
  }
});

async function dernierClub() {
  const res = await caches.match(DERNIER_CLUB);
  if (!res) return null;
  try {
    return (await res.json()).slug || null;
  } catch {
    return null;
  }
}

/// Le repli d'une navigation qui n'a pas abouti, du plus précis au plus
/// général. Jamais la page vitrine, jamais une réponse redirigée.
async function repli(url) {
  const chemin = url.pathname;
  const club = chemin.match(/^\/c\/([^/]+)(?:\/(.*))?$/);

  // « / » n'est jamais servi depuis le cache quand on connaît un club : cette
  // entrée peut être la page VITRINE, mise en cache du temps où personne
  // n'était connecté. Hors-ligne, elle proposait « Se connecter » à quelqu'un
  // qui l'était déjà, sans aucun moyen d'atteindre son équipe.
  if (!club) {
    const slug = await dernierClub();
    if (slug) {
      const accueil = await caches.match(`/c/${slug}`);
      if (accueil) return accueil;
      const coquille = await caches.match(`/c/${slug}/play`);
      if (coquille) return coquille;
    }
    const exactHorsClub = await caches.match(chemin);
    if (exactHorsClub) return exactHorsClub;
    const horsLigne = await caches.match("/hors-ligne");
    return (
      horsLigne ||
      new Response("Hors-ligne", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }

  const exact = await caches.match(chemin);
  if (exact) return exact;
  if (club) {
    const slug = club[1];
    const reste = club[2] || "";
    const coquille = await caches.match(`/c/${slug}/play`);
    // Tout ce qui est un match retombe sur la coquille : elle lit
    // l'identifiant dans l'URL et le match dans IndexedDB.
    if (reste === "play" || reste.startsWith("matches/")) {
      if (coquille) return coquille;
    }
    const accueil = await caches.match(`/c/${slug}`);
    if (accueil) return accueil;
    if (coquille) return coquille;
  }

  const horsLigne = await caches.match("/hors-ligne");
  if (horsLigne) return horsLigne;
  return new Response("Hors-ligne", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function cacheDabord(req) {
  const enCache = await caches.match(req);
  if (enCache) return enCache;
  try {
    const res = await avecDelai(req, 8000);
    await stocker(req, res);
    return res;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function navigation(req, url) {
  try {
    const res = await avecDelai(req, DELAI_NAV);
    // Une redirection se suit sans se stocker ; une page OK se stocke sous
    // son chemin, sans la query — ainsi /c/x/play?m=… ressert /c/x/play.
    if (res.ok && !res.redirected && estHtml(res)) {
      await stocker(url.pathname, res);
    }
    return res;
  } catch {
    return repli(url);
  }
}

async function rsc(req) {
  try {
    return await avecDelai(req, DELAI_RSC);
  } catch {
    // Échouer VITE : Next retombe alors en navigation dure, que l'on sait
    // servir. Attendre ici, c'était l'écran blanc.
    return new Response("", { status: 503 });
  }
}

async function api(req) {
  try {
    const res = await avecDelai(req, DELAI_API);
    if (res.ok) await stocker(req, res);
    return res;
  } catch {
    const enCache = await caches.match(req);
    if (enCache) return enCache;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const p = url.pathname;
  if (
    p.startsWith("/_next/static/") ||
    p.startsWith("/fonts/") ||
    p.startsWith("/icons/") ||
    p === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheDabord(req));
    return;
  }
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(rsc(req));
    return;
  }
  if (p.startsWith("/api/")) {
    event.respondWith(api(req));
    return;
  }
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(navigation(req, url));
  }
});
