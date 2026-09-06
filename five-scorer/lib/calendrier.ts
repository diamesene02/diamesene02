// Calendrier récurrent d'une saison.
//
// Un club de five ne crée pas ses soirées une par une : il joue tous les lundis
// de septembre à juillet. Quarante-quatre créations à la main par saison, que
// personne ne fait — d'où la feuille de match absente au coup d'envoi. Ce
// module produit la liste des dates d'une saison, en écartant ce qui n'est pas
// jouable, et en DISANT pourquoi : la liste est présentée avant d'être écrite.
//
// Tout se calcule dans le fuseau du navigateur, comme le reste des dates de
// l'application (cf. NewSessionForm) — la personne qui prépare le calendrier
// est celle qui joue.

export type JourSemaine = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = dimanche

/// Dimanche de Pâques (grégorien) — algorithme de Meeus/Jones/Butcher.
/// Nécessaire parce que trois fériés français en dépendent, dont deux lundis :
/// le lundi de Pâques et le lundi de Pentecôte. Une liste en dur serait fausse
/// dès la saison suivante.
export function paques(annee: number): Date {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(annee, mois - 1, jour);
}

function decale(d: Date, jours: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + jours);
  return r;
}

export function cle(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/// Les onze jours fériés français d'une année civile, avec leur nom.
export function joursFeries(annee: number): Map<string, string> {
  const p = paques(annee);
  const m = new Map<string, string>();
  const pose = (d: Date, nom: string) => m.set(cle(d), nom);

  pose(new Date(annee, 0, 1), "Jour de l'an");
  pose(decale(p, 1), "Lundi de Pâques");
  pose(new Date(annee, 4, 1), "Fête du Travail");
  pose(new Date(annee, 4, 8), "Victoire 1945");
  pose(decale(p, 39), "Ascension");
  pose(decale(p, 50), "Lundi de Pentecôte");
  pose(new Date(annee, 6, 14), "Fête nationale");
  pose(new Date(annee, 7, 15), "Assomption");
  pose(new Date(annee, 10, 1), "Toussaint");
  pose(new Date(annee, 10, 11), "Armistice");
  pose(new Date(annee, 11, 25), "Noël");
  return m;
}

/// Du 24 décembre au 1er janvier inclus. Volontairement étroit et prévisible :
/// la liste étant modifiable date par date avant création, mieux vaut une règle
/// qu'on peut réciter qu'une heuristique qui surprend.
export function estTreveDeNoel(d: Date): boolean {
  const mois = d.getMonth();
  const jour = d.getDate();
  return (mois === 11 && jour >= 24) || (mois === 0 && jour === 1);
}

export type Occurrence = {
  date: Date;
  /// Motif d'exclusion proposé par défaut, ou null si la date est jouable.
  /// L'utilisateur reste libre de rétablir ou de retirer n'importe quelle date.
  exclu: string | null;
};

export type OptionsCalendrier = {
  /// Première date possible (incluse). Une saison démarrée en cours d'année
  /// commence aujourd'hui, pas en septembre.
  debut: Date;
  /// Dernière date possible (incluse).
  fin: Date;
  jourSemaine: JourSemaine;
  heures: number;
  minutes: number;
  sauterFeries?: boolean;
  sauterTreveDeNoel?: boolean;
};

/// Toutes les occurrences hebdomadaires entre deux bornes, à l'heure dite.
export function genererCalendrier(o: OptionsCalendrier): Occurrence[] {
  const feries = new Map<string, string>();
  for (let a = o.debut.getFullYear(); a <= o.fin.getFullYear(); a++) {
    for (const [k, nom] of joursFeries(a)) feries.set(k, nom);
  }

  // Premier jour voulu à partir de `debut`.
  const curseur = new Date(
    o.debut.getFullYear(),
    o.debut.getMonth(),
    o.debut.getDate(),
    o.heures,
    o.minutes,
    0,
    0,
  );
  const ecart = (o.jourSemaine - curseur.getDay() + 7) % 7;
  curseur.setDate(curseur.getDate() + ecart);

  const out: Occurrence[] = [];
  // Garde-fou : une saison ne dépasse pas deux ans d'occurrences hebdomadaires.
  const plafond = 120;
  while (curseur <= o.fin && out.length < plafond) {
    const date = new Date(curseur);
    let exclu: string | null = null;
    const ferie = feries.get(cle(date));
    if (o.sauterFeries !== false && ferie) exclu = ferie;
    else if (o.sauterTreveDeNoel !== false && estTreveDeNoel(date)) {
      exclu = "Trêve de Noël";
    }
    out.push({ date, exclu });
    curseur.setDate(curseur.getDate() + 7);
  }
  return out;
}

/// Bornes par défaut d'une saison de five : septembre → juillet. Appelée avec
/// la date du jour, elle propose la saison en cours si on est dedans, la
/// suivante sinon — et ne propose jamais de créer des soirées dans le passé.
export function saisonParDefaut(aujourdhui: Date): {
  debut: Date;
  fin: Date;
  nom: string;
} {
  const a = aujourdhui.getFullYear();
  const mois = aujourdhui.getMonth(); // 0 = janvier
  // De septembre (8) à décembre : saison a/a+1. De janvier à juillet (0..6) :
  // saison a-1/a. En août : la saison à venir, a/a+1.
  const anneeDebut = mois >= 8 || mois === 7 ? a : a - 1;
  const debutSaison = new Date(anneeDebut, 8, 1); // 1er septembre
  const fin = new Date(anneeDebut + 1, 6, 31, 23, 59, 59); // 31 juillet
  const debut = debutSaison > aujourdhui ? debutSaison : aujourdhui;
  return { debut, fin, nom: `Saison ${anneeDebut}-${anneeDebut + 1}` };
}
