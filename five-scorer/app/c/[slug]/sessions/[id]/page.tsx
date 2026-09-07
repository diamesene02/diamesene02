import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import CompoSoiree from "@/components/CompoSoiree";
import Classement from "@/components/Classement";
import Panneau from "@/components/Panneau";
import { nomsChasubles } from "@/lib/color";
import { getLeaderboard } from "@/lib/stats";
import Icon from "@/components/Icon";
import MoneyPanel from "./MoneyPanel";
import SessionRsvpAdmin, { type SessionPlayerRow } from "./SessionRsvpAdmin";
import DeleteSessionButton from "./DeleteSessionButton";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;

  const md = await prisma.matchDay.findFirst({
    where: { id, clubId },
    include: {
      rsvps: { select: { playerId: true, status: true, hasPaid: true } },
      lineup: { select: { playerId: true, team: true } },
      matches: {
        orderBy: { playedAt: "asc" },
        include: {
          opponent: true,
          // Les buteurs : sans eux, six lignes de ticker répètent les deux
          // mêmes noms d'équipe et n'apprennent rien de plus que le score.
          events: {
            where: { type: { in: ["GOAL", "OWN_GOAL"] } },
            orderBy: { minute: "asc" },
            select: {
              type: true,
              player: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!md) notFound();

  // Les noms d'équipe par défaut se DÉDUISENT des chasubles réglées par le
  // club. Ils étaient écrits en dur (« Blanc » / « Noir ») pendant que le club
  // choisissait ses vraies couleurs ailleurs : une équipe nommée « Blanc »
  // pouvait porter une barre noire, et l'écran se lisait à l'envers.
  const nomsClub = nomsChasubles(ctx.club.colorA, ctx.club.colorB);

  const [players, myPlayer] = await Promise.all([
    prisma.player.findMany({
      where: { clubId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, skill: true, isGk: true },
    }),
    prisma.player.findFirst({
      where: { clubId, userId: ctx.user.id },
      select: { id: true },
    }),
  ]);

  const rsvpByPlayer = new Map(md.rsvps.map((r) => [r.playerId, r]));
  const rsvpRows: SessionPlayerRow[] = players.map((p) => ({
    playerId: p.id,
    name: p.name,
    status: rsvpByPlayer.get(p.id)?.status ?? null,
  }));

  const payers = players
    .filter((p) => rsvpByPlayer.get(p.id)?.status === "IN")
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      hasPaid: rsvpByPlayer.get(p.id)?.hasPaid ?? false,
    }));

  const liveMatches = md.matches.filter((m) => m.status === "LIVE");
  const autresMatchs = md.matches.filter((m) => m.status !== "LIVE");
  const termines = md.matches.filter((m) => m.status === "FINISHED");
  const hasFinished = termines.length > 0;

  // ── LE BILAN DU SOIR ────────────────────────────────────────────────────
  // Le club joue toute la soirée avec LES MÊMES DEUX ÉQUIPES : huit matchs de
  // suite entre les mêmes chasubles. Le chiffre qui raconte la soirée n'est
  // donc pas le score d'un match, c'est le nombre de matchs gagnés par camp.
  // Il n'était calculé nulle part — il fallait lire huit lignes et compter
  // de tête.
  const internes = termines.filter((m) => m.kind !== "EXTERNAL");
  let victoiresA = 0;
  let victoiresB = 0;
  let nuls = 0;
  for (const m of internes) {
    if (m.scoreA > m.scoreB) victoiresA += 1;
    else if (m.scoreB > m.scoreA) victoiresB += 1;
    else nuls += 1;
  }
  const butsDuSoir = termines.reduce((s, m) => s + m.scoreA + m.scoreB, 0);
  const nomA = md.teamAName ?? internes[0]?.teamAName ?? nomsClub.a;
  const nomB = md.teamBName ?? internes[0]?.teamBName ?? nomsClub.b;
  // Tant qu'un match est en cours, rien n'est acquis : la bande du vainqueur
  // ne s'élargit qu'au coup de sifflet final de la soirée.
  const soireeFinie = liveMatches.length === 0;

  const classementBrut = hasFinished
    ? (await getLeaderboard({ clubId, matchDayId: id })).filter(
        (r) => r.matchesPlayed > 0,
      )
    : [];
  const classement = classementBrut.slice(0, 10);
  const buteurDuSoir = [...classementBrut]
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals)[0];
  const mvpDuSoir = [...classementBrut]
    .filter((r) => r.mvpCount > 0)
    .sort((a, b) => b.mvpCount - a.mvpCount)[0];

  const dateLabel = md.date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const timeLabel = md.date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const fmtShort = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const opponentOr = (m: (typeof md.matches)[number]) =>
    m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;

  /// « Diame ×2, Karim, Rayan » — les buteurs groupés, dans l'ordre du match.
  /// Un csc porte le nom du joueur suivi de « csc » : c'est ainsi qu'on le
  /// raconte au bord du terrain.
  const buteursDe = (m: (typeof md.matches)[number]) => {
    const compte = new Map<string, number>();
    for (const e of m.events) {
      const nom = e.player?.name ?? "?";
      const cle = e.type === "OWN_GOAL" ? `${nom} (csc)` : nom;
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    }
    return [...compte].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ");
  };

  const showMoney = ctx.canManage || md.fieldCostCents != null;
  const commencee = md.matches.length > 0;

  // ── LA PRÉPARATION ──────────────────────────────────────────────────────
  // Équipes, présences, terrain : l'outillage d'avant coup d'envoi. Il passe
  // en tête quand la soirée n'a pas commencé — c'est alors TOUTE la page —
  // et sous les résultats une fois qu'il y a une histoire à raconter.
  const preparation = (
    <>
      {/* Les équipes de la soirée, préparées à l'avance.
          C'est le bloc qui répond à la douleur rapportée : « à l'heure du
          match on oublie de faire la feuille de match, on perd du temps ». Les
          équipes sont connues trois à quatre jours avant — elles ont désormais
          où être écrites, et le coup d'envoi n'a plus rien à saisir. */}
      <section className="bande mt-8">
        <div className="bande-titre">
          <span className="kicker">Les équipes</span>
          <span
            className="text-[13px] font-semibold"
            style={{
              color: md.lineup.length > 0 ? "var(--win)" : "var(--ink-3)",
            }}
          >
            {md.lineup.length > 0 ? "Prête" : "À faire"}
          </span>
        </div>
        <CompoSoiree
          // L'état du composant est posé au montage. Sans identité dérivée des
          // données serveur, « Compo précédente » écrivait bien en base mais
          // n'apparaissait pas : router.refresh() préserve l'état client. Le
          // badge affichait « Prête » au-dessus d'une liste restée vide, et
          // l'enregistrement suivant effaçait la compo reprise.
          key={
            md.lineup.map((l) => `${l.playerId}:${l.team}`).join("|") +
            `|${md.teamAName ?? ""}|${md.teamBName ?? ""}`
          }
          slug={slug}
          matchDayId={md.id}
          peutModifier={ctx.canScore}
          joueurs={players}
          compoInitiale={md.lineup.map((l) => ({
            playerId: l.playerId,
            team: l.team as "A" | "B",
          }))}
          nomAInitial={md.teamAName ?? nomsClub.a}
          nomBInitial={md.teamBName ?? nomsClub.b}
        />
      </section>

      <section className="bande mt-8">
        <div className="bande-titre">
          <span className="kicker">Présences</span>
        </div>
        <SessionRsvpAdmin
          key={rsvpRows.map((r) => `${r.playerId}:${r.status ?? "-"}`).join("|")}
          slug={slug}
          matchDayId={md.id}
          myPlayerId={myPlayer?.id ?? null}
          canManage={ctx.canManage}
          players={rsvpRows}
        />
      </section>

      {showMoney && (
        <section className="bande mt-8">
          <div className="bande-titre">
            <span className="kicker">Le terrain</span>
            <Icon name="coin" size={15} className="text-[color:var(--ink-3)]" />
          </div>
          <MoneyPanel
            key={`${md.fieldCostCents ?? "-"}|${payers
              .map((p) => `${p.playerId}:${p.hasPaid ? 1 : 0}`)
              .join(",")}`}
            slug={slug}
            matchDayId={md.id}
            canManage={ctx.canManage}
            costCents={md.fieldCostCents}
            payers={payers}
          />
        </section>
      )}
    </>
  );

  // ── LES RÉSULTATS ───────────────────────────────────────────────────────
  const resultats = (
    <>
      {/* LE BILAN. Le même panneau que partout, mais le chiffre compte les
          matchs gagnés, pas les buts : c'est ce qu'on se dit en rentrant. */}
      {internes.length > 0 && (
        <section className="mt-8">
          <div className="bande-titre">
            <span className="kicker">Matchs gagnés</span>
            {!soireeFinie && (
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[color:var(--direct)]">
                <span className="live-dot" />
                en cours
              </span>
            )}
          </div>
          <Panneau
            a={nomA}
            b={nomB}
            scoreA={victoiresA}
            scoreB={victoiresB}
            taille="panneau"
            fini={soireeFinie}
            pied={
              <span className="synthese">
                <span>
                  <b>{internes.length}</b> match
                  {internes.length > 1 ? "s" : ""}
                </span>
                {nuls > 0 && (
                  <>
                    <span className="synthese-sep">·</span>
                    <span>
                      <b>{nuls}</b> nul{nuls > 1 ? "s" : ""}
                    </span>
                  </>
                )}
                <span className="synthese-sep">·</span>
                <span>
                  <b>{butsDuSoir}</b> but{butsDuSoir > 1 ? "s" : ""}
                </span>
                {buteurDuSoir && (
                  <>
                    <span className="synthese-sep">·</span>
                    <span>
                      {buteurDuSoir.name} <b>{buteurDuSoir.goals}</b> buts
                    </span>
                  </>
                )}
                {mvpDuSoir && (
                  <>
                    <span className="synthese-sep">·</span>
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: "var(--gold)" }}
                    >
                      <Icon name="star" size={12} filled />
                      {mvpDuSoir.name}
                    </span>
                  </>
                )}
              </span>
            }
          />
        </section>
      )}

      {/* LE MATCH EN COURS. Une seule chose sur l'écran mérite d'être touchée
          maintenant : celle-ci. */}
      {liveMatches.map((m) => (
        <section key={m.id} className="mt-8">
          <div className="bande-titre">
            <span className="flex items-center gap-2 kicker text-[color:var(--direct)]">
              <span className="live-dot" />
              En direct
            </span>
            <span className="text-[13px] font-semibold text-[color:var(--ink-2)]">
              Reprendre →
            </span>
          </div>
          <Link href={`/c/${slug}/matches/${m.id}/live`} className="block">
            <Panneau
              a={m.teamAName}
              b={opponentOr(m)}
              scoreA={m.scoreA}
              scoreB={m.scoreB}
              taille="panneau"
            />
          </Link>
        </section>
      ))}

      {/* LES MATCHS en ticker. Huit fiches encadrées les unes sous les autres
          occupaient tout l'écran pour huit scores : ici un seul en-tête, un
          filet entre les lignes, 32 px par match. Un service de résultats. */}
      {autresMatchs.length > 0 && (
        <section className="bande mt-8">
          <div className="bande-titre">
            <span className="kicker">Les matchs</span>
            <span className="text-[13px] text-[color:var(--ink-3)]">
              {autresMatchs.length}
            </span>
          </div>
          <ul>
            {autresMatchs.map((m) => {
              const aGagne = m.scoreA > m.scoreB;
              const bGagne = m.scoreB > m.scoreA;
              const aVenir = m.status === "SCHEDULED";
              return (
                <li key={m.id}>
                  <Link href={`/c/${slug}/matches/${m.id}`} className="ticker">
                    <span className="ticker-heure">{fmtShort(m.playedAt)}</span>
                    <span className="ticker-score">
                      {aVenir ? (
                        <span className="text-[color:var(--ink-3)]">—</span>
                      ) : (
                        <>
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
                        </>
                      )}
                    </span>
                    <span className="ticker-buteurs">
                      {m.kind === "EXTERNAL" && (
                        <span className="text-[color:var(--ink-2)]">
                          {opponentOr(m)}
                          {" · "}
                        </span>
                      )}
                      {aVenir
                        ? "à venir"
                        : buteursDe(m) || `${m.teamAName} · ${opponentOr(m)}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* LES CRACKS DU SOIR. Le tableau de cinq colonnes devient les mêmes
          rangées dépliables que le classement de saison : un seul dessin de
          classement dans toute l'app. */}
      {classement.length > 0 && (
        <section className="bande mt-8">
          <div className="bande-titre">
            <span className="kicker">Les cracks du soir</span>
          </div>
          <Classement
            slug={slug}
            lignes={classement.map((r) => ({
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
            trackAssists={ctx.club.trackAssists}
            trackCards={ctx.club.trackCards}
          />
        </section>
      )}
    </>
  );

  return (
    <main>
      {/* EN-TÊTE : la date en grand, le reste en légende. Le bloc « aurora »
          encadré mettait le titre de la soirée en majuscules tracées au-dessus
          d'une boîte à dégradé — le gabarit de tableau de bord. Ici la date
          EST la page, comme sur l'accueil. */}
      <section>
        <Link
          href={`/c/${slug}/sessions`}
          className="text-[13px] font-semibold text-[color:var(--ink-2)]"
        >
          ← Les soirées
        </Link>
        <span className="kicker mt-4 block">{md.title || "Soirée"}</span>
        <h1 className="display-xl mt-2 capitalize">{dateLabel}</h1>
        <div className="synthese mt-3">
          <span>{timeLabel}</span>
          {md.location && (
            <>
              <span className="synthese-sep">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="pin" size={13} className="shrink-0" />
                {md.location}
              </span>
            </>
          )}
          {commencee && (
            <>
              <span className="synthese-sep">·</span>
              <span>
                <b>{md.matches.length}</b> match
                {md.matches.length > 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
        {md.notes && (
          <p className="mt-3 max-w-prose text-sm text-[color:var(--ink-2)]">
            {md.notes}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {ctx.canScore && (
            <Link
              href={`/c/${slug}/matches/new?md=${md.id}`}
              className="inline-flex min-h-[44px] items-center rounded-[2px] bg-[color:var(--ink-1)] px-5 text-[13px] font-semibold text-[color:var(--pitch-0)]"
            >
              Lancer un match
            </Link>
          )}
          {ctx.canManage && (
            <DeleteSessionButton slug={slug} matchDayId={md.id} />
          )}
        </div>
      </section>

      {commencee ? (
        <>
          {resultats}
          {preparation}
        </>
      ) : (
        <>
          {preparation}
          <section className="bande mt-8">
            <p className="text-sm text-[color:var(--ink-2)]">
              Aucun match lancé pour cette soirée
              {ctx.canScore ? " — à toi de donner le coup d'envoi." : "."}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
