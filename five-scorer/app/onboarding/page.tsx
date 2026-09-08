import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, getUserClubs } from "@/lib/guard";
import { getUnclaimedLegacyClub } from "@/lib/legacy";
import Bienvenue from "@/components/ios/Bienvenue";
import Ecusson from "@/components/ios/Ecusson";
import { lettre } from "@/lib/ini";
import CreateClubForm from "./CreateClubForm";
import JoinClubForm from "./JoinClubForm";
import ClaimLegacyForm from "./ClaimLegacyForm";
import Deplier from "./Deplier";

export const metadata: Metadata = {
  title: "Mes clubs — Five Scorer",
};

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Capitaine",
  admin: "Admin",
  member: "Joueur",
};

// Mes clubs, puis « Ton club » — la création de la maquette — puis le code
// d'invitation. Sans club, la création s'ouvre d'elle-même.
export default async function OnboardingPage() {
  const session = await requireUser();
  const [clubs, legacy] = await Promise.all([getUserClubs(session.user.id), getUnclaimedLegacyClub()]);

  return (
    <Bienvenue compact titre={`Salut ${session.user.name}`} accroche={clubs.length > 0 ? "Tes clubs." : "Ton club t'attend."}>
      {clubs.length > 0 && (
        <>
          <div className="bv-section">Mes clubs</div>
          <section className="carte">
            {clubs.map(({ role, org }) => (
              <Link key={org.id} href={`/c/${org.slug}`} className="bv-club">
                <Ecusson camp="A" lettre={lettre(org.name)} taille={40} style={{ borderRadius: 11 }} />
                <span className="nom">{org.name}</span>
                <span className="role">{ROLE_LABEL[role] ?? "Joueur"}</span>
                <span className="chevron">›</span>
              </Link>
            ))}
          </section>
        </>
      )}

      {legacy && (
        <>
          <div className="bv-section">Ton historique t&apos;attend</div>
          <section className="carte bv-carte">
            <p style={{ fontSize: 15, color: "var(--i2)", marginBottom: 12 }}>
              L&apos;appli a changé de peau, pas de mémoire. Les matchs et joueurs d&apos;avant la v2 sont dans le club «&nbsp;{legacy.name}&nbsp;». Saisis l&apos;ancien PIN admin pour en devenir capitaine.
            </p>
            <ClaimLegacyForm />
          </section>
        </>
      )}

      <div className="bv-section">Créer un club</div>
      {clubs.length === 0 ? (
        <>
          <p className="bv-accroche" style={{ padding: "0 16px 8px", fontSize: 15, textAlign: "left" }}>
            Les couleurs des chasubles habillent toute l&apos;app — regarde le fond changer.
          </p>
          <CreateClubForm />
        </>
      ) : (
        <section className="carte">
          <Deplier libelle="Ton club" aide="Un nom, deux chasubles, et c'est parti.">
            <p className="bv-accroche" style={{ padding: "0 0 8px", fontSize: 15, textAlign: "left" }}>
              Les couleurs des chasubles habillent toute l&apos;app — regarde le fond changer.
            </p>
            <CreateClubForm />
          </Deplier>
        </section>
      )}

      <div className="bv-section">Rejoindre un club</div>
      <section className="carte bv-carte">
        <p style={{ fontSize: 15, color: "var(--i2)", marginBottom: 12 }}>
          On t&apos;a filé un code d&apos;invitation ? Colle-le ici et rejoins ton équipe.
        </p>
        <JoinClubForm />
      </section>
    </Bienvenue>
  );
}
