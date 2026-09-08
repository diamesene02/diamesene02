import Link from "next/link";
import ClubTheme from "@/components/ClubTheme";
import Ecusson from "./Ecusson";
import "@/app/accueil.css";

// La coquille des écrans publics : le thème par défaut (les chasubles de
// base, sombre), l'icône, le nom, l'accroche. Ce qui suit — boutons ou
// formulaire — vient de la page.
export default function Bienvenue({
  compact = false,
  titre = "Five Scorer",
  accroche,
  children,
  pied,
  colorA,
  colorB,
}: {
  compact?: boolean;
  titre?: string;
  accroche?: React.ReactNode;
  children: React.ReactNode;
  pied?: React.ReactNode;
  colorA?: string | null;
  colorB?: string | null;
}) {
  return (
    <div data-club-theme data-theme="dark">
      <ClubTheme colorA={colorA ?? null} colorB={colorB ?? null} theme="dark" />
      <main className="bv ecran">
        <div className={`bv-haut${compact ? " compact" : ""}`}>
          <Link href="/" aria-label="Five Scorer">
            <Ecusson camp="A" lettre="F" className="bv-icone" />
          </Link>
          <div className="bv-titre">{titre}</div>
          {accroche && <div className="bv-accroche">{accroche}</div>}
        </div>
        {children}
        {pied && <div className="bv-pied">{pied}</div>}
      </main>
    </div>
  );
}
