import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Five Scorer",
  description:
 "Ce que Five Scorer collecte, pourquoi, où c'est hébergé, et comment exercer tes droits.",
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

export default function PrivacyPage() {
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
            Politique de <em>confidentialité</em>.
          </h1>
          <p className="text-base leading-7 text-[color:var(--ink-1)]">
            Five Scorer est une application de suivi de matchs de foot entre
            potes. Pas de pub, pas de revente de données, pas de tracking.
            Voici exactement ce qu&apos;on collecte et pourquoi.
          </p>
        </div>

        <Section title="Qui est responsable ?">
          <p>
            L&apos;application Five Scorer (
            <a
              href="https://five-scorer.vercel.app"
              className="font-bold text-[color:var(--ink-1)] underline underline-offset-2"
            >
              five-scorer.vercel.app
            </a>
            ). Pour toute question ou demande liée à tes données :{" "}
            <a
              href="mailto:diamesene02@gmail.com"
              className="font-bold text-[color:var(--ink-1)] underline underline-offset-2"
            >
              diamesene02@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="Quelles données sont collectées ?">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong className="text-[color:var(--ink-0)]">
                Données de compte
              </strong>{" "}
              : nom affiché, adresse e-mail, mot de passe (stocké haché, jamais
              en clair).
            </li>
            <li>
              <strong className="text-[color:var(--ink-0)]">
                Données sportives saisies par les clubs
              </strong>{" "}
              : joueurs (potentiellement des noms réels, saisis par les admins
              de club), matchs, buts, présences, votes MVP, paiements de
              session notés par le club.
            </li>
            <li>
              <strong className="text-[color:var(--ink-0)]">
                Données techniques minimales
              </strong>{" "}
              : cookie de session d&apos;authentification et logs serveur
              (nécessaires au fonctionnement et à la sécurité).
            </li>
          </ul>
        </Section>

        <Section title="Pour quoi faire ?">
          <p>
            Uniquement pour fournir le service : gérer les comptes, les clubs
            et les statistiques. Pas de publicité, pas de revente de données,
            pas de tracking tiers, pas d&apos;analytics tiers.
          </p>
        </Section>

        <Section title="Où sont hébergées les données ?">
          <p>
            L&apos;application est hébergée chez Vercel et la base de données
            chez Supabase. Les données transitent chiffrées (HTTPS).
          </p>
        </Section>

        <Section title="Combien de temps ?">
          <p>
            Tant que ton compte ou ton club existe. Tu peux demander la
            suppression de ton compte et de tes données à l&apos;adresse de
            contact ci-dessus. Un admin de club peut aussi supprimer joueurs et
            matchs directement depuis l&apos;app.
          </p>
        </Section>

        <Section title="Pages publiques">
          <p>
            Un club peut activer une vitrine publique (classements, résultats)
            : elle est visible par tout le monde tant que l&apos;option est
            active — un admin peut la désactiver à tout moment. Les récaps de
            match partagés par lien sont accessibles à toute personne disposant
            du lien.
          </p>
        </Section>

        <Section title="Tes droits (RGPD)">
          <p>
            Tu peux demander l&apos;accès, la rectification ou la suppression
            de tes données en écrivant à{" "}
            <a
              href="mailto:diamesene02@gmail.com"
              className="font-bold text-[color:var(--ink-1)] underline underline-offset-2"
            >
              diamesene02@gmail.com
            </a>
            . Cela vaut aussi si un club a saisi ton nom comme joueur et que tu
            souhaites qu&apos;il soit retiré.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Un seul cookie : celui de la session d&apos;authentification, qui
            te garde connecté. Aucun cookie tiers, aucun cookie publicitaire.
          </p>
        </Section>

        <footer className="mt-12 flex flex-wrap items-center gap-4 border-t border-[color:var(--rule)] pt-6 text-xs text-[color:var(--ink-2)]">
          <Link href="/" className="font-bold hover:text-white">
            ← Retour à l&apos;accueil
          </Link>
          <Link href="/terms" className="font-bold hover:text-white">
            Conditions d&apos;utilisation
          </Link>
        </footer>
      </div>
    </main>
  );
}
