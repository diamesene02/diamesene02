import { requireClub } from "@/lib/guard";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LiveMatch from "./LiveMatch";

export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canScore) redirect(`/c/${slug}/matches/${id}`);

  // Le vivier complet du club, amorcé dans le cache local à l'ouverture.
  //
  // Le cache n'était rempli que par l'écran de composition : un match lancé
  // autrement affichait des tuiles nommées « ? » hors ligne, et surtout aucun
  // retardataire ne pouvait entrer, faute de connaître les joueurs absents de
  // la feuille. On l'amorce ici, pendant qu'il y a du réseau.
  const vivier = await prisma.player.findMany({
    where: { clubId: ctx.club.id, isArchived: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      nickname: true,
      skill: true,
      isGk: true,
      isGuest: true,
    },
  });

  return (
    <LiveMatch
      slug={slug}
      matchId={id}
      clubId={ctx.club.id}
      vivier={vivier}
      settings={{
        trackAssists: ctx.club.trackAssists,
        trackCards: ctx.club.trackCards,
        motmMode: ctx.club.motmMode,
        matchDurationMin: ctx.club.matchDurationMin,
      }}
    />
  );
}
