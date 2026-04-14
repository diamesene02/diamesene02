import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EditMatchForm from "@/components/EditMatchForm";

export const dynamic = "force-dynamic";

export default async function EditMatchPage({
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

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-4">
      <Link
        href={`/matches/${id}`}
        className="text-sm text-[color:var(--ink-2)] hover:text-white"
      >
        ← Match
      </Link>

      <header>
        <h1 className="text-2xl font-black tracking-tight">Éditer le match</h1>
        <p className="text-sm text-[color:var(--ink-2)]">
          Corrige le score, le MVP, supprime un but, ou annule le match.
        </p>
      </header>

      <EditMatchForm
        match={{
          id: match.id,
          teamAName: match.teamAName,
          teamBName: match.teamBName,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          status: match.status,
          mvpId: match.mvpId,
        }}
        players={match.players.map((mp) => ({
          id: mp.playerId,
          name: mp.player.name,
          team: mp.team,
        }))}
        goals={match.goals.map((g) => ({
          id: g.id,
          scorerId: g.scorerId,
          scorerName: g.scorer.name,
          assistId: g.assistId,
          assistName: g.assist?.name ?? null,
          team: g.team,
          minute: g.minute,
        }))}
      />
    </main>
  );
}
