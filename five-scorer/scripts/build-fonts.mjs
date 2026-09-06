// Fabrique les .woff2 auto-hébergés depuis les sources Google Fonts.
//
// Pourquoi auto-héberger : l'app est offline-first et tourne dans une WebView
// Capacitor. Une police servie par un CDN ne se charge pas au bord du terrain
// sans réseau — le texte tomberait en fallback système au pire moment.
//
// Usage :  node scripts/build-fonts.mjs
// Prérequis : pyftsubset (pip install "fonttools[woff]" brotli)

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "fonts");
const TMP = join(process.cwd(), ".fonts-tmp");

// Jeu de caractères : latin de base + tout ce dont le français a besoin
// (accents, ligature œ, guillemets, tirets cadratins, degré, ×) + les
// symboles utilisés dans l'interface.
const UNICODES = [
  "U+0020-007E", // ASCII imprimable
  "U+00A0-00FF", // latin-1 : à â ä ç è é ê ë î ï ô ö ù û ü ÿ « » ° ×
  "U+0152-0153", // Œ œ
  "U+0178", // Ÿ
  "U+2018-201F", // guillemets simples/doubles typographiques
  "U+2013-2014", // – —
  "U+2026", // …
  "U+202F", // espace fine insécable (typo française)
  "U+2039-203A", // ‹ ›
  "U+2192", // →
  "U+2605-2606", // ★ ☆
].join(",");

/**
 * Chaque entrée : la police variable en .ttf depuis le dépôt officiel
 * google/fonts, et le nom du fichier de sortie.
 * `axes` limite les instances d'une variable font (allège fortement).
 */
const FONTS = [
  // Archivo (Omnibus-Type, OFL) — une seule variable fait tout le travail :
  //   · axe de chasse 62→125 : les scores en condensé façon numéro de maillot,
  //     le texte d'interface en chasse normale. Deux voix, un seul fichier.
  //   · axe de graisse 100→900.
  //   · vrais chiffres tabulaires (tnum) : les classements ne tremblent pas.
  //   · accents français complets, ligature œ comprise.
  // Vérifié à la main : la plupart des « polices de sport » recommandées
  // partout (Oswald, IBM Plex Sans) n'ont PAS de chiffres tabulaires.
  {
    file: "archivo-var.woff2",
    url: "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf",
  },
];

function sh(cmd, args) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} sur ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  if (FONTS.length === 0) {
    console.log(
      "Aucune police déclarée dans FONTS — renseigne les entrées puis relance."
    );
    return;
  }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(TMP, { recursive: true });

  for (const font of FONTS) {
    const src = join(TMP, font.file.replace(/\.woff2$/, ".ttf"));
    const dest = join(OUT, font.file);
    process.stdout.write(`· ${font.file} … `);

    if (!existsSync(src)) await download(font.url, src);

    const args = [
      src,
      `--output-file=${dest}`,
      `--unicodes=${UNICODES}`,
      "--flavor=woff2",
      "--layout-features=kern,liga,tnum,frac,sups",
      "--desubroutinize",
      "--no-hinting",
    ];
    if (font.axes) args.push(`--variations=${font.axes}`);
    sh("pyftsubset", args);

    const kb = (statSync(dest).size / 1024).toFixed(1);
    console.log(`${kb} Ko`);
  }
  console.log("\nTerminé. Déclare les @font-face dans app/globals.css.");
}

main().catch((e) => {
  console.error("Échec :", e.message);
  process.exit(1);
});
