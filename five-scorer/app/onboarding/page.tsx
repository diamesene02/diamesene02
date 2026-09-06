import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, getUserClubs } from "@/lib/guard";
import { getUnclaimedLegacyClub } from "@/lib/legacy";
import Icon from "@/components/Icon";
import CreateClubForm from "./CreateClubForm";
import JoinClubForm from "./JoinClubForm";
import ClaimLegacyForm from "./ClaimLegacyForm";

export const metadata: Metadata = {
  title: "Mes clubs — Five Scorer",
};

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Capitaine",
  admin: "Admin",
  member: "Joueur",
};

export default async function OnboardingPage() {
  const session = await requireUser();
  const [clubs, legacy] = await Promise.all([
    getUserClubs(session.user.id),
    getUnclaimedLegacyClub(),
  ]);

  return (
    <main className="relative min-h-screen">
      {/* Lignes de terrain en fond */}
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-3xl px-5 pb-20 pt-8">
        <header className="flex items-center justify-between">
          <Link href="/">
            <span className="brand-pill">
              <Icon name="ball" size={14} />
              Five Scorer
            </span>
          </Link>
          <span className="text-sm font-bold text-[color:var(--ink-1)]">
            {session.user.name}
          </span>
        </header>

        <div className="mt-10">
          <span className="kicker">Salut {session.user.name}</span>
          <h1 className="display-md mt-2">
            {clubs.length > 0 ? (
              <>
                Tes <em>clubs</em>.
              </>
            ) : (
              <>
                Ton <em>club</em> t&apos;attend.
              </>
            )}
          </h1>
        </div>

        {/* Mes clubs */}
        {clubs.length > 0 && (
          <section className="mt-8">
            <span className="kicker mb-3 block">Mes clubs</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {clubs.map(({ role, org }) => (
                <Link
                  key={org.id}
                  href={`/c/${org.slug}`}
                  className="edge-top group p-6 transition-colors hover:bg-[color:var(--bg-2)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-lg font-black leading-tight">
                      {org.name}
                    </div>
                    <span
                      className={
                        role === "owner"
                          ? "rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[color:var(--gold)]"
                          : role === "admin"
                            ? "rounded-full bg-[color:var(--b-500)]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[color:var(--b-400)]"
                            : "rounded-full bg-[color:var(--stroke)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[color:var(--ink-1)]"
                      }
                    >
                      {ROLE_LABEL[role] ?? "Joueur"}
                    </span>
                  </div>
                  <div className="mt-3 text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)] group-hover:text-[color:var(--ink-1)]">
                    Entrer →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Historique v1 à revendiquer */}
        {legacy && (
          <section className="edge-top mt-8 p-6">
            <span className="kicker" style={{ color: "var(--gold)" }}>
              Ton historique t&apos;attend
            </span>
            <p className="mt-3 max-w-lg text-sm text-[color:var(--ink-1)]">
              L&apos;appli a changé de peau, pas de mémoire. Les matchs et
              joueurs d&apos;avant la v2 sont dans le club «&nbsp;
              {legacy.name}&nbsp;». Saisis l&apos;ancien PIN admin pour en
              devenir capitaine.
            </p>
            <div className="mt-4">
              <ClaimLegacyForm />
            </div>
          </section>
        )}

        {/* Créer un club */}
        <section className="edge-top mt-8 p-6">
          <span className="kicker">Créer un club</span>
          <p className="mt-3 max-w-lg text-sm text-[color:var(--ink-1)]">
            Ton groupe de five, ton club du dimanche — chaque club a son
            espace, ses joueurs, ses stats.
          </p>
          <div className="mt-4">
            <CreateClubForm />
          </div>
        </section>

        {/* Rejoindre un club */}
        <section className="edge-top mt-8 p-6">
          <span className="kicker">Rejoindre un club</span>
          <p className="mt-3 max-w-lg text-sm text-[color:var(--ink-1)]">
            On t&apos;a filé un code d&apos;invitation ? Colle-le ici et
            rejoins ton équipe.
          </p>
          <div className="mt-4">
            <JoinClubForm />
          </div>
        </section>
      </div>
    </main>
  );
}
