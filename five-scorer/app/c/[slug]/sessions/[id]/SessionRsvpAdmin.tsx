"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { setRsvp } from "@/app/actions/matchday";
import AvatarAnneau from "@/components/ios/AvatarAnneau";
import type { RsvpStatus } from "@prisma/client";

export type SessionPlayerRow = {
  playerId: string;
  name: string;
  photo?: string | null;
  status: RsvpStatus | null; // null = sans réponse
  /// « Je viens tous les lundis » : compté présent tant qu'il n'a rien dit.
  abonne?: boolean;
  /// Au-delà de la capacité du terrain, les derniers engagés attendent.
  enAttente?: boolean;
  /// Le camp dans la compo de la soirée : donne la couleur de l'anneau.
  camp?: "A" | "B" | null;
};

/// Le statut RETENU : une réponse explicite gagne toujours sur l'abonnement.
function effectif(r: SessionPlayerRow): RsvpStatus | null {
  return r.status ?? (r.abonne ? "IN" : null);
}

const LIBELLES: Record<RsvpStatus, string> = {
  IN: "Présent",
  MAYBE: "Peut-être",
  OUT: "Absent",
};

/// Tap admin : cycle IN → MAYBE → OUT (sans réponse → IN).
function nextStatus(s: RsvpStatus | null): RsvpStatus {
  if (s === "IN") return "MAYBE";
  if (s === "MAYBE") return "OUT";
  return "IN"; // OUT ou sans réponse
}

const ORDRE: Record<string, number> = { IN: 0, MAYBE: 1, OUT: 2, none: 3 };

// La carte « Ma réponse » : mon segment Présent / Absent en tête, le compte
// des présents et la note du terrain sur une ligne, puis les joueurs un par
// ligne — moi d'abord, puis ceux qui ont répondu. Le reste se replie derrière
// « et N autres » : sur un club de vingt, on veut savoir qui vient, pas lire
// vingt lignes.
export default function SessionRsvpAdmin({
  slug,
  matchDayId,
  myPlayerId,
  canManage,
  players,
  argent,
  etat,
}: {
  slug: string;
  matchDayId: string;
  myPlayerId: string | null;
  canManage: boolean;
  players: SessionPlayerRow[];
  /// L'état de la soirée, calculé côté serveur : « confirmée », « il en
  /// manque 3 ». Une soirée n'avait que deux états — elle existait, ou elle
  /// avait été jouée. Entre les deux, personne ne savait si ça tenait.
  etat?: { statut: "annulee" | "confirmee" | "en-attente"; phrase: string };
  /// « 48 € · 5,33 € chacun » — rendu par MoneyPanel, posé à droite du compte.
  argent?: React.ReactNode;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(players);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deplie, setDeplie] = useState(false);

  const moiLigne = myPlayerId
    ? (rows.find((r) => r.playerId === myPlayerId) ?? null)
    : null;
  const mine = moiLigne ? effectif(moiLigne) : null;

  function apply(playerId: string, status: RsvpStatus) {
    setError(null);
    // Optimiste : maj locale immédiate.
    setRows((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, status } : r))
    );
    startTransition(async () => {
      const res = await setRsvp(slug, matchDayId, playerId, status);
      if (!res.ok) {
        setError(res.error ?? "Erreur");
      }
      router.refresh();
    });
  }

  // « Présents » = ceux qui JOUENT. Compter les remplaçants avec eux donnait
  // « 10 présents » au-dessus de « complet à 6 » : deux chiffres qui se
  // contredisent sur la même carte.
  const presents = rows.filter((r) => effectif(r) === "IN" && !r.enAttente).length;
  const enAttente = rows.filter((r) => effectif(r) === "IN" && r.enAttente).length;
  const absents = rows.filter((r) => effectif(r) === "OUT").length;
  const peutEtre = rows.filter((r) => effectif(r) === "MAYBE").length;

  const tries = [...rows].sort((a, b) => {
    if (a.playerId === myPlayerId) return -1;
    if (b.playerId === myPlayerId) return 1;
    // Les remplaçants après les titulaires, quel que soit leur statut.
    if (!!a.enAttente !== !!b.enAttente) return a.enAttente ? 1 : -1;
    return ORDRE[effectif(a) ?? "none"] - ORDRE[effectif(b) ?? "none"];
  });
  const VISIBLES = 4;
  const visibles = deplie ? tries : tries.slice(0, VISIBLES);
  const caches = tries.slice(VISIBLES);
  const cachesIn = caches.filter(
    (r) => effectif(r) === "IN" && !r.enAttente,
  ).length;
  const cachesNone = caches.filter((r) => effectif(r) === null).length;
  const libelleAutres =
    caches.length === cachesIn
      ? `et ${caches.length} autre${caches.length > 1 ? "s" : ""} présent${caches.length > 1 ? "s" : ""}`
      : caches.length === cachesNone
        ? `et ${caches.length} sans réponse`
        : `et ${caches.length} autre${caches.length > 1 ? "s" : ""}`;

  const compte = [
    `${presents} présent${presents > 1 ? "s" : ""}`,
    enAttente > 0 ? `${enAttente} en attente` : null,
    peutEtre > 0 ? `${peutEtre} peut-être` : null,
    `${absents} absent${absents > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="soiree-reponse-tete">
        <span className="titre">{myPlayerId ? "Ma réponse" : "Présences"}</span>
        {myPlayerId && (
          <div className="segment" role="radiogroup" aria-label="Ma réponse">
            <button
              type="button"
              role="radio"
              aria-checked={mine === "IN"}
              disabled={pending}
              className={cn(mine === "IN" && "actif")}
              onClick={() => apply(myPlayerId, "IN")}
            >
              Présent
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mine === "OUT"}
              disabled={pending}
              className={cn(mine === "OUT" && "actif")}
              onClick={() => apply(myPlayerId, "OUT")}
            >
              Absent
            </button>
          </div>
        )}
      </div>
      <div className="soiree-filet" />
      <div className="soiree-compte">
        <span>{compte}</span>
        {argent && <span className="argent">{argent}</span>}
      </div>
      {etat && (
        <div className={`soiree-etat ${etat.statut}`}>{etat.phrase}</div>
      )}
      {error && <p className="soiree-erreur">{error}</p>}

      {visibles.map((p) => {
        const moi = p.playerId === myPlayerId;
        const contenu = (
          <>
            <AvatarAnneau nom={p.name} photo={p.photo} camp={p.camp ?? null} />
            <span className="nom">
              {p.name}
              {moi && " (moi)"}
            </span>
            <span
              className={cn(
                "statut",
                effectif(p) === "IN" && "in",
                effectif(p) === "OUT" && "out",
                effectif(p) === "MAYBE" && "maybe",
                !effectif(p) && "none",
                p.enAttente && "attente",
              )}
            >
              {p.enAttente
                ? "En attente"
                : effectif(p)
                  ? LIBELLES[effectif(p)!]
                  : "—"}
              {/* Un abonné n'a rien répondu : le lui faire croire serait
                  mentir, et l'empêcherait de se désister le jour où il ne
                  peut pas. */}
              {!p.status && p.abonne && <span className="via"> · abonné</span>}
            </span>
          </>
        );
        return canManage ? (
          <button
            key={p.playerId}
            type="button"
            disabled={pending}
            onClick={() => apply(p.playerId, nextStatus(p.status))}
            title="Changer le statut"
            className="soiree-rangee tape"
          >
            {contenu}
          </button>
        ) : (
          <div key={p.playerId} className="soiree-rangee">
            {contenu}
          </div>
        );
      })}

      {caches.length > 0 ? (
        <button
          type="button"
          className="soiree-autres"
          onClick={() => setDeplie((d) => !d)}
          aria-expanded={deplie}
        >
          {deplie ? "Replier" : libelleAutres}
        </button>
      ) : (
        <div style={{ height: 12 }} />
      )}

      {canManage && deplie && (
        <p className="soiree-aide">
          Touche un joueur pour changer son statut : présent → peut-être →
          absent.
        </p>
      )}
    </>
  );
}
