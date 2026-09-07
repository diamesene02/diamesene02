import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import Icon from "@/components/Icon";
import {
  getExternalRecord,
  getLeaderboard,
  getSeasonHonours,
  type Result,
  type SeasonHonours,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

// La lettre porte l'information ; la couleur ne fait que la doubler.
function FormBadges({ form }: { form: Result[] }) {
  if (form.length === 0) {
    return <span className="text-[color:var(--ink-3)]">—</span>;
  }
  return (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-black ${
            r === "W"
              ? "bg-[color:var(--win)] text-[color:var(--pitch-0)]"
              : r === "D"
                ? "bg-[color:var(--pitch-2)] text-[color:var(--ink-3)]"
                : "bg-[color:var(--pitch-2)] text-[color:var(--loss)]"
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

// La série est un nombre signé : le chiffre dit tout, sans pictogramme.
function StreakBadge({ streak }: { streak: number }) {
  if (streak >= 2) {
    return (
      <span className="whitespace-nowrap text-xs font-black tabular-nums text-[color:var(--win)]">
        +{streak}
      </span>
    );
  }
  if (streak <= -2) {
    return (
      <span className="whitespace-nowrap text-xs font-black tabular-nums text-[color:var(--loss)]">
        -{Math.abs(streak)}
      </span>
    );
  }
  return <span className="text-[color:var(--ink-3)]">—</span>;
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireClub(slug);
  const { club } = ctx;
  const clubId = club.id;

  const seasons = await prisma.season.findMany({
    where: { clubId },
    orderBy: { startsAt: "desc" },
  });
  const activeSeason = seasons.find((s) => s.isActive) ?? null;

  const requested = typeof sp.saison === "string" ? sp.saison : undefined;
  const selected =
    requested === "all"
      ? "all"
      : requested && seasons.some((s) => s.id === requested)
        ? requested
        : (activeSeason?.id ?? "all");

  const scope = {
    clubId,
    seasonId: selected === "all" ? null : selected,
  };

  const [rows, external] = await Promise.all([
    getLeaderboard(scope),
    getExternalRecord(scope, { win: club.pointsWin, draw: club.pointsDraw }),
  ]);

  // Palmarès : saison sélectionnée clôturée → palmarès complet ;
  // « Toutes » → bandeau compact par saison clôturée.
  const closedSeasons = seasons.filter((s) => !s.isActive);
  const selectedClosed = closedSeasons.some((s) => s.id === selected);
  const honours: SeasonHonours | null = selectedClosed
    ? await getSeasonHonours(clubId, selected)
    : null;
  const pastHonours: SeasonHonours[] =
    selected === "all" && closedSeasons.length > 0
      ? (
          await Promise.all(
            closedSeasons.map((s) => getSeasonHonours(clubId, s.id))
          )
        ).filter((h): h is SeasonHonours => h !== null)
      : [];

  const chips = [
    { id: "all", label: "Toutes" },
    ...seasons.map((s) => ({ id: s.id, label: s.name })),
  ];

  const byGoals = [...rows].sort((a, b) => b.goals - a.goals)[0];
  const byMvp = [...rows].sort((a, b) => b.mvpCount - a.mvpCount)[0];
  const byAssists = [...rows].sort((a, b) => b.assists - a.assists)[0];

  // Le libellé dit déjà ce que l'emoji disait : plus de pictogramme ici.
  const podium: {
    label: string;
    name: string;
    value: number;
    unit: string;
  }[] = [];
  if (byGoals && byGoals.goals > 0) {
    podium.push({
      label: "Pichichi",
      name: byGoals.name,
      value: byGoals.goals,
      unit: byGoals.goals > 1 ? "buts" : "but",
    });
  }
  if (byMvp && byMvp.mvpCount > 0) {
    podium.push({
      label: "MVP",
      name: byMvp.name,
      value: byMvp.mvpCount,
      unit: byMvp.mvpCount > 1 ? "titres" : "titre",
    });
  }
  if (club.trackAssists && byAssists && byAssists.assists > 0) {
    podium.push({
      label: "Passeur",
      name: byAssists.name,
      value: byAssists.assists,
      unit: byAssists.assists > 1 ? "passes" : "passe",
    });
  }

  const th =
 "px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--ink-3)]";
  const td = "px-3 py-2.5";
  const tdNum = `${td} text-center tabular-nums`;
  const panel =
 "rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-1)]";

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="kicker">
            {selected === "all"
              ? "Toutes saisons"
              : (seasons.find((s) => s.id === selected)?.name ?? "Saison")}
          </span>
          <h1 className="display-md mt-1">Stats</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Link
              key={c.id}
              href={`/c/${slug}/stats?saison=${c.id}`}
              className={`rounded-[2px] px-4 py-1.5 text-xs font-bold transition-colors ${
                selected === c.id
                  ? "bg-[color:var(--ink-1)] font-black text-[color:var(--pitch-0)]"
                  : "border border-[color:var(--rule)] bg-[color:var(--pitch-2)] text-[color:var(--ink-1)] hover:border-[color:var(--rule-hi)]"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* L'état vide n'est ni une carte, ni une icône, ni une pilule centrée :
          c'est le SQUELETTE de l'écran, avec des tirets à la place des
          chiffres. Une feuille de match vierge se reconnaît vierge — elle ne
          se présente pas comme une erreur. */}
      {rows.length === 0 ? (
        <section className="bande mt-8">
          <div className="rangee-tete" style={{ ["--cols" as string]: 3 }}>
            <span />
            <span>Joueur</span>
            <span>J</span>
            <span>Buts</span>
            <span>%V</span>
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rangee"
              style={{ ["--cols" as string]: 3 }}
              aria-hidden
            >
              <span className="rangee-bande" />
              <span className="rangee-nom text-[color:var(--ink-3)]">—</span>
              <span className="rangee-num">—</span>
              <span className="rangee-num">—</span>
              <span className="rangee-num">—</span>
            </div>
          ))}
          <p className="mt-4 text-[color:var(--ink-2)]">
            Aucun match terminé sur cette période.
            {ctx.canScore && (
              <>
                {" "}
                <Link href={`/c/${slug}/matches/new`} className="lien">
                  Lancer le premier
                </Link>
                .
              </>
            )}
          </p>
        </section>
      ) : (
        <>
          {/* Podium — tuiles compactes : étiquette, nom, numéro de maillot. */}
          {podium.length > 0 && (
            <section className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {podium.map((p, i) => (
                <div
                  key={p.label}
                  className={`rounded-[2px] bg-[color:var(--pitch-1)] p-3 ${
                    i === 0 && podium.length !== 2
                      ? "col-span-2 sm:col-span-1"
                      : ""
                  }`}
                >
                  <span className="kicker">{p.label}</span>
                  <div className="mt-1 truncate font-semibold">{p.name}</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="num-sculpt text-3xl">{p.value}</span>
                    <span className="text-xs font-bold text-[color:var(--ink-3)]">
                      {p.unit}
                    </span>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Classement */}
          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="kicker">Classement</span>
              <a
                href={`/api/clubs/${clubId}/export?type=leaderboard&saison=${selected}`}
                download
                className="rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-1 text-xs font-bold text-[color:var(--ink-1)] transition-colors hover:border-[color:var(--rule-hi)]"
              >
                Export CSV
              </a>
            </div>
            <div className={`scroll-x ${panel}`}>
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--rule)]">
                    <th className={`${th} text-left`}>#</th>
                    <th className={`${th} text-left`}>Joueur</th>
                    <th className={`${th} text-center`}>J</th>
                    <th className={`${th} text-center`}>V</th>
                    <th className={`${th} text-center`}>N</th>
                    <th className={`${th} text-center`}>D</th>
                    <th className={`${th} text-center`}>%V</th>
                    <th className={`${th} text-center`}>Élo</th>
                    <th className={`${th} text-center`}>Buts</th>
                    {club.trackAssists && (
                      <th className={`${th} text-center`}>Passes</th>
                    )}
                    {club.trackCards && (
                      <th className={`${th} text-center`}>
                        <span className="inline-flex items-center justify-center gap-1">
                          <Icon
                            name="card"
                            filled
                            size={12}
                            label="Cartons jaunes"
                            className="text-[color:var(--gold)]"
                          />
                          <Icon
                            name="card"
                            filled
                            size={12}
                            label="Cartons rouges"
                            className="text-[color:var(--loss)]"
                          />
                        </span>
                      </th>
                    )}
                    <th className={`${th} text-center`}>MVP</th>
                    <th className={`${th} text-left`}>Forme</th>
                    <th className={`${th} text-left`}>Série</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--rule)]">
                  {rows.map((r, i) => (
                    <tr
                      key={r.playerId}
                      className="transition-colors hover:bg-[color:var(--pitch-2)]"
                    >
                      <td
                        className={`${td} text-xs font-bold tabular-nums text-[color:var(--ink-3)]`}
                      >
                        {i + 1}
                      </td>
                      <td className={`${td} font-bold`}>
                        <Link
                          href={`/c/${slug}/players/${r.playerId}`}
                          className="hover:text-[color:var(--ink-1)]"
                        >
                          {r.name}
                          {r.nickname && (
                            <span className="ml-1.5 font-normal text-[color:var(--ink-3)]">
                              {r.nickname}
                            </span>
                          )}
                          {r.isGuest && (
                            <span className="ml-1.5 font-normal text-[color:var(--ink-3)]">
                              (inv.)
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className={tdNum}>{r.matchesPlayed}</td>
                      <td className={tdNum}>{r.wins}</td>
                      <td className={tdNum}>{r.draws}</td>
                      <td className={tdNum}>{r.losses}</td>
                      <td className={`${tdNum} text-[color:var(--ink-1)]`}>
                        {r.winPct}
                      </td>
                      <td className={`${tdNum} whitespace-nowrap`}>
                        <span className="font-bold">{r.elo}</span>{" "}
                        {r.eloTrend > 0 ? (
                          <span className="text-[10px] font-black text-[color:var(--win)]">
                            +{r.eloTrend}
                          </span>
                        ) : r.eloTrend < 0 ? (
                          <span className="text-[10px] font-black text-[color:var(--loss)]">
                            -{Math.abs(r.eloTrend)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[color:var(--ink-3)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className={`${tdNum} font-black`}>{r.goals}</td>
                      {club.trackAssists && (
                        <td className={tdNum}>{r.assists}</td>
                      )}
                      {club.trackCards && (
                        <td className={tdNum}>
                          <span className="text-[color:var(--gold)]">
                            {r.yellow}
                          </span>
                          <span className="text-[color:var(--ink-3)]">/</span>
                          <span className="text-[color:var(--loss)]">
                            {r.red}
                          </span>
                        </td>
                      )}
                      <td className={`${tdNum} text-[color:var(--gold)]`}>
                        {r.mvpCount}
                      </td>
                      <td className={td}>
                        <FormBadges form={r.form} />
                      </td>
                      <td className={td}>
                        <StreakBadge streak={r.streak} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Palmarès — saison clôturée sélectionnée */}
          {honours && (
            <section className="mt-10">
              <span className="kicker mb-3 block">
                Palmarès {honours.seasonName}
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      label: "Pichichi",
                      entry: honours.topScorer,
                      unit: (v: number) => (v > 1 ? "buts" : "but"),
                    },
                    ...(club.trackAssists
                      ? [
                          {
                            label: "Passeur",
                            entry: honours.topAssister,
                            unit: (v: number) => (v > 1 ? "passes" : "passe"),
                          },
                        ]
                      : []),
                    {
                      label: "MVP",
                      entry: honours.topMvp,
                      unit: (v: number) => (v > 1 ? "titres" : "titre"),
                    },
                    {
                      label: "Meilleur %V",
                      entry: honours.topWinPct,
                      unit: () => "% (min 5 matchs)",
                    },
                    {
                      label: "Élo le plus haut",
                      entry: honours.topElo,
                      unit: () => "pts",
                    },
                    {
                      label: "L'inoxydable",
                      entry: honours.ironMan,
                      unit: (v: number) =>
                        v > 1 ? "apparitions" : "apparition",
                    },
                  ] as {
                    label: string;
                    entry: SeasonHonours["topScorer"];
                    unit: (v: number) => string;
                  }[]
                )
                  .filter((c) => c.entry !== null)
                  .map((c) => (
                    <div
                      key={c.label}
                      className="rounded-[2px] bg-[color:var(--pitch-1)] p-3"
                    >
                      <span className="kicker">{c.label}</span>
                      <div className="mt-1 truncate font-semibold">
                        <Link
                          href={`/c/${slug}/players/${c.entry!.playerId}`}
                          className="hover:text-[color:var(--ink-1)]"
                        >
                          {c.entry!.name}
                        </Link>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="num-sculpt text-2xl text-[color:var(--gold)]">
                          {c.entry!.value}
                        </span>
                        <span className="truncate text-xs font-bold text-[color:var(--ink-3)]">
                          {c.unit(c.entry!.value)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Palmarès compact — « Toutes » + saisons clôturées.
              Ici l'icône porte le sens seule : aucun mot ne dit
              « meilleur buteur » ou « homme du match ». */}
          {pastHonours.length > 0 && (
            <section className="mt-10">
              <span className="kicker mb-3 block">
                Palmarès des saisons clôturées
              </span>
              <ul
                className={`divide-y divide-[color:var(--rule)] overflow-hidden ${panel}`}
              >
                {pastHonours.map((h) => (
                  <li
                    key={h.seasonName}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  >
                    <span className="font-black">{h.seasonName}</span>
                    {h.topScorer ? (
                      <span className="inline-flex items-center gap-1.5 text-[color:var(--ink-2)]">
                        <Icon
                          name="crown"
                          filled
                          size={14}
                          label="Meilleur buteur"
                          className="shrink-0 text-[color:var(--ink-3)]"
                        />
                        <span className="font-bold text-[color:var(--ink-1)]">
                          {h.topScorer.name}
                        </span>
                        <span className="text-xs tabular-nums">
                          {h.topScorer.value} but
                          {h.topScorer.value > 1 ? "s" : ""}
                        </span>
                      </span>
                    ) : null}
                    {h.topMvp ? (
                      <span className="inline-flex items-center gap-1.5 text-[color:var(--ink-2)]">
                        <Icon
                          name="star"
                          filled
                          size={14}
                          label="Homme du match"
                          className="shrink-0 text-[color:var(--gold)]"
                        />
                        <span className="font-bold text-[color:var(--ink-1)]">
                          {h.topMvp.name}
                        </span>
                        <span className="text-xs tabular-nums">
                          {h.topMvp.value} MVP
                        </span>
                      </span>
                    ) : null}
                    {!h.topScorer && !h.topMvp && (
                      <span className="text-[color:var(--ink-3)]">
                        Saison sans relief.
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Bilan vs adversaires */}
          {external.played > 0 && (
            <section className="mt-10">
              <span className="kicker mb-3 block">Bilan vs adversaires</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  { label: "J", value: String(external.played) },
                  {
                    label: "V-N-D",
                    value: `${external.wins}-${external.draws}-${external.losses}`,
                  },
                  {
                    label: "Buts +/-",
                    value: `${external.goalsFor} / ${external.goalsAgainst}`,
                  },
                  { label: "Points", value: String(external.points) },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[2px] bg-[color:var(--pitch-1)] px-4 py-3"
                  >
                    <div className="kicker">{s.label}</div>
                    <div className="num-sculpt mt-1 truncate text-lg">
                      {s.value}
                    </div>
                  </div>
                ))}
                <div className="col-span-2 rounded-[2px] bg-[color:var(--pitch-1)] px-4 py-3 sm:col-span-1">
                  <div className="kicker">Forme</div>
                  <div className="mt-2">
                    <FormBadges form={external.form} />
                  </div>
                </div>
              </div>

              {external.byOpponent.length > 0 && (
                <div className="mt-4">
                  <span className="kicker mb-3 block">Face-à-face</span>
                  <div className={`scroll-x ${panel}`}>
                    <table className="min-w-[640px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-[color:var(--rule)]">
                          <th className={`${th} text-left`}>Adversaire</th>
                          <th className={`${th} text-center`}>J</th>
                          <th className={`${th} text-center`}>V</th>
                          <th className={`${th} text-center`}>N</th>
                          <th className={`${th} text-center`}>D</th>
                          <th className={`${th} text-center`}>BP</th>
                          <th className={`${th} text-center`}>BC</th>
                          <th className={`${th} text-center`}>Diff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[color:var(--rule)]">
                        {external.byOpponent.map((o) => {
                          const diff = o.goalsFor - o.goalsAgainst;
                          return (
                            <tr
                              key={o.opponentId}
                              className="transition-colors hover:bg-[color:var(--pitch-2)]"
                            >
                              <td className={`${td} font-bold`}>{o.name}</td>
                              <td className={tdNum}>{o.played}</td>
                              <td className={tdNum}>{o.wins}</td>
                              <td className={tdNum}>{o.draws}</td>
                              <td className={tdNum}>{o.losses}</td>
                              <td className={tdNum}>{o.goalsFor}</td>
                              <td className={tdNum}>{o.goalsAgainst}</td>
                              <td
                                className={`${tdNum} font-black ${
                                  diff > 0
                                    ? "text-[color:var(--win)]"
                                    : diff < 0
                                      ? "text-[color:var(--loss)]"
                                      : "text-[color:var(--ink-3)]"
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff < 0 ? `-${Math.abs(diff)}` : diff}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
