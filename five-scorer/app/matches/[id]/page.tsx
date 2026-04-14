import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RecapView from "@/components/RecapView";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MatchRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      mvp: true,
      players: { include: { player: true } },
      goals: {
        include: { scorer: true, assist: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!match) notFound();

  const admin = await isAdmin();

  return (
    <main className="recap-wrap mx-auto max-w-xl p-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-[color:var(--ink-2)] hover:text-white">
          ← Accueil
        </Link>
        {admin ? (
          <Link
            href={`/matches/${match.id}/edit`}
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-500/20"
          >
            🔒 Éditer
          </Link>
        ) : (
          <Link
            href={`/admin?next=/matches/${match.id}`}
            className="rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-2)] hover:text-white"
          >
            Admin
          </Link>
        )}
      </div>
      <RecapView
        match={{
          id: match.id,
          playedAt: match.playedAt.toISOString(),
          teamAName: match.teamAName,
          teamBName: match.teamBName,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          status: match.status,
          mvpId: match.mvpId,
        }}
        mvpName={match.mvp?.name ?? null}
        teamA={match.players
          .filter((mp) => mp.team === "A")
          .map((mp) => ({
            id: mp.playerId,
            name: mp.player.name,
            goals: match.goals.filter((g) => g.scorerId === mp.playerId).length,
            assists: match.goals.filter((g) => g.assistId === mp.playerId).length,
            team: "A" as const,
          }))}
        teamB={match.players
          .filter((mp) => mp.team === "B")
          .map((mp) => ({
            id: mp.playerId,
            name: mp.player.name,
            goals: match.goals.filter((g) => g.scorerId === mp.playerId).length,
            assists: match.goals.filter((g) => g.assistId === mp.playerId).length,
            team: "B" as const,
          }))}
        goals={match.goals.map((g) => ({
          id: g.id,
          scorerId: g.scorerId,
          assistId: g.assistId,
          team: g.team,
          minute: g.minute,
          createdAt: g.createdAt.toISOString(),
          scorerName: g.scorer.name,
          assistName: g.assist?.name ?? null,
        }))}
        showLiveResumeLink={match.status === "LIVE"}
      />
    </main>
  );
}
