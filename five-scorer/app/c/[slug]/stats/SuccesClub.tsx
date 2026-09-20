import Link from "next/link";
import { cn } from "@/lib/cn";
import { NOMS_MATIERES } from "@/lib/succes-icones";
import type { Badge, SuccesClub as Club } from "@/lib/succes";
import Carte from "@/components/ios/Carte";
import Onglets from "@/components/ios/Onglets";
import Ecusson from "@/components/ios/Ecusson";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import Medaille from "@/components/succes/Medaille";
import { dateRelative, nombre } from "@/components/succes/textes";
import "@/components/succes/succes.css";
import { grouperFil, nommer } from "./succes-club";

// La carte « Succès » des stats : ce que le club a débloqué ces dernières
// semaines, les niveaux de chacun, et ce que presque personne n'a.
//
// Elle ne suit pas le sélecteur de saison : un niveau et un palier se
// gagnent sur toute la carrière au club, ils ne repartent pas de zéro en
// septembre.

export default function SuccesClub({
  slug,
  club,
  moi,
  photos,
  camps,
  maintenant,
}: {
  slug: string;
  club: Club;
  /// Le joueur lié au compte connecté : sa ligne ressort.
  moi: string | null;
  photos: Record<string, string | null | undefined>;
  camps: Record<string, "A" | "B" | undefined>;
  maintenant: Date;
}) {
  if (club.niveaux.length === 0) return null;
  const fiche = (id: string) => `/c/${slug}/players/${id}`;
  const fil = grouperFil(club.fil);
  // La rareté est calculée par le moteur (lib/succes.ts) : l'app lit la même
  // liste. La recalculer ici, c'était deux définitions pour un seul mot.
  const rares = club.raretes;

  const exploits = (
    <div>
      {fil.map(({ cle, d, joueurs }) => {
        const [premier] = joueurs;
        const quand = dateRelative(d.le, maintenant);
        // Seul, le joueur mène la ligne : « Bakary · Buteur ». À plusieurs,
        // c'est le palier : dix noms devant « Toujours là » le coupaient.
        const seul = joueurs.length === 1;
        return (
          <Link
            key={cle}
            href={d.matchId ? `/c/${slug}/matches/${d.matchId}` : fiche(premier.playerId)}
            className="ligne-exploit"
          >
            <AvatarAnneau
              nom={premier.nom}
              photo={photos[premier.playerId]}
              camp={camps[premier.playerId] ?? null}
              taille={36}
            />
            <span className="exploit-textes">
              {seul ? (
                <>
                  <span className="exploit-l1">
                    <b>{premier.nom}</b> · {d.nom}
                  </span>
                  <span className="exploit-l2">
                    {d.libelle} · {quand}
                  </span>
                </>
              ) : (
                <>
                  <span className="exploit-l1">
                    <b>{d.nom}</b> · {d.libelle}
                  </span>
                  <span className="exploit-l2">
                    {nommer(joueurs.map((j) => j.nom))} · {quand}
                  </span>
                </>
              )}
            </span>
            <Medaille icone={d.icone} matiere={d.matiere} taille={36} label={NOMS_MATIERES[d.matiere]} />
          </Link>
        );
      })}
    </div>
  );

  const niveaux = (
    <div>
      {club.niveaux.map((n, i) => (
        <Link
          key={n.playerId}
          href={`${fiche(n.playerId)}#succes`}
          className={cn("stats-rangee stats-niveau", n.playerId === moi && "moi")}
          aria-current={n.playerId === moi ? "true" : undefined}
        >
          <span>{i + 1}</span>
          <AvatarAnneau nom={n.nom} photo={photos[n.playerId]} camp={camps[n.playerId] ?? null} taille={30} />
          <span className="bloc">
            <span className="nom">
              {n.nom}
              {n.playerId === moi && <span className="toi"> · toi</span>}
            </span>
            <span className="sous">
              <span className="sr-only">niveau {n.niveau}, </span>
              {n.titre} · {nombre(n.xp)} XP
            </span>
          </span>
          <Ecusson camp="A" lettre={String(n.niveau)} taille={30} />
        </Link>
      ))}
    </div>
  );

  const raretes = (
    <div>
      {rares.map((r) => {
        const seul = r.detenteurs.length === 1;
        const contenu = (
          <>
            <Medaille icone={r.icone} matiere={r.matiere} taille={40} label={NOMS_MATIERES[r.matiere]} />
            <span className="exploit-textes">
              <span className="exploit-l1">
                <b>{r.nom}</b> · {r.libelle}
              </span>
              <span className="exploit-l2">
                {nommer(r.detenteurs.map((j) => j.nom))} · {r.detenteurs.length} joueur
                {seul ? "" : "s"} sur {r.total}
              </span>
            </span>
          </>
        );
        return seul ? (
          <Link key={r.badgeId} href={`${fiche(r.detenteurs[0].playerId)}#succes`} className="ligne-exploit">
            {contenu}
          </Link>
        ) : (
          <div key={r.badgeId} className="ligne-exploit">
            {contenu}
          </div>
        );
      })}
    </div>
  );

  const onglets = [
    ...(fil.length > 0 ? [{ id: "exploits", label: "Exploits", contenu: exploits }] : []),
    { id: "niveaux", label: "Niveaux", contenu: niveaux },
    ...(rares.length > 0 ? [{ id: "rares", label: "Raretés", contenu: raretes }] : []),
  ];

  return (
    <Carte className="stats-carte stats-succes" titre="Succès">
      <Onglets onglets={onglets} />
    </Carte>
  );
}
