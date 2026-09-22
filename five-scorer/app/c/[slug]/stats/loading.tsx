import "./stats.css";

// L'attente sur les stats.
//
// Avant : pas de squelette à cet écran, donc celui du club — un titre et une
// grosse carte de 210 px — pendant qu'arrivait une carte à onglets et un
// tableau de rangées de 54 px. Le premier bloc sautait de 55 px, mesuré à
// 402 px de large.
//
// La page a déjà un tableau vide, quand le club n'a pas encore joué : des
// onglets, l'en-tête des colonnes, des rangées de tirets (voir page.tsx).
// Le squelette reprend exactement cette forme-là, avec les mêmes classes que
// le vrai tableau — même grille de neuf colonnes, mêmes 54 px par rangée. La
// nuance tient en un mot : le tableau vide dit « aucun match », celui-ci ne
// dit rien encore.
export default function Chargement() {
  return (
    <main className="ecran attente" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement des stats…</span>

      <div className="stats-tete" aria-hidden>
        <h1 className="titre-ecran">
          <span className="os">Stats</span>
        </h1>
      </div>

      <div className="carte stats-carte" aria-hidden>
        <div className="onglets">
          <span className="onglet actif">
            <span className="os">Tableau</span>
          </span>
          <span className="onglet">
            <span className="os">Buteurs</span>
          </span>
          <span className="onglet">
            <span className="os">Forme</span>
          </span>
        </div>
        <div className="filet" />
        {/* L'en-tête des colonnes ne bouge pas d'une saison à l'autre : on
            l'écrit tel quel, il est déjà juste. Ce sont les chiffres qu'on
            attend, pas les titres. */}
        <div className="tableau-tete">
          <span />
          <span />
          <span>Joueur</span>
          <span>MJ</span>
          <span>V</span>
          <span>N</span>
          <span>D</span>
          <span>B</span>
          <span>PTS</span>
        </div>
        {/* Six rangées : le club en compte une vingtaine, mais six suffisent
            à remplir l'écran d'un téléphone — en promettre vingt ferait
            reculer le pied de page quand la vraie liste arrive. */}
        {["Bakary", "Cédric", "Diame", "Enzo", "Farid", "Gaël"].map((nom) => (
          <div key={nom} className="tableau-rangee">
            <span>
              <span className="os">1</span>
            </span>
            <span className="os-rond" style={{ width: 30, height: 30 }} />
            <span>
              <span className="os">{nom}</span>
            </span>
            <span>
              <span className="os">0</span>
            </span>
            <span>
              <span className="os">0</span>
            </span>
            <span>
              <span className="os">0</span>
            </span>
            <span>
              <span className="os">0</span>
            </span>
            <span>
              <span className="os">0</span>
            </span>
            <span>
              <span className="os">0</span>
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
