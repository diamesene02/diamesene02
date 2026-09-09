// L'appel authentifié à l'app web — et pas une ligne d'Expo.
//
// Pourquoi ce fichier existe à côté de `lib/api.ts` : `api.ts` importe
// `expo-constants` et `expo-linking` dès ses premières lignes, pour deviner
// l'adresse du serveur depuis l'hôte qui a servi le bundle. Ces deux modules
// ne se chargent pas dans Node. Tout ce qui vit à côté d'eux est donc
// intestable dans le nuage — c'est-à-dire intestable par l'agent qui repasse
// toutes les deux heures, et le §5 de MOBILE.md dit que c'est là que doit
// vivre la confiance.
//
// Ici rien n'est deviné : l'adresse, le cookie et le `fetch` sont passés en
// paramètres. C'est le procédé de `creerDrain(deps)` (lib/outbox/sync.ts),
// pour la même raison — et il rend en prime le lecteur de cookie partageable
// entre l'app et le drain, qui doivent rejouer LE MÊME.

/// Levée quand le serveur répond 401 : la session est finie ou révoquée.
///
/// Distincte d'une erreur réseau, et c'est tout l'intérêt : c'est la seule qui
/// doive ramener à l'écran de connexion. Les autres se retentent — renvoyer
/// quelqu'un vers un formulaire de connexion parce que le Wi-Fi du gymnase a
/// hoqueté serait le pire des conseils.
export class SessionExpiree extends Error {
  constructor() {
    super("Session expirée");
    this.name = "SessionExpiree";
  }
}

/// Toute autre réponse d'erreur du serveur.
///
/// `status` est conservé sur l'objet, et pas seulement dans le message : c'est
/// la convention que `encaisserEchec` du drain lit déjà (`err.status`) pour
/// décider si l'opération se retente. Une erreur qui perd son code force
/// l'appelant à relire une phrase française pour prendre une décision de
/// machine.
export class ErreurServeur extends Error {
  readonly status: number;
  constructor(status: number, detail?: string | null) {
    super(
      detail
        ? "Le serveur a répondu " + status + " — " + detail
        : "Le serveur a répondu " + status + ".",
    );
    this.name = "ErreurServeur";
    this.status = status;
  }
}

/// Un fetch qui dit OÙ il a échoué.
///
/// « Could not connect to the server » ne désigne rien : ni l'adresse, ni la
/// raison. Sur un téléphone, c'est presque toujours l'adresse — le Mac
/// éteint, un autre Wi-Fi, ou un « localhost » qui désignait le téléphone.
/// Donner l'adresse essayée transforme une demi-heure de recherche en un coup
/// d'œil.
export async function joindre(
  url: string,
  options?: RequestInit,
  appeler: typeof globalThis.fetch = (u, o) => globalThis.fetch(u, o),
): Promise<Response> {
  try {
    return await appeler(url, options);
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    throw new Error("Impossible de joindre " + url + " — " + cause);
  }
}

/// Le corps d'une réponse d'erreur, quand il en porte un.
///
/// Nos routes répondent `{ "error": "forbidden" }`, `{ "error": "Aucun
/// joueur" }`… Recopier ce mot dans le message change « Le serveur a répondu
/// 400. » — qui n'aide personne — en une phrase qui dit quoi corriger. Une
/// réponse illisible ne doit jamais masquer le code : on rend `null` et le
/// code reste.
async function detailDeLErreur(res: Response): Promise<string | null> {
  try {
    const texte = await res.text();
    if (!texte) return null;
    const corps: unknown = JSON.parse(texte);
    if (
      corps &&
      typeof corps === "object" &&
      typeof (corps as { error?: unknown }).error === "string"
    ) {
      return (corps as { error: string }).error;
    }
    return null;
  } catch {
    return null;
  }
}

export type DependancesAppel = {
  /// La racine de l'app web (« https://five-scorer.vercel.app », ou le serveur
  /// du Mac). Les URL sont absolues : il n'y a pas d'origine implicite sur un
  /// téléphone.
  api: string;
  /// Le cookie de session, lu dans le trousseau. Appelé À CHAQUE requête, et
  /// pas une fois pour toutes : une session qui se renouvelle, ou une
  /// déconnexion, doivent se voir au coup d'après.
  cookie: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
};

/// Fabrique la fonction d'appel authentifié de l'app.
///
/// React Native n'a pas de bocal à cookies : `credentials: "include"` ne fait
/// RIEN ici. Il faut lire le cookie dans le trousseau et le poser à la main —
/// et poser `credentials: "omit"` pour que rien ne s'en mêle.
export function creerAppel(deps: DependancesAppel) {
  const appeler: typeof globalThis.fetch =
    deps.fetch ?? ((u, o) => globalThis.fetch(u, o));

  return async function appelAuthentifie<T>(
    chemin: string,
    options: RequestInit = {},
  ): Promise<T> {
    // `getCookie` est ASYNCHRONE : il lit le trousseau du téléphone, où le
    // plugin range la session en morceaux de 1800 caractères qu'il faut
    // recoller. Sans `await`, on posait une promesse dans l'en-tête — et le
    // serveur voyait une requête anonyme, donc un 401 incompréhensible.
    const cookie = await deps.cookie();

    const entetes: Record<string, string> = { accept: "application/json" };
    if (options.body) entetes["content-type"] = "application/json";
    if (cookie) entetes.cookie = cookie;
    // L'appelant a le dernier mot : il peut viser un autre `accept` (le CSV de
    // `export`, un jour) sans qu'on ait à rouvrir ce fichier.
    Object.assign(entetes, (options.headers ?? {}) as Record<string, string>);

    const res = await joindre(
      deps.api + chemin,
      { ...options, credentials: "omit", headers: entetes },
      appeler,
    );

    if (res.status === 401) throw new SessionExpiree();
    if (!res.ok) throw new ErreurServeur(res.status, await detailDeLErreur(res));
    return (await res.json()) as T;
  };
}

export type Appel = ReturnType<typeof creerAppel>;
