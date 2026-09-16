"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ajouterButCorrection,
  changerJoueurEvenementCorrection,
  deplacerJoueurCorrection,
  retirerEvenementCorrection,
} from "@/app/actions/correction";

type Camp = "A" | "B";
type Participant = { id: string; name: string; team: Camp };
type Evenement = {
  id: string;
  type: "GOAL" | "OWN_GOAL" | "YELLOW_CARD" | "RED_CARD" | "HALF_TIME";
  team: Camp;
  minute: number | null;
  playerId: string | null;
  playerName: string | null;
  assistId: string | null;
  assistName: string | null;
};
type Resultat = { ok: true } | { ok: false; error: string };

const HORS_LIGNE =
  "Corriger un match demande du réseau. Tu es hors ligne — réessaie quand tu en auras.";

const LIBELLE: Record<Evenement["type"], string> = {
  GOAL: "But",
  OWN_GOAL: "Contre son camp",
  YELLOW_CARD: "Carton jaune",
  RED_CARD: "Carton rouge",
  HALF_TIME: "Mi-temps",
};

const inputCls =
  "min-h-[40px] rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-2 py-1 text-sm outline-none focus:border-[color:var(--ink-1)]";
const btnCls =
  "inline-flex min-h-[40px] items-center rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 text-sm font-bold text-[color:var(--ink-1)] hover:text-white disabled:opacity-50";

export default function CorrigerForm({
  slug,
  matchId,
  kind,
  nomA,
  nomB,
  trackAssists,
  participants,
  events,
  gardes,
}: {
  slug: string;
  matchId: string;
  kind: "INTERNAL" | "EXTERNAL";
  nomA: string;
  nomB: string;
  trackAssists: boolean;
  participants: Participant[];
  events: Evenement[];
  gardes: { horsFenetre: boolean; saisonClose: boolean; saisonNom: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enLigne, setEnLigne] = useState(true);
  // La garde renforcée (six semaines, saison close) se lit une fois par
  // visite ; une fois acceptée, les gestes suivants ne la redemandent pas.
  const [garantie, setGarantie] = useState(false);
  const [attente, setAttente] = useState<(() => Promise<Resultat>) | null>(null);

  const [type, setType] = useState<"GOAL" | "OWN_GOAL">("GOAL");
  const [team, setTeam] = useState<Camp>("A");
  const [playerId, setPlayerId] = useState("");
  const [assistId, setAssistId] = useState("");

  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine);
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
    };
  }, []);

  const gardeActive = gardes.horsFenetre || gardes.saisonClose;
  const nom = (c: Camp) => (c === "A" ? nomA : nomB);
  const autre = (c: Camp): Camp => (c === "A" ? "B" : "A");
  const du = (c: Camp) => participants.filter((p) => p.team === c);
  const bloque = pending || !enLigne;

  function executer(action: () => Promise<Resultat>) {
    setErreur(null);
    start(async () => {
      try {
        const res = await action();
        if (!res.ok) setErreur(res.error);
        else router.refresh();
      } catch (e) {
        // Une action serveur qui ne joint pas le serveur lève côté navigateur.
        // Rien n'est mis en file : le refus se dit, avec sa suite (Q4).
        const reseau = !navigator.onLine || e instanceof TypeError;
        setErreur(reseau ? HORS_LIGNE : (e as Error).message);
      }
    });
  }

  function lancer(action: () => Promise<Resultat>) {
    if (gardeActive && !garantie) {
      setAttente(() => action);
      return;
    }
    executer(action);
  }

  function confirmer() {
    const a = attente;
    setGarantie(true);
    setAttente(null);
    if (a) executer(a);
  }

  function ajouter(e: React.FormEvent) {
    e.preventDefault();
    lancer(() =>
      ajouterButCorrection(slug, matchId, {
        type,
        team,
        playerId: playerId || null,
        assistPlayerId: type === "GOAL" && trackAssists ? assistId || null : null,
      }),
    );
  }

  // Le buteur d'un but va avec l'équipe créditée ; celui d'un contre son camp
  // est de l'autre camp — c'est le sien qu'il trahit.
  const buteurs = du(type === "GOAL" ? team : autre(team));

  return (
    <div className="space-y-6">
      {!enLigne && <p className="rounded-[2px] border border-[color:var(--loss)] px-3 py-2 text-sm text-[color:var(--loss)]">{HORS_LIGNE}</p>}

      {gardeActive && (
        <div className="rounded-[2px] border border-[color:var(--rule)] bg-[color:var(--pitch-2)] px-3 py-2 text-sm text-[color:var(--ink-2)]">
          {gardes.horsFenetre && (
            <p>
              Ce match a plus de six semaines : son classement a déjà été lu et commenté. Une correction le
              changera après coup.
            </p>
          )}
          {gardes.saisonClose && (
            <p>
              La saison{gardes.saisonNom ? ` « ${gardes.saisonNom} »` : ""} est clôturée : ses chiffres ont déjà
              été lus. Une correction les rouvrira.
            </p>
          )}
        </div>
      )}

      {attente && (
        <div className="rounded-[2px] border border-[color:var(--ink-1)] bg-[color:var(--pitch-2)] px-3 py-3 text-sm">
          <p className="font-bold">Avant d'écrire :</p>
          <ul className="mt-1 list-disc pl-5 text-[color:var(--ink-2)]">
            {gardes.horsFenetre && <li>le match a plus de six semaines — le classement déjà lu va changer ;</li>}
            {gardes.saisonClose && <li>la saison est clôturée — ses chiffres, déjà lus, vont bouger.</li>}
          </ul>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={confirmer} disabled={bloque} className={btnCls}>
              Je comprends — corriger
            </button>
            <button type="button" onClick={() => setAttente(null)} className={btnCls}>
              Non, laisser
            </button>
          </div>
        </div>
      )}

      <section className="bande space-y-3">
        <span className="kicker">Les buts, dans l'ordre</span>
        {events.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-2)]">Aucun événement sur ce match.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-2 border-t border-[color:var(--rule)] pt-2 text-sm">
                <span className="w-9 font-mono text-[color:var(--ink-2)]">{ev.minute != null ? `${ev.minute}′` : "—"}</span>
                <span className="rounded-[2px] bg-[color:var(--pitch-2)] px-1.5 py-0.5 text-xs font-bold">{nom(ev.team)}</span>
                <span className="flex-1">
                  {LIBELLE[ev.type]}
                  {ev.playerName ? ` — ${ev.playerName}` : ev.type === "GOAL" || ev.type === "OWN_GOAL" ? " — sans nom" : ""}
                  {ev.minute == null && (ev.type === "GOAL" || ev.type === "OWN_GOAL") && (
                    <span className="text-[color:var(--ink-2)]"> · ajouté après coup</span>
                  )}
                </span>
                {ev.type === "GOAL" && trackAssists && (
                  <label className="flex items-center gap-1 text-xs text-[color:var(--ink-2)]">
                    passe
                    <select
                      className={inputCls}
                      value={ev.assistId ?? ""}
                      disabled={bloque}
                      onChange={(e) =>
                        lancer(() => changerJoueurEvenementCorrection(slug, matchId, ev.id, "passeur", e.target.value || null))
                      }
                    >
                      <option value="">aucune</option>
                      {du(ev.team)
                        .filter((p) => p.id !== ev.playerId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {ev.type === "OWN_GOAL" && (
                  <label className="flex items-center gap-1 text-xs text-[color:var(--ink-2)]">
                    auteur
                    <select
                      className={inputCls}
                      value={ev.playerId ?? ""}
                      disabled={bloque}
                      onChange={(e) =>
                        lancer(() => changerJoueurEvenementCorrection(slug, matchId, ev.id, "buteurCsc", e.target.value || null))
                      }
                    >
                      <option value="">sans nom</option>
                      {du(autre(ev.team)).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={bloque}
                  onClick={() => lancer(() => retirerEvenementCorrection(slug, matchId, ev.id))}
                  className={`${btnCls} text-[color:var(--loss)]`}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={ajouter} className="bande space-y-3">
        <span className="kicker">Ajouter un but oublié</span>
        <p className="text-xs text-[color:var(--ink-2)]">
          Pas de minute : on ne te demande pas d'en inventer une. Il se place en fin de chronologie, marqué comme
          ajouté après coup.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-[color:var(--ink-2)]">
            quoi
            <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value as "GOAL" | "OWN_GOAL"); setPlayerId(""); setAssistId(""); }}>
              <option value="GOAL">But</option>
              <option value="OWN_GOAL">Contre son camp</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-[color:var(--ink-2)]">
            pour
            <select className={inputCls} value={team} onChange={(e) => { setTeam(e.target.value as Camp); setPlayerId(""); setAssistId(""); }}>
              <option value="A">{nomA}</option>
              <option value="B">{nomB}</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-[color:var(--ink-2)]">
            {type === "GOAL" ? "buteur" : "auteur du csc"}
            <select className={inputCls} value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">sans nom</option>
              {buteurs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {type === "GOAL" && trackAssists && (
            <label className="grid gap-1 text-xs text-[color:var(--ink-2)]">
              passe
              <select className={inputCls} value={assistId} onChange={(e) => setAssistId(e.target.value)}>
                <option value="">aucune</option>
                {du(team)
                  .filter((p) => p.id !== playerId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button type="submit" disabled={bloque} className={btnCls}>
            {pending ? "…" : "Ajouter"}
          </button>
        </div>
      </form>

      <section className="bande space-y-3">
        <span className="kicker">La composition</span>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["A", "B"] as const).map((c) => (
            <div key={c}>
              <p className="text-sm font-bold">{nom(c)}</p>
              {du(c).length === 0 ? (
                <p className="text-xs text-[color:var(--ink-2)]">
                  {kind === "EXTERNAL" && c === "B" ? "L'adversaire : pas de feuille à composer." : "Personne."}
                </p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {du(c).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{p.name}</span>
                      <button
                        type="button"
                        disabled={bloque || (kind === "EXTERNAL" && autre(c) === "B")}
                        onClick={() => lancer(() => deplacerJoueurCorrection(slug, matchId, p.id, autre(c)))}
                        className={btnCls}
                        title={kind === "EXTERNAL" && autre(c) === "B" ? "L'équipe B est l'adversaire" : `Envoyer chez ${nom(autre(c))}`}
                      >
                        → {nom(autre(c))}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {erreur && <p className="text-sm text-[color:var(--loss)]">{erreur}</p>}
    </div>
  );
}
