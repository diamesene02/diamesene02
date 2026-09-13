export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELED";

// FINISHED et CANCELED sont tous deux une histoire close : rejouer un but
// dessus (file hors-ligne en retard, requête rejouée) romprait l'invariant
// qu'on vient de garantir à l'écran — un match « Annulé » qui regagnerait un
// score. Prérequis identifié par la spec 0001 AVANT la spec 0006 qui l'a
// introduit ; les deux specs ferment ensemble APRES-23/25/26.
export function matchVerrouille(status: MatchStatus): boolean {
  return status === "FINISHED" || status === "CANCELED";
}
