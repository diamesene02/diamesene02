import Link from "next/link";
import * as D from "@/lib/dates";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import CompoSoiree from "@/components/CompoSoiree";
import Classement from "@/components/Classement";
import LigneScore from "@/components/ios/LigneScore";
import Ecusson from "@/components/ios/Ecusson";
import { lettre } from "@/lib/ini";
import { nomsChasubles } from "@/lib/color";
import { getLeaderboard } from "@/lib/stats";
import MoneyPanel from "./MoneyPanel";
import SessionRsvpAdmin, { type SessionPlayerRow } from "./SessionRsvpAdmin";
import DeleteSessionButton from "./DeleteSessionButton";
import "./soiree.css";

export const dynamic = "force-dynamic";

// La soirée, dans le dessin de la maquette : la date en titre, la carte
// « Ma réponse », la carte « Composition » sur pelouse, puis — dès que ça a
// joué — le bilan, les matchs et les cracks du soir. La caisse du terrain est
// une carte à part, pour l'admin.
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
          events: {
            where: { type: { in: ["GOAL", "OWN_GOAL"] } },
            orderBy: { minute: "asc" },
            select: { type: true, player: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!md) notFound();

  // Les noms d'équipe par défaut se DÉDUISENT des chasubles réglées par le
  // club : une équipe nommée « Blanc » ne peut plus porter un écusson noir.
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

  const campDe = new Map(md.lineup.map((l) => [l.playerId, l.team as "A" | "B"]));
  const rsvpByPlayer = new Map(md.rsvps.map((r) => [r.playerId, r]));
  const rsvpRows: SessionPlayerRow[] = players.map((p) => ({
    playerId: p.id,
    name: p.name,
    status: rsvpByPlayer.get(p.id)?.status ?? null,
    camp: campDe.get(p.id) ?? null,
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

  // Le bilan du soir : le club joue toute la soirée avec les deux mêmes
  // chasubles, le chiffre qui raconte le lundi est le nombre de matchs gagnés.
  const internes = termines.filter((m) => m.kind !== "EXTERNAL");
  let victoiresA = 0, victoiresB = 0, nuls = 0;
  for (const m of internes) {
    if (m.scoreA > m.scoreB) victoiresA += 1;
    else if (m.scoreB > m.scoreA) victoiresB += 1;
    else nuls += 1;
  }
  const butsDuSoir = termines.reduce((s, m) => s + m.scoreA + m.scoreB, 0);
  const nomA = md.teamAName ?? internes[0]?.teamAName ?? nomsClub.a;
  const nomB = md.teamBName ?? internes[0]?.teamBName ?? nomsClub.b;
  const soireeFinie = liveMatches.length === 0;

  const classement =
    termines.length > 0
      ? (await getLeaderboard({ clubId, matchDayId: id })).filter(
          (r) => r.matchesPlayed > 0,
        )
      : [];
  const buteurDuSoir = [...classement].filter((r) => r.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  const mvpDuSoir = [...classement].filter((r) => r.mvpCount > 0).sort((a, b) => b.mvpCount - a.mvpCount)[0];

  const dateLabel = D.jourLong(md.date);
  const timeLabel = D.heure(md.date);
  const fmtShort = D.heure;
  const opponentOr = (m: (typeof md.matches)[number]) =>
    m.kind === "EXTERNAL" && m.opponent ? m.opponent.name : m.teamBName;
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
  /// Soirée dont le jour est passé : on ne lui propose plus un coup d'envoi
  /// mais une saisie.
  const passee = md.date.getTime() < D.minuit(new Date());

  const preparation = (
    <>
      <section className="carte soiree-carte">
        <SessionRsvpAdmin
          key={rsvpRows.map((r) => `${r.playerId}:${r.status ?? "-"}`).join("|")}
          slug={slug}
          matchDayId={md.id}
          myPlayerId={myPlayer?.id ?? null}
          canManage={ctx.canManage}
          players={rsvpRows}
          argent={
            <MoneyPanel
              mode="resume"
              slug={slug}
              matchDayId={md.id}
              canManage={ctx.canManage}
              costCents={md.fieldCostCents}
              payers={payers}
            />
          }
        />
      </section>

      <section className="carte soiree-carte">
        <CompoSoiree
          // Sans identité dérivée des données serveur, « Compo précédente »
          // écrivait bien en base mais n'apparaissait pas : router.refresh()
          // préserve l'état client.
          key={
            md.lineup.map((l) => `${l.playerId}:${l.team}`).join("|") +
            `|${md.teamAName ?? ""}|${md.teamBName ?? ""}`
          }
          slug={slug}
          matchDayId={md.id}
          peutModifier={ctx.canScore}
          joueurs={players}
          compoInitiale={md.lineup.map((l) => ({ playerId: l.playerId, team: l.team as "A" | "B" }))}
          nomAInitial={md.teamAName ?? nomsClub.a}
          nomBInitial={md.teamBName ?? nomsClub.b}
        />
      </section>

      {showMoney && (
        <section className="carte soiree-carte">
          <div className="carte-titre">Le terrain</div>
          <MoneyPanel
            key={`${md.fieldCostCents ?? "-"}|${payers.map((p) => `${p.playerId}:${p.hasPaid ? 1 : 0}`).join(",")}`}
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

  const resultats = (
    <>
      {/* Le bilan de la soirée — un COMPTE de matchs gagnés, pas un score.
          Il empruntait la ligne de score : deux écussons, deux gros chiffres
          face à face et « Terminé » au milieu. Une soirée gagnée un match à
          zéro se lisait donc comme un match gagné 1-0, juste au-dessus du
          vrai 18-9. On écrit l'unité sous le chiffre, et la barre montre le
          rapport de force au lieu de mimer un tableau d'affichage. */}
      {internes.length > 0 && (
        <section className="carte soiree-carte">
          <div className="carte-titre">
            Le bilan de la soirée
            {!soireeFinie && <span className="soiree-encours"> · en cours</span>}
          </div>
          <div className="soiree-bilan">
            <div className="camp">
              <Ecusson camp="A" lettre={lettre(nomA)} taille={44} />
              <span className="nom">{nomA}</span>
              <span className="compte">{victoiresA}</span>
              <span className="unite">
                match{victoiresA > 1 ? "s" : ""} gagné{victoiresA > 1 ? "s" : ""}
              </span>
            </div>
            <div className="camp">
              <Ecusson camp="B" lettre={lettre(nomB)} taille={44} />
              <span className="nom">{nomB}</span>
              <span className="compte">{victoiresB}</span>
              <span className="unite">
                match{victoiresB > 1 ? "s" : ""} gagné{victoiresB > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div
            className="soiree-jauge"
            role="img"
            aria-label={`${nomA} ${victoiresA}, ${nomB} ${victoiresB}, ${nuls} nul${nuls > 1 ? "s" : ""}`}
          >
            <span className="a" style={{ flexGrow: victoiresA }} />
            <span className="nul" style={{ flexGrow: nuls }} />
            <span className="b" style={{ flexGrow: victoiresB }} />
          </div>
          <div className="soiree-resume">
            {internes.length} match{internes.length > 1 ? "s" : ""} joué
            {internes.length > 1 ? "s" : ""}
            {nuls > 0 && <> · {nuls} nul{nuls > 1 ? "s" : ""}</>} ·{" "}
            <b>{butsDuSoir}</b> but{butsDuSoir > 1 ? "s" : ""}
            {buteurDuSoir && <> · {buteurDuSoir.name} <b>{buteurDuSoir.goals}</b></>}
            {mvpDuSoir && <> · <span style={{ color: "var(--or)" }}>★ {mvpDuSoir.name}</span></>}
          </div>
        </section>
      )}

      {liveMatches.map((m) => (
        <section key={m.id} className="carte soiree-carte soiree-matchs">
          <LigneScore
            nomA={m.teamAName}
            nomB={opponentOr(m)}
            scoreA={m.scoreA}
            scoreB={m.scoreB}
            etat="En direct"
            direct
            heure="Reprendre ›"
            href={`/c/${slug}/matches/${m.id}/live`}
          />
        </section>
      ))}

      {autresMatchs.length > 0 && (
        <section className="carte soiree-carte soiree-matchs">
          <div className="carte-titre">Les matchs</div>
          {autresMatchs.map((m) => {
            const aVenir = m.status === "SCHEDULED";
            return (
              <LigneScore
                key={m.id}
                nomA={m.teamAName}
                nomB={opponentOr(m)}
                scoreA={m.scoreA}
                scoreB={m.scoreB}
                aVenir={aVenir}
                etat={aVenir ? "À venir" : "Terminé"}
                heure={fmtShort(m.playedAt)}
                href={`/c/${slug}/matches/${m.id}`}
                pied={aVenir ? undefined : buteursDe(m) || undefined}
              />
            );
          })}
        </section>
      )}

      {classement.length > 0 && (
        <section className="carte soiree-carte soiree-tableau">
          <div className="carte-titre">Les cracks du soir</div>
          <Classement
            slug={slug}
            lignes={classement.slice(0, 10).map((r) => ({
              playerId: r.playerId, name: r.name, nickname: r.nickname, isGuest: r.isGuest,
              matchesPlayed: r.matchesPlayed, goals: r.goals, assists: r.assists, yellow: r.yellow, red: r.red,
              wins: r.wins, draws: r.draws, losses: r.losses, winPct: r.winPct, mvpCount: r.mvpCount,
              form: r.form, streak: r.streak, elo: r.elo, eloTrend: r.eloTrend,
            }))}
            trackAssists={ctx.club.trackAssists}
            trackCards={ctx.club.trackCards}
          />
        </section>
      )}
    </>
  );

  return (
    <main className="ecran">
      <div className="soiree-tete">
        <div className="titre-ecran capitalize">{dateLabel}</div>
        <div className="sous-titre">
          {timeLabel}
          {md.location && <> · {md.location}</>}
          {md.title && <> · {md.title}</>}
        </div>
        {md.notes && <p className="soiree-notes">{md.notes}</p>}
        {ctx.canScore && liveMatches.length === 0 && (
          <div className="soiree-actions">
            {/* Une soirée passée ne se « lance » pas : elle se saisit. */}
            {passee ? (
              <Link
                href={`/c/${slug}/matches/new?md=${md.id}&joue=1`}
                className="verre"
              >
                Saisir un match joué
              </Link>
            ) : (
              <>
                <Link href={`/c/${slug}/matches/new?md=${md.id}`} className="verre">
                  Lancer un match
                </Link>
                <Link
                  href={`/c/${slug}/matches/new?md=${md.id}&joue=1`}
                  className="verre"
                >
                  Saisir un match joué
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {commencee ? (
        <>
          {resultats}
          {preparation}
        </>
      ) : (
        preparation
      )}

      {ctx.canManage && <DeleteSessionButton slug={slug} matchDayId={md.id} />}
    </main>
  );
}
