import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import ClubSettingsForm from "./ClubSettingsForm";
import InviteCard from "./InviteCard";
import MembersTable from "./MembersTable";
import SeasonsCard from "./SeasonsCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canManage) redirect(`/c/${slug}`);
  const clubId = ctx.club.id;

  const [members, linkedPlayers, seasons] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: ctx.org.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.player.findMany({
      where: { clubId, userId: { not: null } },
      select: { userId: true, name: true },
    }),
    prisma.season.findMany({
      where: { clubId },
      orderBy: { startsAt: "desc" },
    }),
  ]);

  const playerByUser = new Map(
    linkedPlayers.map((p) => [p.userId as string, p.name])
  );

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  return (
    <main className="space-y-8">
      <div>
        <span className="kicker">La gestion</span>
        <h1 className="display-md mt-1">Réglages</h1>
      </div>

      <ClubSettingsForm
        slug={slug}
        initial={{
          name: ctx.org.name,
          colorA: ctx.club.colorA,
          colorB: ctx.club.colorB,
          format: ctx.club.format,
          matchDurationMin: ctx.club.matchDurationMin,
          pointsWin: ctx.club.pointsWin,
          pointsDraw: ctx.club.pointsDraw,
          trackAssists: ctx.club.trackAssists,
          trackCards: ctx.club.trackCards,
          membersCanScore: ctx.club.membersCanScore,
          motmMode: ctx.club.motmMode,
          isPublic: ctx.club.isPublic,
        }}
      />

      <InviteCard slug={slug} inviteCode={ctx.club.inviteCode} />

      <MembersTable
        slug={slug}
        currentUserId={ctx.user.id}
        members={members.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          playerName: playerByUser.get(m.user.id) ?? null,
          role: m.role,
        }))}
      />

      <SeasonsCard
        slug={slug}
        seasons={seasons.map((s) => ({
          id: s.id,
          name: s.name,
          isActive: s.isActive,
          period: `${fmtDate(s.startsAt)}${
            s.endsAt ? ` → ${fmtDate(s.endsAt)}` : " → en cours"
          }`,
        }))}
      />
    </main>
  );
}
