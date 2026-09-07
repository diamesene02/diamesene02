import { bibTheme } from "@/lib/color";
import { themeVars, themeTokens, type Theme } from "@/lib/theme";

// Habille l'app aux couleurs du club.
//
// Le fond, les cartes, les écussons, les halos : tout est calculé depuis les
// deux chasubles (lib/theme.ts), en sombre et en clair. Le composant émet les
// deux jeux de jetons ; l'attribut `data-theme` sur le conteneur choisit.
//
// Les anciens jetons « craie sur gazon » (--pitch-*, --ink-*, --rule*) sont
// REMAPPÉS sur les nouveaux : chaque écran non encore redessiné bascule dans
// la nouvelle palette sans être touché, en clair comme en sombre.

const REMAP = [
  "--pitch-0:var(--bgSolid)",
  "--pitch-1:var(--cdSolid)",
  "--pitch-2:var(--seg)",
  "--pitch-3:var(--gb)",
  "--ink-1:var(--ink)",
  "--ink-2:var(--i2)",
  "--ink-3:var(--i3)",
  "--rule:var(--sep)",
  "--rule-hi:var(--gb)",
  "--win:var(--ok)",
  "--loss:var(--bad)",
  "--gold:var(--or)",
  "--direct:var(--bad)",
  "--bib-a:var(--ta)",
  "--bib-b:var(--tb)",
  "--bib-a-ink:var(--taInk)",
  "--bib-b-ink:var(--tbInk)",
  "--bib-a-slab:var(--ta)",
  "--bib-b-slab:var(--tb)",
  "--font:var(--ios-font)",
  "--r-0:14px",
  "--r-2:22px",
].join(";");

export default function ClubTheme({
  colorA,
  colorB,
  theme = "dark",
}: {
  colorA?: string | null;
  colorB?: string | null;
  /// Le thème initial, lu du cookie côté serveur. Le conteneur porte
  /// `data-theme` ; le basculer côté client rhabille sans rechargement.
  theme?: Theme;
}) {
  // Les anciens jetons de chasuble restent calculés pour ce qui les lit
  // encore (tuiles du live, compo).
  const t = bibTheme(colorA, colorB);
  const dark = themeVars(colorA, colorB, "dark");
  const light = themeVars(colorA, colorB, "light");
  const css =
    `[data-club-theme]{${dark};${REMAP};color-scheme:dark;--bib-a-legacy:${t.aFill};--bib-b-legacy:${t.bFill}}` +
    `[data-club-theme][data-theme="light"]{${light};color-scheme:light}`;
  const barre = themeTokens(colorA, colorB, theme).bgSolid;
  return (
    <>
      <style>{css}</style>
      {/* La barre système suit le fond du club. */}
      <meta name="theme-color" content={barre} />
    </>
  );
}
