"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { balanceTeams } from "@/lib/balance";
import { enregistrerCompo, reprendreCompoPrecedente } from "@/app/actions/compo";
import Icon from "@/components/Icon";

export type JoueurClub = {
  id: string;
  name: string;
  skill: number;
  isGk: boolean;
};

type Camp = "A" | "B" | null;

// La composition d'une soirée, préparée trois à quatre jours avant.
//
// Un tap fait le tour : hors compo → équipe A → équipe B → hors compo. Pas de
// glissé, pas de menu : la liste se remplit au pouce, et l'état de chaque
// joueur se lit à la couleur de sa barre. C'est le même vocabulaire que les
// tuiles de l'écran live, pour ne pas avoir deux grammaires dans la même app.

export default function CompoSoiree({
  slug,
  matchDayId,
  joueurs,
  compoInitiale,
  nomAInitial,
  nomBInitial,
  peutModifier,
}: {
  slug: string;
  matchDayId: string;
  joueurs: JoueurClub[];
  compoInitiale: { playerId: string; team: "A" | "B" }[];
  nomAInitial: string | null;
  nomBInitial: string | null;
  peutModifier: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const [camps, setCamps] = useState<Record<string, Camp>>(() =>
    Object.fromEntries(compoInitiale.map((c) => [c.playerId, c.team])),
  );
  const [nomA, setNomA] = useState(nomAInitial ?? "Blanc");
  const [nomB, setNomB] = useState(nomBInitial ?? "Noir");
  const [graine, setGraine] = useState(() => Math.floor(Math.random() * 1e6) + 1);

  const equipeA = joueurs.filter((j) => camps[j.id] === "A");
  const equipeB = joueurs.filter((j) => camps[j.id] === "B");
  const dehors = joueurs.filter((j) => !camps[j.id]);
  const retenus = equipeA.length + equipeB.length;

  // Les mises en garde qui comptent au bord du terrain, dites avant d'y être.
  const alertes = useMemo(() => {
    const a: string[] = [];
    if (retenus > 0 && equipeA.length !== equipeB.length) {
      a.push(
        `Effectif déséquilibré : ${equipeA.length} contre ${equipeB.length}.`,
      );
    }
    if (retenus > 0 && (equipeA.length === 0 || equipeB.length === 0)) {
      a.push("Une équipe est vide.");
    }
    const gkA = equipeA.some((j) => j.isGk);
    const gkB = equipeB.some((j) => j.isGk);
    if (retenus > 0 && (!gkA || !gkB)) {
      const sans = [!gkA && nomA, !gkB && nomB].filter(Boolean).join(" et ");
      a.push(`Pas de gardien attitré chez ${sans}.`);
    }
    return a;
  }, [equipeA, equipeB, retenus, nomA, nomB]);

  function basculer(id: string) {
    if (!peutModifier) return;
    setEnregistre(false);
    setCamps((c) => {
      const actuel = c[id];
      return { ...c, [id]: actuel === "A" ? "B" : actuel === "B" ? null : "A" };
    });
  }

  /// Répartit les joueurs déjà retenus. Ne convoque personne de lui-même : qui
  /// joue est une décision, pas un calcul.
  function equilibrer() {
    const pool = joueurs
      .filter((j) => camps[j.id])
      .map((j) => ({ id: j.id, name: j.name, skill: j.skill, isGk: j.isGk }));
    if (pool.length < 2) {
      setError("Retiens d'abord les joueurs de la soirée.");
      return;
    }
    setError(null);
    setEnregistre(false);
    const { teamA, teamB } = balanceTeams(pool, { seed: graine });
    setGraine((g) => g + 1);
    setCamps((c) => {
      const n = { ...c };
      teamA.forEach((p) => (n[p.id] = "A"));
      teamB.forEach((p) => (n[p.id] = "B"));
      return n;
    });
  }

  function reprendre() {
    setError(null);
    startTransition(async () => {
      const res = await reprendreCompoPrecedente(slug, matchDayId);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        return;
      }
      router.refresh();
    });
  }

  function enregistrer() {
    setError(null);
    startTransition(async () => {
      const res = await enregistrerCompo(slug, matchDayId, {
        teamAName: nomA,
        teamBName: nomB,
        joueurs: joueurs
          .filter((j) => camps[j.id])
          .map((j) => ({
            playerId: j.id,
            team: camps[j.id] as "A" | "B",
            isGk: j.isGk,
          })),
      });
      if (!res.ok) {
        setError(res.error ?? "Erreur");
        return;
      }
      setEnregistre(true);
      router.refresh();
    });
  }

  const champNom =
    "min-w-0 flex-1 rounded-lg border border-[color:var(--stroke)] bg-[color:var(--bg-2)] px-2 py-1.5 text-sm font-bold outline-none focus:border-[color:var(--lime)]";

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          value={nomA}
          onChange={(e) => {
            setNomA(e.target.value);
            setEnregistre(false);
          }}
          disabled={!peutModifier}
          aria-label="Nom de la première équipe"
          className={champNom}
          style={{ borderLeft: "3px solid var(--bib-a)" }}
        />
        <span className="shrink-0 text-xs font-black uppercase text-[color:var(--ink-3)]">
          vs
        </span>
        <input
          value={nomB}
          onChange={(e) => {
            setNomB(e.target.value);
            setEnregistre(false);
          }}
          disabled={!peutModifier}
          aria-label="Nom de la seconde équipe"
          className={champNom}
          style={{ borderLeft: "3px solid var(--bib-b)" }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between text-xs text-[color:var(--ink-3)]">
        <span className="tabular-nums">
          {equipeA.length} contre {equipeB.length}
        </span>
        {dehors.length > 0 && (
          <span className="tabular-nums">
            {dehors.length} hors compo
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {joueurs.map((j) => {
          const camp = camps[j.id];
          return (
            <li key={j.id}>
              <button
                type="button"
                onClick={() => basculer(j.id)}
                disabled={!peutModifier}
                aria-label={`${j.name} — ${
                  camp === "A" ? nomA : camp === "B" ? nomB : "hors compo"
                }`}
                className={cn(
                  "compo-ligne",
                  camp === "A" && "A",
                  camp === "B" && "B",
                )}
              >
                <span className="compo-barre" />
                <span className="compo-nom">
                  {j.name}
                  {j.isGk && (
                    <span className="compo-gk" title="Gardien attitré">
                      <Icon name="glove" size={13} />
                    </span>
                  )}
                </span>
                <span className="compo-camp">
                  {camp === "A" ? nomA : camp === "B" ? nomB : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {alertes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {alertes.map((a) => (
            <li
              key={a}
              className="flex items-start gap-2 text-sm text-[color:var(--gold)]"
            >
              <span className="mt-0.5 shrink-0">
                <Icon name="bolt" size={13} />
              </span>
              {a}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 text-sm text-[color:var(--loss)]">{error}</p>
      )}

      {peutModifier && (
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={equilibrer}
              className="btn ghost tap flex-1 text-sm"
              type="button"
            >
              Équilibrer
            </button>
            <button
              onClick={reprendre}
              disabled={pending}
              className="btn ghost tap flex-1 text-sm disabled:opacity-60"
              type="button"
            >
              Compo précédente
            </button>
          </div>
          <button
            onClick={enregistrer}
            disabled={pending}
            className="btn primary big w-full disabled:opacity-60"
            type="button"
          >
            {pending ? "Enregistrement…" : enregistre ? "Compo prête" : "Enregistrer la compo"}
          </button>
        </div>
      )}
    </div>
  );
}
