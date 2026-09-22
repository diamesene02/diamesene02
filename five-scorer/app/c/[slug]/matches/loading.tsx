// L'historique : le titre, les deux rangées de filtres, puis les matchs
// groupés par soirée.
//
// Le premier jet posait un titre et une sous-ligne génériques ; la vraie
// tête de cet écran en compte quatre morceaux (« Historique », le grand
// titre, la définition sur deux lignes, le compte à droite), et tout ce qui
// suit arrivait 100 px plus bas que le squelette ne l'annonçait. On reprend
// donc le balisage de la page, mot pour mot : les barres ont la longueur du
// texte qu'elles remplacent et la tête a sa vraie hauteur.
export default function Chargement() {
  return (
    <main className="attente" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement des matchs…</span>

      <div className="flex items-end justify-between gap-3" aria-hidden>
        <div>
          <span className="kicker">
            <span className="os">Historique</span>
          </span>
          <h1 className="display-md mt-1">
            <span className="os">Les matchs</span>
          </h1>
          <p className="mt-1.5 max-w-sm text-sm">
            <span className="os">
              Une rencontre jouée : un score, des buteurs, un chrono. Dans une
              soirée, ou toute seule.
            </span>
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums">
          <span className="os">12 joués</span>
        </span>
      </div>

      {/* Les deux rangées de filtres : saisons, puis type de rencontre. Elles
          ont la hauteur d'une pastille tactile (44 px), comme les vraies. */}
      <div className="mt-6 space-y-2" aria-hidden>
        <div className="chargement-puces">
          <span style={{ width: 124 }} />
          <span style={{ width: 132 }} />
        </div>
        <div className="chargement-puces">
          <span style={{ width: 66 }} />
          <span style={{ width: 118 }} />
          <span style={{ width: 138 }} />
        </div>
      </div>

      <div className="mt-8" aria-hidden>
        <span className="kicker mb-3 block">
          <span className="os">Joués</span>
        </span>
        <div className="chargement-liste">
          <div className="chargement-liste-titre" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="chargement-rangee" style={{ height: 56 }}>
              <span className="c">
                <i style={{ width: `${[58, 72, 46][i]}%` }} />
                <i style={{ width: `${[38, 30, 44][i]}%` }} />
              </span>
            </div>
          ))}
        </div>
        <div className="chargement-liste">
          <div className="chargement-liste-titre" />
          {[0, 1].map((i) => (
            <div key={i} className="chargement-rangee" style={{ height: 56 }}>
              <span className="c">
                <i style={{ width: `${[64, 52][i]}%` }} />
                <i style={{ width: `${[34, 40][i]}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
