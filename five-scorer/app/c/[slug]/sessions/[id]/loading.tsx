import "./soiree.css";

// L'attente sur la soirée — l'écran du lundi soir.
//
// Avant : pas de squelette ici non plus, donc celui du club. Le premier bloc
// de la vraie page arrivait 114 px plus bas que ce que le squelette avait
// annoncé (mesuré à 402 px), et surtout il n'avait pas la même forme : une
// grosse carte vide à la place d'une date sur deux lignes, d'une ligne de
// score et d'un panneau de présents.
//
// On reprend donc les classes de la page (.soiree-tete, .soiree-carte) et on
// pose ce qui s'y trouve toujours : la date, la ligne d'état, puis deux
// cartes. Ce qui varie — le match en cours, le bilan, « Ma réponse » — n'est
// pas dessiné en détail : un pavé de la bonne hauteur ne ment pas, alors
// qu'une ligne de score en squelette promettrait un match qui n'existe
// peut-être pas.
export default function Chargement() {
  return (
    <main className="ecran attente" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de la soirée…</span>

      <div className="soiree-tete" aria-hidden>
        {/* La date passe presque toujours sur deux lignes à cette largeur
            (« Dimanche 13 septembre ») : le squelette en prend deux, sinon
            tout ce qui suit remonte au dernier moment. */}
        <div className="titre-ecran">
          <span className="os">Dimanche 13 septembre</span>
        </div>
        <div className="sous-titre">
          <span className="os">19:00 · Five Renault</span>
        </div>
      </div>

      {/* Une ligne de score fait 12 + 14 de marge intérieure et environ 88 de
          contenu : le pavé prend sa place, pas sa forme. */}
      <section className="carte soiree-carte" aria-hidden>
        <span className="os-pave" style={{ height: 112, margin: 4 }} />
      </section>

      {/* La seconde carte est le bilan quand la soirée a commencé, « Ma
          réponse » quand elle est à venir. Les deux tournent autour de 210
          px de haut. */}
      <section className="carte soiree-carte" aria-hidden>
        <span className="os-pave" style={{ height: 206, margin: 4 }} />
      </section>
    </main>
  );
}
