// Les icônes de l'app native, produites depuis la MÊME source que celles du
// site : public/icons/icon.svg. C'est le point : l'icône sur l'écran d'accueil
// doit être celle qu'on reconnaît, pas le chevron bleu du gabarit Expo.
//
// Android impose une contrainte que le site n'a pas : le lanceur découpe
// l'icône adaptative en cercle, en carré arrondi ou en goutte selon le
// téléphone, et ne garantit que les 66 % centraux. On produit donc un
// premier plan à l'échelle réduite sur fond transparent, et le vert en fond
// séparé — sinon le « FS » se fait rogner sur la moitié des appareils.
//
//   node scripts/icones.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ici = dirname(fileURLToPath(import.meta.url));
const sortie = join(ici, "..", "assets");
// sharp vit dans le projet web (transitif via Next). On ne le duplique pas
// dans le projet mobile pour une commande qu'on lance trois fois par an.
const sharp = (await import(join(ici, "..", "..", "five-scorer", "node_modules", "sharp", "lib", "index.js"))).default;

const SVG = join(ici, "..", "..", "five-scorer", "public", "icons", "icon.svg");
const source = await readFile(SVG);

/// La même image, sans son fond ni les lignes du terrain : le logo seul, sur
/// transparence.
///
/// C'est ce qu'Android attend du premier plan d'une icône adaptative. Le
/// lanceur superpose ce calque au fond et découpe l'ensemble — en cercle, en
/// carré arrondi ou en goutte selon le téléphone. Un premier plan qui porte
/// déjà son propre fond vert donnerait un carré vert découpé dans un rond,
/// avec le vrai fond visible autour.
const premierPlan = Buffer.from(
  source
    .toString("utf8")
    .replace(/<rect[^>]*fill="url\(#bg\)"[^>]*\/>/, "")
    // Les lignes du terrain sont dessinées à 12 % d'opacité pour se poser sur
    // le vert. Sur transparence elles ne seraient qu'un halo sale.
    .replace(/<!-- pitch line -->[\s\S]*?<line[^>]*\/>/, ""),
);

/// Le vert du fond du logo, repris tel quel pour le fond adaptatif Android et
/// pour l'écran de démarrage : trois nuances différentes se verraient.
const VERT = "#0b3d20";

await mkdir(sortie, { recursive: true });

async function carre(taille, nom, options = {}) {
  const { fond = null, echelle = 1, calque = source } = options;
  const dessin = Math.round(taille * echelle);
  let contenu = sharp(calque, { density: 1024 }).resize(dessin, dessin);

  if (echelle === 1 && !fond) {
    await contenu.png().toFile(join(sortie, nom));
    console.log(" ->", nom, `${taille}px`);
    return;
  }

  // Centrer le CANEVAS ne centre pas le DESSIN : le monogramme est au milieu
  // du viewBox, mais le ballon déborde en haut à droite, si bien que la tache
  // d'encre penche. On recadre donc sur ce qui est réellement dessiné —
  // `trim` enlève les bords transparents — puis on centre ça.
  const rogne = await sharp(await contenu.png().toBuffer())
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);

  const image = rogne
    ? await sharp(rogne.data)
        .resize(dessin, dessin, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    : await contenu.png().toBuffer();

  const marge = Math.round((taille - dessin) / 2);
  await sharp({
    create: {
      width: taille, height: taille, channels: 4,
      background: fond ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: image, top: marge, left: marge }])
    .png()
    .toFile(join(sortie, nom));
  console.log(" ->", nom, `${taille}px`);
}

async function uni(taille, nom, couleur) {
  await sharp({ create: { width: taille, height: taille, channels: 4, background: couleur } })
    .png().toFile(join(sortie, nom));
  console.log(" ->", nom, `${taille}px uni`);
}

// iOS : une seule image, carrée, opaque, 1024. Le système arrondit les coins
// lui-même ; une icône déjà arrondie donnerait un liseré.
await carre(1024, "icon.png");

// Android adaptatif : premier plan à 66 % sur transparent, fond vert à part.
await carre(1024, "android-icon-foreground.png", { echelle: 0.66, calque: premierPlan });
await uni(1024, "android-icon-background.png", VERT);
// Le monochrome (thème Material You) doit être une silhouette : on garde la
// même mise à l'échelle, le système n'en retient que la forme.
await carre(1024, "android-icon-monochrome.png", { echelle: 0.66, calque: premierPlan });

// L'écran de démarrage : le logo seul, petit, sur le vert du fond. Une image
// pleine largeur serait recadrée différemment sur chaque téléphone.
await carre(512, "splash-icon.png", { echelle: 0.62, calque: premierPlan });

// Le favicon de la cible web d'Expo.
await carre(96, "favicon.png");

console.log("\nFait.");
