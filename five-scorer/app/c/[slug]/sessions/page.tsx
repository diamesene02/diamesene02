import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClub } from "@/lib/guard";
import { cn } from "@/lib/cn";
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

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "short",
    });

  const Row = ({
    md,
    highlight,
  }: {
    md: (typeof matchDays)[number];
    highlight?: boolean;
  }) => {
    const inCount = md.rsvps.length;
    const allPaid = inCount > 0 && md.rsvps.every((r) => r.hasPaid);
    const totalGoals = md.matches.reduce(
      (s, m) => s + m.scoreA + m.scoreB,
      0
    );
    return (
      <Link
        href={`/c/${slug}/sessions/${md.id}`}
        className={cn(
          "block rounded-2xl border bg-[color:var(--bg-1)] p-4 transition-colors",
          highlight
            ? "border-[color:var(--lime)]/60 hover:border-[color:var(--lime)]"
            : "border-[color:var(--stroke)] hover:border-[color:var(--stroke-hi)]"
        )}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-black">
              {md.title || "Session"}
              <span
                className={cn(
                  "ml-3 text-xs font-bold capitalize tabular-nums",
                  highlight
                    ? "text-[color:var(--lime)]"
                    : "text-[color:var(--ink-1)]"
                )}
              >
                {fmtDate(md.date)}
              </span>
            </div>
            {md.location && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--ink-2)]">
                <Icon name="pin" size={12} className="shrink-0" />
                <span className="truncate">{md.location}</span>
              </div>
            )}
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[color:var(--ink-2)]">
            Voir →
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold tabular-nums">
          <span className="rounded-full border border-[color:var(--a-500)]/40 bg-[color:var(--a-wash)] px-2.5 py-1 text-[color:var(--a-400)]">
            {inCount} présent{inCount > 1 ? "s" : ""}
          </span>
          <span className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-2.5 py-1 text-[color:var(--ink-1)]">
            {md.matches.length} match{md.matches.length > 1 ? "s" : ""}
            {totalGoals > 0 && (
              <span className="text-[color:var(--ink-2)]">
                {" "}
                · {totalGoals} but{totalGoals > 1 ? "s" : ""}
              </span>
            )}
          </span>
          {md.fieldCostCents != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                allPaid
                  ? "border-[color:var(--lime)]/50 bg-[color:var(--lime-dim)] text-[color:var(--lime)]"
                  : "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
              )}
            >
              <Icon name="coin" size={12} />
              {fmtEuro(md.fieldCostCents)} · {allPaid ? "réglé" : "à encaisser"}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="kicker">Sessions</span>
          <h1 className="display-md mt-1">Les soirées</h1>
        </div>
        {ctx.canScore && (
          <Link
            href={`/c/${slug}/matches/new-session`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[color:var(--stroke-hi)] bg-[color:var(--bg-2)] px-5 text-sm font-bold hover:border-[color:var(--lime)]"
          >
            <Icon name="plus" size={16} />
            Programmer une session
          </Link>
        )}
      </div>

      {matchDays.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-[color:var(--stroke)] bg-[color:var(--bg-1)] p-8 text-center">
          <p className="text-lg font-black">Aucune soirée pour l&apos;instant.</p>
          <p className="mt-2 text-sm text-[color:var(--ink-1)]">
            Programme la prochaine session, préviens les copains, et le terrain
            fera le reste.
          </p>
          {ctx.canScore && (
            <Link
              href={`/c/${slug}/matches/new-session`}
              className="btn primary big mt-5"
            >
              <Icon name="plus" size={18} />
              Programmer une session
            </Link>
          )}
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mt-8 space-y-3">
              <span className="kicker block">À venir</span>
              {upcoming.map((md) => (
                <Row key={md.id} md={md} highlight />
              ))}
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-8 space-y-3">
              <span className="kicker block">Déjà jouées</span>
              {past.map((md) => (
                <Row key={md.id} md={md} />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
