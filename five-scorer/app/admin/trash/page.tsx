import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import TrashList from "@/components/TrashList";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  if (!(await isAdmin())) {
    redirect("/admin?next=/admin/trash");
  }

  const matches = await prisma.match.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: { mvp: { select: { name: true } } },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-5">
      <Link
        href="/admin"
        className="text-sm text-[color:var(--ink-2)] hover:text-white"
      >
        ← Admin
      </Link>

      <header>
        <span className="kicker">Filet de sécurité</span>
        <h1 className="display-md mt-3">
          Corbeille<span className="text-[color:var(--gold)]">.</span>
        </h1>
        <p className="mt-2 text-sm text-[color:var(--ink-1)]">
          Matchs supprimés — restaurables tant qu&apos;ils ne sont pas purgés.
        </p>
      </header>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-6 text-center text-sm text-[color:var(--ink-2)]">
          La corbeille est vide.
        </div>
      ) : (
        <TrashList
          matches={matches.map((m) => ({
            id: m.id,
            playedAt: m.playedAt.toISOString(),
            deletedAt: m.deletedAt!.toISOString(),
            teamAName: m.teamAName,
            teamBName: m.teamBName,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            status: m.status,
            mvpName: m.mvp?.name ?? null,
          }))}
        />
      )}
    </main>
  );
}
