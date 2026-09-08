import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserSession, getUserClubs } from "@/lib/guard";
import Bienvenue from "@/components/ios/Bienvenue";

export const metadata: Metadata = {
  title: "Five Scorer — le score de vos lundis soirs",
  description:
    "Buts, équipes, classement — même sans réseau. Le suivi de matchs de ton five et de ton club du dimanche.",
};

export const dynamic = "force-dynamic";

// L'écran « Bienvenue » de la maquette : l'icône, le nom, l'accroche, et les
// façons d'entrer. Quelqu'un de connecté ne le voit jamais : il file dans
// son club.
export default async function LandingPage() {
  const session = await getUserSession();
  if (session) {
    const clubs = await getUserClubs(session.user.id);
    redirect(clubs.length === 1 ? `/c/${clubs[0].org.slug}` : "/onboarding");
  }
  const google = Boolean(process.env.GOOGLE_CLIENT_ID);

  return (
    <Bienvenue
      accroche={
        <>
          Le score de vos lundis soirs.
          <br />
          Buts, équipes, classement — même sans réseau.
        </>
      }
      pied={
        <>
          Un code d&apos;invitation ? <Link href="/login?next=/onboarding">Rejoindre un club</Link>
          <br />
          En continuant, tu acceptes les <Link href="/terms">conditions</Link> et la{" "}
          <Link href="/privacy">politique de confidentialité</Link>.
        </>
      }
    >
      <div className="bv-actions">
        {google && (
          <Link href="/login?google=1" className="plein">
            Continuer avec Google
          </Link>
        )}
        <Link href="/login" className={google ? "verre" : "plein"}>
          Continuer avec un e-mail
        </Link>
        <Link href="/signup" className="verre">
          Créer un compte
        </Link>
      </div>
    </Bienvenue>
  );
}
