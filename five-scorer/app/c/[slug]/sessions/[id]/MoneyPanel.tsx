"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { setFieldCost, setRsvpPaid } from "@/app/actions/payments";
import AvatarAnneau from "@/components/ios/AvatarAnneau";

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

// La note du terrain, en deux dessins.
//
// « resume » : « 48 € · 5,33 € chacun », posé à droite du compte des présents
// dans la carte « Ma réponse » — c'est la seule chose que la plupart veulent
// savoir. « caisse » : le prix à saisir, qui a payé (un tap par joueur) et
// l'encaissé — l'outillage de l'admin, dans sa propre carte.
export default function MoneyPanel({
  slug,
  matchDayId,
  canManage,
  costCents,
  payers,
  mode = "caisse",
}: {
  slug: string;
  matchDayId: string;
  canManage: boolean;
  costCents: number | null;
  payers: PayerRow[]; // joueurs IN de la soirée
  mode?: "resume" | "caisse";
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

  if (mode === "resume") {
    if (cost == null) return null;
    return (
      <>
        {fmtEuro(cost)}
        {shareCents != null && <> · {fmtEuro(shareCents)} chacun</>}
      </>
    );
  }

  return (
    <div className="soiree-caisse">
      {/* Prix du terrain */}
      {canManage ? (
        <div className="soiree-prix">
          <input
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Prix du terrain (€)"
            aria-label="Prix du terrain en euros"
          />
          <button
            type="button"
            disabled={pending}
            onClick={saveCost}
            className="verre grand"
          >
            {pending ? "…" : "Enregistrer"}
          </button>
        </div>
      ) : (
        cost != null && (
          <div className="rangee-ios">
            <span className="libelle">Prix du terrain</span>
            <span className="valeur" style={{ color: "var(--ink)", fontWeight: 600 }}>
              {fmtEuro(cost)}
            </span>
          </div>
        )
      )}
      {error && (
        <p className="mt-2 text-[15px] text-[color:var(--bad)]">{error}</p>
      )}

      {cost != null && (
        <>
          {nbIn === 0 ? (
            <p className="mt-3 text-[15px] text-[color:var(--i2)]">
              Personne n&apos;a encore répondu présent — la part sera calculée
              dès les premières réponses.
            </p>
          ) : (
            <div className={canManage ? "mt-2" : ""}>
              {rows.map((r) => {
                const contenu = (
                  <>
                    <AvatarAnneau nom={r.name} taille={30} />
                    <span className="libelle">{r.name}</span>
                    <span className={cn("valeur", r.hasPaid && "paye")}>
                      {r.hasPaid ? "Payé" : "—"}
                    </span>
                  </>
                );
                return canManage ? (
                  <button
                    key={r.playerId}
                    type="button"
                    disabled={pending}
                    onClick={() => togglePaid(r.playerId, !r.hasPaid)}
                    aria-pressed={r.hasPaid}
                    className="rangee-ios tape"
                  >
                    {contenu}
                  </button>
                ) : (
                  <div key={r.playerId} className="rangee-ios">
                    {contenu}
                  </div>
                );
              })}
            </div>
          )}

          {/* Encaissé */}
          <div className="soiree-encaisse">
            <div className="ligne">
              <span>
                Encaissé
                {shareCents != null && <> · {fmtEuro(shareCents)} chacun</>}
              </span>
              <span>
                <b>{fmtEuro(Math.min(collectedCents, cost))}</b> / {fmtEuro(cost)}
              </span>
            </div>
            <div className="soiree-jauge">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        </>
      )}

      {cost == null && canManage && (
        <p className="mt-3 text-[13px] text-[color:var(--i3)]">
          Renseigne le prix du terrain pour répartir la note entre les présents
          et cocher qui a payé.
        </p>
      )}
    </div>
  );
}
