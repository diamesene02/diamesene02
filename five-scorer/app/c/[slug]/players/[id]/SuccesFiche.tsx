import Link from "next/link";
import CarteNiveau from "@/components/succes/CarteNiveau";
import Medaille from "@/components/succes/Medaille";
import TuileBadge from "@/components/succes/TuileBadge";
import { dateRelative } from "@/components/succes/textes";
import { NOMS_MATIERES } from "@/lib/succes-icones";
import type { Badge, Deblocage, Serie, SuccesJoueur } from "@/lib/succes";
import { ordonnerBadges } from "./vitrine";

// La section « Succès » de la fiche : le niveau, les séries, la vitrine des
// badges, et les derniers paliers franchis. Elle remplace « Prochains
// paliers » et « Trophées », que le moteur des succès englobe : deux listes
// qui disaient la même chose avec d'autres seuils.

/// Trois rangées de deux : le reste se déplie. Vingt-six tuiles d'un bloc
/// faisaient une page entière de médailles grises.
const TUILES_VISIBLES = 6;
const PALIERS_VISIBLES = 5;
/// « Nouveau » sur une tuile : la semaine qui suit, jusqu'à la soirée
/// suivante.
const NOUVEAU_MS = 7 * 86_400_000;

function sousSerie(s: Pick<Serie, "enCours" | "record">): string {
  if (s.record === 0) return "pas encore de série";
  if (s.enCours > 0 && s.enCours >= s.record) return "record en cours";
  // Série retombée à zéro : le grand chiffre de la tuile affiche « 0 ».
  // Dire « en cours » sous un zéro, c'est annoncer au joueur qu'il a encore
  // quelque chose à ne pas casser le soir où il vient de le casser.
  if (s.enCours === 0) return `record ${s.record}`;
  return `en cours · record ${s.record}`;
}

export default function SuccesFiche({
  slug,
  succes,
  elo,
  maintenant,
}: {
  slug: string;
  succes: SuccesJoueur;
  /// La cote actuelle, pour mesurer la distance au palier d'Élo.
  elo: number | null;
  maintenant: Date;
}) {
  const badges = ordonnerBadges(succes.badges, { series: succes.series, elo, maintenant });
  const obtenus = succes.badges.filter((b) => b.palier > 0).length;
  const t = maintenant.getTime();
  const versMatch = (id: string) => `/c/${slug}/matches/${id}`;

  const tuile = (b: Badge) => (
    <TuileBadge
      key={b.id}
      badge={b}
      href={b.palier > 0 && b.matchId ? versMatch(b.matchId) : undefined}
      nouveau={b.obtenuLe != null && t - Date.parse(b.obtenuLe) <= NOUVEAU_MS}
    />
  );

  const palier = (d: Deblocage) => {
    const contenu = (
      <>
        <Medaille icone={d.icone} matiere={d.matiere} taille={36} label={NOMS_MATIERES[d.matiere]} />
        <span className="textes">
          <b>{d.nom}</b> · {d.libelle}
        </span>
        <span className="quand">{dateRelative(d.le, maintenant)}</span>
      </>
    );
    const cle = `${d.badgeId}:${d.palier}`;
    return d.matchId ? (
      <Link key={cle} href={versMatch(d.matchId)} className="palier-ligne">
        {contenu}
      </Link>
    ) : (
      <div key={cle} className="palier-ligne">
        {contenu}
      </div>
    );
  };

  const tete = badges.slice(0, TUILES_VISIBLES);
  const suite = badges.slice(TUILES_VISIBLES);
  const recents = succes.deblocages.slice(0, PALIERS_VISIBLES);
  const anciens = succes.deblocages.slice(PALIERS_VISIBLES);

  return (
    <div id="succes" className="fiche-succes">
      <CarteNiveau niveau={succes.niveau} detail={succes.xpDetail} />

      <section className="carte fiche-series">
        <div className="carte-titre">Séries</div>
        <div className="grille">
          {succes.series.map((s) => (
            <div key={s.id} className="serie">
              <span className="nom">{s.nom}</span>
              <span className="n">{s.enCours}</span>
              <span className="rec">{sousSerie(s)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="carte fiche-badges">
        <div className="carte-titre">Succès</div>
        <p className="compte">
          {obtenus} sur {succes.badges.length} débloqué{obtenus > 1 ? "s" : ""}
        </p>
        <div className="grille">{tete.map(tuile)}</div>
        {suite.length > 0 && (
          <details className="plus">
            <summary>
              <span className="ouvrir">Voir les {suite.length} autres</span>
              <span className="fermer">Masquer</span>
            </summary>
            <div className="grille">{suite.map(tuile)}</div>
          </details>
        )}
      </section>

      {recents.length > 0 && (
        <section className="carte fiche-carte fiche-deblocages">
          <div className="carte-titre" style={{ padding: "20px 0 8px" }}>
            Derniers paliers débloqués
          </div>
          {recents.map(palier)}
          {anciens.length > 0 && (
            <details className="plus">
              <summary>
                <span className="ouvrir">
                  {anciens.length === 1 ? "Voir le précédent" : `Voir les ${anciens.length} précédents`}
                </span>
                <span className="fermer">Masquer</span>
              </summary>
              {anciens.map(palier)}
            </details>
          )}
        </section>
      )}
    </div>
  );
}
