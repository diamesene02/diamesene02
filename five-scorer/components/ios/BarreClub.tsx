"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import SyncBadge from "@/components/SyncBadge";
import Ecusson from "./Ecusson";
import MenuClub from "./MenuClub";

// La barre du haut, une seule pour tout le club.
//
// Sur l'accueil : « Five Scorer » en grand et la pilule du club. Ailleurs :
// le bouton retour en verre et la même pilule — le menu est joignable de
// partout, il n'y a plus de barre d'onglets en bas.
export default function BarreClub(props: {
  slug: string;
  clubShort: string;
  userName: string;
  myPlayerId: string | null;
  canManage: boolean;
  publicUrl: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/c/${props.slug}`;
  const accueil = pathname === base;
  // Le live et le récap prennent tout l'écran et ont leur propre barre.
  if (
    /\/matches\/[^/]+(\/live)?$/.test(pathname) &&
    !pathname.endsWith("/matches/new") &&
    !pathname.endsWith("/matches/schedule") &&
    !pathname.endsWith("/matches/new-session")
  )
    return null;
  if (pathname.endsWith("/play")) return null;

  const retour = () => {
    if (window.history.length > 1) router.back();
    else router.push(base);
  };

  return (
    <div className="barre-haut" style={{ padding: "calc(var(--safe-t) + 14px) 14px 0" }}>
      {/* L'écusson fait 34 px : le lien vers l'accueil ne se touchait donc
          que sur 34 de haut. Il en prend 44, sans bouger d'un pixel à
          l'écran — la barre fait déjà plus haut que ça. */}
      {accueil ? (
        // Deux noms se disputaient cette barre, et c'est toujours le club qui
        // perdait : « Renault Five Urban Guy » sortait en « Renault F… ».
        // Le nom du club est l'identité de l'écran, la marque est un mot que
        // l'utilisateur connaît par cœur — c'est donc elle qui s'efface quand
        // les deux ne tiennent pas (voir .barre-marque, à partir de 500 px).
        // Le lien vers l'accueil, lui, ne bouge pas : l'écusson le porte.
        <Link href={base} aria-label="Five Scorer — accueil du club" className="barre-marque">
          <Ecusson camp="A" lettre="F" taille={34} style={{ borderRadius: 9 }} />
          <span className="mot" aria-hidden>
            Five Scorer
          </span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={retour}
          aria-label="Retour"
          className="verre rond"
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden>
            <path
              d="M10 2L2 10l8 8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {/* La pilule prend toute la place qui reste : elle était plafonnée à
          44 % de la barre, soit huit caractères de nom de club sur un
          téléphone. */}
      <div className="barre-club">
        <SyncBadge compact />
        <MenuClub {...props} />
      </div>
    </div>
  );
}
