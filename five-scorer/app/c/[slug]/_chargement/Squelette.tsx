// Les pièces d'un squelette de chargement.
//
// Le squelette générique du club (un titre, deux cartes pleines) servait
// pour les onze écrans : en arrivant sur « Les soirées », on voyait deux
// gros blocs, puis une liste de rangées fines les remplaçait. L'écran
// sautait. Un squelette n'est utile que s'il annonce la forme de ce qui
// vient — sinon il ment, et le saut coûte plus cher que l'attente.
//
// Les écrans qui ont une tête à eux (matchs, soirées, effectif, saison,
// stats, soirée) reprennent directement le balisage de leur page, avec la
// classe `.os` qui remplace l'encre d'un mot par une barre : la géométrie
// est alors la même par construction. Il reste cette pièce-ci pour le cas
// simple — une carte pleine de rangées régulières — dont les mesures
// suivent celles des listes du site (rangée de 54 à 64 px).
/// Une carte-liste : un en-tête de groupe puis des rangées régulières.
export function CarteListe({
  n = 4,
  hauteur = 56,
  tete,
  titre = true,
}: {
  n?: number;
  hauteur?: number;
  /// Ce qui ouvre la rangée : un bloc de date (le calendrier) ou un avatar
  /// rond (l'effectif, le tableau).
  tete?: "date" | "rond";
  titre?: boolean;
}) {
  return (
    <div className="chargement-liste">
      {titre && <div className="chargement-liste-titre" />}
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="chargement-rangee" style={{ height: hauteur }}>
          {tete && <span className={tete === "rond" ? "d rond" : "d"} />}
          <span className="c">
            {/* Deux lignes de longueurs inégales : une liste vraie n'aligne
                pas ses fins de ligne, et un squelette qui les aligne se
                remarque comme un placeholder. */}
            <i style={{ width: `${[58, 72, 46, 64, 52][i % 5]}%` }} />
            <i style={{ width: `${[38, 30, 44, 34, 40][i % 5]}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
