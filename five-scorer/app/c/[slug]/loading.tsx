// L'attente entre deux écrans du club.
//
// Chaque page est rendue côté serveur à chaque visite, et l'accueil enchaîne
// trois vagues de requêtes. Entre le tap et l'affichage, rien ne bougeait :
// sur la 4G du terrain, on retapait, ou on croyait l'app cassée. La barre du
// haut reste en place (elle vit dans le layout) ; seul le contenu attend, sous
// la forme de ce qui va arriver — un titre et des cartes.
export default function Chargement() {
  return (
    <main className="chargement" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <div className="chargement-titre" />
      <div className="chargement-sous" />
      <div className="carte chargement-carte" />
      <div className="carte chargement-carte courte" />
    </main>
  );
}
