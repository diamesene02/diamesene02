import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import NewMatchForm from "./NewMatchForm";
import { nomsChasubles } from "@/lib/color";

export const dynamic = "force-dynamic";

export default async function NewMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ md?: string; scheduled?: string; joue?: string }>;
}) {
  const { slug } = await params;
  const { md, scheduled: scheduledId, joue } = await searchParams;
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
              // La compo préparée trois jours plus tôt : elle vaut mieux
              // qu'une préselection « tout le monde en A ».
              lineup: {
                where: { player: { isArchived: false } },
                select: { playerId: true, team: true, isGk: true },
              },
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
    <main className="ecran">
      <div className="titre-ecran" style={{ padding: "18px 4px 16px" }}>
        {scheduled
          ? "Composer les équipes"
          : joue === "1"
            ? "Saisir un match joué"
            : "Nouveau match"}
      </div>
      <NewMatchForm
        clubId={ctx.club.id}
        slug={slug}
        initialPlayers={players.map((p) => ({ ...p, clubId: ctx.club.id }))}
        opponents={opponents}
        seasonId={activeSeason?.id ?? null}
        matchDayId={matchDay?.id ?? null}
        presentPlayerIds={presentPlayerIds}
        scheduled={scheduled}
        compoPreparee={
          matchDay?.lineup.map((l) => ({
            playerId: l.playerId,
            team: l.team as "A" | "B",
          })) ?? []
        }
        dateSoiree={matchDay?.date.toISOString() ?? null}
        saisieApresCoup={joue === "1"}
        nomsParDefaut={
          matchDay?.teamAName && matchDay?.teamBName
            ? { a: matchDay.teamAName, b: matchDay.teamBName }
            : nomsChasubles(ctx.club.colorA, ctx.club.colorB)
        }
      />
    </main>
  );
}
