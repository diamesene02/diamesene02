"use server";

import { revalidatePath } from "next/cache";
import { requireClub } from "@/lib/guard";
import { ecrireCompo, reprendreCompo, type JoueurCompo } from "@/lib/compo";

// Le type N'EST PLUS réexporté d'ici. Dans ce fichier « use server », le
// chargeur d'actions de Next (Turbopack, 16.2) laissait `export type { … }`
// à l'exécution : « ReferenceError: JoueurCompo is not defined » à
// l'évaluation du module, et « Enregistrer la compo » répondait 500
// (constaté en développement le 19 septembre 2026). Personne ne l'importait
// plus d'ici : on le prend dans lib/compo.

// La composition préparée d'une soirée.
//
// Le club connaît ses équipes trois à quatre jours avant de jouer. Jusqu'ici
// elles n'avaient nulle part où être écrites : il fallait attendre le coup
// d'envoi et composer au bord du terrain. Elles vivent sur la SOIRÉE, pas sur
// un match — une soirée enchaîne quatre à huit matchs avec les deux mêmes
// équipes, et chacun en hérite.

export async function enregistrerCompo(
  slug: string,
  matchDayId: string,
  input: {
    joueurs: JoueurCompo[];
    teamAName?: string;
    teamBName?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Droits insuffisants." };

  // Les RÈGLES vivent dans lib/compo.ts, partagées avec la route que l'app
  // appelle. Ici il ne reste que la garde du site et la revalidation.
  const r = await ecrireCompo(ctx.club.id, matchDayId, input);
  if (!r.ok) return r;

  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true };
}

/// Reprend la composition de la dernière soirée déjà préparée, comme point de
/// départ. Les équipes tournent d'une semaine à l'autre, mais on part rarement
/// d'une page blanche — et c'est le geste qui coûtait le plus de temps.
export async function reprendreCompoPrecedente(
  slug: string,
  matchDayId: string,
): Promise<{ ok: boolean; error?: string; reprises?: number }> {
  const ctx = await requireClub(slug);
  if (!ctx.canScore) return { ok: false, error: "Droits insuffisants." };

  // Même règle que la route que l'app appelle : elle vit dans lib/compo.ts.
  // Le corps était recopié ici à l'identique ; la première correction faite
  // d'un seul côté (ne pas reconduire un ancien invité, remonter plus loin
  // que la soirée juste avant) aurait donné deux compos différentes selon
  // que le capitaine touche le bouton sur le site ou dans l'app.
  const r = await reprendreCompo(ctx.club.id, matchDayId);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/c/${slug}`, "layout");
  return { ok: true, reprises: r.reprises };
}
