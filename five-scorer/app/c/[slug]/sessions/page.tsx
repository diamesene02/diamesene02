import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import Icon from "@/components/Icon";

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

  const matchDays = await prisma.matchDay.findMany({
    where: { clubId },
    orderBy: { date: "desc" },
    take: 100,
    include: {
      rsvps: {
        where: { status: "IN" },
        select: { hasPaid: true },
      },
      matches: {
        select: { id: true, scoreA: true, scoreB: true, status: true },
      },
    },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
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
  const fmtCourt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" });
  const fmtHeure = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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
    const presents = md.rsvps.length;
    const toutRegle = presents > 0 && md.rsvps.every((r) => r.hasPaid);
    const buts = md.matches.reduce((s, m) => s + m.scoreA + m.scoreB, 0);
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
        <span className="ticker-buteurs">
          {aVenir ? (
            <>
              {md.location && <span>{md.location}</span>}
              {presents > 0 && (
                <span style={{ color: "var(--bib-a-ink)" }}>
                  {md.location ? " · " : ""}
                  {presents} présent{presents > 1 ? "s" : ""}
                </span>
              )}
              {md.title && !md.location && <span>{md.title}</span>}
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
          titre: md.date.toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          }),
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
          <span className="capitalize text-[13px] font-semibold text-[color:var(--ink-1)]">
            {g.titre}
          </span>
          <span className="text-[13px] tabular-nums text-[color:var(--ink-3)]">
            {g.jours.length}
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="kicker">Le calendrier</span>
          <h1 className="display-md mt-1">Les soirées</h1>
          {/* La définition ne tient pas dans un kicker de 11 px : elle se lit
              ici, à taille de texte courant, sous le titre qu'elle éclaire. */}
          <p className="mt-1.5 max-w-sm text-sm text-[color:var(--ink-2)]">
            Un créneau réservé : une date, un terrain, qui vient.{" "}
            <span className="text-[color:var(--ink-1)]">
              Les matchs se jouent dedans.
            </span>
          </p>
        </div>
        {ctx.canScore && (
          <Link
            href={`/c/${slug}/matches/new-session`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[2px] border border-[color:var(--rule-hi)] bg-[color:var(--pitch-2)] px-5 text-sm font-bold hover:border-[color:var(--ink-1)]"
          >
            <Icon name="plus" size={16} />
            Programmer une soirée
          </Link>
        )}
      </div>
      {/* Poser toute la saison d'un coup : la voie normale pour un club qui
          joue toutes les semaines. Créer les soirées une par une reste
          possible juste au-dessus, pour les dates hors calendrier. */}
      {ctx.canManage && (
        <Link
          href={`/c/${slug}/saison`}
          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--ink-2)] hover:text-[color:var(--ink-1)]"
        >
          <Icon name="calendar" size={15} />
          Poser toute la saison
          <Icon name="chevron" size={14} />
        </Link>
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
