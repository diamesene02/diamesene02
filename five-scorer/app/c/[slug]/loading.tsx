import { CarteListe } from "./_chargement/Squelette";

// L'attente entre deux écrans du club.
//
// Chaque page est rendue côté serveur à chaque visite, et l'accueil enchaîne
// trois vagues de requêtes. Entre le tap et l'affichage, rien ne bougeait :
// sur la 4G du terrain, on retapait, ou on croyait l'app cassée. La barre du
// haut reste en place (elle vit dans le layout) ; seul le contenu attend, sous
// la forme de ce qui va arriver.
//
// Ce squelette est celui de l'ACCUEIL, la page qu'il couvre en premier : la
// carte « À venir » (la prochaine soirée, celle qu'on vient chercher), puis
// le tableau. Les écrans qui ont une autre forme — soirées, matchs, effectif
// — ont le leur à côté de leur page.
export default function Chargement() {
  return (
    <main className="chargement" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      {/* La carte « À venir » : la date, le panneau des deux camps, la
          ligne des présents. C'est le premier écran d'un lundi. */}
      <div className="carte chargement-carte" />
      <CarteListe n={4} hauteur={54} tete="rond" />
    </main>
  );
}
