import Link from "next/link";
import * as D from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { cn } from "@/lib/cn";
import Icon from "@/components/Icon";
import Panneau from "@/components/Panneau";

export const dynamic = "force-dynamic";

const TYPE_CHIPS = [
  ["all", "Tous"],
  ["INTERNAL", "Entre nous"],
  ["EXTERNAL", "Vs adversaires"],
] as const;

export default async function MatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saison?: string; type?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;

  const seasons = await prisma.season.findMany({
    where: { clubId },
    orderBy: { startsAt: "desc" },
  });
  const activeSeason = seasons.find((s) => s.isActive) ?? null;

  const saison = sp.saison ?? (activeSeason ? activeSeason.id : "all");
  const type =
    sp.type === "INTERNAL" || sp.type === "EXTERNAL" ? sp.type : "all";

  const matches = await prisma.match.findMany({
    where: {
      clubId,
      status: { in: ["LIVE", "SCHEDULED", "FINISHED"] },
      ...(saison !== "all" ? { seasonId: saison } : {}),
      ...(type !== "all" ? { kind: type } : {}),
    },
    orderBy: { playedAt: "desc" },
    take: 200,
    include: {
      opponent: true,
      mvp: true,
      // La soirée d'origine : c'est elle qui rend le rattachement visible dans
      // la liste, et qui permet d'y remonter depuis un match.
      matchDay: { select: { id: true, title: true, date: true } },
      _count: { select: { rsvps: { where: { status: "IN" } } } },
    },
  });

  const live = matches.filter((m) => m.status === "LIVE");
  // À venir : les plus proches d'abord.
  const scheduled = matches
    .filter((m) => m.status === "SCHEDULED")
    .sort(
      (a, b) =>
        (a.scheduledAt ?? a.playedAt).getTime() -
        (b.scheduledAt ?? b.playedAt).getTime(),
    );
  const finished = matches.filter((m) => m.status === "FINISHED");

  const href = (s: string, t: string) =>
    `/c/${slug}/matches?saison=${encodeURIComponent(s)}&type=${t}`;

  const fmtDate = D.jourCourt2;

  const fmtTime = D.heure;

  const opponentOr = (m: (typeof matches)[number]) =>
    m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;

  // UN LUNDI, UN BLOC.
  //
  // Le club joue six à huit matchs par soirée avec les deux mêmes chasubles :
  // une liste plate en donne autant de fiches encadrées qui répètent toutes
  // « Orange vs Bleu ». Sur une saison, c'est deux cents lignes identiques.
  //
  // Les matchs se rangent donc sous la soirée qui les a produits — un en-tête
  // porte la date et le nombre de matchs, les lignes ne portent plus que
  // l'heure, le score et l'homme du match. Un match improvisé, sans soirée,
  // forme un groupe de son propre jour : la structure ne se casse pas.
  type Joue = (typeof finished)[number];
  const groupes: { cle: string; titre: string; date: Date; matchs: Joue[] }[] =
    [];
  const parCle = new Map<string, (typeof groupes)[number]>();
  for (const m of finished) {
    const cle = m.matchDay?.id ?? `jour-${m.playedAt.toDateString()}`;
    let g = parCle.get(cle);
    if (!g) {
      g = {
        cle,
        titre: m.matchDay?.title || "",
        date: m.matchDay?.date ?? m.playedAt,
        matchs: [],
      };
      parCle.set(cle, g);
      groupes.push(g);
    }
    g.matchs.push(m);
  }
  // Dans une soirée, on relit les matchs dans l'ordre où ils se sont joués.
  for (const g of groupes)
    g.matchs.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

  const fmtJour = D.jourLong2;

  const chip = (active: boolean) =>
    cn(
 "inline-flex min-h-[44px] items-center rounded-[2px] border px-4 text-[13px] font-semibold transition-colors",
      active
        ? "border-transparent bg-[color:var(--bt)] text-[color:var(--bf)]"
        : "border-[color:var(--gb)] bg-[color:var(--gl)] text-[color:var(--ink)]",
    );

  return (
    <main>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="kicker">Historique</span>
          <h1 className="display-md mt-1">Les matchs</h1>
          {/* Pendant de la définition posée sur la page des soirées. Formulée
              pour couvrir les trois cas que l'app produit : le match d'une
              soirée, l'improvisé, et la rencontre contre un club adverse. */}
          <p className="mt-1.5 max-w-sm text-sm text-[color:var(--ink-2)]">
            Une rencontre jouée : un score, des buteurs, un chrono.{" "}
            <span className="text-[color:var(--ink-1)]">
              Dans une soirée, ou toute seule.
            </span>
          </p>
        </div>
        <span className="text-sm font-bold tabular-nums text-[color:var(--ink-2)]">
          {finished.length} joué{finished.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Filtres */}
      <div className="mt-6 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Link href={href("all", type)} className={chip(saison === "all")}>
            Toutes saisons
          </Link>
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={href(s.id, type)}
              className={chip(saison === s.id)}
            >
              {s.name}
              {s.isActive && " ●"}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPE_CHIPS.map(([t, label]) => (
            <Link key={t} href={href(saison, t)} className={chip(type === t)}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* En direct — le panneau commun. Le score s'écrivait ici une
          cinquième fois, avec un « : » et une taille à lui. */}
      {live.length > 0 && (
        <section className="mt-8">
          {live.map((m) => (
            <div key={m.id} className="mt-4 first:mt-0">
              <div className="bande-titre">
                <span className="kicker flex items-center gap-2 text-[color:var(--direct)]">
                  <span className="live-dot" />
                  En direct
                </span>
                <span className="text-[13px] font-semibold text-[color:var(--ink-2)]">
                  Reprendre →
                </span>
              </div>
              <Link
                href={`/c/${slug}/matches/${m.id}/live`}
                className="block"
              >
                <Panneau
                  a={m.teamAName}
                  b={opponentOr(m)}
                  scoreA={m.scoreA}
                  scoreB={m.scoreB}
                  taille="panneau"
                />
              </Link>
            </div>
          ))}
        </section>
      )}

      {/* Programmés */}
      {scheduled.length > 0 && (
        <section className="bande mt-8">
          <div className="bande-titre">
            <span className="kicker">Programmés</span>
            <span className="text-[13px] tabular-nums text-[color:var(--ink-3)]">
              {scheduled.length}
            </span>
          </div>
          <ul>
            {scheduled.map((m) => {
              const quand = m.scheduledAt ?? m.playedAt;
              return (
                <li key={m.id}>
                  <Link href={`/c/${slug}/matches/${m.id}`} className="ticker">
                    <span className="ticker-heure">{fmtDate(quand)}</span>
                    <span className="ticker-score text-[color:var(--ink-1)]">
                      {fmtTime(quand)}
                    </span>
                    <span className="ticker-buteurs">
                      {m.teamAName}
                      <span className="text-[color:var(--rule-hi)]"> vs </span>
                      {opponentOr(m)}
                      {m.venue && (
                        <span className="text-[color:var(--ink-3)]">
                          {" · "}
                          {m.venue}
                        </span>
                      )}
                      {m._count.rsvps > 0 && (
                        <span style={{ color: "var(--bib-a-ink)" }}>
                          {" · "}
                          {m._count.rsvps} présent
                          {m._count.rsvps > 1 ? "s" : ""}
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

      {/* Joués — groupés par soirée */}
      {groupes.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Joués</span>
          {groupes.map((g) => (
            <div key={g.cle} className="bande mt-5 first:mt-0">
              <div className="bande-titre">
                <span className="text-[13px] font-semibold text-[color:var(--ink-1)]">
                  <span className="capitalize">{fmtJour(g.date)}</span>
                  {g.titre && (
                    <span className="text-[color:var(--ink-3)]">
                      {" · "}
                      {g.titre}
                    </span>
                  )}
                </span>
                <span className="text-[13px] tabular-nums text-[color:var(--ink-3)]">
                  {g.matchs.length} match{g.matchs.length > 1 ? "s" : ""}
                </span>
              </div>
              <ul>
                {g.matchs.map((m) => {
                  const aGagne = m.scoreA > m.scoreB;
                  const bGagne = m.scoreB > m.scoreA;
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/c/${slug}/matches/${m.id}`}
                        className="ticker"
                      >
                        <span className="ticker-heure">
                          {fmtTime(m.playedAt)}
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
                          {m.kind === "EXTERNAL" && (
                            <span className="text-[color:var(--ink-2)]">
                              {opponentOr(m)}
                            </span>
                          )}
                          {m.mvp && (
                            <span
                              className="inline-flex items-center gap-1.5 align-middle"
                              style={{ color: "var(--gold)" }}
                            >
                              {m.kind === "EXTERNAL" && " · "}
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
            </div>
          ))}
        </section>
      )}

      {matches.length === 0 && (
        <p className="mt-10 text-sm text-[color:var(--ink-1)]">
          Aucun match pour ces filtres. Le terrain attend.
        </p>
      )}
    </main>
  );
}
