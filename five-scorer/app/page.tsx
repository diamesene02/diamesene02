import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserSession, getUserClubs } from "@/lib/guard";
import Icon from "@/components/Icon";

export const metadata: Metadata = {
  title: "Five Scorer — le suivi de matchs de ton équipe",
  description:
    "Scoring live au bord du terrain, stats de saison, équipes équilibrées automatiquement, vote du MVP. Pour ton five du jeudi comme pour ton club du dimanche.",
};

export const dynamic = "force-dynamic";

// Pas d'icône décorative : chaque titre dit déjà ce que fait la carte.
// Une icône par entrée est un anti-motif ; le texte se lit plus vite.
const FEATURES: { title: string; body: string }[] = [
  {
    title: "Scoring live",
    body: "Tape +1, c'est marqué. Buts, passes, csc, cartons — même sans réseau, ça sync après.",
  },
  {
    title: "Équipes équilibrées",
    body: "Le générateur répartit les présents selon leur niveau. Fini les équipes déséquilibrées et les débats de 20 minutes.",
  },
  {
    title: "Stats de saison",
    body: "Buteurs, forme, séries, % de victoires. Les chiffres qui alimentent les débats du vestiaire.",
  },
  {
    title: "MVP au vote",
    body: "Après chaque match, les membres votent. L'égo en jeu, chaque semaine.",
  },
  {
    title: "Soirées & présences",
    body: "Programme ta session, chacun répond présent/absent, les présents remplissent le générateur.",
  },
  {
    title: "Mode adversaire",
    body: "Ton équipe contre le reste du monde : bilan, face-à-face par adversaire, barème de points configurable.",
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "Crée ton club",
    body: "Un nom, et c'est parti. Ton espace, tes joueurs, tes règles.",
  },
  {
    title: "Invite avec un lien",
    body: "Un lien à coller dans le groupe WhatsApp, chacun rejoint en deux clics.",
  },
  {
    title: "Lance le premier match",
    body: "Équipes générées, coup d'envoi, et l'historique commence à s'écrire.",
  },
];

export default async function LandingPage() {
  const session = await getUserSession();
  if (session) {
    const clubs = await getUserClubs(session.user.id);
    redirect(clubs.length === 1 ? `/c/${clubs[0].org.slug}` : "/onboarding");
  }

  return (
    <main className="relative min-h-screen">
      {/* Lignes de terrain en fond */}
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-6">
        {/* Barre du haut */}
        <header className="flex items-center justify-between gap-3">
          <span className="brand-pill">
            <Icon name="ball" size={14} />
            Five Scorer
          </span>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full bg-[color:var(--bg-2)] px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-[color:var(--stroke)]"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[color:var(--lime)] px-4 py-2 text-xs font-black uppercase tracking-wider text-[color:var(--bg-0)] transition-colors hover:bg-white"
            >
              Créer un compte
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="aurora edge-top relative mt-6 overflow-hidden p-8 sm:p-12">
          <div className="relative z-[1] flex flex-col items-start gap-5">
            <span className="kicker">Le foot entre potes, pris au sérieux</span>
            <h1 className="display-xl">
              Marque <em>vite</em>.
              <br />
              Regarde <em>mieux</em>.
            </h1>
            <p className="max-w-xl text-base text-[color:var(--ink-1)] sm:text-lg">
              Scoring live au bord du terrain, stats de saison, équipes
              équilibrées automatiquement, vote du MVP. Pour ton five du jeudi
              comme pour ton club du dimanche.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/signup" className="btn primary big">
                Créer mon club — c&apos;est gratuit
              </Link>
              <Link href="/onboarding" className="btn ghost big">
                J&apos;ai un code d&apos;invitation
              </Link>
            </div>
          </div>
        </section>

        {/* Ce que ça fait */}
        <section className="mt-12">
          <span className="kicker mb-4 block">Tout le match, rien d&apos;autre</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="edge-top p-5 transition-colors hover:bg-[color:var(--bg-2)]"
              >
                <h3 className="mt-1 text-lg font-black leading-tight tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-1)]">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="mt-14">
          <span className="kicker mb-4 block">Trois touches, un but</span>
          <div className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="rounded-lg bg-[color:var(--bg-1)] p-5"
              >
                <div className="num-sculpt text-5xl">0{i + 1}</div>
                <h3 className="mt-4 text-lg font-black leading-tight tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-1)]">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Dernier appel */}
        <section className="edge-top mt-14 p-8 text-center sm:p-10">
          <h2 className="display-md">
            Le prochain match compte <em>déjà</em>.
          </h2>
          <div className="mt-6 flex justify-center">
            <Link href="/signup" className="btn primary big">
              Créer mon club — c&apos;est gratuit
            </Link>
          </div>
        </section>

        {/* Emporte l'app */}
        <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[color:var(--bg-1)] p-6">
          <div>
            <span className="kicker">Sur ton téléphone</span>
            <p className="mt-2 max-w-md text-sm text-[color:var(--ink-1)]">
              Android : télécharge l&apos;APK. iPhone : ouvre le site dans
              Safari puis « Ajouter à l&apos;écran d&apos;accueil » — c&apos;est
              une PWA, elle s&apos;installe toute seule.
            </p>
          </div>
          <a
            href="https://github.com/diamesene02/diamesene02/releases/tag/apk-latest"
            className="btn ghost"
          >
            APK Android
          </a>
        </section>

        {/* Pied de page */}
        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--stroke)] pt-6 text-xs text-[color:var(--ink-2)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Five Scorer — open source, offline-first.</span>
            <Link href="/privacy" className="hover:text-white">
              Confidentialité
            </Link>
            <Link href="/terms" className="hover:text-white">
              CGU
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="font-bold hover:text-white">
              Se connecter
            </Link>
            <Link href="/signup" className="font-bold hover:text-white">
              Créer un compte
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
