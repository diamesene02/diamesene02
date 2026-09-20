import Link from "next/link";
import Carte from "@/components/ios/Carte";
import Ecusson from "@/components/ios/Ecusson";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import BarreProgression from "@/components/succes/BarreProgression";
import IconeSucces from "@/components/succes/IconeSucces";
import Medaille from "@/components/succes/Medaille";
import { nombre } from "@/components/succes/textes";
import type { IconeSucces as Cle } from "@/lib/succes-icones";
import type { SuccesJoueur } from "@/lib/succes";
import Evolution from "./Evolution";
import { ordinal, phraseBilan, prochainPalier, seriePhare, type Bilan } from "./ma-saison";

/// Une ligne du tableau, ce qu'il en faut pour dire l'écart et le départage.
type Ligne = { nom: string; points: number; victoires: number; buts: number; camp?: "A" | "B" | null };

const pts = (n: number) => `${n} pt${n > 1 ? "s" : ""}`;

function Pastille({ icone }: { icone: Cle }) {
  return (
    <span className="saison-pastille">
      <IconeSucces icone={icone} taille={20} />
    </span>
  );
}

function Rangee({
  tete,
  titre,
  sous,
  children,
}: {
  tete: React.ReactNode;
  titre: string;
  sous?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="saison-ligne">
      {tete}
      <span className="textes">
        <span className="l1">{titre}</span>
        {sous && <span className="l2">{sous}</span>}
        {children}
      </span>
    </div>
  );
}

// « Ma saison » : ce que le joueur connecté vient chercher le mardi matin —
// où il en est, qui est juste devant, la série qu'il ne veut pas casser et le
// prochain palier à portée. Le rang vient du tableau de l'accueil (même tri,
// même saison) : la carte et le tableau juste en dessous ne peuvent pas se
// contredire. Le niveau et les paliers, eux, couvrent toute la carrière.
export default function MaSaison({
  slug,
  playerId,
  succes,
  rang,
  total,
  moi,
  evolution,
  devant,
  derriere,
  bilan,
  avecPasses,
}: {
  slug: string;
  playerId: string;
  succes: SuccesJoueur;
  /// Sa place au tableau de l'accueil, null s'il n'a pas joué cette saison.
  rang: number | null;
  total: number;
  /// Sa ligne du tableau (points à 0 s'il n'y figure pas).
  moi: Ligne;
  evolution: number | null;
  devant: Ligne | null;
  derriere: Ligne | null;
  /// Sa dernière soirée jouée : « Lundi », et ce qu'il y a fait.
  bilan: { quand: string; bilan: Bilan } | null;
  avecPasses: boolean;
}) {
  const n = succes.niveau;
  const reste = Math.max(0, n.xpSuivant - n.xp);
  const serie = seriePhare(succes.series);
  const cible = succes.prochain;
  const palier = cible ? prochainPalier(cible, succes.series) : null;
  const phrase = bilan ? phraseBilan(bilan.bilan, avecPasses) : null;

  let poursuite: React.ReactNode = null;
  if (rang === 1) {
    const avance = derriere ? moi.points - derriere.points : 0;
    poursuite = (
      <Rangee
        tete={<Pastille icone="couronne" />}
        titre="Tu mènes le tableau"
        sous={
          derriere
            ? avance > 0
              ? `${pts(avance)} d'avance sur ${derriere.nom}`
              : `à égalité de points avec ${derriere.nom}`
            : pts(moi.points)
        }
      />
    );
  } else if (rang != null && devant) {
    const ecart = devant.points - moi.points;
    // À égalité de points, le tableau départage aux victoires, puis aux
    // buts, puis au nom : on dit lequel a joué, plutôt qu'une règle générale
    // qui serait fausse une fois sur trois.
    const departage =
      devant.victoires !== moi.victoires
        ? "devant aux victoires"
        : devant.buts !== moi.buts
          ? "devant aux buts"
          : "départagés par le nom";
    poursuite = (
      <Rangee
        tete={<AvatarAnneau nom={devant.nom} camp={devant.camp ?? null} taille={36} />}
        titre={ecart > 0 ? `À ${pts(ecart)} de ${devant.nom}` : `À égalité avec ${devant.nom}`}
        // Le rang est celui de CELUI QUI EST DEVANT — l'avatar et le nom de
        // la ligne. « 2e » tout seul se lisait comme la place du joueur,
        // affichée en grand juste au-dessus.
        sous={
          ecart > 0
            ? `${ordinal(rang - 1)} du tableau`
            : `${ordinal(rang - 1)} du tableau · ${departage}`
        }
      />
    );
  }

  return (
    <Carte titre="Ma saison" className="accueil-carte ma-saison">
      <div className="saison-tete">
        <Ecusson camp="A" lettre={String(n.niveau)} taille={52} />
        <div className="saison-niveau">
          <div className="titre">{n.titre}</div>
          <div className="sous">
            Niveau {n.niveau} · {nombre(n.xp)} XP
          </div>
        </div>
        {rang != null && (
          <div className="saison-rang">
            <div className="rang">
              {ordinal(rang)}
              <Evolution places={evolution} zero />
            </div>
            <div className="sous">sur {total}</div>
          </div>
        )}
      </div>
      <BarreProgression
        part={n.progression}
        hauteur={6}
        label={`Vers le niveau ${n.niveau + 1}`}
        className="saison-barre"
      />
      <div className="saison-reste">
        encore <b>{nombre(reste)} XP</b> pour le niveau {n.niveau + 1}
      </div>

      <div className="saison-lignes">
        {bilan && phrase && (
          <Rangee
            tete={<Pastille icone="lundi" />}
            titre={`${bilan.quand}\u00a0: ${phrase.resultats}`}
            sous={phrase.detail}
          />
        )}
        {poursuite}
        {serie && <Rangee tete={<Pastille icone={serie.icone} />} titre={serie.titre} sous={serie.sous} />}
        {cible && palier && (
          <Rangee
            tete={<Medaille icone={cible.icone} matiere={cible.matiere} taille={36} />}
            titre={palier.titre}
            sous={palier.sous}
          >
            <BarreProgression
              part={palier.part}
              hauteur={4}
              label={`Vers ${palier.titre}`}
              className="saison-palier-barre"
            />
          </Rangee>
        )}
      </div>

      <Link href={`/c/${slug}/players/${playerId}`} className="tableau-pied">
        Mes succès ›
      </Link>
    </Carte>
  );
}
