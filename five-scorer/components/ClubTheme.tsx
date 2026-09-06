import { bibTheme } from "@/lib/color";

// Habille l'app aux couleurs du club.
//
// L'interface est délibérément neutre — craie sur gazon — pour que les
// deux couleurs de chasubles portent seules l'identité. Ce composant
// redéfinit les jetons de couleur d'équipe sur le conteneur du club :
// tout ce qui en dépend (barres des tuiles joueur, scores en tête,
// classements, récap) suit sans une ligne de code en plus.
//
// Les variantes « ink » ne sont pas choisies mais calculées : on éclaircit
// la couleur du club juste assez pour qu'elle porte du texte (Lc 60), ce
// qu'aucune couleur d'équipe vive ne fait à l'état brut.

export default function ClubTheme({
  colorA,
  colorB,
}: {
  colorA?: string | null;
  colorB?: string | null;
}) {
  const t = bibTheme(colorA, colorB);
  const css = `[data-club-theme]{--bib-a:${t.aFill};--bib-a-ink:${t.aInk};--bib-b:${t.bFill};--bib-b-ink:${t.bInk};}`;
  return <style>{css}</style>;
}
