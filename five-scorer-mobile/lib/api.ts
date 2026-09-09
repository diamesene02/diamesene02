import Constants from "expo-constants";

/// L'accès à l'application web, qui devient l'API du mobile.
///
/// Par défaut on parle à la PRODUCTION. C'est délibéré : dans Expo Go, on
/// scanne un QR code et on veut voir son club tout de suite.
///
/// Pour travailler contre le serveur local, poser EXPO_PUBLIC_API dans
/// five-scorer-mobile/.env.local :
///   EXPO_PUBLIC_API=http://localhost:3000
///
/// « localhost » y est parfaitement acceptable — voir `versLHote` juste en
/// dessous, qui le traduit tout seul.

/// Sur un téléphone, « localhost » désigne LE TÉLÉPHONE.
///
/// C'est le piège classique du développement mobile, et il coûte une demi-
/// heure à chaque fois : on écrit `http://localhost:3000` en pensant au Mac,
/// l'app est servie sur l'iPhone, et le fetch part vers un serveur qui
/// n'existe pas — avec pour seul indice « Could not connect to the server ».
///
/// Expo connaît pourtant l'adresse du Mac : c'est celle qui a servi le bundle,
/// exposée dans `hostUri` (« 192.168.1.192:8081 »). On remplace donc l'hôte,
/// en gardant le port demandé. Sur la cible web, où « localhost » désigne bien
/// la machine, on ne touche à rien.
function versLHote(url: string): string {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) return url;

  const hote = (Constants.expoConfig?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost) as string | undefined;
  const ip = hote?.split(":")[0];
  if (!ip || ip === "localhost" || ip === "127.0.0.1") return url;

  return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)/i, "$1" + ip);
}

export const API = versLHote(
  process.env.EXPO_PUBLIC_API?.replace(/\/$/, "") ?? "https://five-scorer.vercel.app",
);

/// Le club dont on affiche la vitrine tant que l'authentification n'est pas
/// portée. Il vient de l'environnement pour ne pas figer un club dans le code.
export const CLUB = process.env.EXPO_PUBLIC_CLUB ?? "renault-five-urban-guy";

export type LigneClassement = {
  playerId: string;
  nom: string;
  photo: string | null;
  matchs: number;
  buts: number;
  victoires: number;
  nuls: number;
  defaites: number;
  pctVictoires: number;
  elo: number;
  forme: ("W" | "D" | "L")[];
  serie: number;
  hommeDuMatch: number;
};

export type DernierMatch = {
  id: string;
  quand: string;
  quandCourt: string;
  nomA: string;
  nomB: string;
  scoreA: number;
  scoreB: number;
  hommeDuMatch: string | null;
};

export type Vitrine = {
  club: {
    slug: string;
    nom: string;
    couleurA: string;
    couleurB: string;
    /// Les jetons du thème, calculés côté serveur par lib/theme.ts. La règle
    /// qui dérive les couleurs des deux chasubles ne doit exister qu'à un
    /// seul endroit, sinon le web et le mobile divergent au premier réglage.
    theme: { sombre: Record<string, string>; clair: Record<string, string> };
  };
  saison: { id: string; nom: string } | null;
  classement: LigneClassement[];
  derniersMatchs: DernierMatch[];
};

/// Un fetch qui dit OÙ il a échoué.
///
/// « Could not connect to the server » ne désigne rien : ni l'adresse, ni la
/// raison. Sur un téléphone, c'est presque toujours l'adresse — le Mac
/// éteint, un autre Wi-Fi, ou un « localhost » qui désignait le téléphone.
/// Donner l'adresse essayée transforme une demi-heure de recherche en un
/// coup d'œil.
async function joindre(url: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    throw new Error("Impossible de joindre " + url + " — " + cause);
  }
}

export async function chargerVitrine(slug = CLUB): Promise<Vitrine> {
  const res = await joindre(API + "/api/public/" + slug, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    // Le 404 a une cause précise et fréquente : la vitrine du club n'est pas
    // ouverte. Le dire évite de chercher une panne de réseau qui n'existe pas.
    if (res.status === 404) {
      throw new Error(
        "Aucun club public à « " +
          slug +
          " ». Vérifie le réglage « Page publique » du club.",
      );
    }
    throw new Error("Le serveur a répondu " + res.status + ".");
  }
  return (await res.json()) as Vitrine;
}

// --- L'appel authentifié -----------------------------------------------------

export type ReglagesClub = {
  format: string;
  dureeMatchMin: number;
  pointsVictoire: number;
  pointsNul: number;
  suitPasses: boolean;
  suitCartons: boolean;
  modeHommeDuMatch: string;
  minJoueurs: number;
  capaciteSoiree: number;
};

export type ClubDeMoi = {
  id: string;
  slug: string;
  nom: string;
  role: "owner" | "admin" | "member";
  peutGerer: boolean;
  peutScorer: boolean;
  couleurA: string;
  couleurB: string;
  nomChasubleA: string;
  nomChasubleB: string;
  theme: { sombre: Record<string, string>; clair: Record<string, string> };
  reglages: ReglagesClub;
  monJoueur: { id: string; nom: string; photo: string | null } | null;
};

export type Moi = {
  utilisateur: { id: string; nom: string; email: string };
  clubs: ClubDeMoi[];
};

/// Levée quand le serveur répond 401 : la session est finie ou révoquée.
/// Distincte d'une erreur réseau — c'est la seule qui doive ramener à l'écran
/// de connexion, les autres se retentent.
export class SessionExpiree extends Error {
  constructor() {
    super("Session expirée");
    this.name = "SessionExpiree";
  }
}

/// Appeler une route de l'app web au nom de l'utilisateur connecté.
///
/// React Native n'a pas de bocal à cookies : `credentials: "include"` ne fait
/// RIEN ici. Il faut lire le cookie dans le trousseau et le poser à la main —
/// et poser `credentials: "omit"` pour que rien ne s'en mêle.
export async function appelAuthentifie<T>(
  chemin: string,
  options: RequestInit = {},
): Promise<T> {
  // Import différé : lib/auth-client importe lib/api, on éviterait un cycle.
  const { authClient } = await import("./auth-client");
  // `getCookie` est ASYNCHRONE : il lit le trousseau du téléphone, et le
  // plugin y range la session en morceaux qu'il faut recoller. Sans `await`,
  // on posait une promesse dans l'en-tête — et le serveur voyait une requête
  // anonyme, donc un 401 incompréhensible.
  const cookie = await authClient.getCookie();

  const entetes: Record<string, string> = { accept: "application/json" };
  if (options.body) entetes["content-type"] = "application/json";
  if (cookie) entetes.cookie = cookie;
  Object.assign(entetes, (options.headers ?? {}) as Record<string, string>);

  const res = await joindre(API + chemin, {
    ...options,
    credentials: "omit",
    headers: entetes,
  });

  if (res.status === 401) throw new SessionExpiree();
  if (!res.ok) throw new Error("Le serveur a répondu " + res.status + ".");
  return (await res.json()) as T;
}

export function chargerMoi(): Promise<Moi> {
  return appelAuthentifie<Moi>("/api/me");
}
