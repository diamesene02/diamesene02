// FINISHED et CANCELED sont tous deux une histoire close : rejouer un but
// dessus romprait l'invariant que 0006 vient de garantir à l'écran.

import { describe, it, expect } from "vitest";
import { matchVerrouille, type MatchStatus } from "./matchStatus";

describe("matchVerrouille", () => {
  it("verrouille un match FINISHED", () => {
    expect(matchVerrouille("FINISHED")).toBe(true);
  });

  it("verrouille un match CANCELED", () => {
    expect(matchVerrouille("CANCELED")).toBe(true);
  });

  it("laisse écrire un match SCHEDULED", () => {
    expect(matchVerrouille("SCHEDULED")).toBe(false);
  });

  it("laisse écrire un match LIVE", () => {
    expect(matchVerrouille("LIVE")).toBe(false);
  });

  it("couvre les quatre statuts et aucun de plus — le jour où un cinquième arrive, ce test doit être relu", () => {
    const tous: MatchStatus[] = ["SCHEDULED", "LIVE", "FINISHED", "CANCELED"];
    expect(tous.map(matchVerrouille)).toEqual([false, false, true, true]);
  });
});
