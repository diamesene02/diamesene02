/// La convocation, prête à coller sur le groupe.
///
/// Le club décide ses équipes trois à quatre jours avant de jouer, et il les
/// annonce sur WhatsApp. Le site savait les composer, pas les dire : une fois
/// la compo enregistrée, il ne restait qu'à la recopier à la main nom par nom.
/// Le « Mot de la soirée » (`lib/soiree.ts`) raconte la soirée jouée ; ceci
/// l'annonce.
///
/// Le texte reste valable quand on le lit le lendemain : la date y est donc
/// absolue — « dans 2 jours » serait faux dès le matin suivant.
///
/// Pur : l'en-tête arrive déjà mis en forme (les dates vivent derrière
/// `server-only`), le lien arrive complet (seul le navigateur connaît son
/// origine).

export type EquipeConvoquee = { nom: string; joueurs: string[] };

export function texteConvocation(input: {
  /// « Lundi 21 septembre · 19:00 · Five Renault »
  entete: string;
  /// « 8 présents · 4 places », ou null quand la soirée n'a pas d'état à dire.
  etat: string | null;
  /// Vide tant que la compo n'est pas faite : le texte reste une convocation.
  equipes: EquipeConvoquee[];
  lien: string;
}): string {
  const l: string[] = [input.entete];
  if (input.etat) l.push(input.etat);

  const equipes = input.equipes.filter((e) => e.joueurs.length > 0);
  if (equipes.length > 0) {
    l.push("");
    for (const e of equipes) {
      l.push(`${e.nom} (${e.joueurs.length}) : ${e.joueurs.join(", ")}`);
    }
  }

  l.push("");
  l.push(`Réponds ici : ${input.lien}`);
  return l.join("\n");
}
