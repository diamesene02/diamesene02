import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/stats";
import Ecusson from "@/components/ios/Ecusson";
import LigneScore from "@/components/ios/LigneScore";
import { lettre } from "@/lib/ini";
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
    <div data-club-theme data-theme="dark" className="relative min-h-dvh">
      {/* La vitrine publique porte aussi les couleurs du club. */}
      <ClubTheme colorA={club.colorA} colorB={club.colorB} theme="dark" />
      <div className="relative mx-auto max-w-[520px] px-[14px] pb-16">
        <header className="barre-haut" style={{ padding: "calc(var(--safe-t) + 14px) 0 0" }}>
          <span className="verre lueur" style={{ height: 50, borderRadius: 25, padding: "0 18px 0 11px", gap: 10 }}>
            <Ecusson camp="A" lettre={lettre(org.name)} taille={28} />
            <span className="max-w-[46vw] truncate">{org.name}</span>
          </span>
          <Link href="/" className="text-[13px] font-semibold" style={{ color: "var(--i2)" }}>
            Créé avec Five Scorer
          </Link>
        </header>

        <main className="ecran mt-6">
          <span className="kicker">{activeSeason ? activeSeason.name : "Toutes saisons"}</span>
          <h1 className="titre-ecran mt-1">{org.name}</h1>
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
          <section className="carte mt-[18px]" style={{ padding: "0 10px 8px" }}>
            <div className="carte-titre">Classement</div>
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

          {/* Derniers résultats — la ligne de score de l'app. */}
          {lastMatches.length > 0 && (
            <section className="carte mt-[18px]">
              <div className="carte-titre">Derniers résultats</div>
              {lastMatches.map((m) => (
                <LigneScore
                  key={m.id}
                  nomA={m.teamAName}
                  nomB={m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName}
                  scoreA={m.scoreA}
                  scoreB={m.scoreB}
                  etat="Terminé"
                  heure={fmtDate(m.playedAt)}
                  href={`/r/${m.id}`}
                  pied={m.mvp ? <span style={{ color: "var(--or)" }}>★ {m.mvp.name}</span> : undefined}
                />
              ))}
            </section>
          )}

          {/* CTA */}
          <section className="carte mt-[18px] p-6 text-center">
            <span className="kicker">Ton équipe aussi</span>
            <p className="mx-auto mt-2 max-w-md text-[22px] font-semibold leading-tight tracking-[-.3px]" style={{ color: "var(--ink)" }}>
              Monte le tien. Scoring live, stats, équipes équilibrées — gratuit.
            </p>
            <Link href="/signup" className="plein mt-5">
              Créer mon club
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
