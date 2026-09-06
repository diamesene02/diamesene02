import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";
import RosterClient from "./RosterClient";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;

  const [roster, leaderboard] = await Promise.all([
    prisma.player.findMany({
      where: { clubId },
      orderBy: { name: "asc" },
    }),
    getLeaderboard({ clubId }),
  ]);

  const statsById = new Map(leaderboard.map((r) => [r.playerId, r]));
  const hasLinkedPlayer = roster.some((p) => p.userId === ctx.user.id);

  const players = roster.map((p) => ({
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    skill: p.skill,
    isGk: p.isGk,
    isGuest: p.isGuest,
    isArchived: p.isArchived,
    isLinked: p.userId !== null,
    matchesPlayed: statsById.get(p.id)?.matchesPlayed ?? 0,
    goals: statsById.get(p.id)?.goals ?? 0,
  }));

  const activeCount = players.filter((p) => !p.isArchived).length;

  return (
    <main>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="kicker">Le vestiaire</span>
          <h1 className="display-md mt-1">Effectif</h1>
        </div>
        <span className="font-mono text-sm font-bold text-[color:var(--ink-2)]">
          {activeCount} joueur{activeCount > 1 ? "s" : ""}
        </span>
      </div>

      <RosterClient
        slug={slug}
        canManage={ctx.canManage}
        userId={ctx.user.id}
        hasLinkedPlayer={hasLinkedPlayer}
        players={players}
      />
    </main>
  );
}
