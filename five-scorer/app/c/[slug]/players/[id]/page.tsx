import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClub } from "@/lib/guard";
import { getPlayerDetail, type Result } from "@/lib/stats";
import { cn } from "@/lib/cn";
import PlayerAvatar from "@/components/PlayerAvatar";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// La lettre reste : la couleur double l'information, elle ne la porte pas.
function resultBadgeClass(r: Result) {
  if (r === "W") return "bg-[color:var(--win)] text-[color:var(--pitch-0)]";
  if (r === "D")
    return "border border-[color:var(--rule)] bg-[color:var(--pitch-2)] text-[color:var(--ink-2)]";
  return "bg-[color:var(--pitch-2)] text-[color:var(--loss)]";
}

// La série est un nombre signé, pas un pictogramme de flamme.
function streakTile(streak: number | undefined): {
  value: string;
  tone?: "win" | "loss";
} {
  if (streak === undefined) return { value: "—" };
  if (streak >= 2) return { value: `+${streak}`, tone: "win" };
  if (streak <= -2) return { value: `-${Math.abs(streak)}`, tone: "loss" };
  return { value: "—" };
}

// Niveau : cinq étoiles du jeu d'icônes, pas des glyphes ★ empruntés à
// une police de repli.
function SkillStars({ skill }: { skill: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Niveau ${skill} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          filled={n <= skill}
          size={14}
          className={
            n <= skill
              ? "text-[color:var(--ink-1)]"
              : "text-[color:var(--rule-hi)]"
          }
        />
      ))}
    </span>
  );
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);
  const detail = await getPlayerDetail(ctx.club.id, id);
  if (!detail) notFound();

  const { player, allTime, bySeason, recentMatches } = detail;

  const streak = streakTile(allTime?.streak);

  const tiles: { label: string; value: string; tone?: "win" | "loss" }[] = [
    { label: "Matchs", value: String(allTime?.matchesPlayed ?? 0) },
    { label: "Buts", value: String(allTime?.goals ?? 0) },
    { label: "Passes", value: String(allTime?.assists ?? 0) },
    {
      label: "% victoires",
      value: allTime ? `${allTime.winPct}%` : "—",
    },
    { label: "Élo", value: String(allTime?.elo ?? 1000) },
    { label: "MVP", value: String(allTime?.mvpCount ?? 0) },
    { label: "Série", value: streak.value, tone: streak.tone },
  ];

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });

  const panel =
 "rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)]";

  return (
    <main>
      {/* Hero */}
      <section className="aurora edge-top relative overflow-hidden p-6 sm:p-8">
        <div className="relative z-[1] flex items-start gap-5">
          <PlayerAvatar name={player.name} id={player.id} size="lg" />
          <div className="min-w-0">
            <span className="kicker">Fiche joueur</span>
            <h1 className="display-md mt-2">{player.name}</h1>
            {player.nickname && (
              <div className="mt-1 text-lg italic text-[color:var(--ink-2)]">
                « {player.nickname} »
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SkillStars skill={player.skill} />
              {player.isGk && (
                <span className="rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-2.5 py-0.5 text-[13px] font-semibold text-[color:var(--ink-1)]">
                  gardien
                </span>
              )}
              {player.isGuest && (
                <span className="rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-2.5 py-0.5 text-[13px] font-semibold text-[color:var(--ink-1)]">
                  invité
                </span>
              )}
              {player.userId && (
                <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-2.5 py-0.5 text-[13px] font-semibold text-[color:var(--bib-a-ink)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--bib-a)]" />
                  compte lié
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tuiles stats */}
      <section className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[2px] bg-[color:var(--pitch-1)] px-4 py-3"
          >
            <div className="kicker">{t.label}</div>
            <div
              className={cn(
 "num-sculpt mt-1 text-2xl",
                t.tone === "win" && "text-[color:var(--win)]",
                t.tone === "loss" && "text-[color:var(--loss)]"
              )}
            >
              {t.value}
            </div>
          </div>
        ))}
      </section>

      {/* Forme */}
      {allTime && allTime.form.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Forme</span>
          <div className="flex gap-2">
            {allTime.form.map((r, i) => (
              <span
                key={i}
                className={cn(
 "flex h-9 w-9 items-center justify-center rounded-[2px] text-sm font-black",
                  resultBadgeClass(r)
                )}
              >
                {r}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[color:var(--ink-3)]">
            Du plus récent au plus ancien.
          </p>
        </section>
      )}

      {/* Par saison */}
      {bySeason.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Par saison</span>
          <div className={`scroll-x ${panel}`}>
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-[color:var(--rule)] text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--ink-3)]">
                  <th className="px-4 py-3">Saison</th>
                  <th className="px-3 py-3 text-right">J</th>
                  <th className="px-3 py-3 text-right">Buts</th>
                  <th className="px-3 py-3 text-right">Passes</th>
                  <th className="px-3 py-3 text-right">%V</th>
                  <th className="px-4 py-3 text-right">MVP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--rule)]">
                {bySeason.map((s) => (
                  <tr key={s.seasonId ?? "none"}>
                    <td className="px-4 py-3 font-bold">{s.seasonName}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {s.row.matchesPlayed}
                    </td>
                    <td className="px-3 py-3 text-right font-black tabular-nums">
                      {s.row.goals}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {s.row.assists}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {s.row.winPct}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[color:var(--gold)]">
                      {s.row.mvpCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Derniers matchs */}
      {recentMatches.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Derniers matchs</span>
          <ul
            className={`divide-y divide-[color:var(--rule)] overflow-hidden ${panel}`}
          >
            {recentMatches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/c/${slug}/matches/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--pitch-2)]"
                >
                  <span className="w-16 shrink-0 text-[11px] uppercase tabular-nums text-[color:var(--ink-3)]">
                    {fmtDate(m.playedAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {m.label}
                  </span>
                  {m.wasMvp && (
                    <Icon
                      name="star"
                      filled
                      size={14}
                      label="MVP du match"
                      className="shrink-0 text-[color:var(--gold)]"
                    />
                  )}
                  {m.goals > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums text-[color:var(--ink-2)]">
                      <Icon name="ball" size={12} label="Buts marqués" />
                      {m.goals}
                    </span>
                  )}
                  <span className="text-sm font-black tabular-nums text-[color:var(--ink-1)]">
                    {m.score}
                  </span>
                  <span
                    className={cn(
 "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-black",
                      resultBadgeClass(m.result)
                    )}
                  >
                    {m.result}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentMatches.length === 0 && (
        <p className="mt-8 text-sm text-[color:var(--ink-2)]">
          Aucun match joué pour l&apos;instant. Ça se règle sur le terrain.
        </p>
      )}
    </main>
  );
}
