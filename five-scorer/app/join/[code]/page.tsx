import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/guard";
import Icon from "@/components/Icon";
import JoinButton from "./JoinButton";

export const metadata: Metadata = {
  title: "Invitation — Five Scorer",
};

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const club = await prisma.club.findUnique({
    where: { inviteCode: code },
    include: { organization: true },
  });

  if (!club) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-12">
        <div className="pointer-events-none fixed inset-0 opacity-30">
          <div className="pitch-motif absolute inset-0" />
        </div>
        <div className="relative w-full max-w-sm text-center">
          <Link href="/">
            <span className="brand-pill">
              <Icon name="ball" size={14} />
              Five Scorer
            </span>
          </Link>
          <div className="edge-top mt-8 p-8">
            <span className="kicker">Invitation</span>
            <h1 className="display-md mt-2">
              Lien invalide ou <em>expiré</em>.
            </h1>
            <p className="mt-3 text-sm text-[color:var(--ink-1)]">
              Demande un nouveau lien au capitaine du club — les codes peuvent
              être régénérés.
            </p>
            <Link href="/" className="btn ghost mt-6">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [memberCount, session] = await Promise.all([
    prisma.member.count({ where: { organizationId: club.id } }),
    getUserSession(),
  ]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>
      <div className="relative w-full max-w-sm text-center">
        <Link href="/">
          <span className="brand-pill">
            <Icon name="ball" size={14} />
            Five Scorer
          </span>
        </Link>
        <div className="aurora edge-top mt-8 overflow-hidden p-8">
          <span className="kicker">Invitation</span>
          <h1 className="display-md mt-3 break-words">
            Tu es invité·e à rejoindre <em>{club.organization.name}</em>
          </h1>
          <p className="mt-3 text-sm text-[color:var(--ink-1)]">
            {memberCount} membre{memberCount > 1 ? "s" : ""} t&apos;
            {memberCount > 1 ? "attendent" : "attend"} déjà sur le terrain.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {session ? (
              <JoinButton code={code} />
            ) : (
              <>
                <Link
                  href={`/signup?next=${encodeURIComponent(`/join/${code}`)}`}
                  className="btn primary big w-full"
                >
                  Créer un compte et rejoindre
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}
                  className="btn ghost w-full"
                >
                  J&apos;ai déjà un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
