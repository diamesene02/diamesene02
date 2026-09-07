"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { setFieldCost, setRsvpPaid } from "@/app/actions/payments";

export type PayerRow = {
  playerId: string;
  name: string;
  hasPaid: boolean;
};

function fmtEuro(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export default function MoneyPanel({
  slug,
  matchDayId,
  canManage,
  costCents,
  payers,
}: {
  slug: string;
  matchDayId: string;
  canManage: boolean;
  costCents: number | null;
  payers: PayerRow[]; // joueurs IN de la soirée
}) {
  const router = useRouter();
  const [cost, setCost] = useState<number | null>(costCents);
  const [input, setInput] = useState(
    costCents != null ? String(costCents / 100) : ""
  );
  const [rows, setRows] = useState(payers);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const nbIn = rows.length;
  const shareCents =
    cost != null && nbIn > 0 ? Math.ceil(cost / nbIn) : null;
  const paidCount = rows.filter((r) => r.hasPaid).length;
  const collectedCents = shareCents != null ? paidCount * shareCents : 0;
  const pct =
    cost != null && cost > 0
      ? Math.min(100, Math.round((collectedCents / cost) * 100))
      : 0;

  function saveCost() {
    setError(null);
    const raw = input.trim().replace(",", ".");
    const next =
      raw === "" ? null : Math.round(Number.parseFloat(raw) * 100);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setError("Montant invalide.");
      return;
    }
    setCost(next);
    startTransition(async () => {
      const res = await setFieldCost(slug, matchDayId, next);
      if (!res.ok) setError(res.error ?? "Erreur");
      router.refresh();
    });
  }

  function togglePaid(playerId: string, paid: boolean) {
    setError(null);
    // Optimiste : maj locale immédiate.
    setRows((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, hasPaid: paid } : r))
    );
    startTransition(async () => {
      const res = await setRsvpPaid(slug, matchDayId, playerId, paid);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        setRows((prev) =>
          prev.map((r) =>
            r.playerId === playerId ? { ...r, hasPaid: !paid } : r
          )
        );
      }
      router.refresh();
    });
  }

  return (
    <div>
      {/* Prix du terrain */}
      {canManage ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-black  text-[color:var(--ink-2)]">
              Prix du terrain (€)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ex. 80"
              className="w-32 rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2.5 text-sm font-bold tabular-nums outline-none focus:border-[color:var(--ink-1)]"
            />
          </label>
          <button
            disabled={pending}
            onClick={saveCost}
            className="big-touch rounded-none border border-[color:var(--rule-hi)] bg-[color:var(--pitch-2)] px-4 py-2.5 text-sm font-bold transition-colors hover:border-[color:var(--ink-1)] disabled:opacity-50"
          >
            {pending ? "…" : "Enregistrer"}
          </button>
        </div>
      ) : (
        cost != null && (
          <div className="text-sm">
            <span className="text-[color:var(--ink-2)]">Prix du terrain :</span>{" "}
            <span className="font-black tabular-nums">{fmtEuro(cost)}</span>
          </div>
        )
      )}
      {error && (
        <p className="mt-2 text-sm text-[color:var(--loss)]">{error}</p>
      )}

      {cost != null && (
        <>
          {/* Répartition */}
          <p className="mt-4 text-sm text-[color:var(--ink-1)]">
            {nbIn > 0 ? (
              <>
                <span className="font-black tabular-nums text-[color:var(--bib-a-ink)]">
                  {nbIn}
                </span>{" "}
                présent{nbIn > 1 ? "s" : ""} →{" "}
                <span className="num-sculpt text-xl text-[color:var(--ink-1)]">
                  {fmtEuro(shareCents!)}
                </span>{" "}
                chacun
              </>
            ) : (
 "Personne n'a encore répondu présent — la part sera calculée dès les premiers RSVP."
            )}
          </p>

          {/* Qui a payé */}
          {nbIn > 0 && (
            <ul className="mt-3 divide-y divide-[color:var(--rule)] overflow-hidden rounded-none border border-[color:var(--rule)] bg-[color:var(--pitch-2)]">
              {rows.map((r) => (
                <li key={r.playerId}>
                  <label
                    className={cn(
 "flex min-h-[44px] items-center gap-3 px-4 py-2.5",
                      canManage && "cursor-pointer hover:bg-white/[0.03]"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={r.hasPaid}
                      disabled={!canManage || pending}
                      onChange={(e) => togglePaid(r.playerId, e.target.checked)}
                      className="h-4 w-4 accent-[color:var(--ink-1)]"
                    />
                    <span className="flex-1 truncate text-sm font-bold">
                      {r.name}
                    </span>
                    <span
                      className={cn(
 "text-[13px] font-semibold",
                        r.hasPaid
                          ? "text-[color:var(--ink-1)]"
                          : "text-[color:var(--ink-2)]"
                      )}
                    >
                      {r.hasPaid ? "payé" : "—"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {/* Encaissé */}
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-[color:var(--ink-2)]">Encaissé</span>
              <span className="font-black tabular-nums">
                <span
                  className={
                    collectedCents >= cost
                      ? "text-[color:var(--ink-1)]"
                      : undefined
                  }
                >
                  {fmtEuro(Math.min(collectedCents, cost))}
                </span>{" "}
                <span className="text-[color:var(--ink-2)]">
                  / {fmtEuro(cost)}
                </span>
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[color:var(--pitch-2)]">
              <div
                className="h-full rounded-[2px] bg-[color:var(--ink-1)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </>
      )}

      {cost == null && canManage && (
        <p className="mt-3 text-[11px] text-[color:var(--ink-2)]">
          Renseigne le prix du terrain pour répartir la note entre les présents
          et cocher qui a payé.
        </p>
      )}
    </div>
  );
}
