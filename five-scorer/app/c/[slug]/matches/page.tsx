import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { cn } from "@/lib/cn";
import Icon from "@/components/Icon";

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
      matchDay: { select: { id: true, title: true } },
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

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const opponentOr = (m: (typeof matches)[number]) =>
    m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;

  const chip = (active: boolean) =>
    cn(
 "inline-flex min-h-[44px] items-center rounded-[2px] border px-4 text-[13px] font-semibold transition-colors",
      active
        ? "border-transparent bg-[color:var(--ink-1)] text-[color:var(--pitch-0)]"
        : "border-[color:var(--rule)] bg-[color:var(--pitch-2)] text-[color:var(--ink-1)] hover:text-white",
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

      {/* En direct */}
      {live.length > 0 && (
        <section className="mt-8 space-y-3">
          {live.map((m) => (
            <Link
              key={m.id}
              href={`/c/${slug}/matches/${m.id}/live`}
              className="flex min-h-[56px] items-center gap-4 rounded-none border border-[color:var(--direct)]/40 bg-[color:var(--pitch-1)] p-4 transition-colors hover:border-[color:var(--direct)]"
            >
              <span className="live-dot shrink-0" />
              <span className="min-w-0 flex-1 truncate text-base font-black">
                {m.teamAName}{" "}
                <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                {opponentOr(m)}
              </span>
              <span className="num-sculpt text-2xl">
                {m.scoreA}
                <span className="px-1.5 text-[color:var(--ink-2)]">:</span>
                {m.scoreB}
              </span>
              <span className="text-[10px] font-black  text-[color:var(--direct)]">
                Live →
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* Programmés */}
      {scheduled.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Programmés</span>
          <ul className="divide-y divide-[color:var(--rule)] overflow-hidden rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)]">
            {scheduled.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/c/${slug}/matches/${m.id}`}
                  className="flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--pitch-2)]"
                >
                  <span className="w-20 shrink-0 text-[11px] uppercase leading-tight tabular-nums text-[color:var(--ink-2)]">
                    {fmtDate(m.scheduledAt ?? m.playedAt)}
                    <br />
                    <span className="text-[color:var(--ink-1)]">
                      {fmtTime(m.scheduledAt ?? m.playedAt)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {m.teamAName}{" "}
                    <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                    {opponentOr(m)}
                    {m.venue && (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-[color:var(--ink-2)]">
                        <Icon name="pin" size={11} />
                        {m.venue}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-[color:var(--bib-a-ink)]">
                    {m._count.rsvps} présent{m._count.rsvps > 1 ? "s" : ""}
                  </span>
                  <span className="shrink-0 rounded-[2px] border border-[color:var(--bib-b-ink)]/40 bg-[color:var(--pitch-2)] px-2.5 py-0.5 text-[13px] font-semibold text-[color:var(--bib-b-ink)]">
                    à venir
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Joués */}
      {finished.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Joués</span>
          <ul className="divide-y divide-[color:var(--rule)] overflow-hidden rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)]">
            {finished.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/c/${slug}/matches/${m.id}`}
                  className="flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--pitch-2)]"
                >
                  <span className="w-14 shrink-0 text-[11px] uppercase tabular-nums text-[color:var(--ink-2)]">
                    {fmtDate(m.playedAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {m.teamAName}{" "}
                      <span className="text-[color:var(--ink-2)]">vs</span>{" "}
                      {opponentOr(m)}
                      {m.mvp && (
                        <span className="ml-2 inline-flex items-center gap-1 align-middle text-[13px] font-semibold text-[color:var(--gold)]">
                          <Icon name="star" size={11} filled />
                          {m.mvp.name}
                        </span>
                      )}
                    </span>
                    {/* Voir plusieurs lignes porter la même soirée fait
                        comprendre l'emboîtement sans qu'on l'explique. */}
                    {m.matchDay && (
                      <span className="rattache mt-0.5 max-w-full truncate">
                        {m.matchDay.title || "Soirée"}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-black tabular-nums">
                    <span
                      className={
                        m.scoreA > m.scoreB
                          ? "text-[color:var(--ink-1)]"
                          : "text-[color:var(--ink-1)]"
                      }
                    >
                      {m.scoreA}
                    </span>
                    <span className="px-1.5 text-[color:var(--ink-2)]">:</span>
                    <span
                      className={
                        m.scoreB > m.scoreA
                          ? "text-[color:var(--ink-1)]"
                          : "text-[color:var(--ink-1)]"
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

      {matches.length === 0 && (
        <p className="mt-10 text-sm text-[color:var(--ink-1)]">
          Aucun match pour ces filtres. Le terrain attend.
        </p>
      )}
    </main>
  );
}
