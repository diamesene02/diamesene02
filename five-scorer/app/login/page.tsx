import type { Metadata } from "next";
import Link from "next/link";
import Bienvenue from "@/components/ios/Bienvenue";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Connexion — Five Scorer",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; session?: string; google?: string }>;
}) {
  const sp = await searchParams;
  // Renvoyé ici par /session-expiree quand le compte de la session a disparu.
  const sessionExpiree = sp.session === "expiree";
  // Redirection interne uniquement — jamais vers un domaine externe.
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : undefined;

  return (
    <Bienvenue
      compact
      accroche="Reviens sur le terrain."
      pied={
        <>
          Pas de compte ?{" "}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Crée-le</Link>
        </>
      }
    >
      {sessionExpiree && <p className="bv-erreur">Ta session a expiré : reconnecte-toi.</p>}
      <section className="carte bv-carte">
        <LoginForm
          next={next}
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID)}
          googleDirect={sp.google === "1"}
        />
      </section>
    </Bienvenue>
  );
}
