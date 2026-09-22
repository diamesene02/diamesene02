// Le calendrier arrive en deux blocs : « À venir », puis « Déjà jouées ».
//
// Comme sur les matchs et l'effectif, le squelette reprend le balisage de la
// page plutôt que d'en redessiner les mesures : la tête a ses quatre
// morceaux (le surtitre, le grand titre, la définition sur deux lignes, le
// bouton), et les rangées gardent les 62 px du ticker. Ce qui se charge se
// pose là où on l'attendait.
export default function Chargement() {
  return (
    <main className="attente" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement des soirées…</span>

      <div className="flex flex-wrap items-end justify-between gap-3" aria-hidden>
        <div>
          <span className="kicker">
            <span className="os">Le calendrier</span>
          </span>
          <h1 className="display-md mt-1">
            <span className="os">Les soirées</span>
          </h1>
          <p className="mt-1.5 max-w-sm text-sm">
            <span className="os">
              Un créneau réservé : une date, un terrain, qui vient. Les matchs
              se jouent dedans.
            </span>
          </p>
        </div>
      </div>

      {/* Les deux commandes de tête — « Programmer une soirée » et « Poser
          toute la saison » — ne s'affichent qu'aux gestionnaires, et le
          squelette ne sait pas encore qui regarde. On réserve leur hauteur :
          un blanc qui se remplit vaut mieux qu'une liste qui descend. */}
      <span
        className="os-pave mt-3"
        style={{ height: 44, width: 230, borderRadius: 22 }}
        aria-hidden
      />
      <span
        className="os-pave mt-2"
        style={{ height: 24, width: 176, borderRadius: 12 }}
        aria-hidden
      />

      {[
        { titre: "À venir", n: 2 },
        { titre: "Déjà jouées", n: 3 },
      ].map((bloc) => (
        <div key={bloc.titre} className="mt-7" aria-hidden>
          <span className="kicker mb-3 block">
            <span className="os">{bloc.titre}</span>
          </span>
          <div className="chargement-liste">
            <div className="chargement-liste-titre" />
            {Array.from({ length: bloc.n }, (_, i) => (
              <div key={i} className="chargement-rangee" style={{ height: 62 }}>
                <span className="c">
                  <i style={{ width: `${[58, 44, 66][i % 3]}%` }} />
                  <i style={{ width: `${[36, 48, 30][i % 3]}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
