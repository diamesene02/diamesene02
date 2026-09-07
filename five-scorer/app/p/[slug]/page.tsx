import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/stats";
import Icon from "@/components/Icon";
import ClubTheme from "@/components/ClubTheme";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { club: true },
  });
  if (!org?.club || !org.club.isPublic) {
    return { title: "Club · Five Scorer" };
  }
  return {
    title: `${org.name} · Five Scorer`,
    description: `Classement et derniers résultats de ${org.name} sur Five Scorer.`,
  };
}

export default async function PublicClubPage({ params }: Params) {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { club: true },
  });
  if (!org?.club || !org.club.isPublic) notFound();
  const club = org.club;

  const activeSeason = await prisma.season.findFirst({
    where: { clubId: club.id, isActive: true },
    orderBy: { startsAt: "desc" },
  });

  const [rows, lastMatches] = await Promise.all([
    getLeaderboard({ clubId: club.id, seasonId: activeSeason?.id ?? null }),
    prisma.match.findMany({
      where: { clubId: club.id, status: "FINISHED" },
      orderBy: { playedAt: "desc" },
      take: 5,
      include: { mvp: true, opponent: true },
    }),
  ]);
  const top = rows.slice(0, 10);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });

  const th =
 "px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--ink-2)]";
  const td = "px-3 py-2.5";

  return (
    <div data-club-theme className="relative min-h-screen">
      {/* La vitrine publique porte aussi les couleurs du club. */}
      <ClubTheme colorA={club.colorA} colorB={club.colorB} />
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="pitch-motif absolute inset-0" />
      </div>

      <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-4">
        <header className="flex items-center justify-between gap-3">
          <span className="brand-pill">
            <Icon name="ball" size={14} />
            {org.name}
          </span>
          <Link
            href="/"
            className="text-xs font-bold  text-[color:var(--ink-2)] hover:text-[color:var(--ink-1)]"
          >
            Créé avec Five Scorer
          </Link>
        </header>

        <main className="mt-10">
          <span className="kicker">
            {activeSeason ? activeSeason.name : "Toutes saisons"}
          </span>
          <h1 className="display-md mt-1">{org.name}</h1>

          {/* Classement */}
          <section className="mt-8">
            <span className="kicker mb-3 block">Classement</span>
            {top.length === 0 ? (
              <div className="rounded-[2px] bg-[color:var(--pitch-1)] p-8 text-center text-sm text-[color:var(--ink-1)]">
                Pas encore de match terminé.
              </div>
            ) : (
              <div className="scroll-x rounded-[2px] bg-[color:var(--pitch-1)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--rule)]">
                      <th className={`${th} text-left`}>#</th>
                      <th className={`${th} text-left`}>Joueur</th>
                      <th className={`${th} text-center`}>J</th>
                      <th className={`${th} text-center`}>Buts</th>
                      <th className={`${th} text-center`}>MVP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--rule)]">
                    {top.map((r, i) => (
                      <tr key={r.playerId}>
                        <td
                          className={`${td} tabular text-xs font-bold text-[color:var(--ink-2)]`}
                        >
                          {i + 1}
                        </td>
                        <td className={`${td} font-bold`}>{r.name}</td>
                        <td
                          className={`${td} tabular text-center text-[color:var(--ink-2)]`}
                        >
                          {r.matchesPlayed}
                        </td>
                        <td
                          className={`${td} num-sculpt text-center text-base text-[color:var(--ink-1)]`}
                        >
                          {r.goals}
                        </td>
                        <td
                          className={`${td} tabular text-center text-[color:var(--gold)]`}
                        >
                          {r.mvpCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Derniers résultats */}
          {lastMatches.length > 0 && (
            <section className="mt-8">
              <span className="kicker mb-3 block">Derniers résultats</span>
              <ul className="divide-y divide-[color:var(--rule)] overflow-hidden rounded-[2px] bg-[color:var(--pitch-1)]">
                {lastMatches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/r/${m.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--pitch-2)]"
                    >
                      <span className="tabular w-14 shrink-0 text-[11px] uppercase text-[color:var(--ink-2)]">
                        {fmtDate(m.playedAt)}
                      </span>
                      <span className="flex-1 truncate text-sm font-bold">
                        {m.teamAName}{" "}
                        <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                        {m.kind === "EXTERNAL" && m.opponent
                          ? m.opponent.name
                          : m.teamBName}
                        {m.mvp && (
                          <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-bold text-[color:var(--gold)]">
                            <Icon
                              name="star"
                              size={12}
                              filled
                              label="Homme du match"
                            />
                            {m.mvp.name}
                          </span>
                        )}
                      </span>
                      <span className="num-sculpt text-lg">
                        <span
                          className={
                            m.scoreA >= m.scoreB
                              ? "text-[color:var(--ink-1)]"
                              : "text-[color:var(--ink-3)]"
                          }
                        >
                          {m.scoreA}
                        </span>
                        <span className="px-1.5 text-[color:var(--ink-3)]">
                          :
                        </span>
                        <span
                          className={
                            m.scoreB >= m.scoreA
                              ? "text-[color:var(--ink-1)]"
                              : "text-[color:var(--ink-3)]"
                          }
                        >
                          {m.scoreB}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* CTA */}
          <section className="aurora edge-top mt-12 p-8 text-center">
            <span className="kicker">Ton équipe aussi</span>
            <p className="mx-auto mt-3 max-w-md text-xl font-black leading-tight tracking-tight">
              Monte le tien. Scoring live, stats, équipes équilibrées —
              gratuit.
            </p>
            <Link href="/signup" className="btn primary big mt-6">
              Créer mon club
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
