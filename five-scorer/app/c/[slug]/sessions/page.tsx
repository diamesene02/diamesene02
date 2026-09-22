import Link from "next/link";
import * as D from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import Icon from "@/components/Icon";
import { cn } from "@/lib/cn";
import { calculerPresences } from "@/lib/presences";
import { quandRelatif } from "@/lib/quand";

export const dynamic = "force-dynamic";

function fmtEuro(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  const clubId = ctx.club.id;

  const [matchDays, vivier] = await Promise.all([
    prisma.matchDay.findMany({
      where: { clubId },
      orderBy: { date: "desc" },
      take: 100,
      include: {
        rsvps: {
          select: { playerId: true, status: true, respondedAt: true, hasPaid: true },
        },
        matches: {
          select: { id: true, scoreA: true, scoreB: true, status: true },
        },
      },
    }),
    // Les abonnés viennent sans répondre : sans eux, « lun. 21 » ne montrait
    // aucun présent alors que l'accueil en annonçait huit.
    prisma.player.findMany({
      where: { clubId, isArchived: false },
      select: { id: true, abonne: true },
    }),
  ]);
  const maintenant = new Date();

  const startOfToday = D.debutDuJour();
  const upcoming = matchDays
    .filter((md) => md.date >= startOfToday)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = matchDays.filter((md) => md.date < startOfToday);

  // « Je ne vois pas la soirée d'hier. »
  //
  // Un club qui pose sa saison d'un coup a quarante-quatre lundis devant lui.
  // « Déjà jouées » se retrouvait donc sous quarante-quatre rangées : la
  // soirée qu'on vient de jouer — celle dont on vient chercher le résultat —
  // était la dernière chose de la page. On montre les six prochaines, puis le
  // passé ; le reste de la saison se déplie en bas, où il ne gêne personne.
  const PROCHAINES = 6;
  const prochaines = upcoming.slice(0, PROCHAINES);
  const resteSaison = upcoming.slice(PROCHAINES);

  // La colonne d'en-tête du ticker fait 52 px : « lun. 07 » y tient, « lundi
  // 07 sept. » non. Le mois est porté par l'en-tête de groupe.
  const fmtCourt = D.jourSemaineNumero;
  const fmtHeure = D.heure;

  // UNE SOIRÉE, UNE LIGNE.
  //
  // Chaque soirée occupait une carte encadrée de quatre lignes — titre, date,
  // lieu, puis trois pastilles « 0 présent », « 0 match », le prix. Sur une
  // saison de quarante lundis, c'est un mur de cartes identiques qu'il faut
  // parcourir au pouce pour retrouver une date.
  //
  // Elles deviennent des rangées de 32 px, groupées par mois : le calendrier
  // se relit d'un coup d'œil, et le mois donne le repère que la date seule ne
  // donne pas.
  const Rangee = ({
    md,
    aVenir,
  }: {
    md: (typeof matchDays)[number];
    aVenir?: boolean;
  }) => {
    const inscrits = md.rsvps.filter((r) => r.status === "IN");
    const toutRegle = inscrits.length > 0 && inscrits.every((r) => r.hasPaid);
    const buts = md.matches.reduce((s, m) => s + m.scoreA + m.scoreB, 0);
    // Une soirée annulée se présentait comme les autres — date, heure, lieu —
    // et le joueur passé par Menu > Soirées venait pour rien.
    if (md.canceledAt) {
      return (
        <Link href={`/c/${slug}/sessions/${md.id}`} className="ticker annulee">
          <span className="ticker-heure">{fmtCourt(md.date)}</span>
          <span className="ticker-score whitespace-nowrap">Annulée</span>
          <span className="ticker-buteurs">{md.cancelReason ?? md.location ?? ""}</span>
        </Link>
      );
    }
    const presents = aVenir
      ? calculerPresences({
          entrees: vivier.map((j) => {
            const r = md.rsvps.find((x) => x.playerId === j.id);
            return {
              playerId: j.id,
              reponse: r?.status ?? null,
              repondueLe: r?.respondedAt ?? null,
              abonne: j.abonne,
            };
          }),
          creeeLe: md.createdAt,
          minJoueurs: ctx.club.minJoueurs,
          capacite: ctx.club.capaciteSoiree,
        }).titulaires.length
      : inscrits.length;
    const relatif = aVenir ? quandRelatif(md.date, maintenant) : null;
    return (
      <Link href={`/c/${slug}/sessions/${md.id}`} className="ticker">
        <span className="ticker-heure">{fmtCourt(md.date)}</span>
        <span className="ticker-score whitespace-nowrap">
          {aVenir ? (
            fmtHeure(md.date)
          ) : (
            <>
              <b>{md.matches.length}</b>
              <span className="text-[13px] font-normal text-[color:var(--ink-3)]">
                {" "}
                match{md.matches.length > 1 ? "s" : ""}
              </span>
            </>
          )}
        </span>
        <span className={cn("ticker-buteurs", aVenir && "lignes")}>
          {aVenir ? (
            // Deux lignes NOMMÉES plutôt qu'une phrase qu'on laisse se
            // couper où le mot tombe. Le point médian était collé au mot
            // qui le précède : la première ligne finissait donc par un
            // séparateur orphelin, « 8 présents · », et le terrain tombait
            // seul en dessous. On le pose donc là exprès, sans séparateur :
            // quand et combien tiennent ensemble, le lieu — toujours le plus
            // long — prend la ligne du dessous.
            <>
              <span className="l1">
                {[
                  relatif && (
                    <span key="q" style={{ color: "var(--ink-1)" }}>
                      {relatif}
                    </span>
                  ),
                  presents > 0 && (
                    <span key="p" style={{ color: "var(--bib-a-ink)" }}>
                      {presents} présent{presents > 1 ? "s" : ""}
                    </span>
                  ),
                ]
                  .filter(Boolean)
                  .flatMap((el, i) => (i === 0 ? [el] : [" · ", el]))}
              </span>
              {(md.location ?? md.title) && (
                <span className="l2">{md.location ?? md.title}</span>
              )}
            </>
          ) : (
            <>
              {buts > 0 && (
                <span>
                  {buts} but{buts > 1 ? "s" : ""}
                </span>
              )}
              {md.fieldCostCents != null && md.fieldCostCents > 0 && (
                <span
                  style={{
                    color: toutRegle ? "var(--ink-3)" : "var(--gold)",
                  }}
                >
                  {buts > 0 ? " · " : ""}
                  {fmtEuro(md.fieldCostCents)}
                  {toutRegle ? " réglé" : " à encaisser"}
                </span>
              )}
            </>
          )}
        </span>
      </Link>
    );
  };

  /// Le mois donne le repère qu'une date seule ne donne pas quand on en
  /// aligne quarante.
  const parMois = (liste: typeof matchDays) => {
    const out: { cle: string; titre: string; jours: typeof matchDays }[] = [];
    const index = new Map<string, (typeof out)[number]>();
    for (const md of liste) {
      const cle = `${md.date.getFullYear()}-${md.date.getMonth()}`;
      let g = index.get(cle);
      if (!g) {
        g = {
          cle,
          titre: D.moisAnnee(md.date),
          jours: [],
        };
        index.set(cle, g);
        out.push(g);
      }
      g.jours.push(md);
    }
    return out;
  };

  const Mois = ({
    liste,
    aVenir,
  }: {
    liste: typeof matchDays;
    aVenir?: boolean;
  }) =>
    parMois(liste).map((g) => (
      <div key={g.cle} className="bande mt-5 first:mt-0">
        <div className="bande-titre">
          {/* « septembre 2026 », comme sur la saison : la page des soirées
              écrivait « Septembre 2026 » et les deux écrans se contredisaient
              sur le même objet. */}
          <span className="text-[13px] font-semibold text-[color:var(--ink-1)]">
            {g.titre}
          </span>
          <span className="text-[13px] tabular-nums text-[color:var(--ink-3)]">
            {g.jours.length} soirée{g.jours.length > 1 ? "s" : ""}
          </span>
        </div>
        <ul>
          {g.jours.map((md) => (
            <li key={md.id}>
              <Rangee md={md} aVenir={aVenir} />
            </li>
          ))}
        </ul>
      </div>
    ));

  return (
    <main>
      <div>
        <span className="kicker">Le calendrier</span>
        <h1 className="display-md mt-1">Les soirées</h1>
        {/* La définition ne tient pas dans un kicker de 11 px : elle se lit
            ici, à taille de texte courant, sous le titre qu'elle éclaire. */}
        <p className="entete-definition">
          Un créneau réservé : une date, un terrain, qui vient.{" "}
          <span className="text-[color:var(--ink-1)]">
            Les matchs se jouent dedans.
          </span>
        </p>
      </div>
      {/* Les deux voies de création, dans une seule rangée d'actions.
          « Programmer une soirée » flottait au bout d'un flex-wrap, en
          pastille de verre, et « Poser toute la saison » — la voie NORMALE
          d'un club qui joue toutes les semaines — n'était qu'un lien gris
          en dessous. Une action principale se voit ; la seconde reste en
          verre, à la même taille. */}
      {(ctx.canScore || ctx.canManage) && (
        <div className="entete-actions">
          {ctx.canScore && (
            <Link href={`/c/${slug}/matches/new-session`} className="plein">
              <Icon name="plus" size={18} />
              Programmer une soirée
            </Link>
          )}
          {ctx.canManage && (
            <Link href={`/c/${slug}/saison`} className="verre grand">
              <Icon name="calendar" size={16} />
              Poser toute la saison
            </Link>
          )}
        </div>
      )}

      {matchDays.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-[color:var(--rule)] bg-[color:var(--pitch-1)] p-8 text-center">
          <p className="text-lg font-black">Aucune soirée pour l&apos;instant.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[color:var(--ink-1)]">
            Une soirée, c&apos;est le créneau : jeudi 19 h, terrain 2. Tu la
            programmes, chacun dit s&apos;il vient, et tu répartis le prix du
            terrain entre les présents.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm text-[color:var(--ink-2)]">
            Les matchs, eux, se jouent dedans — et souvent plusieurs dans la même
            soirée. Ce sont eux qui portent les scores et les statistiques.
          </p>
          {ctx.canScore && (
            <Link
              href={`/c/${slug}/matches/new-session`}
              className="btn primary big mt-5"
            >
              <Icon name="plus" size={18} />
              Programmer une soirée
            </Link>
          )}
        </div>
      ) : (
        <>
          {prochaines.length > 0 && (
            <section className="mt-8">
              <span className="kicker mb-3 block">À venir</span>
              <Mois liste={prochaines} aVenir />
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-8">
              <span className="kicker mb-3 block">Déjà jouées</span>
              <Mois liste={past} />
            </section>
          )}
          {resteSaison.length > 0 && (
            <details className="mt-8">
              <summary className="kicker cursor-pointer select-none">
                Le reste de la saison ({resteSaison.length})
              </summary>
              <div className="mt-3">
                <Mois liste={resteSaison} aVenir />
              </div>
            </details>
          )}
        </>
      )}
    </main>
  );
}
