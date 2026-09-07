import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/stats";
import Icon from "@/components/Icon";
import ClubTheme from "@/components/ClubTheme";
import Classement from "@/components/Classement";

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

  // Une vitrine dit d'abord ce que le club a fait cette saison. La page
  // s'ouvrait directement sur un tableau de cinq colonnes.
  const totalMatchs = await prisma.match.count({
    where: {
      clubId: club.id,
      status: "FINISHED",
      ...(activeSeason ? { seasonId: activeSeason.id } : {}),
    },
  });
  const totalButs = rows.reduce((s, r) => s + r.goals, 0);
  const meilleurButeur = rows.filter((r) => r.goals > 0)[0] ?? null;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });

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
          <h1 className="display-xl mt-2">{org.name}</h1>
          {totalMatchs > 0 && (
            <div className="synthese mt-3">
              <span>
                <b>{totalMatchs}</b> match{totalMatchs > 1 ? "s" : ""}
              </span>
              <span className="synthese-sep">·</span>
              <span>
                <b>{totalButs}</b> but{totalButs > 1 ? "s" : ""}
              </span>
              {meilleurButeur && (
                <>
                  <span className="synthese-sep">·</span>
                  <span>
                    {meilleurButeur.name} <b>{meilleurButeur.goals}</b>
                  </span>
                </>
              )}
            </div>
          )}

          {/* Classement — le même dessin que dans l'app, sans le lien vers la
              fiche joueur : le visiteur n'a pas de compte. C'était un tableau
              de cinq colonnes à en-têtes en capitales tracées. */}
          <section className="bande mt-8">
            <div className="bande-titre">
              <span className="kicker">Classement</span>
            </div>
            {top.length === 0 ? (
              <p className="text-sm text-[color:var(--ink-2)]">
                Pas encore de match terminé.
              </p>
            ) : (
              <Classement
                slug={slug}
                avecFiches={false}
                trackAssists={club.trackAssists}
                trackCards={club.trackCards}
                lignes={top.map((r) => ({
                  playerId: r.playerId,
                  name: r.name,
                  nickname: r.nickname,
                  isGuest: r.isGuest,
                  matchesPlayed: r.matchesPlayed,
                  goals: r.goals,
                  assists: r.assists,
                  yellow: r.yellow,
                  red: r.red,
                  wins: r.wins,
                  draws: r.draws,
                  losses: r.losses,
                  winPct: r.winPct,
                  mvpCount: r.mvpCount,
                  form: r.form,
                  streak: r.streak,
                  elo: r.elo,
                  eloTrend: r.eloTrend,
                }))}
              />
            )}
          </section>

          {/* Derniers résultats — le ticker commun. Le score s'écrivait ici
              avec un « : » et une taille à lui, la sixième dans l'app. */}
          {lastMatches.length > 0 && (
            <section className="bande mt-8">
              <div className="bande-titre">
                <span className="kicker">Derniers résultats</span>
              </div>
              <ul>
                {lastMatches.map((m) => {
                  const aGagne = m.scoreA > m.scoreB;
                  const bGagne = m.scoreB > m.scoreA;
                  return (
                    <li key={m.id}>
                      <Link href={`/r/${m.id}`} className="ticker">
                        <span className="ticker-heure">
                          {fmtDate(m.playedAt)}
                        </span>
                        <span className="ticker-score">
                          <span
                            className={aGagne ? "" : "text-[color:var(--ink-3)]"}
                          >
                            {m.scoreA}
                          </span>
                          <span className="px-1.5 text-[color:var(--rule-hi)]">
                            —
                          </span>
                          <span
                            className={bGagne ? "" : "text-[color:var(--ink-3)]"}
                          >
                            {m.scoreB}
                          </span>
                        </span>
                        <span className="ticker-buteurs">
                          {m.teamAName}
                          <span className="text-[color:var(--rule-hi)]"> vs </span>
                          {m.kind === "EXTERNAL" && m.opponent
                            ? m.opponent.name
                            : m.teamBName}
                          {m.mvp && (
                            <span
                              className="inline-flex items-center gap-1.5 align-middle"
                              style={{ color: "var(--gold)" }}
                            >
                              {" · "}
                              <Icon name="star" size={11} filled />
                              {m.mvp.name}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
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
