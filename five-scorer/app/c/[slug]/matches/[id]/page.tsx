import Link from "next/link";
import * as D from "@/lib/dates";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import RecapView from "@/components/RecapView";
import MotmVotePanel from "@/components/MotmVotePanel";
import DeleteMatchButton from "@/components/DeleteMatchButton";
import RematchButton from "@/components/RematchButton";
import { estRetro } from "@/lib/retro";
import Icon from "@/components/Icon";
import MatchRsvpPanel from "./MatchRsvpPanel";
import CancelMatchButton from "./CancelMatchButton";
import { soireeDuJour } from "@/lib/matches";
import RestoreMatchButton from "./RestoreMatchButton";
import RangerDansSoireeButton from "./RangerDansSoireeButton";
import DebloquesDuMatch, { type JoueurDuMatch } from "./DebloquesDuMatch";
import AnnonceSucces from "@/components/succes/AnnonceSucces";
import { succesDuClub } from "@/lib/succes-serveur";

export const dynamic = "force-dynamic";

export default async function MatchRecapPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);

  const match = await prisma.match.findFirst({
    where: { id, clubId: ctx.club.id },
    include: {
      mvp: true,
      opponent: true,
      season: { select: { name: true } },
      participants: { include: { player: true } },
      events: { orderBy: { createdAt: "asc" }, include: { player: true } },
      motmVotes: true,
      rsvps: { select: { playerId: true, status: true } },
      matchDay: { select: { id: true, date: true } },
      correctedBy: { select: { name: true } },
    },
  });
  if (!match) notFound();

  // Les succès ne se lisent que sur un match terminé (le moteur ignore les
  // autres). Lancés tout de suite, ils se chargent pendant les requêtes du
  // récap au lieu de les attendre.
  //
  // Ils ne sont qu'un plus, comme sur l'accueil : s'ils échouent, le récap
  // s'affiche sans eux plutôt que pas du tout. Le `catch` évite du même coup
  // la promesse rejetée sans preneur pendant que le récap attend ses autres
  // requêtes — Node la signale, voire arrête le processus.
  const succesEnCours =
    match.status === "FINISHED"
      ? succesDuClub(ctx.club.id).catch((e: unknown) => {
          console.error("Récap : succès indisponibles", e);
          return null;
        })
      : null;

  // Rejouer, c'est créer un match AUJOURD'HUI. Il ne doit donc hériter ni de
  // la saison ni de la soirée du match rejoué s'il regarde un vieux récap :
  // sinon le match du soir se retrouve classé dans une saison close, ou
  // rattaché à une soirée d'il y a trois semaines.
  const [saisonActive, matchEnCours] = await Promise.all([
    prisma.season.findFirst({
      where: { clubId: ctx.club.id, isActive: true },
      orderBy: { startsAt: "desc" },
      select: { id: true },
    }),
    prisma.match.findFirst({
      where: { clubId: ctx.club.id, status: "LIVE" },
      select: { id: true },
    }),
  ]);
  // Même histoire qu'à l'accueil : ce calcul portait une seconde copie de la
  // fenêtre glissante de douze heures, sans nom ni test. Le jour du club a
  // remplacé les deux, et la règle qui rattache vraiment vit dans le serveur
  // (spec 0007).
  const soireeEnCours =
    match.matchDay && D.memeJour(match.matchDay.date, new Date())
      ? match.matchDay.id
      : null;

  // Un match sans soirée, un jour où une soirée existe : on propose de le
  // ranger. C'est la destination des trois écrans qui réclamaient une
  // feuille — ils mènent ici, et ici on range (spec 0007).
  const soireeARanger =
    match.matchDayId === null && match.status !== "CANCELED"
      ? await (async () => {
          const id = await soireeDuJour(prisma, ctx.club.id, match.playedAt);
          return id
            ? prisma.matchDay.findUnique({
                where: { id },
                select: { id: true, date: true },
              })
            : null;
        })()
      : null;
  // Sauf quand on est en train de rattraper une soirée passée : là, « le
  // match suivant » est le deuxième match de CETTE soirée-là, pas un match de
  // ce soir. Une soirée de four s'enchaîne ainsi feuille après feuille.
  const rattrapage = estRetro(match.playedAt) && match.matchDayId != null;
  const suivantLe = new Date(
    Math.min(match.playedAt.getTime() + 30 * 60_000, Date.now()),
  ).toISOString();

  // ── Match programmé / annulé : vue convocation, pas de récap ──────────────
  // Un CANCELED sans rien dedans (annulé avant d'avoir été lancé) garde la
  // vue « convocation annulée » d'aujourd'hui. Un CANCELED qui a des
  // participants ou des événements — annulé APRÈS avoir été joué (spec 0006)
  // — tombe dans le récap plus bas, avec son score et un bandeau « Annulé » :
  // il y a quelque chose à montrer, pas seulement une date qui ne tiendra
  // plus lieu de rien.
  const canceledVide =
    match.status === "CANCELED" &&
    match.participants.length === 0 &&
    match.events.length === 0;
  if (match.status === "SCHEDULED" || canceledVide) {
    const scheduledAt = match.scheduledAt ?? match.playedAt;
    const dateLabel = D.jourLong(scheduledAt);
    const timeLabel = D.heure(scheduledAt);
    const versus =
      match.kind === "EXTERNAL" && match.opponent
        ? match.opponent.name
        : match.teamBName;

    if (match.status === "CANCELED") {
      return (
        <main className="mx-auto max-w-2xl">
          <section className="bande">
            <span className="kicker" style={{ color: "var(--loss)" }}>
              Match annulé
            </span>
            <h1 className="display-md mt-2">
              {match.teamAName}{" "}
              <span className="text-[color:var(--ink-2)]">vs</span> {versus}
            </h1>
            <p className="mt-2 text-sm tabular-nums text-[color:var(--ink-1)]">
              Était prévu le {dateLabel} · {timeLabel}
              {match.venue ? ` · ${match.venue}` : ""}
            </p>
            {ctx.canManage && (
              <div className="mt-6 flex justify-end border-t border-[color:var(--rule)] pt-4">
                <DeleteMatchButton slug={slug} matchId={match.id} />
              </div>
            )}
          </section>
        </main>
      );
    }

    const [roster, myPlayer] = await Promise.all([
      prisma.player.findMany({
        where: { clubId: ctx.club.id, isArchived: false, isGuest: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.player.findFirst({
        where: { clubId: ctx.club.id, userId: ctx.user.id },
        select: { id: true },
      }),
    ]);
    const statusByPlayer = new Map(
      match.rsvps.map((r) => [r.playerId, r.status])
    );

    return (
      <main className="mx-auto max-w-2xl">
        <section className="aurora edge-top relative overflow-hidden bande creuse">
          <div className="relative z-[1]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[2px] border border-[color:var(--bib-b-ink)]/40 bg-[color:var(--pitch-2)] px-2.5 py-0.5 text-[13px] font-semibold text-[color:var(--bib-b-ink)]">
                Match programmé
              </span>
              {match.season && <span className="kicker">{match.season.name}</span>}
            </div>
            <h1 className="display-md mt-3">
              {match.teamAName}{" "}
              <span className="text-[color:var(--ink-2)]">vs</span>{" "}
              <span className="text-[color:var(--bib-b-ink)]">{versus}</span>
            </h1>
            <div className="mt-3 text-2xl font-black capitalize">
              {dateLabel}
              <span className="ml-3 text-xl tabular-nums text-[color:var(--ink-1)]">
                {timeLabel}
              </span>
            </div>
            {match.venue && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-[color:var(--ink-1)]">
                <Icon name="pin" size={14} className="shrink-0" />
                <span>{match.venue}</span>
              </div>
            )}
            {ctx.canScore && (
              <Link
                href={`/c/${slug}/matches/new?scheduled=${match.id}`}
                className="group mt-5 inline-flex min-h-[56px] items-center gap-2 rounded-[2px] bg-[color:var(--ink-1)] px-6 text-base font-black tracking-tight text-[color:var(--pitch-0)] transition-transform hover:scale-[1.02]"
              >
                <span>Composer les équipes et lancer</span>
                <span className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            )}
          </div>
        </section>

        <section className="mt-6 bande">
          <span className="kicker mb-3 block">Convocation — qui est là ?</span>
          <MatchRsvpPanel
            slug={slug}
            matchId={match.id}
            myPlayerId={myPlayer?.id ?? null}
            canManage={ctx.canManage}
            players={roster.map((p) => ({
              playerId: p.id,
              name: p.name,
              status: statusByPlayer.get(p.id) ?? null,
            }))}
          />
        </section>

        {ctx.canManage && (
          <div className="mt-8 flex justify-end border-t border-[color:var(--rule)] pt-4">
            <CancelMatchButton slug={slug} matchId={match.id} />
          </div>
        )}
      </main>
    );
  }

  const players = match.participants.map((p) => ({
    id: p.player.id,
    name: p.player.name,
    photo: p.player.photo,
    team: p.team as "A" | "B",
    goals: match.events.filter(
      (e) => e.type === "GOAL" && e.playerId === p.player.id
    ).length,
  }));
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const goals = match.events
    .filter((e) => e.type === "GOAL" || e.type === "OWN_GOAL")
    .map((e) => ({
      id: e.id,
      // Un csc apparaît dans la chronologie mais ne crédite pas le joueur
      // au classement des buteurs.
      scorerId: e.type === "OWN_GOAL" ? "" : (e.playerId ?? ""),
      team: e.team as "A" | "B",
      minute: e.minute,
      createdAt: e.createdAt.toISOString(),
      // Un csc peut rester sans auteur : le score part au premier tap et
      // personne n'est obligé d'avouer. Sans ce repli, le récap affichait
      // « ? » — ce qui se lit comme une panne, pas comme une abstention.
      scorerName: e.player
        ? e.type === "OWN_GOAL"
          ? `${e.player.name} (csc)`
          : e.player.name
        : e.type === "OWN_GOAL"
          ? `csc de ${e.team === "B" ? match.teamAName : match.teamBName}`
          : match.kind === "EXTERNAL" && e.team === "B"
            ? (match.opponent?.name ?? match.teamBName)
            : "?",
      assistName: ctx.club.trackAssists
        ? (match.participants.find((p) => p.playerId === e.assistPlayerId)?.player.name ?? null)
        : undefined,
    }));

  // Les joueurs archivés depuis ne sont pas reconduits — l'accueil le faisait
  // déjà, le récap non : rejouer y réenrôlait des gens partis du club, et
  // saveRoster les réinjectait dans le cache local de l'appareil.
  const rejouables = match.participants.filter((p) => !p.player.isArchived);

  const votesByPlayer = new Map<string, number>();
  for (const v of match.motmVotes) {
    votesByPlayer.set(v.playerId, (votesByPlayer.get(v.playerId) ?? 0) + 1);
  }
  const myVote =
    match.motmVotes.find((v) => v.voterId === ctx.user.id)?.playerId ?? null;
  const showVoting =
    ctx.club.motmMode === "VOTE" &&
    match.status === "FINISHED" &&
    players.length > 0;

  // Le contexte de la barre : « Soirée du 7 sept. · Match 2 ».
  let contexte: string | undefined;
  if (match.matchDay) {
    const freres = await prisma.match.findMany({
      where: { matchDayId: match.matchDay.id, status: { in: ["LIVE", "FINISHED"] } },
      orderBy: { playedAt: "asc" },
      select: { id: true },
    });
    const n = freres.findIndex((m) => m.id === match.id) + 1;
    contexte = `Soirée du ${D.jourCourt(match.matchDay.date)}${n > 0 ? ` · Match ${n}` : ""}`;
  }

  // Le bilan de la saison entre ces deux chasubles : « 9-2-3 » sous chaque
  // écusson, comme sur la maquette.
  const memesEquipes = await prisma.match.findMany({
    where: {
      clubId: ctx.club.id,
      status: "FINISHED",
      kind: "INTERNAL",
      seasonId: match.seasonId,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
    },
    select: { scoreA: true, scoreB: true },
  });
  let vA = 0, vB = 0, nul = 0;
  for (const m of memesEquipes) {
    if (m.scoreA > m.scoreB) vA += 1;
    else if (m.scoreB > m.scoreA) vB += 1;
    else nul += 1;
  }
  const bilanA = memesEquipes.length > 1 ? `${vA}-${nul}-${vB}` : null;
  const bilanB = memesEquipes.length > 1 ? `${vB}-${nul}-${vA}` : null;

  const cartons = ctx.club.trackCards
    ? {
        a: match.events.filter((e) => (e.type === "YELLOW_CARD" || e.type === "RED_CARD") && e.team === "A").length,
        b: match.events.filter((e) => (e.type === "YELLOW_CARD" || e.type === "RED_CARD") && e.team === "B").length,
      }
    : null;
  const votesPour = match.mvpId ? (votesByPlayer.get(match.mvpId) ?? 0) : 0;
  const votesTotal = match.motmVotes.length;

  const succes = succesEnCours ? ((await succesEnCours) ?? null) : null;
  const debloques = succes ? succes.deblocagesDuMatch(match.id) : [];
  const joueursDuMatch = new Map<string, JoueurDuMatch>(
    match.participants.map((p) => [p.playerId, { photo: p.player.photo, camp: p.team as "A" | "B" }]),
  );
  const moi = succes?.joueurDuCompte(ctx.user.id) ?? null;
  const mesSucces = moi ? (succes?.parJoueur.get(moi) ?? null) : null;

  return (
    <main>
      <RecapView
        match={{
          id: match.id,
          playedAt: match.playedAt.toISOString(),
          teamAName: match.teamAName,
          teamBName:
            match.kind === "EXTERNAL" && match.opponent
              ? match.opponent.name
              : match.teamBName,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          status:
            match.status === "CANCELED"
              ? "CANCELED"
              : match.status === "FINISHED"
                ? "FINISHED"
                : "LIVE",
          mvpId: match.mvpId,
          motmLocked: match.motmLocked,
          corrige: match.correctedAt
            ? `Corrigé le ${D.dateComplete(match.correctedAt)} à ${D.heure(match.correctedAt)}${match.correctedBy ? ` par ${match.correctedBy.name}` : ""}`
            : null,
        }}
        mvpName={match.mvp?.name ?? null}
        mvpHref={match.mvpId ? `/c/${slug}/players/${match.mvpId}` : undefined}
        votes={votesTotal > 0 ? { pour: votesPour, total: votesTotal } : null}
        teamA={teamA}
        teamB={teamB}
        goals={goals}
        cartons={cartons}
        bilanA={bilanA}
        bilanB={bilanB}
        contexte={contexte}
        showLiveResumeLink={match.status === "LIVE" && ctx.canScore}
        liveHref={`/c/${slug}/matches/${match.id}/live`}
        club={{
          name: ctx.org.name,
          colorA: ctx.club.colorA,
          colorB: ctx.club.colorB,
        }}
      >
        {/* Une soirée, c'est plusieurs matchs. Le suivant part d'ici, avec la
            composition qu'on vient de jouer. Pas de « on rejoue » tant qu'un
            match tourne : deux matchs LIVE, c'est deux tableaux pour un seul
            terrain. */}
        {match.status === "FINISHED" &&
          ctx.canScore &&
          !matchEnCours &&
          rejouables.length > 0 && (
            <RematchButton
              clubId={ctx.club.id}
              slug={slug}
              teamAName={match.teamAName}
              teamBName={match.teamBName}
              kind={match.kind === "EXTERNAL" ? "EXTERNAL" : "INTERNAL"}
              opponentId={match.opponentId}
              matchDayId={rattrapage ? match.matchDayId : soireeEnCours}
              seasonId={rattrapage ? match.seasonId : (saisonActive?.id ?? null)}
              playedAt={rattrapage ? suivantLe : null}
              label={rattrapage ? "Saisir le match suivant" : undefined}
              players={rejouables.map((p) => ({
                id: p.player.id,
                name: p.player.name,
                nickname: p.player.nickname,
                skill: p.player.skill,
                estGardien: p.player.isGk,
                gardienCeMatch: p.isGk,
                isGuest: p.player.isGuest,
                team: p.team as "A" | "B",
              }))}
            />
          )}

        {/* Après « on rejoue » (le geste du bord du terrain), avant le vote :
            quelques lignes, qui ne doivent pas finir sous la liste des
            candidats. */}
        {debloques.length > 0 && (
          <DebloquesDuMatch slug={slug} deblocages={debloques} joueurs={joueursDuMatch} />
        )}

        {/* L'annonce d'un succès neuf pour le joueur du compte : c'est ici
            qu'on arrive après le coup de sifflet, ou depuis le lien du
            groupe le lendemain. */}
        {moi && mesSucces && (
          <AnnonceSucces clubId={ctx.club.id} playerId={moi} slug={slug} deblocages={mesSucces.deblocages} />
        )}

        {showVoting && (
          <MotmVotePanel
            slug={slug}
            matchId={match.id}
            myVote={myVote}
            candidates={players.map((p) => ({
              id: p.id,
              name: p.name,
              photo: p.photo,
              votes: votesByPlayer.get(p.id) ?? 0,
            }))}
          />
        )}

        {ctx.canManage && match.status === "FINISHED" && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <Link href={`/c/${slug}/matches/${match.id}/corriger`} className="verre">
                Corriger
              </Link>
              <Link href={`/c/${slug}/matches/${match.id}/edit`} className="inline-flex min-h-[44px] items-center text-sm text-[color:var(--ink-2)] hover:text-white">
                Modifier les infos
              </Link>
            </span>
            <DeleteMatchButton slug={slug} matchId={match.id} />
          </div>
        )}
        {/* Celui qui a saisi la feuille n'est très souvent pas admin (Q1,
            spec 0001) : sans cette phrase, il constate une erreur et ne voit
            aucun bouton, sans savoir pourquoi ni à qui s'adresser (APRES-12,
            article V — un refus se dit). */}
        {!ctx.canManage && match.status === "FINISHED" && (
          <p className="text-sm text-[color:var(--ink-2)]">
            Seul un administrateur peut corriger un match terminé.
          </p>
        )}

        {/* Symétrique du bloc FINISHED ci-dessus : un match annulé qui a
            gardé du contenu (buts, compo — spec 0006, sinon il aurait été
            supprimé) peut revenir en jeu et dans les stats (spec 0001,
            Q8). */}
        {ctx.canManage && match.status === "CANCELED" && (
          <RestoreMatchButton slug={slug} matchId={match.id} />
        )}

        {/* Le match n'appartient à aucune soirée, et une soirée existe ce
            jour-là : c'est ici qu'atterrissent les trois écrans qui
            réclamaient une feuille. Ouvert à qui peut scorer (spec 0007) —
            celui qui a fabriqué l'orphelin peut le ranger, sans attendre un
            admin le mardi matin. */}
        {ctx.canScore && soireeARanger && (
          <RangerDansSoireeButton
            slug={slug}
            matchId={match.id}
            soireeId={soireeARanger.id}
            libelle={`Soirée du ${D.jourLong(soireeARanger.date)}`}
          />
        )}
      </RecapView>
    </main>
  );
}
