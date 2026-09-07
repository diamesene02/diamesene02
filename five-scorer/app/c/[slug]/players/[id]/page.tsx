import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClub } from "@/lib/guard";
import { getPlayerDetail, type Result } from "@/lib/stats";
import { cn } from "@/lib/cn";
import PlayerAvatar from "@/components/PlayerAvatar";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/// La forme, au dessin unique de l'app : plein pour une victoire, contour
/// pour un nul, vide pour une défaite. Elle se lit sans couleur.
function Forme({ form, grand = false }: { form: Result[]; grand?: boolean }) {
  return (
    <span className="forme" style={grand ? { gap: "5px" } : undefined}>
      {form.map((r, i) => (
        <span
          key={i}
          className={cn("forme-case", r === "W" && "v", r === "D" && "n")}
          style={grand ? { width: 14, height: 14 } : undefined}
          title={r === "W" ? "Victoire" : r === "D" ? "Nul" : "Défaite"}
        />
      ))}
    </span>
  );
}

/// « 3 victoires d'affilée » — la série ne se dit qu'à partir de deux, sinon
/// tout joueur en a toujours une et le mot ne veut plus rien dire.
function phraseSerie(streak: number | undefined): string | null {
  if (streak === undefined || Math.abs(streak) < 2) return null;
  const n = Math.abs(streak);
  return streak > 0 ? `${n} victoires d'affilée` : `${n} défaites d'affilée`;
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

  const serie = phraseSerie(allTime?.streak);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });

  return (
    <main>
      {/* L'EN-TÊTE. Le nom EST la page — comme la date sur l'accueil et sur
          la soirée. Il était en display-md dans une boîte à dégradé, sous une
          étiquette « FICHE JOUEUR » en capitales tracées. */}
      <section className="flex items-start gap-4">
        <PlayerAvatar name={player.name} id={player.id} size="lg" />
        <div className="min-w-0 flex-1">
          <span className="kicker">Fiche joueur</span>
          <h1 className="display-xl mt-1">{player.name}</h1>
          {player.nickname && (
            <div className="mt-1 text-lg italic text-[color:var(--ink-2)]">
              « {player.nickname} »
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SkillStars skill={player.skill} />
            {player.isGk && (
              <span className="text-[13px] font-semibold text-[color:var(--ink-2)]">
                · gardien
              </span>
            )}
            {player.isGuest && (
              <span className="text-[13px] font-semibold text-[color:var(--ink-2)]">
                · invité
              </span>
            )}
            {player.userId && (
              <span
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
                style={{ color: "var(--bib-a-ink)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--bib-a)]" />
                compte lié
              </span>
            )}
          </div>
        </div>
      </section>

      {/* TOUT LE BILAN EN UNE LIGNE.
          Sept tuiles « étiquette + gros chiffre » occupaient la moitié de
          l'écran pour dire sept nombres, dont deux à zéro. C'est le gabarit de
          tableau de bord, pas la densité d'une page de sport — l'accueil s'en
          est débarrassé, la fiche joueur le gardait. */}
      {allTime && allTime.matchesPlayed > 0 && (
        <section className="bande mt-6">
          <div className="synthese">
            <span>
              <b>{allTime.matchesPlayed}</b> match
              {allTime.matchesPlayed > 1 ? "s" : ""}
            </span>
            <span className="synthese-sep">·</span>
            <span>
              <b>{allTime.goals}</b> but{allTime.goals > 1 ? "s" : ""}
            </span>
            {ctx.club.trackAssists && allTime.assists > 0 && (
              <>
                <span className="synthese-sep">·</span>
                <span>
                  <b>{allTime.assists}</b> passes
                </span>
              </>
            )}
            <span className="synthese-sep">·</span>
            <span>
              <b>{allTime.winPct}</b> % de victoires
            </span>
            <span className="synthese-sep">·</span>
            <span>
              Élo <b>{allTime.elo}</b>
            </span>
            {allTime.mvpCount > 0 && (
              <>
                <span className="synthese-sep">·</span>
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ color: "var(--gold)" }}
                >
                  <Icon name="star" size={12} filled />
                  <b>{allTime.mvpCount}</b> fois homme du match
                </span>
              </>
            )}
          </div>
          {allTime.form.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <Forme form={allTime.form} grand />
              <span className="text-[13px] text-[color:var(--ink-3)]">
                {serie ?? "cinq derniers, du plus récent au plus ancien"}
              </span>
            </div>
          )}
        </section>
      )}

      {/* Par saison. Un tableau de six colonnes large de 420 px qu'il
          fallait faire glisser en travers d'un écran de 375, pour deux ou
          trois lignes : une saison tient dans une phrase. */}
      {bySeason.length > 0 && (
        <section className="mt-8">
          <span className="kicker mb-3 block">Par saison</span>
          {bySeason.map((sn) => (
            <div key={sn.seasonId ?? "none"} className="bande mt-4 first:mt-0">
              <div className="bande-titre">
                <span className="text-[13px] font-semibold text-[color:var(--ink-1)]">
                  {sn.seasonName}
                </span>
                <span className="text-[13px] tabular-nums text-[color:var(--ink-3)]">
                  {sn.row.matchesPlayed} match
                  {sn.row.matchesPlayed > 1 ? "s" : ""}
                </span>
              </div>
              <div className="synthese">
                <span>
                  <b>{sn.row.goals}</b> but{sn.row.goals > 1 ? "s" : ""}
                </span>
                {ctx.club.trackAssists && sn.row.assists > 0 && (
                  <>
                    <span className="synthese-sep">·</span>
                    <span>
                      <b>{sn.row.assists}</b> passes
                    </span>
                  </>
                )}
                <span className="synthese-sep">·</span>
                <span>
                  <b>{sn.row.winPct}</b> % de victoires
                </span>
                {sn.row.mvpCount > 0 && (
                  <>
                    <span className="synthese-sep">·</span>
                    <span style={{ color: "var(--gold)" }}>
                      <b>{sn.row.mvpCount}</b> fois homme du match
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Derniers matchs — le ticker commun : date, score, adversaire. */}
      {recentMatches.length > 0 && (
        <section className="bande mt-8">
          <div className="bande-titre">
            <span className="kicker">Derniers matchs</span>
          </div>
          <ul>
            {recentMatches.map((m) => (
              <li key={m.id}>
                <Link href={`/c/${slug}/matches/${m.id}`} className="ticker">
                  <span className="ticker-heure">{fmtDate(m.playedAt)}</span>
                  <span className="ticker-score">
                    {m.score.replace("-", " — ")}
                  </span>
                  <span className="ticker-buteurs flex items-center gap-2">
                    <Forme form={[m.result]} />
                    <span className="min-w-0 truncate">{m.label}</span>
                    {m.goals > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-[color:var(--ink-2)]">
                        <Icon name="ball" size={11} label="Buts marqués" />
                        {m.goals}
                      </span>
                    )}
                    {m.wasMvp && (
                      <Icon
                        name="star"
                        filled
                        size={11}
                        label="Homme du match"
                        className="shrink-0 text-[color:var(--gold)]"
                      />
                    )}
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
