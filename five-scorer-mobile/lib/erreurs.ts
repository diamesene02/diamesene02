// Ce qu'on dit au joueur quand un chargement ou un envoi échoue.
//
// Les écrans affichaient `e.message` tel quel, en rouge : « Impossible de
// joindre https://five-scorer.vercel.app/api/clubs/cm…/accueil — Network
// request failed ». Le message était fait pour le développeur — il dit OÙ
// ça a cassé, c'est `joindre` qui le fabrique exprès — et il arrivait au
// joueur, au bord du terrain, qui n'en tire rien.
//
// Ici on garde les deux : `messageErreur` rend une phrase qui dit quoi faire,
// `detailTechnique` rend l'original pour qui saura le lire (un appui long,
// une capture envoyée sur WhatsApp).
//
// Pas d'import d'Expo : ce fichier se teste sous Node, comme `appel.ts`.

import { ErreurServeur, SessionExpiree } from "./appel";

export type NatureErreur =
  | "hors-ligne"
  | "delai"
  | "session"
  | "droits"
  | "introuvable"
  | "conflit"
  | "refus"
  | "serveur"
  | "inconnue";

const PHRASES: Record<NatureErreur, string> = {
  "hors-ligne": "Pas de connexion au serveur. Vérifie le réseau, puis réessaie.",
  delai: "Le serveur met trop de temps à répondre. Réessaie dans un instant.",
  session: "Ta session a expiré. Reconnecte-toi pour continuer.",
  droits: "Tu n'as pas les droits pour faire ça. Demande à un admin du club.",
  introuvable: "C'est introuvable : ça a peut-être été supprimé entre-temps.",
  conflit: "Quelqu'un a modifié ça en même temps. Recharge, puis réessaie.",
  refus: "Le serveur a refusé la demande. Vérifie ce que tu as saisi.",
  serveur: "Le serveur ne répond pas pour l'instant. Réessaie dans un moment.",
  inconnue: "Quelque chose n'a pas marché. Réessaie.",
};

/// Les phrases qu'un réseau absent fait remonter de `fetch`, selon la
/// plateforme : iOS (NSURLError), Android (OkHttp via React Native), Hermes.
const RESEAU =
  /network request failed|failed to fetch|networkerror|internet connection appears to be offline|could not connect to the server|hostname could not be found|network connection was lost|unable to resolve host|failed to connect|connection refused|econnrefused|enotfound|socket/i;

const DELAI = /timed? ?out|timeout|aborted|abort/i;

/// Les mots-codes que nos routes rendent dans `{ error }` et qui ne sont pas
/// des phrases : on ne les montre pas, on s'en tient au code HTTP.
const CODES = new Set([
  "introuvable",
  "unauthorized",
  "forbidden",
  "non connecté",
  "non autorisé.",
  "droits insuffisants",
  "corps illisible",
  "invalid type",
  "payload invalide",
  "playerid requis",
  "joueurs manquant",
  "requête invalide.",
]);

function texteDe(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "";
}

function statutDe(e: unknown): number | null {
  if (e instanceof ErreurServeur) return e.status;
  const s = (e as { status?: unknown } | null)?.status;
  if (typeof s === "number") return s;
  // `chargerVitrine` et les écrans qui ont rangé le message en chaîne : le
  // code n'existe plus qu'à l'intérieur de la phrase.
  const m = texteDe(e).match(/répondu (\d{3})/);
  return m ? Number(m[1]) : null;
}

/// Ce que le serveur a dit en plus du code, quand il l'a dit.
function detailServeur(e: unknown): string | null {
  const m = texteDe(e).match(/^Le serveur a répondu \d{3} — ([\s\S]+)$/);
  return m ? m[1].trim() : null;
}

/// Une phrase qu'on peut montrer telle quelle, ou `null`.
///
/// Une phrase a des espaces, pas d'adresse, pas de trace de code. Les
/// messages de nos routes (« Réservé aux admins. », « Nom trop court. ») et
/// les verdicts de `appel.ts` (« tu n'es plus membre de ce club… ») passent ;
/// « forbidden », une URL ou un « Unexpected token < in JSON » ne passent pas.
export function phraseHumaine(texte: string | null | undefined): string | null {
  const t = (texte ?? "").trim();
  if (!t || t.length > 240) return null;
  if (CODES.has(t.toLowerCase())) return null;
  if (!/\s/.test(t)) return null;
  if (/:\/\/|[{}<>]|\b(undefined|null|NaN|JSON|TypeError|Error|SQLITE)\b/.test(t)) {
    return null;
  }
  const phrase = t[0].toUpperCase() + t.slice(1);
  return /[.!?…»]$/.test(phrase) ? phrase : phrase + ".";
}

export function natureErreur(e: unknown): NatureErreur {
  if (
    e instanceof SessionExpiree ||
    (e as { name?: unknown } | null)?.name === "SessionExpiree" ||
    texteDe(e) === "Session expirée"
  ) {
    return "session";
  }
  const statut = statutDe(e);
  if (statut != null) {
    if (statut === 401) return "session";
    if (statut === 403) return "droits";
    if (statut === 404 || statut === 410) return "introuvable";
    if (statut === 408 || statut === 504) return "delai";
    if (statut === 409) return "conflit";
    if (statut >= 500) return "serveur";
    if (statut >= 400) return "refus";
  }
  const texte = texteDe(e);
  const nom = (e as { name?: unknown } | null)?.name;
  // `joindre` enveloppe l'échec du fetch : la cause est après le tiret.
  const joindre = texte.startsWith("Impossible de joindre ");
  const cause = joindre ? texte.split(" — ").slice(1).join(" — ") || texte : texte;
  if (nom === "AbortError" || (DELAI.test(cause) && !RESEAU.test(cause))) return "delai";
  if (joindre || RESEAU.test(cause)) return "hors-ligne";
  return "inconnue";
}

/// La phrase à montrer au joueur. Jamais d'URL, jamais de code brut.
///
/// Accepte aussi une chaîne : beaucoup d'écrans rangent déjà `e.message`
/// dans leur état, et c'est au rendu qu'on traduit.
export function messageErreur(e: unknown): string {
  const nature = natureErreur(e);
  switch (nature) {
    case "session":
    case "hors-ligne":
    case "delai":
    case "serveur":
    case "conflit":
      return PHRASES[nature];
    case "droits":
    case "introuvable":
    case "refus": {
      const statut = statutDe(e);
      if (statut === 429) return "Trop d'essais d'un coup. Attends un instant, puis réessaie.";
      if (statut === 413) return "C'est trop lourd à envoyer. Essaie avec une photo plus petite.";
      // Le serveur sait souvent dire POURQUOI (« Réservé aux admins. »,
      // « tu n'es plus membre de ce club… ») : c'est plus utile que la
      // phrase générique.
      return phraseHumaine(detailServeur(e)) ?? PHRASES[nature];
    }
    case "inconnue":
      return phraseHumaine(texteDe(e)) ?? PHRASES.inconnue;
  }
}

/// Le message d'origine, pour qui sait le lire. `null` s'il n'apporte rien
/// de plus que la phrase affichée.
export function detailTechnique(e: unknown): string | null {
  const t = texteDe(e).trim();
  if (!t || t === messageErreur(e)) return null;
  return t;
}

/// Vrai quand réessayer a une chance de marcher sans rien changer d'autre.
/// Un refus de droits ou une session finie ne se règlent pas en retapant.
export function vautLaPeineDeReessayer(e: unknown): boolean {
  const n = natureErreur(e);
  return (
    n === "hors-ligne" || n === "delai" || n === "serveur" || n === "conflit" || n === "inconnue"
  );
}
