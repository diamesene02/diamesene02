import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import RecapView from "@/components/RecapView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    select: { teamAName: true, teamBName: true, scoreA: true, scoreB: true, playedAt: true },
  });
  if (!match) return { title: "Match · Five Scorer" };
  const title = `${match.teamAName} ${match.scoreA} — ${match.scoreB} ${match.teamBName}`;
  const date = new Date(match.playedAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  });
  return {
    title: `${title} · Five Scorer`,
    description: `Match du ${date}`,
    openGraph: {
      title,
      description: `Match du ${date}`,
      type: "website",
    },
  };
}

export default async function PublicRecap({ params }: Params) {
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

  return (
    <main className="recap-wrap mx-auto max-w-xl p-4">
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-3 py-1 text-xs uppercase tracking-widest text-[color:var(--ink-1)]">
          <span>⚽</span>
          <span>Five Scorer</span>
        </div>
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
        showActions={true}
      />
    </main>
  );
}
