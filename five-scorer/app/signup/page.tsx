import type { Metadata } from "next";
import Link from "next/link";
import Bienvenue from "@/components/ios/Bienvenue";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Créer un compte — Five Scorer",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  // Redirection interne uniquement — jamais vers un domaine externe.
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : undefined;

  return (
    <Bienvenue
      compact
      accroche="Entre dans le match."
      pied={
        <>
          Déjà un compte ?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Connecte-toi</Link>
        </>
      }
    >
      <section className="carte bv-carte">
        <SignupForm next={next} googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID)} />
      </section>
    </Bienvenue>
  );
}
