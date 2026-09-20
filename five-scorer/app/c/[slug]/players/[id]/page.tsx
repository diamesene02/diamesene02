import Link from "next/link";
import * as D from "@/lib/dates";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getGardiens, getLeaderboard, getPlayerDetail } from "@/lib/stats";
import { succesDuClub } from "@/lib/succes-serveur";
import { nomsChasubles } from "@/lib/color";
import { trierParPoints } from "@/lib/classement";
import { cn } from "@/lib/cn";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import Ecusson from "@/components/ios/Ecusson";
import AnnonceSucces from "@/components/succes/AnnonceSucces";
import Abonnement from "./Abonnement";
import SuccesFiche from "./SuccesFiche";
import { libelleAbonnement } from "./vitrine";
import "../player.css";

export const dynamic = "force-dynamic";

// La fiche joueur de la maquette : la photo (ici les initiales) avec le badge
// de sa chasuble habituelle, le nom, « Orange · Titulaire · 1er du tableau »,
// quatre chiffres, la forme / l'Élo / les buts par match, les succès, les
// derniers matchs, et la saison par saison.
//
// Le badge de l'avatar porte le NIVEAU des succès (le même écusson que la
// carte du niveau, plus bas). Il portait la note d'équilibrage (1 à 5) : deux
// « niveaux » sur la même fiche, qui ne disaient pas la même chose. La note
// reste où elle sert — l'effectif et la composition.
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

  // La chasuble habituelle : celle des matchs de la saison en cours, à la
  // majorité. Et le rang au tableau de la saison.
  const saison = await prisma.season.findFirst({
    where: { clubId: ctx.club.id, isActive: true },
    orderBy: { startsAt: "desc" },
    select: { id: true },
  });
  const maintenant = new Date();
  const [apparitions, classement, succesClub, gardiens, soireesAVenir, soireesPassees] = await Promise.all([
    prisma.matchParticipant.findMany({
      where: {
        playerId: id,
        match: { clubId: ctx.club.id, status: "FINISHED", ...(saison ? { seasonId: saison.id } : {}) },
      },
      select: { initialTeam: true },
    }),
    getLeaderboard({ clubId: ctx.club.id, seasonId: saison?.id ?? null }),
    // Les succès ne sont qu'un plus, comme sur l'accueil : s'ils échouent,
    // la fiche s'affiche sans eux plutôt que pas du tout.
    succesDuClub(ctx.club.id).catch((e: unknown) => {
      console.error("Fiche joueur : succès indisponibles", e);
      return null;
    }),
    getGardiens({ clubId: ctx.club.id }),
    // Le jour de jeu du club, pour le libellé de l'abonnement. Les soirées À
    // VENIR d'abord : ce sont elles qui disent le jour qu'on joue
    // MAINTENANT. En lisant une fenêtre de 90 jours dans le passé, du plus
    // ancien au plus récent, on rendait les soirées d'il y a trois mois — un
    // club passé au jeudi en février lisait encore « Vient tous les lundis »
    // sur son réglage le plus important.
    prisma.matchDay.findMany({
      where: { clubId: ctx.club.id, canceledAt: null, date: { gte: maintenant } },
      orderBy: { date: "asc" },
      take: 8,
      select: { date: true },
    }),
    // En juillet, le calendrier de la saison suivante n'est pas encore posé :
    // on se rabat sur les dernières soirées jouées, la plus récente d'abord.
    prisma.matchDay.findMany({
      where: { clubId: ctx.club.id, canceledAt: null, date: { lt: maintenant } },
      orderBy: { date: "desc" },
      take: 8,
      select: { date: true },
    }),
  ]);
  const soirees = soireesAVenir.length > 0 ? soireesAVenir : soireesPassees;
  const succes = succesClub?.parJoueur.get(id) ?? null;
  // Un joueur qui n'a jamais joué est au niveau 1 à 0 XP : on ne l'affiche
  // pas, il n'y a rien à dire.
  const niveau = succes && succes.niveau.xp > 0 ? succes.niveau : null;
  const gardien = gardiens.find((g) => g.playerId === id) ?? null;
  const nA = apparitions.filter((a) => a.initialTeam === "A").length;
  const nB = apparitions.length - nA;
  const camp: "A" | "B" | null = apparitions.length === 0 ? null : nA >= nB ? "A" : "B";
  const noms = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  // Le rang est celui du TABLEAU — donc aux points, comme `Classement`. En
  // lisant `getLeaderboard` dans son ordre (les buteurs), la fiche annonçait
  // « 1er du tableau » à un joueur que la page du classement mettait deuxième.
  const rang =
    trierParPoints(
      classement.filter((r) => r.matchesPlayed > 0),
      ctx.club.pointsWin,
      ctx.club.pointsDraw,
    ).findIndex((r) => r.playerId === id) + 1;

  // Les places gagnées depuis la dernière soirée, quand il y en a : « 3e du
  // tableau (+2) ». Zéro ne se dit pas.
  const evolution = succes?.classement.evolution ?? null;
  const sousTitre: React.ReactNode[] = [
    camp ? (camp === "A" ? noms.a : noms.b) : null,
    niveau ? (
      <>
        {niveau.titre}
        <span className="sr-only">, niveau {niveau.niveau}</span>
      </>
    ) : null,
    player.isGk ? "gardien" : null,
    player.isGuest ? "invité" : null,
    rang > 0
      ? `${rang}${rang === 1 ? "er" : "e"} du tableau${
          evolution ? ` (${evolution > 0 ? "+" : "−"}${Math.abs(evolution)})` : ""
        }`
      : null,
  ].filter(Boolean);
  const estMoi = player.userId === ctx.user.id;

  const fmtDate = (iso: string) => D.jourCourt(new Date(iso));

  return (
    <main className="ecran">
      {/* L'annonce d'un succès neuf, pour qui regarde SA fiche : sur celle
          d'un autre, elle annoncerait ses succès à lui — et les marquerait
          vus à sa place. */}
      {estMoi && succes && (
        <AnnonceSucces
          clubId={ctx.club.id}
          playerId={player.id}
          slug={slug}
          deblocages={succes.deblocages}
          href={`/c/${slug}/players/${player.id}#succes`}
        />
      )}
      {ctx.canManage && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link href={`/c/${slug}/players?edit=${player.id}`} className="verre lueur">
            Modifier
          </Link>
        </div>
      )}
      <div className="fiche-tete">
        <div className="fiche-photo">
          <AvatarAnneau nom={player.name} photo={player.photo} camp={camp} taille={128} />
          {niveau && <Ecusson camp={camp ?? "A"} lettre={String(niveau.niveau)} taille={40} className="badge" />}
        </div>
        <div className="fiche-nom">{player.name}</div>
        {player.nickname && <div className="fiche-sous">« {player.nickname} »</div>}
        <div className="fiche-sous">
          {sousTitre.map((m, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {m}
            </span>
          ))}
        </div>
      </div>

      {allTime && allTime.matchesPlayed > 0 ? (
        <>
          <section className="carte fiche-chiffres">
            <div>
              <div className="n">{allTime.matchesPlayed}</div>
              <div className="l">Matchs</div>
            </div>
            <div>
              <div className="n">{allTime.goals}</div>
              <div className="l">Buts</div>
            </div>
            <div>
              <div className="n">{allTime.mvpCount}</div>
              <div className="l">Homme du match</div>
            </div>
            <div>
              <div className="n">
                {allTime.winPct}
                <small>%</small>
              </div>
              <div className="l">Victoires</div>
            </div>
          </section>

          {gardien && (
            <section className="carte fiche-carte">
              <div className="carte-titre" style={{ padding: "20px 0 8px" }}>
                Dans les buts
              </div>
              <div className="fiche-ligne">
                <span className="l">Matchs gardés</span>
                <span className="v">{gardien.matchs}</span>
              </div>
              <div className="fiche-ligne">
                <span className="l">Buts encaissés</span>
                <span className="v">
                  {gardien.encaisses}{" "}
                  <span style={{ color: "var(--i2)", fontWeight: 400 }}>
                    · {gardien.moyenne.toLocaleString("fr-FR", { minimumFractionDigits: 1 })} par match
                  </span>
                </span>
              </div>
              <div className="fiche-ligne">
                <span className="l">Matchs sans encaisser</span>
                <span className="v">{gardien.cleanSheets}</span>
              </div>
              <div className="fiche-ligne">
                <span className="l">Victoires quand il garde</span>
                <span className="v">{gardien.pctVictoires} %</span>
              </div>
            </section>
          )}

          <section className="carte fiche-carte">
            {(ctx.canManage || estMoi) && (
              <Abonnement
                slug={slug}
                playerId={player.id}
                initial={player.abonne}
                estMoi={estMoi}
                nom={player.name}
                libelle={libelleAbonnement(soirees.map((s) => D.jourSemaineLong(s.date)))}
              />
            )}
            <div className="fiche-ligne">
              <span className="l">Forme</span>
              {/* La plus récente à DROITE, comme la page des stats :
                  `getLeaderboard` la rend la plus récente en premier, et la
                  fiche la peignait dans cet ordre — deux écrans du même site
                  montraient la même forme dans deux sens. */}
              <span className="forme">
                {[...allTime.form].reverse().map((r, i) => (
                  <span key={i} className={cn("forme-case", r === "W" && "v", r === "D" && "n")} title={r === "W" ? "Victoire" : r === "D" ? "Nul" : "Défaite"} />
                ))}
              </span>
              <span className={cn("v", allTime.streak > 0 && "plus", allTime.streak < 0 && "moins")}>
                <span className={allTime.streak > 0 ? "plus" : allTime.streak < 0 ? "moins" : ""}>
                  {allTime.streak > 0 ? `+${allTime.streak}` : allTime.streak < 0 ? allTime.streak : "—"}
                </span>
              </span>
            </div>
            <div className="fiche-ligne">
              <span className="l">Élo</span>
              <span className="v">
                {allTime.elo.toLocaleString("fr-FR")}{" "}
                {allTime.eloTrend !== 0 && (
                  <span className={allTime.eloTrend > 0 ? "plus" : "moins"}>
                    {allTime.eloTrend > 0 ? `+${allTime.eloTrend}` : allTime.eloTrend}
                  </span>
                )}
              </span>
            </div>
            <div className="fiche-ligne">
              <span className="l">Buts par match</span>
              <span className="v">{allTime.goalsPerMatch.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</span>
            </div>
            {ctx.club.trackAssists && allTime.assists > 0 && (
              <div className="fiche-ligne">
                <span className="l">Passes décisives</span>
                <span className="v">{allTime.assists}</span>
              </div>
            )}
          </section>

          {succes && <SuccesFiche slug={slug} succes={succes} elo={allTime.elo} maintenant={maintenant} />}

          <section className="carte fiche-carte">
            <div className="carte-titre" style={{ padding: "20px 0 8px" }}>
              Derniers matchs
            </div>
            {recentMatches.map((m) => {
              const [sa, sb] = m.score.split("-").map(Number);
              const [gauche, droite] = m.label.includes(" vs ") ? m.label.split(" vs ") : [m.label, ""];
              return (
                <Link key={m.id} href={`/c/${slug}/matches/${m.id}`} className="fiche-match">
                  <span className="d">{fmtDate(m.playedAt)}</span>
                  <span className="s">
                    {sa > sb ? <b>{gauche} {sa}</b> : <>{gauche} {sa}</>} – {sb > sa ? <b>{sb} {droite}</b> : <>{sb} {droite}</>}
                  </span>
                  <span className="b">
                    {m.goals > 0 ? `${m.goals} but${m.goals > 1 ? "s" : ""}` : m.wasMvp ? "★" : ""}
                    {m.goals > 0 && m.wasMvp ? " ★" : ""}
                  </span>
                </Link>
              );
            })}
          </section>

          {bySeason.length > 1 && (
            <section className="carte fiche-carte">
              <div className="carte-titre" style={{ padding: "20px 0 8px" }}>
                Par saison
              </div>
              {bySeason.map((sn) => (
                <div key={sn.seasonId ?? "none"} className="fiche-match" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span className="s">
                    <b>{sn.seasonName}</b> · {sn.row.matchesPlayed} match{sn.row.matchesPlayed > 1 ? "s" : ""}
                  </span>
                  <span className="b">
                    {sn.row.goals} but{sn.row.goals > 1 ? "s" : ""} · {sn.row.winPct} %
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      ) : (
        <section className="carte fiche-carte">
          <p className="fiche-vide">Aucun match joué pour l&apos;instant. Ça se règle sur le terrain.</p>
        </section>
      )}
    </main>
  );
}
