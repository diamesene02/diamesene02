import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import RecapView from "@/components/RecapView";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    select: {
      teamAName: true,
      teamBName: true,
      scoreA: true,
      scoreB: true,
      playedAt: true,
      status: true,
      kind: true,
      opponent: { select: { name: true } },
    },
  });
  const robots = { index: false, follow: false };
  if (!match || match.status !== "FINISHED") {
    return { title: "Match · Five Scorer", robots };
  }
  const teamBName =
    match.kind === "EXTERNAL" && match.opponent
      ? match.opponent.name
      : match.teamBName;
  const title = `${match.teamAName} ${match.scoreA} — ${match.scoreB} ${teamBName}`;
  const date = match.playedAt.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
  });
  return {
    title: `${title} · Five Scorer`,
    description: `Match du ${date}`,
    robots,
    openGraph: {
      title,
      description: `Match du ${date}`,
      type: "website",
    },
  };
}

export default async function PublicRecapPage({ params }: Params) {
  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      mvp: true,
      opponent: true,
      participants: { include: { player: true } },
      events: { orderBy: { createdAt: "asc" }, include: { player: true } },
    },
  });
  if (!match || match.status !== "FINISHED") notFound();

  const teamBName =
    match.kind === "EXTERNAL" && match.opponent
      ? match.opponent.name
      : match.teamBName;

  const players = match.participants.map((p) => ({
    id: p.player.id,
    name: p.player.name,
    team: p.team as "A" | "B",
    goals: match.events.filter(
      (e) => e.type === "GOAL" && e.playerId === p.player.id
    ).length,
  }));
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const goals = match.events
    .filter((e) => e.type === "GOAL" || e.type === "OWN_GOAL")
    .map((e) => ({
      id: e.id,
      // Un csc reste dans la chronologie mais ne compte pas au classement
      // des buteurs.
      scorerId: e.type === "OWN_GOAL" ? "" : (e.playerId ?? ""),
      team: e.team as "A" | "B",
      minute: e.minute,
      createdAt: e.createdAt.toISOString(),
      // Un csc peut rester sans auteur : le score part au premier tap et
      // personne n'est obligé d'avouer. Sans ce repli, le récap affichait
      // « ? » — ce qui se lit comme une panne, pas comme une abstention.
      scorerName: e.player
        ? e.type === "OWN_GOAL"
          ? `${e.player.name} (csc)`
          : e.player.name
        : e.type === "OWN_GOAL"
          ? `csc de ${e.team === "B" ? match.teamAName : match.teamBName}`
          : match.kind === "EXTERNAL" && e.team === "B"
            ? (match.opponent?.name ?? match.teamBName)
            : "?",
    }));

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>

      <main className="relative mx-auto max-w-2xl px-5 pb-16 pt-6">
        <div className="mb-4 text-center">
          <span className="brand-pill">
            <Icon name="ball" size={14} />
            Five Scorer
          </span>
        </div>

        <RecapView
          match={{
            id: match.id,
            playedAt: match.playedAt.toISOString(),
            teamAName: match.teamAName,
            teamBName,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            status: "FINISHED",
            mvpId: match.mvpId,
          }}
          mvpName={match.mvp?.name ?? null}
          teamA={teamA}
          teamB={teamB}
          goals={goals}
          showActions={false}
        />

        <footer className="mt-10 text-center text-xs text-[color:var(--ink-2)]">
          Suivi avec{" "}
          <Link
            href="/"
            className="font-bold text-[color:var(--ink-1)] underline underline-offset-2"
          >
            Five Scorer
          </Link>
        </footer>
      </main>
    </div>
  );
}
