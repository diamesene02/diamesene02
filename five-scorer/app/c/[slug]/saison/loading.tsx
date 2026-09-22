import "./saison.css";

// L'attente sur le calendrier de la saison.
//
// Avant : cet écran n'avait pas de squelette et récupérait celui du club —
// un titre, une grosse carte de 210 px. Le calendrier qui arrivait derrière
// est une carte à onglets pleine de rangées de 64 px : le premier bloc se
// déplaçait de 99 px, mesuré à 402 px de large.
//
// Ici on ne redessine rien : ce sont les classes de la vraie page
// (.saison-tete, .saison-carte, .onglets, .saison-mois, .saison-rangee),
// avec des mots dont l'encre est remplacée par une barre. Ce qui se charge
// se pose exactement là où le squelette l'annonçait.
//
// Les mots sont ceux qu'on lit vraiment ici — « Saison », « Calendrier »,
// « SEPTEMBRE 2026 » — pour que les barres aient la bonne longueur. Ils ne
// sont pas à lire : le bloc est aria-hidden, et l'annonce passe par le
// texte pour lecteur d'écran, en tête.
export default function Chargement() {
  return (
    <main className="ecran attente" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement de la saison…</span>

      <div className="saison-tete" aria-hidden>
        <div className="titre-ecran">
          <span className="os">Saison</span>
        </div>
        <div className="sous-titre">
          <span className="os">12 soirées jouées · 30 au calendrier</span>
        </div>
      </div>

      <section className="carte saison-carte" aria-hidden>
        <div className="onglets">
          <span className="onglet actif">
            <span className="os">Calendrier</span>
          </span>
          <span className="onglet">
            <span className="os">Adversaires</span>
          </span>
          <span className="onglet">
            <span className="os">Bilan</span>
          </span>
        </div>
        <div className="filet" />
        <div className="saison-mois">
          {/* En bas de casse comme la vraie ligne : `D.moisAnnee` rend
              « septembre 2026 », et la feuille ne met plus de capitales. */}
          <span className="os">septembre 2026</span>
        </div>
        {/* Quatre lundis : de quoi remplir l'écran sans promettre un mois
            plus rempli qu'il ne l'est. Les libellés varient de longueur,
            comme un vrai calendrier — des barres toutes égales se
            remarquent comme un décor. */}
        {[
          ["Soirée · 19:00", "Five Renault · 8 présents · équipes prêtes"],
          ["Soirée · 19:00", "Five Renault · 10 présents"],
          ["Soirée · 20:30", "Gymnase · 6 matchs joués"],
          ["Soirée · 19:00", "Five Renault"],
        ].map(([titre, sous], i) => (
          <div key={i} className="saison-rangee">
            <span className="saison-date">
              <span className="jour">
                <span className="os">LUN.</span>
              </span>
              <span className="numero">
                <span className="os">15</span>
              </span>
            </span>
            <span className="saison-corps">
              <span className="titre">
                <span className="os">{titre}</span>
              </span>
              <span className="sous">
                <span className="os">{sous}</span>
              </span>
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
