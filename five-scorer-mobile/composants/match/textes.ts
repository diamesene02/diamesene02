// Les mots des écrans de match : la liste, le récap, la feuille en direct.
//
// Pur, sans React ni Expo : ce fichier se teste sous Node (textes.test.ts).
// Les phrases sont celles du site quand il en a une — « But de Bakary (12′)
// retiré », « Annuler le but » —, pour qu'un joueur qui passe de l'un à
// l'autre lise la même chose.

export type TypeEvenement = "GOAL" | "OWN_GOAL" | "YELLOW_CARD" | "RED_CARD" | "HALF_TIME";

/// Ce que retire le bouton « Annuler » du pied, en deux mots sous le verbe
/// (`quoiAnnuler` de LiveMatch.tsx). « Annuler » seul se lisait « annuler le
/// match ».
export function quoiAnnuler(type: string | undefined): string | null {
  if (!type) return null;
  if (type === "GOAL" || type === "OWN_GOAL") return "le but";
  if (type === "HALF_TIME") return "la mi-temps";
  return "le carton";
}

/// La phrase de la bande « … retiré · Rétablir » (`phraseRetrait` du site).
/// Sans auteur, on nomme le camp : un but sans nom reste un but de quelqu'un.
export function phraseRetrait(
  e: { type: string; playerName: string | null; minute: number | null },
  nomCamp: string,
): string {
  const qui = e.playerName ?? nomCamp;
  const min = e.minute != null ? ` (${e.minute}′)` : "";
  if (e.type === "GOAL") return `But de ${qui}${min} retiré`;
  if (e.type === "OWN_GOAL") return `Csc${e.playerName ? ` de ${e.playerName}` : ""}${min} retiré`;
  if (e.type === "HALF_TIME") return "Mi-temps retirée";
  return `Carton ${e.type === "YELLOW_CARD" ? "jaune" : "rouge"} de ${qui}${min} retiré`;
}

/// « mardi 15 septembre » → « Mardi 15 Septembre » : la classe `capitalize`
/// des en-têtes de groupe du site, qui met une majuscule à chaque mot.
export function majusculesAuxMots(texte: string): string {
  return texte.replace(/(^|\s)(\p{L})/gu, (_, espace: string, l: string) => espace + l.toUpperCase());
}

/// « 1 match », « 3 matchs ».
export function nombreDeMatchs(n: number): string {
  return `${n} match${n > 1 ? "s" : ""}`;
}

/// L'heure du match suivant d'une soirée saisie après coup : une demi-heure
/// après celui qu'on vient d'enregistrer, jamais dans le futur. La même règle
/// que le serveur pour « Saisir le match suivant » (route du récap) — sinon
/// les matchs d'un même lundi se retrouveraient tous à la même minute, et la
/// chronologie de la soirée ne dirait plus lequel est venu en premier.
export function heureDuSuivant(joueLe: string, maintenant: number = Date.now()): string {
  const t = Date.parse(joueLe);
  if (Number.isNaN(t)) return new Date(maintenant).toISOString();
  return new Date(Math.min(t + 30 * 60_000, maintenant)).toISOString();
}

/// Le vainqueur d'un score, ou `null` pour un nul.
export function vainqueur(scoreA: number, scoreB: number): "A" | "B" | null {
  return scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null;
}

/// « Blanc l'emporte », « Match nul » — la phrase du temps plein.
export function verdict(nomA: string, nomB: string, scoreA: number, scoreB: number): string {
  const v = vainqueur(scoreA, scoreB);
  return v === "A" ? `${nomA} l'emporte` : v === "B" ? `${nomB} l'emporte` : "Match nul";
}

/// Les minutes d'un buteur : « 3′, 11′ ». Un but sans minute (feuille saisie
/// après coup, but ajouté depuis le site) n'écrit rien — le site non plus.
export function minutesDuButeur(minutes: readonly (number | null)[]): string {
  return minutes
    .filter((m): m is number => m != null)
    .map((m) => `${m}′`)
    .join(", ");
}

type CampPartage = {
  nom: string;
  buteurs: { nom: string; minutes: (number | null)[] }[];
};

/// Le message du partage d'un récap : ce qu'on poste dans le groupe WhatsApp
/// le soir même.
///
/// Du texte seul, avec le lien public `/r/<id>` en dernière ligne : c'est lui
/// qui donne l'aperçu riche dans WhatsApp. La carte image du site passe par
/// un module natif de capture d'écran que le binaire installé n'a pas.
///
///   Blanc 2 – 1 Noir
///   Soirée du 7 sept. · Match 2
///   Blanc : Bakary 3′, Ismaël (csc) 8′
///   Noir : Hugo 5′
///   Homme du match : Bakary
///   https://…/r/<id>
export function texteDuPartage(
  f: {
    scoreA: number;
    scoreB: number;
    enDirect?: boolean;
    legende: string | null;
    camps: CampPartage[];
    homme: string | null;
  },
  lien: string,
): string {
  const [a, b] = f.camps;
  const lignes: string[] = [];
  const score = `${a?.nom ?? "A"} ${f.scoreA} – ${f.scoreB} ${b?.nom ?? "B"}`;
  lignes.push(f.enDirect ? `${score} (en direct)` : score);
  if (f.legende) lignes.push(f.legende);
  for (const c of f.camps) {
    if (c.buteurs.length === 0) continue;
    const noms = c.buteurs.map((bt) => {
      const mins = minutesDuButeur(bt.minutes);
      if (mins) return `${bt.nom} ${mins}`;
      return bt.minutes.length > 1 ? `${bt.nom} ×${bt.minutes.length}` : bt.nom;
    });
    lignes.push(`${c.nom} : ${noms.join(", ")}`);
  }
  if (f.homme) lignes.push(`Homme du match : ${f.homme}`);
  lignes.push(lien);
  return lignes.join("\n");
}

/// « 3 votes », « 1 vote », « 0 vote ».
export function nombreDeVotes(n: number): string {
  return `${n} vote${n > 1 ? "s" : ""}`;
}

/// Le vote déplacé, de façon optimiste : ma voix quitte l'ancien candidat
/// pour le nouveau. Retaper le même ne change rien — c'est ce que fait le
/// serveur (un vote par votant et par match).
export function deplacerMaVoix<C extends { playerId: string; voix: number }>(
  candidats: readonly C[],
  ancien: string | null,
  nouveau: string,
): C[] {
  if (ancien === nouveau) return [...candidats];
  return candidats.map((c) =>
    c.playerId === nouveau
      ? { ...c, voix: c.voix + 1 }
      : c.playerId === ancien
        ? { ...c, voix: Math.max(0, c.voix - 1) }
        : c,
  );
}

/// L'ordre de la carte de vote : les voix d'abord, puis le nom.
export function trierCandidats<C extends { nom: string; voix: number }>(candidats: readonly C[]): C[] {
  return [...candidats].sort((x, y) => y.voix - x.voix || x.nom.localeCompare(y.nom, "fr"));
}
