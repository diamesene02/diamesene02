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
      {accueil ? (
        <Link href={base} className="flex min-w-0 flex-1 items-center gap-2">
          <Ecusson camp="A" lettre="F" taille={34} style={{ borderRadius: 9 }} />
          <span className="truncate text-[30px] font-bold leading-none tracking-[-.5px] text-[color:var(--ink)]">
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
      <div className="flex flex-none items-center gap-3" style={{ maxWidth: "46%" }}>
        <SyncBadge compact />
        <MenuClub {...props} />
      </div>
    </div>
  );
}
