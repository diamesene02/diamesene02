import "./stats.css";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import Icon from "@/components/Icon";
import Carte from "@/components/ios/Carte";
import Onglets from "@/components/ios/Onglets";
import Records from "./Records";
import DerbyCarte from "./Derby";
import Gardiens from "./Gardiens";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import Classement, { trierParPoints } from "@/components/Classement";
import {
  getClubRecords,
  getDerby,
  getExternalRecord,
  getGardiens,
  getLeaderboard,
  getSeasonHonours,
  type Result,
  type SeasonHonours,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

type Camp = "A" | "B";

/// « Saison 2026-2027 » devient « Saison 26–27 » : la pilule fait 44 px de
/// haut et partage la ligne avec le titre, le millésime complet n'y tient
/// pas. Un nom libre (« Été ») garde son mot.
function libelleSaison(nom: string): string {
  const m = nom.match(/(\d{2})(\d{2})\s*[-–—/]\s*(\d{2})?(\d{2})/);
  if (m) return `Saison ${m[2]}–${m[4]}`;
  return /^saison/i.test(nom.trim()) ? nom : `Saison ${nom}`;
}

/// Les cinq cases V/N/D, dans l'ordre du temps : la plus récente à droite,
/// là où l'œil finit — c'est de là que part la série.
function Forme({ form }: { form: Result[] }) {
  if (form.length === 0) {
    return <span className="text-[color:var(--i3)]">—</span>;
  }
  return (
    <span className="forme">
      {[...form].reverse().map((r, i) => (
        <span
          key={i}
          className={`forme-case${r === "W" ? " v" : r === "D" ? " n" : ""}`}
          title={r === "W" ? "Victoire" : r === "D" ? "Nul" : "Défaite"}
        />
      ))}
    </span>
  );
}

// La série est un nombre signé : +3, −2, ou un tiret quand rien ne court.
function Serie({ streak }: { streak: number }) {
  if (streak > 0) return <span className="serie plus">+{streak}</span>;
  if (streak < 0) return <span className="serie moins">−{Math.abs(streak)}</span>;
  return <span className="serie">—</span>;
}

/// Le ballon qui part : la passe décisive n'a pas d'icône dans le jeu
/// maison, celle-ci suit son tracé (1,75 px, grille de 24, bouts francs).
function IconePasse() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      aria-hidden
    >
      <circle cx="15.5" cy="12" r="5.5" />
      <path d="M2.5 12h7M6.5 8.5l3.5 3.5-3.5 3.5" />
    </svg>
  );
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

  const [rows, external, records, derby, gardiens, participations] = await Promise.all([
    getLeaderboard(scope),
    getExternalRecord(scope, { win: club.pointsWin, draw: club.pointsDraw }),
    getClubRecords(scope),
    getDerby(scope),
    getGardiens(scope),
    // La chasuble de chacun, pour l'anneau de son avatar : celle de son
    // dernier match terminé dans la période. Un joueur n'a pas d'équipe
    // fixe au five, on lui prête la dernière portée.
    prisma.matchParticipant.findMany({
      where: {
        match: {
          clubId,
          status: "FINISHED",
          ...(scope.seasonId ? { seasonId: scope.seasonId } : {}),
        },
      },
      select: { playerId: true, initialTeam: true },
      orderBy: { match: { playedAt: "desc" } },
    }),
  ]);
  const camps: Record<string, Camp | undefined> = {};
  for (const p of participations) {
    if (!camps[p.playerId]) camps[p.playerId] = p.initialTeam;
  }

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

  const choix = [
    ...seasons.map((s) => ({ id: s.id, label: libelleSaison(s.name) })),
    { id: "all", label: "Toutes saisons" },
  ];
  const choixCourant = choix.find((c) => c.id === selected) ?? choix[0];

  const byGoals = [...rows].sort((a, b) => b.goals - a.goals)[0];
  const byMvp = [...rows].sort((a, b) => b.mvpCount - a.mvpCount)[0];
  const byAssists = [...rows].sort((a, b) => b.assists - a.assists)[0];

  // Le palmarès de la période : l'homme du match le plus titré, le meilleur
  // buteur, le passeur si le club compte les passes. Le gardien de la soirée
  // de la maquette n'existe pas ici — aucun but encaissé n'est en base, on
  // ne l'invente pas.
  const podium: {
    id: string;
    label: string;
    icone: React.ReactNode;
    or?: boolean;
    playerId: string;
    name: string;
    value: number;
    unit?: string;
  }[] = [];
  if (byMvp && byMvp.mvpCount > 0) {
    podium.push({
      id: "mvp",
      label: "Homme du match",
      icone: <Icon name="trophy" size={26} />,
      or: true,
      playerId: byMvp.playerId,
      name: byMvp.name,
      value: byMvp.mvpCount,
    });
  }
  if (byGoals && byGoals.goals > 0) {
    podium.push({
      id: "buteur",
      label: "Meilleur buteur",
      icone: <Icon name="ball" size={26} />,
      playerId: byGoals.playerId,
      name: byGoals.name,
      value: byGoals.goals,
    });
  }
  if (club.trackAssists && byAssists && byAssists.assists > 0) {
    podium.push({
      id: "passeur",
      label: "Meilleur passeur",
      icone: <IconePasse />,
      playerId: byAssists.playerId,
      name: byAssists.name,
      value: byAssists.assists,
    });
  }

  const lignes = rows.map((r) => ({
    playerId: r.playerId,
    photo: r.photo,
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
  }));
  const fiche = (id: string) => `/c/${slug}/players/${id}`;

  // Buteurs : tous les joueurs, du plus prolifique au moins, la barre en
  // proportion du meilleur.
  const buteurs = [...rows].sort(
    (a, b) => b.goals - a.goals || a.name.localeCompare(b.name),
  );
  const maxButs = buteurs[0]?.goals ?? 0;

  // Forme : dans l'ordre du tableau, pour retrouver chacun à la même place.
  const forme = trierParPoints(rows, club.pointsWin, club.pointsDraw);

  const exportHref = `/api/clubs/${clubId}/export?type=leaderboard&saison=${selected}`;

  const selecteur = (
    <details className="stats-saison">
      <summary className="verre lueur" aria-label="Choisir la saison">
        <span className="nom">{choixCourant.label}</span>
        <span className="fleche" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="stats-saison-menu" role="menu">
        {choix.map((c) => (
          <Link
            key={c.id}
            href={`/c/${slug}/stats?saison=${c.id}`}
            role="menuitemradio"
            aria-checked={c.id === selected}
            className={`stats-saison-item${c.id === selected ? " actif" : ""}`}
          >
            {c.label}
            {c.id === selected && (
              <span className="coche">
                <Icon name="check" size={16} />
              </span>
            )}
          </Link>
        ))}
      </div>
    </details>
  );

  return (
    <main className="ecran">
      <div className="stats-tete">
        <h1 className="titre-ecran">Stats</h1>
        {selecteur}
      </div>

      {rows.length === 0 ? (
        /* L'état vide est le SQUELETTE du tableau, avec des tirets à la place
           des chiffres. Une feuille vierge se reconnaît vierge — elle ne se
           présente pas comme une erreur. */
        <Carte className="stats-carte">
          <div className="onglets" aria-hidden>
            <span className="onglet actif">Tableau</span>
            <span className="onglet">Buteurs</span>
            <span className="onglet">Forme</span>
          </div>
          <div className="filet" />
          <div className="tableau-tete" aria-hidden>
            <span />
            <span />
            <span>Joueur</span>
            <span>MJ</span>
            <span>V</span>
            <span>N</span>
            <span>D</span>
            <span>B</span>
            <span>PTS</span>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="tableau-rangee" aria-hidden>
              <span>—</span>
              <span className="avatar-anneau" />
              <span className="text-[color:var(--i3)]">—</span>
              <span>—</span>
              <span>—</span>
              <span>—</span>
              <span>—</span>
              <span>—</span>
              <span>—</span>
            </div>
          ))}
          <p className="stats-vide">
            Aucun match terminé sur cette période.
            {ctx.canScore && (
              <>
                {" "}
                <Link href={`/c/${slug}/matches/new`}>Lancer le premier</Link>.
              </>
            )}
          </p>
        </Carte>
      ) : (
        <>
          {/* LA CARTE À ONGLETS : le tableau, les buteurs, la forme. Chaque
              rangée mène à la fiche du joueur. */}
          <Carte className="stats-carte">
            <Onglets
              onglets={[
                {
                  id: "tableau",
                  label: "Tableau",
                  contenu: (
                    <>
                      <Classement
                        slug={slug}
                        lignes={lignes}
                        trackAssists={club.trackAssists}
                        trackCards={club.trackCards}
                        pointsWin={club.pointsWin}
                        pointsDraw={club.pointsDraw}
                        camps={camps}
                      />
                      <a href={exportHref} download className="tableau-pied">
                        Exporter en CSV
                      </a>
                    </>
                  ),
                },
                {
                  id: "buteurs",
                  label: "Buteurs",
                  contenu: (
                    <div>
                      {buteurs.map((r, i) => {
                        const camp = camps[r.playerId];
                        return (
                          <Link
                            key={r.playerId}
                            href={fiche(r.playerId)}
                            className="stats-rangee stats-buteur"
                          >
                            <span>{i + 1}</span>
                            <AvatarAnneau nom={r.name} photo={r.photo} camp={camp ?? null} taille={30} />
                            <span className="bloc">
                              <span className="nom">{r.name}</span>
                              <span className="barre" aria-hidden>
                                <i
                                  className={camp ?? undefined}
                                  style={{
                                    width: `${maxButs > 0 ? Math.round((r.goals / maxButs) * 100) : 0}%`,
                                  }}
                                />
                              </span>
                            </span>
                            <span className="buts">{r.goals}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ),
                },
                {
                  id: "forme",
                  label: "Forme",
                  contenu: (
                    <div>
                      {forme.map((r) => (
                        <Link
                          key={r.playerId}
                          href={fiche(r.playerId)}
                          className="stats-rangee stats-forme"
                        >
                          <AvatarAnneau
                            nom={r.name}
                            photo={r.photo}
                            camp={camps[r.playerId] ?? null}
                            taille={30}
                          />
                          <span className="nom">{r.name}</span>
                          <Forme form={r.form} />
                          <Serie streak={r.streak} />
                        </Link>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </Carte>

          {/* LE PALMARÈS de la période. Pour une saison clôturée, c'est le
              palmarès complet qui prend la carte — même dessin, plus de
              titres. */}
          {honours ? (
            <Carte
              className="stats-palmares"
              titre={`Palmarès ${honours.seasonName}`}
            >
              {(
                [
                  {
                    label: "Homme du match",
                    icone: <Icon name="trophy" size={26} />,
                    or: true,
                    entry: honours.topMvp,
                    unit: (v: number) => (v > 1 ? "titres" : "titre"),
                  },
                  {
                    label: "Meilleur buteur",
                    icone: <Icon name="ball" size={26} />,
                    entry: honours.topScorer,
                    unit: (v: number) => (v > 1 ? "buts" : "but"),
                  },
                  ...(club.trackAssists
                    ? [
                        {
                          label: "Meilleur passeur",
                          icone: <IconePasse />,
                          entry: honours.topAssister,
                          unit: (v: number) => (v > 1 ? "passes" : "passe"),
                        },
                      ]
                    : []),
                  {
                    label: "Meilleur %V",
                    icone: null,
                    entry: honours.topWinPct,
                    unit: () => "%",
                  },
                  {
                    label: "Élo le plus haut",
                    icone: null,
                    entry: honours.topElo,
                    unit: () => "pts",
                  },
                  {
                    label: "L'inoxydable",
                    icone: null,
                    entry: honours.ironMan,
                    unit: (v: number) => (v > 1 ? "matchs" : "match"),
                  },
                ] as {
                  label: string;
                  icone: React.ReactNode;
                  or?: boolean;
                  entry: SeasonHonours["topScorer"];
                  unit: (v: number) => string;
                }[]
              )
                .filter((c) => c.entry !== null)
                .map((c) => (
                  <Link
                    key={c.label}
                    href={fiche(c.entry!.playerId)}
                    className="stats-titre"
                  >
                    <span className={`icone${c.or ? " or" : ""}`}>{c.icone}</span>
                    <span className="libelle">{c.label}</span>
                    <span className="laureat">
                      {c.entry!.name} · {c.entry!.value}
                      <span className="unite"> {c.unit(c.entry!.value)}</span>
                    </span>
                  </Link>
                ))}
            </Carte>
          ) : (
            podium.length > 0 && (
              <Carte
                className="stats-palmares"
                titre={
                  selected === "all"
                    ? "Palmarès · toutes saisons"
                    : "Palmarès de la saison"
                }
              >
                {podium.map((p) => (
                  <Link key={p.id} href={fiche(p.playerId)} className="stats-titre">
                    <span className={`icone${p.or ? " or" : ""}`}>{p.icone}</span>
                    <span className="libelle">{p.label}</span>
                    <span className="laureat">
                      {p.name} · {p.value}
                    </span>
                  </Link>
                ))}
              </Carte>
            )
          )}

          {/* Palmarès compact — « Toutes » + saisons clôturées. */}
          {pastHonours.length > 0 && (
            <Carte className="stats-palmares" titre="Palmarès des saisons clôturées">
              {pastHonours.map((h) => (
                <div key={h.seasonName} className="stats-saison-cloturee">
                  <div className="nom-saison">{h.seasonName}</div>
                  <div className="laureats">
                    {h.topScorer && (
                      <span>
                        Meilleur buteur <b>{h.topScorer.name}</b> ·{" "}
                        {h.topScorer.value} but{h.topScorer.value > 1 ? "s" : ""}
                      </span>
                    )}
                    {h.topMvp && (
                      <span>
                        Homme du match <b>{h.topMvp.name}</b> · {h.topMvp.value}{" "}
                        titre{h.topMvp.value > 1 ? "s" : ""}
                      </span>
                    )}
                    {!h.topScorer && !h.topMvp && <span>Saison sans relief.</span>}
                  </div>
                </div>
              ))}
            </Carte>
          )}

          {/* LE DERBY : le club joue contre lui-même toute l'année, avec
              les deux mêmes chasubles. C'est la confrontation qui dure. */}
          <DerbyCarte derby={derby} />

          {/* LES GARDIENS : le poste que l'app notait sans le regarder. */}
          <Gardiens slug={slug} gardiens={gardiens} />

          {/* LES RECORDS : ce dont on parle en se rhabillant, et que le
              classement ne dit pas. */}
          <Records slug={slug} records={records} />

          {/* Bilan vs adversaires : la synthèse, la forme, puis le
              face-à-face, un adversaire par ligne. */}
          {external.played > 0 && (
            <Carte className="stats-bilan" titre="Bilan vs adversaires">
              <div className="synthese">
                <span>
                  <b>{external.played}</b> match
                  {external.played > 1 ? "s" : ""}
                </span>
                <span className="synthese-sep">·</span>
                <span>
                  <b>{external.wins}</b> V
                </span>
                <span className="synthese-sep">·</span>
                <span>
                  <b>{external.draws}</b> N
                </span>
                <span className="synthese-sep">·</span>
                <span>
                  <b>{external.losses}</b> D
                </span>
                <span className="synthese-sep">·</span>
                <span>
                  {external.goalsFor}
                  <span className="text-[color:var(--i3)]">:</span>
                  {external.goalsAgainst}
                </span>
                <span className="synthese-sep">·</span>
                <span>
                  <b>{external.points}</b> pts
                </span>
              </div>
              {external.form.length > 0 && (
                <div className="stats-bilan-forme">
                  <Forme form={external.form} />
                </div>
              )}
              {external.byOpponent.map((o) => {
                const diff = o.goalsFor - o.goalsAgainst;
                return (
                  <div key={o.opponentId} className="stats-duel">
                    <span className="nom">{o.name}</span>
                    <span className="bilan">
                      <b>{o.wins}</b> V · <b>{o.draws}</b> N · <b>{o.losses}</b> D
                      {" · "}
                      {o.goalsFor}:{o.goalsAgainst}
                    </span>
                    <span
                      className="diff"
                      style={{
                        color:
                          diff > 0
                            ? "var(--ok)"
                            : diff < 0
                              ? "var(--bad)"
                              : "var(--i3)",
                      }}
                    >
                      {diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : "="}
                    </span>
                  </div>
                );
              })}
            </Carte>
          )}
        </>
      )}
    </main>
  );
}
