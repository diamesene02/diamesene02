import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Five Scorer",
  description:
 "Les règles du jeu pour utiliser Five Scorer : simples, courtes, honnêtes.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-black leading-tight tracking-tight text-[color:var(--ink-0)]">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-7 text-[color:var(--ink-1)]">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="relative min-h-screen">
      {/* Lignes de terrain en fond */}
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-2xl px-5 pb-16 pt-8">
        <Link href="/">
          <span className="brand-pill">
            <Icon name="ball" size={14} />
            Five Scorer
          </span>
        </Link>

        <div className="mt-10 flex flex-col gap-4">
          <span className="kicker">Dernière mise à jour : 24 août 2026</span>
          <h1 className="display-md">
            Conditions <em>d&apos;utilisation</em>.
          </h1>
          <p className="text-base leading-7 text-[color:var(--ink-1)]">
            Les règles du jeu, en version courte et lisible. En utilisant Five
            Scorer, tu acceptes ce qui suit.
          </p>
        </div>

        <Section title="Le service">
          <p>
            Five Scorer est fourni tel quel, gratuitement, et son code est open
            source. On fait de notre mieux pour qu&apos;il fonctionne bien,
            mais il n&apos;y a aucune garantie de disponibilité ou
            d&apos;absence de bugs — c&apos;est un projet fait avec sérieux,
            pas un contrat de niveau de service.
          </p>
        </Section>

        <Section title="Tes données, ta responsabilité">
          <p>
            Tu es responsable des données que tu saisis, y compris celles qui
            concernent d&apos;autres personnes. Concrètement : ne crée pas de
            joueur au nom de quelqu&apos;un qui s&apos;y oppose, et retire-le
            s&apos;il te le demande. Les admins de club sont responsables de ce
            que leur club publie (vitrine publique, récaps partagés).
          </p>
        </Section>

        <Section title="Usage acceptable">
          <p>
            Pas d&apos;usage illicite, pas de harcèlement, pas de contenu
            portant atteinte aux droits d&apos;autrui. L&apos;app sert à
            suivre des matchs de foot — reste dans ce cadre.
          </p>
        </Section>

        <Section title="Ton compte">
          <p>
            Tu peux demander la suppression de ton compte et de tes données à
            tout moment en écrivant à{" "}
            <a
              href="mailto:diamesene02@gmail.com"
              className="font-bold text-[color:var(--ink-1)] underline underline-offset-2"
            >
              diamesene02@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="Évolution du service">
          <p>
            Le service évolue : des fonctionnalités peuvent être ajoutées,
            modifiées ou retirées. Les changements importants de ces conditions
            seront reflétés sur cette page, avec la date de mise à jour en
            haut.
          </p>
        </Section>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t border-[color:var(--rule)] pt-6 text-xs text-[color:var(--ink-2)]">
          <Link href="/" className="font-bold hover:text-white">
            ← Retour à l&apos;accueil
          </Link>
          <Link href="/privacy" className="font-bold hover:text-white">
            Politique de confidentialité
          </Link>
        </footer>
      </div>
    </main>
  );
}
