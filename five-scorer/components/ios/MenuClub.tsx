"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ini } from "@/lib/ini";
import { signOut } from "@/lib/auth-client";
import { lienInvitation } from "@/app/actions/club";
import Ecusson from "./Ecusson";

// Le menu « pilule » en verre : le nom court du club dans une capsule, qui
// ouvre une liste translucide — Mon profil, Accueil, Soirées, Matchs,
// Effectif, Saison, Stats, Partager, Réglages. Il remplace la barre d'onglets
// du bas : ce qui n'y figure pas n'est joignable par aucun chemin évident.

function Ico({ d, cap = "round" }: { d: string; cap?: "round" | "square" }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap={cap}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const ICONES = {
  accueil: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6",
  soirees: "M3.5 5h17v16h-17zM3.5 10h17M8 3v4M16 3v4",
  matchs: "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 7.4l3.9 2.8-1.5 4.6h-4.8L8.1 10.2z",
  effectif:
    "M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7M2.5 20.5c.6-3.6 3.1-5.8 6.5-5.8s5.9 2.2 6.5 5.8M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.9c2 .8 3.2 2.7 3.5 5.6",
  saison:
    "M7 4h10v5a5 5 0 0 1-10 0zM7 5.5H4V8a3 3 0 0 0 3 3M17 5.5h3V8a3 3 0 0 1-3 3M12 14v3.5M8.5 20.5h7",
  stats: "M5 21v-8M12 21V4M19 21v-12",
  partager: "M12 14V3M8 7l4-4 4 4M5 11v10h14V11",
  reglages:
    "M20.5 9.5H11l-2.2-2.2H3.5v3.4a6.3 6.3 0 1 0 12.4 1.6h4.6zM9.6 13.2m-2.1 0a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0-4.2 0",
  clubs: "M4 6h16M4 12h16M4 18h16",
};

export default function MenuClub({
  slug,
  clubShort,
  userName,
  myPlayerId,
  canManage,
  publicUrl,
}: {
  slug: string;
  clubShort: string;
  userName: string;
  myPlayerId: string | null;
  canManage: boolean;
  publicUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const base = `/c/${slug}`;
  const fermer = () => setOpen(false);

  const item = (
    href: string,
    label: string,
    icone: keyof typeof ICONES,
    exact = false,
  ) => {
    const actif = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        onClick={fermer}
        className={cn("menu-club-item", actif && "actif")}
      >
        <Ico d={ICONES[icone]} cap={icone === "saison" ? "square" : "round"} />
        {label}
      </Link>
    );
  };

  // Ce que « Partager » envoie dépend du club. Public : sa page publique,
  // que n'importe qui peut ouvrir. Privé : seule l'invitation fait entrer
  // quelqu'un — un admin la partage (« Inviter au club »), un membre n'a rien
  // à envoyer qui marcherait chez un non-membre, l'entrée disparaît.
  const invite = !publicUrl && canManage;
  const [cheminInvite, setCheminInvite] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  // Chargé à l'ouverture, pas au tap : iOS n'ouvre la feuille de partage que
  // dans la foulée du geste, et un aller-retour serveur entre les deux suffit
  // à la perdre.
  useEffect(() => {
    if (!open || !invite || cheminInvite) return;
    let vivant = true;
    void lienInvitation(slug)
      .then((r) => {
        if (vivant && r.ok) setCheminInvite(r.chemin);
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [open, invite, cheminInvite, slug]);

  const partager = async () => {
    let chemin = publicUrl ?? base;
    if (invite) {
      const r = cheminInvite
        ? { ok: true as const, chemin: cheminInvite }
        : await lienInvitation(slug).catch(() => null);
      if (!r?.ok) return;
      chemin = r.chemin;
    }
    const url = window.location.origin + chemin;
    const texte = invite
      ? `Rejoins le club « ${clubShort} » sur Five Scorer :`
      : `${clubShort} sur Five Scorer :`;
    const nav = navigator as Navigator & {
      canShare?: (d: { url?: string; text?: string }) => boolean;
    };
    try {
      if (nav.share && (!nav.canShare || nav.canShare({ text: texte, url }))) {
        await nav.share({ title: clubShort, text: texte, url });
        fermer();
        return;
      }
      await navigator.clipboard.writeText(`${texte} ${url}`);
      // Sans feuille de partage (ordinateur), le lien partait dans le
      // presse-papier sans un mot : on croyait que le bouton ne marchait pas.
      setCopie(true);
      setTimeout(() => {
        setCopie(false);
        fermer();
      }, 1400);
    } catch (e) {
      // Partage annulé par l'utilisateur : rien à dire.
      if (e instanceof DOMException && e.name === "AbortError") return;
      window.prompt("Le lien à envoyer :", url);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="verre lueur"
        style={{ height: 50, borderRadius: 25, padding: "0 18px 0 11px", gap: 10, maxWidth: "100%" }}
      >
        <Ecusson camp="A" lettre={clubShort[0]?.toUpperCase() ?? "?"} taille={28} />
        <span className="min-w-0 truncate">{clubShort}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fermer"
            onClick={fermer}
            className="menu-club-fond"
          />
          <div className="menu-club" role="menu">
            <div className="menu-club-tete">
              <span
                className="ecusson A"
                style={{ width: 48, height: 48, fontSize: 16 }}
                aria-hidden
              >
                {ini(userName)}
              </span>
              <Link
                href={myPlayerId ? `${base}/players/${myPlayerId}` : `${base}/players`}
                onClick={fermer}
                className="text-[20px] font-semibold text-[color:var(--i2)]"
              >
                Mon profil
              </Link>
            </div>
            {item(base, "Accueil", "accueil", true)}
            {item(`${base}/sessions`, "Soirées", "soirees")}
            {item(`${base}/matches`, "Matchs", "matchs")}
            {item(`${base}/players`, "Effectif", "effectif", true)}
            {item(`${base}/saison`, "Saison", "saison")}
            {item(`${base}/stats`, "Stats", "stats")}
            {(publicUrl || invite) && (
              <button
                type="button"
                onClick={partager}
                className="menu-club-item"
                aria-live="polite"
              >
                <Ico d={ICONES.partager} />
                {copie ? "Lien copié" : invite ? "Inviter au club" : "Partager"}
              </button>
            )}
            {canManage && item(`${base}/settings`, "Réglages", "reglages")}
            <Link href="/onboarding" onClick={fermer} className="menu-club-item">
              <Ico d={ICONES.clubs} />
              Mes clubs
            </Link>
            <button
              type="button"
              className="menu-club-item danger"
              onClick={async () => {
                // Le cache du service worker garde les pages de CET
                // utilisateur ; sur un appareil partagé, la personne suivante
                // les verrait hors-ligne. On le vide avant de partir.
                navigator.serviceWorker?.controller?.postMessage({
                  type: "PURGE",
                });
                await signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              <Ico d="M9 4H5v16h4M13 8l4 4-4 4M17 12H8" />
              Se déconnecter
            </button>
          </div>
        </>
      )}
    </>
  );
}
