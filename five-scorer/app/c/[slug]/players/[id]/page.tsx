import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { getLeaderboard, getPlayerDetail } from "@/lib/stats";
import { nomsChasubles } from "@/lib/color";
import { cn } from "@/lib/cn";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import Ecusson from "@/components/ios/Ecusson";
import "../player.css";

export const dynamic = "force-dynamic";

// La fiche joueur de la maquette : la photo (ici les initiales) avec le badge
// de sa chasuble habituelle, le nom, « Orange · Niveau 4 · 1er du tableau »,
// quatre chiffres, la forme / l'Élo / les buts par match, les derniers
// matchs, et la saison par saison.
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
  const [apparitions, classement] = await Promise.all([
    prisma.matchParticipant.findMany({
      where: {
        playerId: id,
        match: { clubId: ctx.club.id, status: "FINISHED", ...(saison ? { seasonId: saison.id } : {}) },
      },
      select: { initialTeam: true },
    }),
    getLeaderboard({ clubId: ctx.club.id, seasonId: saison?.id ?? null }),
  ]);
  const nA = apparitions.filter((a) => a.initialTeam === "A").length;
  const nB = apparitions.length - nA;
  const camp: "A" | "B" | null = apparitions.length === 0 ? null : nA >= nB ? "A" : "B";
  const noms = nomsChasubles(ctx.club.colorA, ctx.club.colorB);
  const rang = classement.filter((r) => r.matchesPlayed > 0).findIndex((r) => r.playerId === id) + 1;

  const sousTitre = [
    camp ? (camp === "A" ? noms.a : noms.b) : null,
    `Niveau ${player.skill}`,
    player.isGk ? "gardien" : null,
    player.isGuest ? "invité" : null,
    rang > 0 ? `${rang}${rang === 1 ? "er" : "e"} du tableau` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  return (
    <main className="ecran">
      {ctx.canManage && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link href={`/c/${slug}/players?edit=${player.id}`} className="verre lueur">
            Modifier
          </Link>
        </div>
      )}
      <div className="fiche-tete">
        <div className="fiche-photo">
          <AvatarAnneau nom={player.name} camp={camp} taille={128} />
          {camp && <Ecusson camp={camp} lettre={player.isGk ? "G" : String(player.skill)} taille={40} className="badge" />}
        </div>
        <div className="fiche-nom">{player.name}</div>
        {player.nickname && <div className="fiche-sous">« {player.nickname} »</div>}
        <div className="fiche-sous">{sousTitre}</div>
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

          <section className="carte fiche-carte">
            <div className="fiche-ligne">
              <span className="l">Forme</span>
              <span className="forme">
                {allTime.form.map((r, i) => (
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
