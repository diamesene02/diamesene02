import { requireClub } from "@/lib/guard";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PlayShell from "@/components/PlayShell";

// L'unique page de match du lundi soir. Son HTML est le MÊME pour tous les
// matchs du club : le service worker le garde en cache à chaque visite en
// ligne et le sert hors-ligne pour n'importe quel identifiant — y compris
// ceux que le serveur ne connaît pas encore.
export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canScore) redirect(`/c/${slug}`);

  const vivier = await prisma.player.findMany({
    where: { clubId: ctx.club.id, isArchived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, nickname: true, skill: true, isGk: true, isGuest: true },
  });

  return (
    <PlayShell
      slug={slug}
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
