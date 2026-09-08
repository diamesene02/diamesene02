import Link from "next/link";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import Carte from "@/components/ios/Carte";
import type { StatsGardien } from "@/lib/stats";

// Les gardiens.
//
// Un gardien n'apparaissait au classement que par ses buts — c'est-à-dire par
// ce qu'il ne fait pas. Ses chiffres à lui sont les buts encaissés, les
// matchs sans en prendre un, et ce que devient l'équipe quand il est derrière.
export default function Gardiens({
  slug,
  gardiens,
}: {
  slug: string;
  gardiens: StatsGardien[];
}) {
  if (gardiens.length === 0) return null;

  return (
    <Carte className="stats-gardiens" titre="Les gardiens">
      <div className="tete" aria-hidden>
        <span />
        <span>Gardien</span>
        <span>MJ</span>
        <span>BE</span>
        <span>Moy.</span>
        <span>CS</span>
        <span>%V</span>
      </div>
      {gardiens.map((g) => (
        <Link key={g.playerId} href={`/c/${slug}/players/${g.playerId}`} className="rangee">
          <AvatarAnneau nom={g.name} photo={g.photo} taille={30} />
          <span className="nom">{g.name}</span>
          <span>{g.matchs}</span>
          <span>{g.encaisses}</span>
          <span className="moy">{g.moyenne.toLocaleString("fr-FR", { minimumFractionDigits: 1 })}</span>
          <span>{g.cleanSheets}</span>
          <span>{g.pctVictoires}</span>
        </Link>
      ))}
      <p className="legende">
        BE : buts encaissés · Moy. : par match · CS : matchs sans encaisser
      </p>
    </Carte>
  );
}
