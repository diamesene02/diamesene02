import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import VersionBadge from "@/components/VersionBadge";
import ClubSettingsForm from "./ClubSettingsForm";
import InviteCard from "./InviteCard";
import MembersTable from "./MembersTable";
import SeasonsCard from "./SeasonsCard";
import Deplier from "./Deplier";
import Deconnexion from "./Deconnexion";
import "./settings.css";

export const dynamic = "force-dynamic";

// Les réglages, en listes groupées : Club, Match, Saison, Vitrine, Membres.
// L'invitation, la liste des membres et les saisons se déplient sous leur
// ligne — l'outillage complet reste là, sans allonger la page.
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [ctx, jar] = await Promise.all([requireClub(slug), cookies()]);
  if (!ctx.canManage) redirect(`/c/${slug}`);
  const clubId = ctx.club.id;
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);

  const [members, linkedPlayers, seasons] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: ctx.org.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.player.findMany({ where: { clubId, userId: { not: null } }, select: { userId: true, name: true } }),
    prisma.season.findMany({ where: { clubId }, orderBy: { startsAt: "desc" } }),
  ]);
  const playerByUser = new Map(linkedPlayers.map((p) => [p.userId as string, p.name]));
  const admins = members.filter((m) => m.role === "owner" || m.role === "admin").length;
  const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <main className="ecran">
      <div className="reg-tete">
        <div className="titre-ecran">Réglages</div>
        <div className="sous-titre">{ctx.role === "owner" ? "Propriétaire du club" : "Admin du club"}</div>
      </div>

      <ClubSettingsForm
        slug={slug}
        theme={theme}
        saisonActive={seasons.find((s) => s.isActive)?.name ?? null}
        saisonsCount={seasons.length}
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

      <div className="reg-groupe">
        <div className="section-ios">Membres</div>
        <section className="carte">
          <Deplier libelle="Inviter par lien" valeur={<span className="code-invite">{ctx.club.inviteCode.slice(-8).toUpperCase()}</span>}>
            <InviteCard slug={slug} inviteCode={ctx.club.inviteCode} />
          </Deplier>
          <Deplier libelle={`${members.length} membre${members.length > 1 ? "s" : ""} · ${admins} admin${admins > 1 ? "s" : ""}`}>
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
          </Deplier>
          <Deplier libelle="Saisons" valeur={`${seasons.length}`}>
            <SeasonsCard
              slug={slug}
              seasons={seasons.map((s) => ({
                id: s.id,
                name: s.name,
                isActive: s.isActive,
                period: `${fmtDate(s.startsAt)}${s.endsAt ? ` → ${fmtDate(s.endsAt)}` : " → en cours"}`,
              }))}
            />
          </Deplier>
        </section>
      </div>

      <div className="reg-pied">
        <Deconnexion />
      </div>
      <div className="reg-version">
        Five Scorer · <VersionBadge />
      </div>
    </main>
  );
}
