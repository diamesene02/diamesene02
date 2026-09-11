/// La version du CONTRAT entre l'app et ce serveur.
///
/// Pas `version` (« 1.0.0 ») ni `buildNumber` de l'app : ceux-là bougent quand
/// on corrige une couleur. Prévenir quinze personnes qu'elles doivent mettre à
/// jour parce qu'un bouton a changé de teinte, c'est leur apprendre à ignorer
/// l'avertissement — et le jour où il compte vraiment, plus personne ne le lit.
///
/// Cet entier n'augmente QUE quand le contrat change : un champ obligatoire de
/// plus, une route renommée, une forme de réponse différente.
///
/// Deux nombres, pas un. Ils divergeront le jour où le serveur cessera de
/// servir un vieux protocole sans encore en exiger un neuf : `MINIMUM` monte,
/// `COURANT` reste. Aujourd'hui ils sont égaux — c'est le premier jour.
export const PROTOCOLE_COURANT = 1;
export const PROTOCOLE_MINIMUM = 1;

export type VerdictProtocole = "ok" | "trop-vieux" | "trop-recent";

/// Le verdict sur l'en-tête `x-protocole` d'une requête.
///
/// **Il ne refuse jamais rien** : il rend un avis, que `middleware.ts` recopie
/// dans un en-tête de réponse. Au gymnase sans réseau, un blocage
/// transformerait une incompatibilité en soirée perdue (spec 0004, Q4).
///
/// Deux cas rendent « ok » alors qu'on pourrait croire le contraire, et c'est
/// délibéré :
///
///   - **l'en-tête ABSENT** — c'est l'état des quinze téléphones installés
///     aujourd'hui, qui ne connaissent pas encore cet en-tête. Sans ce cas,
///     tout le monde serait déclaré « trop vieux » le jour du déploiement ;
///   - **l'en-tête ILLISIBLE** (« abc », « 1.2 », « -3 ») — un serveur qui
///     pénalise ce qu'il ne comprend pas invente un refus à partir d'un bruit.
export function verdictProtocole(enteteBrut: string | null): VerdictProtocole {
  if (!enteteBrut) return "ok";
  const n = Number(enteteBrut);
  if (!Number.isInteger(n) || n < 1) return "ok";
  if (n < PROTOCOLE_MINIMUM) return "trop-vieux";
  if (n > PROTOCOLE_COURANT) return "trop-recent";
  return "ok";
}
