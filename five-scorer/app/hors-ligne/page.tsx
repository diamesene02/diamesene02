import HorsLigneActions from "./HorsLigneActions";

// Servie par le service worker quand aucune page utile n'est en cache pour
// l'URL demandée. Statique, donc pré-cachée à l'installation du service
// worker : c'est le dernier filet, jamais la page vitrine.
export const dynamic = "force-static";

export default function HorsLignePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pt-16">
      <div className="bande creuse">
        <div className="contexte">Hors-ligne</div>
        <h1 className="display-md mt-2">Le serveur est injoignable.</h1>
        <p className="mt-3 text-[color:var(--ink-2)]">
          Cette page n&apos;a jamais été ouverte avec du réseau, elle n&apos;est
          donc pas en mémoire. Un match déjà lancé, lui, se retrouve depuis
          l&apos;accueil du club.
        </p>
        <HorsLigneActions />
      </div>
    </main>
  );
}
