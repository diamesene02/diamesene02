// spec 0001, Q6 : `updateMatchDetails` écrit `mvpId` sans jamais regarder si
// le club est en mode vote, et `voteMotm` recomptait à chaque voix en
// écrasant silencieusement ce choix — un admin qui désignait l'homme du
// match à la main le voyait disparaître au premier vote suivant. Match
// gagne donc `motmLocked` (posé par `updateMatchDetails` dès qu'une
// désignation manuelle non nulle est écrite) ; ce prédicat porte la
// vérification côté vote, pour qu'elle vive à un seul endroit.
export function verifierMotmDeverouille(
  motmLocked: boolean,
): { ok: true } | { ok: false; error: string } {
  if (motmLocked) {
    return {
      ok: false,
      error:
        "L'homme du match a été désigné par le capitaine ; le vote est fermé.",
    };
  }
  return { ok: true };
}
