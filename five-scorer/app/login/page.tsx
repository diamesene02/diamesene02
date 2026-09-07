import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Connexion — Five Scorer",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; session?: string }>;
}) {
  const sp = await searchParams;
  // Renvoyé ici par /session-expiree quand le compte de la session a disparu.
  const sessionExpiree = sp.session === "expiree";
  // Redirection interne uniquement — jamais vers un domaine externe.
  const next =
    typeof sp.next === "string" && sp.next.startsWith("/")
      ? sp.next
      : undefined;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-12">
      {/* Lignes de terrain en fond */}
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-start gap-4">
          <Link href="/">
            <span className="brand-pill">
              <Icon name="ball" size={14} />
              Five Scorer
            </span>
          </Link>
          <h1 className="display-md">
            Reviens sur
            <br />
            le <em>terrain</em>.
          </h1>
        </div>

        {sessionExpiree && (
          <p className="mb-4 rounded-[2px] border border-[color:var(--loss)] bg-[color:var(--pitch-2)] p-3 text-sm text-[color:var(--loss)]">
            Ta session a expiré : reconnecte-toi.
          </p>
        )}

        <div className="edge-top p-6">
          <LoginForm
            next={next}
            googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID)}
          />
        </div>

        <p className="mt-6 text-center text-sm text-[color:var(--ink-1)]">
          Pas de compte ?{" "}
          <Link
            href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="font-bold underline underline-offset-2"
          >
            Crée-le
          </Link>
        </p>
      </div>
    </main>
  );
}
