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
