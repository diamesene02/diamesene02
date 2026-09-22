"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retirerMatch } from "@/app/actions/matches";

/// « Supprimer » — le mot reste sur le bouton parce qu'un match sans rien à
/// perdre s'efface vraiment. Mais dès qu'il y a des buts, une compo, une
/// convocation, le geste devient une annulation : `retirerMatch` le décide,
/// pas ce composant (spec 0006).
///
/// Deux choses que l'ancienne version faisait mal, et que ce composant
/// corrige : un échec de suppression était avalé et redirigeait quand même
/// comme si c'était fait (APRES-26) — ici l'échec s'affiche, rien d'autre ne
/// se passe. Et une annulation garde le match sur SA page (il existe
/// toujours) ; seule une vraie suppression envoie vers la liste, puisque la
/// page qu'on regarde n'existera plus.
export default function DeleteMatchButton({
  slug,
  matchId,
}: {
  slug: string;
  matchId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-[44px] items-center rounded-[2px] px-4 text-sm font-bold text-[color:var(--loss)] hover:bg-[color:var(--pitch-2)]"
      >
        Supprimer
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[color:var(--ink-2)]">
        S'il n'y a rien dessus, il part pour de vrai. S'il y a des buts ou une
        compo, il reste, marqué annulé.
      </span>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await retirerMatch(slug, matchId);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            if (res.geste === "supprime") {
              router.push(`/c/${slug}/matches`);
            } else {
              router.refresh();
            }
          })
        }
        className="inline-flex min-h-[44px] min-w-[64px] items-center justify-center rounded-[2px] bg-[color:var(--loss)] px-4 text-sm font-bold text-[color:var(--pitch-0)] disabled:opacity-50"
      >
        {pending ? "…" : "Oui"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="inline-flex min-h-[44px] min-w-[64px] items-center justify-center rounded-[2px] px-3 text-sm font-bold text-[color:var(--ink-1)]"
      >
        Non
      </button>
      {error && <p className="w-full text-sm text-[color:var(--loss)]">{error}</p>}
    </div>
  );
}
