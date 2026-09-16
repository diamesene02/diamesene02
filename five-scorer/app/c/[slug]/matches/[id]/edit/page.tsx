import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import * as D from "@/lib/dates";
import EditMatchForm from "./EditMatchForm";

export const dynamic = "force-dynamic";

export default async function EditMatchPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canManage) redirect(`/c/${slug}/matches/${id}`);

  const match = await prisma.match.findFirst({
    where: { id, clubId: ctx.club.id },
    include: {
      participants: {
        include: { player: { select: { id: true, name: true } } },
      },
    },
  });
  if (!match) notFound();

  const seasons = await prisma.season.findMany({
    where: { clubId: ctx.club.id },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, isActive: true },
  });
  // Rattacher un match à sa soirée après coup (APRES-15) : la liste des
  // soirées du club, la plus récente d'abord.
  const matchDays = await prisma.matchDay.findMany({
    where: { clubId: ctx.club.id },
    orderBy: { date: "desc" },
    select: { id: true, date: true, title: true, location: true },
  });

  return (
    <main className="mx-auto max-w-xl">
      <span className="kicker">Correction</span>
      <h1 className="display-md mt-1">Modifier le match</h1>

      <div className="mt-6">
        <EditMatchForm
          slug={slug}
          matchId={match.id}
          initial={{
            teamAName: match.teamAName,
            teamBName: match.teamBName,
            playedAt: match.playedAt.toISOString(),
            mvpId: match.mvpId,
            seasonId: match.seasonId,
            matchDayId: match.matchDayId,
            notes: match.notes ?? "",
          }}
          participants={match.participants.map((p) => ({
            id: p.player.id,
            name: p.player.name,
            team: p.team,
          }))}
          seasons={seasons}
          matchDays={matchDays.map((md) => ({
            id: md.id,
            libelle: `${D.jourAbrege(md.date)} · ${D.heure(md.date)}${md.title ? ` · ${md.title}` : md.location ? ` · ${md.location}` : ""}`,
          }))}
        />
      </div>
    </main>
  );
}
