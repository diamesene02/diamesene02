import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import NewMatchForm from "./NewMatchForm";

export const dynamic = "force-dynamic";

export default async function NewMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ md?: string; scheduled?: string }>;
}) {
  const { slug } = await params;
  const { md, scheduled: scheduledId } = await searchParams;
  const ctx = await requireClub(slug);
  if (!ctx.canScore) redirect(`/c/${slug}`);

  const [players, opponents, activeSeason, matchDay, scheduledMatch] =
    await Promise.all([
      prisma.player.findMany({
        where: { clubId: ctx.club.id, isArchived: false },
        orderBy: [{ isGuest: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          nickname: true,
          skill: true,
          isGk: true,
          isGuest: true,
        },
      }),
      prisma.opponent.findMany({
        where: { clubId: ctx.club.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.season.findFirst({
        where: { clubId: ctx.club.id, isActive: true },
        orderBy: { startsAt: "desc" },
        select: { id: true },
      }),
      md
        ? prisma.matchDay.findFirst({
            where: { id: md, clubId: ctx.club.id },
            include: {
              rsvps: { where: { status: "IN" }, select: { playerId: true } },
            },
          })
        : null,
      // Lancement d'un match programmé : on reprend sa config et ses présents.
      scheduledId
        ? prisma.match.findFirst({
            where: { id: scheduledId, clubId: ctx.club.id, status: "SCHEDULED" },
            include: {
              rsvps: { where: { status: "IN" }, select: { playerId: true } },
            },
          })
        : null,
    ]);

  const scheduled = scheduledMatch
    ? {
        id: scheduledMatch.id,
        kind: scheduledMatch.kind,
        opponentId: scheduledMatch.opponentId,
        matchDayId: scheduledMatch.matchDayId,
        seasonId: scheduledMatch.seasonId,
        teamAName: scheduledMatch.teamAName,
        teamBName: scheduledMatch.teamBName,
      }
    : null;

  const presentPlayerIds = Array.from(
    new Set([
      ...(matchDay?.rsvps.map((r) => r.playerId) ?? []),
      ...(scheduledMatch?.rsvps.map((r) => r.playerId) ?? []),
    ])
  );

  return (
    <main>
      <h1 className="display-md mb-6">
        {scheduled ? "Composer les équipes" : "Nouveau match"}
      </h1>
      <NewMatchForm
        clubId={ctx.club.id}
        slug={slug}
        initialPlayers={players.map((p) => ({ ...p, clubId: ctx.club.id }))}
        opponents={opponents}
        seasonId={activeSeason?.id ?? null}
        matchDayId={matchDay?.id ?? null}
        presentPlayerIds={presentPlayerIds}
        scheduled={scheduled}
      />
    </main>
  );
}
