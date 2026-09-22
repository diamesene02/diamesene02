import "./player.css";

// L'effectif : le titre, le bouton d'ajout, puis une rangée par joueur.
//
// Le premier jet posait un titre générique et une liste ; la carte arrivait
// 38 px plus bas que le squelette ne l'annonçait, parce que la tête de cet
// écran a ses propres marges (18/2 px au-dessus, 14 en dessous) et qu'il y a
// un bouton pleine largeur entre elle et la liste. On reprend le balisage de
// la page : mêmes classes, mêmes marges, et les barres ont la longueur du
// texte qu'elles remplacent.
//
// Huit rangées : le club en compte une vingtaine, mais huit remplissent
// l'écran — en promettre vingt ferait reculer tout ce qui suit.
export default function Chargement() {
  return (
    <main className="attente" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de l&apos;effectif…</span>

      <div className="titre-ecran" style={{ padding: "18px 4px 2px" }} aria-hidden>
        <span className="os">Effectif</span>
      </div>
      <div className="sous-titre" style={{ padding: "0 4px 14px" }} aria-hidden>
        <span className="os">18 joueurs au vestiaire</span>
      </div>

      {/* Le bouton « Ajouter un joueur » n'apparaît qu'aux gestionnaires, et
          le squelette ne sait pas encore qui regarde. On réserve sa place :
          mieux vaut un blanc de 52 px qui se remplit qu'une liste entière qui
          descend d'un coup. */}
      <span className="os-pave" style={{ height: 52, borderRadius: 26 }} aria-hidden />

      <div className="carte mt-4" style={{ padding: "0 16px" }} aria-hidden>
        {["Bakary", "Cédric", "Diame", "Enzo", "Farid", "Gaël", "Hakim", "Idriss"].map(
          (nom, i) => (
            <div key={nom} className="roster-rangee">
              <span className="lien">
                <span className="os-rond" style={{ width: 40, height: 40, flex: "none" }} />
                <span className="corps">
                  <span className="nom">
                    <span className="os">{nom}</span>
                  </span>
                  <span className="sous">
                    <span className="os">
                      {i % 2 ? "12 matchs · 7 buts" : "9 matchs · 3 buts"}
                    </span>
                  </span>
                </span>
              </span>
            </div>
          ),
        )}
      </div>
    </main>
  );
}
