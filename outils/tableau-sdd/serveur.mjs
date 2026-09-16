// Le tableau de bord de la méthode (specs/COMMENT-ON-TRAVAILLE.md), en direct.
//
//   node outils/tableau-sdd/serveur.mjs        # puis http://localhost:4560
//
// Rien n'est stocké : à chaque requête sur /api/etat, il relit specs/ et le
// journal git, et en tire l'état de la base (0000), de chaque lot, et des
// tâches — une tâche est « faite » quand un commit la nomme (« 0001 (tâche 4) »,
// « 0004(phase 3) »), pas quand quelqu'un l'a cochée. Le compteur en tête de
// cas.md est recompté depuis le fichier et le désaccord, s'il y en a un, se
// voit (article VIII : un chiffre recopié se recompte).
//
// Aucune dépendance : http, fs et git (appelé sans shell, arguments fixes).

import http from "node:http";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SPECS = join(RACINE, "specs");
const PORT = Number(process.env.PORT ?? 4560);

const lire = (chemin) => (existsSync(chemin) ? readFileSync(chemin, "utf8") : null);
const sansMd = (s) =>
  s
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/~~/g, "")
    .replace(/\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();

// --- La base : cas.md, recompté depuis le fichier -------------------------

function lireBase() {
  const txt = lire(join(SPECS, "0000-le-club-et-lapp", "cas.md")) ?? "";
  const declares = txt.match(
    /\*\*(\d+) faits · (\d+) partiels · (\d+) absents · (\d+) faux\.\*\*/,
  );
  const totalDeclare = txt.match(/\*\*(\d+) cas\*\*/);

  const cas = {};
  const re = /^### `([^`]+)` — (✔|◐|✗|⚠) (fait|partiel|absent|faux) · \*([^*]+)\*/gm;
  let m;
  while ((m = re.exec(txt))) cas[m[1]] = { statut: m[3], gravite: m[4] };

  const recomptes = { fait: 0, partiel: 0, absent: 0, faux: 0 };
  const gravites = {};
  for (const c of Object.values(cas)) {
    recomptes[c.statut]++;
    gravites[c.gravite] = (gravites[c.gravite] ?? 0) + 1;
  }
  const declare = declares
    ? { fait: +declares[1], partiel: +declares[2], absent: +declares[3], faux: +declares[4] }
    : null;
  const coherent =
    !!declare &&
    declare.fait === recomptes.fait &&
    declare.partiel === recomptes.partiel &&
    declare.absent === recomptes.absent &&
    declare.faux === recomptes.faux;

  return {
    total: Object.keys(cas).length,
    totalDeclare: totalDeclare ? +totalDeclare[1] : null,
    declare,
    recomptes,
    coherent,
    gravites,
    cas,
  };
}

// --- La constitution --------------------------------------------------------

function lireConstitution() {
  const txt = lire(join(SPECS, "CONSTITUTION.md")) ?? "";
  const articles = [];
  const re = /^## ([IVX]+)\. (.+)$/gm;
  let m;
  while ((m = re.exec(txt))) articles.push({ numero: m[1], titre: sansMd(m[2]) });
  const version = txt.match(/\*\*Version\*\* : ([^|]+)\|/);
  return { articles, version: version ? version[1].trim() : null };
}

// --- Le journal git : c'est lui qui dit ce qui est fait -----------------------

function etiqueter(sujet) {
  let lot = null;
  let spec = false;
  let m = sujet.match(/^spec\s+(\d{4})\b/i);
  if (m) {
    lot = m[1];
    spec = true;
  }
  if (!lot) {
    m = sujet.match(/^(\d{4})\b/);
    if (m) lot = m[1];
  }
  if (!lot) {
    m = sujet.match(/^[\w-]+\((\d{4})\)/);
    if (m) lot = m[1];
  }
  const taches = [];
  if (lot && !spec) {
    const re = /(?:tâche|phase)s?\s*(\d+)(?:\s*(?:et|,|&)\s*(\d+))?/gi;
    let r;
    while ((r = re.exec(sujet))) {
      taches.push(+r[1]);
      if (r[2]) taches.push(+r[2]);
    }
  }
  const livraison = /TOUT VERT|tâches sont faites|\blivré\b/i.test(sujet);
  return { lot, spec, taches, livraison };
}

function lireCommits() {
  const r = spawnSync("git", ["log", "--format=%h|%aI|%s", "-300"], {
    cwd: RACINE,
    encoding: "utf8",
  });
  if (r.status !== 0 || !r.stdout) return [];
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((ligne) => {
      const [h, date, ...reste] = ligne.split("|");
      const sujet = reste.join("|");
      return { h, date, sujet, ...etiqueter(sujet) };
    });
}

// --- Les lots : un dossier specs/NNNN-* chacun -------------------------------

function lireTaches(txt) {
  const taches = [];
  const re = /^## (?:(\d+)\.|Phase (\d+) —)\s*(.+)$/gm;
  let m;
  while ((m = re.exec(txt))) {
    const numero = +(m[1] ?? m[2]);
    const brut = m[3];
    taches.push({
      numero,
      titre: sansMd(brut).replace(/\s+—\s+tranché.*$/i, "").trim(),
      tranchee: /~~/.test(brut),
    });
  }
  return taches;
}

function lireCasCites(txt) {
  const debut = txt.indexOf("## Les cas de la base que ce lot referme");
  if (debut < 0) return [];
  let section = txt.slice(debut + 40);
  const fin = section.search(/\n## /);
  if (fin >= 0) section = section.slice(0, fin);
  // Ce que le lot écarte explicitement n'est pas ce qu'il referme.
  const coupe = section.search(/\*\*(Explicitement|Retiré de cette liste|Hors lot)/i);
  if (coupe >= 0) section = section.slice(0, coupe);
  return [...new Set([...section.matchAll(/`([A-Z]{2,}-[A-Z]?\d+)`/g)].map((x) => x[1]))];
}

function lireEtat(txt) {
  const ligne = txt.split("\n").find((l) => /^\*État\s*:/.test(l));
  if (!ligne) return null;
  let s = ligne.replace(/^\*État\s*:\s*/, "");
  s = s.split(" · ")[0];
  s = s.split(/\.\s/)[0];
  return sansMd(s).replace(/\.$/, "");
}

function lireLots(base, commits) {
  const dossiers = readdirSync(SPECS)
    .filter((d) => /^\d{4}-/.test(d))
    .sort();
  return dossiers.map((dossier) => {
    const numero = dossier.slice(0, 4);
    const chemin = join(SPECS, dossier);
    const spec = lire(join(chemin, "spec.md")) ?? "";
    const plan = lire(join(chemin, "plan.md"));
    const tachesTxt = lire(join(chemin, "taches.md"));
    const journal = lire(join(chemin, "journal.md"));

    const titre = sansMd((spec.split("\n")[0] ?? "").replace(/^#\s*\d{4}\s*—\s*/, ""));
    const etat = lireEtat(spec);
    const questionsOuvertes = (spec.match(/^- \*\*Q\d+\./gm) ?? []).length;

    const siens = commits.filter((c) => c.lot === numero);
    const commitsCode = siens.filter((c) => !c.spec);
    const commitsSpec = siens.filter((c) => c.spec);

    const taches = tachesTxt ? lireTaches(tachesTxt) : [];
    for (const t of taches) {
      const c = commitsCode.find((x) => x.taches.includes(t.numero));
      t.faite = !!c;
      t.commit = c ? { h: c.h, date: c.date, sujet: c.sujet } : null;
    }

    const cites = lireCasCites(spec).map((id) => ({
      id,
      statut: base.cas[id]?.statut ?? "inconnu",
      gravite: base.cas[id]?.gravite ?? null,
    }));
    const casFaits = cites.filter((c) => c.statut === "fait").length;

    const livraison = commitsCode.find((c) => c.livraison) ?? null;
    const tachesFaites = taches.filter((t) => t.faite || t.tranchee).length;
    const livre =
      !!livraison ||
      (taches.length > 0 && tachesFaites === taches.length) ||
      (taches.length === 0 && commitsCode.length > 0 && cites.length > 0 && casFaits === cites.length);

    const clarifie = /analyser|clarifier|prête pour le plan|prêt/i.test(etat ?? "") || !!plan;

    return {
      numero,
      dossier,
      titre,
      etat,
      questionsOuvertes,
      fichiers: { spec: !!spec, plan: !!plan, taches: !!tachesTxt, journal: !!journal },
      etapes: {
        spec: !!spec,
        clarifie,
        plan: !!plan,
        taches: !!tachesTxt,
        code: commitsCode.length > 0,
        livre,
      },
      taches,
      tachesFaites,
      cites,
      casFaits,
      commits: { spec: commitsSpec.length, code: commitsCode.length, dernier: siens[0] ?? null },
      livraison,
    };
  });
}

// --- L'état complet ---------------------------------------------------------

function etat() {
  const base = lireBase();
  const commits = lireCommits();
  const lots = lireLots(base, commits);
  const { cas, ...baseSansCas } = base;
  return {
    genereLe: new Date().toISOString(),
    base: baseSansCas,
    constitution: lireConstitution(),
    lots,
    commits: commits.slice(0, 40).map(({ h, date, sujet, lot, spec, taches }) => ({
      h,
      date,
      sujet,
      lot,
      spec,
      taches,
    })),
  };
}

// --- Le serveur --------------------------------------------------------------

const PAGE = join(ICI, "index.html");

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/api/etat") {
      let corps;
      try {
        corps = JSON.stringify(etat());
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ erreur: String(e?.message ?? e) }));
        return;
      }
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(corps);
      return;
    }
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(readFileSync(PAGE));
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => {
    console.log(`Tableau de bord SDD : http://localhost:${PORT}  (racine : ${RACINE})`);
  });
