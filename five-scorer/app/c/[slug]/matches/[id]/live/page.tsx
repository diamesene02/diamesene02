import { requireClub } from "@/lib/guard";
import { redirect } from "next/navigation";
import LiveMatch from "./LiveMatch";

export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);
  if (!ctx.canScore) redirect(`/c/${slug}/matches/${id}`);

  return (
    <LiveMatch
      slug={slug}
      matchId={id}
      settings={{
        trackAssists: ctx.club.trackAssists,
        trackCards: ctx.club.trackCards,
        motmMode: ctx.club.motmMode,
        matchDurationMin: ctx.club.matchDurationMin,
      }}
    />
  );
}
