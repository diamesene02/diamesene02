/// L'accès à l'application web, qui devient l'API du mobile.
///
/// Par défaut on parle à la PRODUCTION. C'est délibéré : dans Expo Go, on
/// scanne un QR code et on veut voir son club tout de suite. Pointer le
/// serveur local suppose d'être sur le même Wi-Fi, de connaître l'IP du Mac
/// et d'avoir réglé les origines autorisées — trois occasions d'échouer avant
/// le premier écran.
///
/// Pour travailler contre le serveur local, poser EXPO_PUBLIC_API dans
/// five-scorer-mobile/.env.local :
///   EXPO_PUBLIC_API=http://192.168.1.192:3000
export const API =
  process.env.EXPO_PUBLIC_API?.replace(/\/$/, "") ??
  "https://five-scorer.vercel.app";

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

export async function chargerVitrine(slug = CLUB): Promise<Vitrine> {
  const res = await fetch(API + "/api/public/" + slug, {
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

  const res = await fetch(API + chemin, {
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
