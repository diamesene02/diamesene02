// Generate PWA icons (192, 512, maskable 512, apple-touch 180) from an SVG.
// Ran via `pnpm gen:icons` after tweaking the SVG.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Sharp is in node_modules already (transitive via Next.js).
const sharp = (await import("sharp")).default;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
await mkdir(outDir, { recursive: true });

// Base SVG — pitch green gradient + centred "FS" monogram + stylised ball dot.
// Safe-zone aware: content is inside the 40% centered square so a 20% maskable
// crop on Android still shows everything.
const svg = /* svg */ `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#14532d"/>
      <stop offset="100%" stop-color="#052e16"/>
    </linearGradient>
    <radialGradient id="ball" cx="0.3" cy="0.3" r="0.8">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#d4d4d8"/>
      <stop offset="100%" stop-color="#71717a"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- pitch line -->
  <circle cx="256" cy="256" r="120" fill="none" stroke="#ffffff20" stroke-width="4"/>
  <line x1="0" y1="256" x2="512" y2="256" stroke="#ffffff20" stroke-width="4"/>
  <!-- FS monogram -->
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif"
    font-weight="900" font-size="210" fill="#ffffff" letter-spacing="-8">FS</text>
  <!-- small ball in upper right inside safe zone -->
  <circle cx="390" cy="140" r="34" fill="url(#ball)"/>
  <path d="M 390 110 L 408 125 L 402 148 L 378 148 L 372 125 Z" fill="#111827" opacity="0.75"/>
</svg>`;

const full = Buffer.from(svg);

async function render(size, name, { maskable = false } = {}) {
  let pipe = sharp(full).resize(size, size);
  if (maskable) {
    // keep same image but ensure solid bg extends to edges (SVG already covers it)
  }
  await pipe.png().toFile(join(outDir, name));
  console.log(" ->", name);
}

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(512, "icon-maskable-512.png", { maskable: true });
await render(180, "apple-touch-icon.png");

// Write the source SVG alongside so future tweaks are easy.
await writeFile(join(outDir, "icon.svg"), svg.trim(), "utf8");
console.log(" -> icon.svg (source)");
console.log("Done.");
