import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getLeaderboard } from "@/lib/stats";
import RosterClient from "./RosterClient";
import "./player.css";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { slug } = await params;
  const { edit } = await searchParams;
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
    photo: p.photo,
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
      <div className="titre-ecran" style={{ padding: "18px 4px 2px" }}>
        Effectif
      </div>
      <div className="sous-titre" style={{ padding: "0 4px 14px" }}>
        {activeCount} joueur{activeCount > 1 ? "s" : ""} au vestiaire
      </div>

      <RosterClient
        slug={slug}
        canManage={ctx.canManage}
        userId={ctx.user.id}
        hasLinkedPlayer={hasLinkedPlayer}
        players={players}
        editInitial={ctx.canManage && edit ? edit : null}
      />
    </main>
  );
}
