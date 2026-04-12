import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiveMatch from "./LiveMatch";

export const dynamic = "force-dynamic";

export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      players: { include: { player: true } },
      goals: true,
    },
  });
  if (!match) notFound();
  if (match.status === "FINISHED") redirect(`/matches/${id}`);

  const goalsByPlayer = match.goals.reduce<Record<string, number>>(
    (acc, g) => {
      acc[g.scorerId] = (acc[g.scorerId] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <LiveMatch
      matchId={match.id}
      teamAName={match.teamAName}
      teamBName={match.teamBName}
      initialScoreA={match.scoreA}
      initialScoreB={match.scoreB}
      teamA={match.players
        .filter((mp) => mp.team === "A")
        .map((mp) => ({
          id: mp.player.id,
          name: mp.player.name,
          goals: goalsByPlayer[mp.player.id] ?? 0,
        }))}
      teamB={match.players
        .filter((mp) => mp.team === "B")
        .map((mp) => ({
          id: mp.player.id,
          name: mp.player.name,
          goals: goalsByPlayer[mp.player.id] ?? 0,
        }))}
    />
  );
}
