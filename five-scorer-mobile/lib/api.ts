import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { creerAppel, joindre } from "./appel";

// Le cœur de l'appel authentifié vit dans `./appel`, sans un import d'Expo,
// pour être testable dans le nuage. Ici on ne fait que le brancher sur ce
// que ce fichier-ci sait et que lui ne peut pas savoir : l'adresse du
// serveur, et le trousseau du téléphone.
export {
  SessionExpiree,
  ErreurServeur,
  type Appel,
  type DependancesAppel,
} from "./appel";

/// Le schéma de lien profond de l'app, déclaré dans app.json. Il vit ici
/// plutôt qu'en dur dans deux fichiers : c'est lui que le client
/// d'authentification annonce au serveur comme origine, et c'est lui que le
/// serveur cherche dans ses origines de confiance. Une divergence entre les
/// deux se solderait par un « Invalid origin » sans indice.
export const SCHEMA = "fivescorer";

/// L'origine que le serveur verra réellement.
///
/// Calculée exactement comme @better-auth/expo la calcule — son client fait
/// `Linking.createURL("", { scheme })` et l'envoie dans l'en-tête
/// `expo-origin`, que le plugin serveur recopie ensuite dans `origin`
/// (node_modules/@better-auth/expo/dist/client.js et dist/index.js).
export const ORIGINE = Linking.createURL("", { scheme: SCHEMA });

/// L'accès à l'application web, qui devient l'API du mobile.
///
/// En développement on vise le serveur du Mac, en production la production —
/// voir `DEFAUT` plus bas, qui explique pourquoi ce n'est pas négociable.
/// EXPO_PUBLIC_API dans five-scorer-mobile/.env.local force l'un ou l'autre :
///   EXPO_PUBLIC_API=https://five-scorer.vercel.app
///
/// « localhost » y est parfaitement acceptable — voir `resoudreAdresse` juste
/// en dessous, qui le traduit tout seul.

/// Sur un téléphone, « localhost » désigne LE TÉLÉPHONE.
///
/// C'est le piège classique du développement mobile, et il coûte une demi-
/// heure à chaque fois : on écrit `http://localhost:3000` en pensant au Mac,
/// l'app est servie sur l'iPhone, et le fetch part vers un serveur qui
/// n'existe pas — avec pour seul indice « Could not connect to the server ».
///
/// Expo connaît pourtant l'adresse du Mac : c'est celle qui a servi le bundle
/// (`hostUri`, « 192.168.1.192:8090 »). On remplace donc l'hôte en gardant le
/// port demandé.
///
/// Fonction pure, et testée par scripts/verif-adresse.mjs : c'est la seule
/// pièce de l'app qu'on ne peut pas voir se tromper à l'écran — elle échoue
/// en silence, dans une requête réseau.
export function resoudreAdresse(
  url: string,
  hote: string | undefined,
): { url: string; obstacle: string | null } {
  // Sur la cible web, « localhost » désigne bien la machine : on ne touche à
  // rien. Idem pour une adresse déjà distante.
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
    return { url, obstacle: null };
  }

  const ip = hote?.split(":")[0];
  if (!ip || ip === "localhost" || ip === "127.0.0.1") {
    return { url, obstacle: null };
  }

  // `expo start --tunnel` sert le bundle depuis un domaine `exp.direct`, pas
  // depuis une IP. Y recopier le port 3000 fabriquerait une adresse qui
  // n'existe pas. Et de toute façon, si on a sorti le tunnel c'est que le
  // téléphone n'est pas sur le réseau du Mac : le serveur local est hors
  // d'atteinte quoi qu'on écrive. Autant le dire plutôt que de laisser
  // chercher.
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return {
      url,
      obstacle:
        `Le bundle arrive par un tunnel (${ip}), donc le téléphone n'est pas ` +
        "sur le réseau du Mac et ne peut pas joindre son serveur. Reviens sur " +
        "le même Wi-Fi, ou vise la production avec EXPO_PUBLIC_API.",
    };
  }

  return {
    url: url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)/i, "$1" + ip),
    obstacle: null,
  };
}

/// L'hôte qui a servi le bundle. `expoConfig.hostUri` sur les versions
/// récentes d'Expo, `expoGoConfig.debuggerHost` sur les plus anciennes.
function hoteDuBundle(): string | undefined {
  return (Constants.expoConfig?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost) as string | undefined;
}

export const PROD = "https://five-scorer.vercel.app";

/// Vrai quand l'app tourne dans Expo Go plutôt que dans un build à elle.
///
/// Ce n'est pas une devinette sur l'environnement, c'est LA question posée
/// directement : dans Expo Go, expo-linking ignore silencieusement le schéma
/// demandé et rend « exp:// » (Schemes.js, resolveScheme : sous
/// `executionEnvironment === "storeClient"`, il retourne 'exp'). Dans un
/// build — development build compris — le module natif d'expo-constants
/// déclare « bare » en dur (ios/EXConstantsService.m), et le schéma de
/// app.json est rendu tel quel.
const DANS_EXPO_GO = !ORIGINE.startsWith(SCHEMA + ":");

/// À quel serveur on parle par défaut.
///
/// La règle ne regarde pas `__DEV__` mais l'origine ci-dessus, parce que
/// c'est l'origine, et elle seule, que le serveur accepte ou refuse :
///
/// - Expo Go annonce « exp:// ». La production ne lui fait pas confiance, et
///   c'est délibéré : le plugin serveur recopie l'en-tête `set-cookie` — donc
///   le jeton de session en clair — dans l'URL de redirection dès que la
///   destination est une origine de confiance à schéma non-http. Y autoriser
///   « exp:// » donnerait à n'importe quelle app Expo un moyen de récupérer
///   une session. Expo Go parle donc au serveur du Mac, qui, lui, l'accepte
///   en développement.
/// - Un build annonce « fivescorer:// », que la production accepte. Il parle
///   donc à la production : c'est le seul endroit où vit le vrai club.
///
/// EXPO_PUBLIC_API force l'un ou l'autre quand on veut développer un écran
/// contre le serveur local depuis un build.
const DEFAUT = DANS_EXPO_GO ? "http://localhost:3000" : PROD;

const resolu = resoudreAdresse(
  process.env.EXPO_PUBLIC_API?.replace(/\/$/, "") ?? DEFAUT,
  hoteDuBundle(),
);

export const API = resolu.url;

/// Ce qui empêche le téléphone de joindre le serveur, quand quelque chose
/// l'empêche. `null` quand tout va bien. Affiché par l'écran de connexion :
/// une adresse injoignable sans explication, c'est une demi-heure perdue.
export const OBSTACLE = resolu.obstacle;

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

/// Le cookie de session, lu dans le trousseau du téléphone.
///
/// Import différé, et ce n'est pas un détail de style : `lib/auth-client`
/// importe ce fichier-ci pour l'adresse et le schéma. Un import en tête
/// fabriquerait un cycle, dont le symptôme en React Native est un module
/// à moitié initialisé — donc un `undefined` très loin de sa cause.
///
/// Rendu `null` plutôt que la chaîne vide : c'est la forme qu'attend
/// `Dependances.cookie` du drain (lib/outbox/sync.ts), à qui cette même
/// fonction sera injectée à l'étape 11. L'app et la file doivent rejouer le
/// MÊME cookie ; deux lecteurs, c'était deux façons de se tromper.
export async function lireCookie(): Promise<string | null> {
  const { authClient } = await import("./auth-client");
  return (await authClient.getCookie()) || null;
}

/// Appeler une route de l'app web au nom de l'utilisateur connecté.
///
/// La mécanique (cookie à la main, `credentials: "omit"`, 401 → session
/// expirée) vit dans `./appel` et s'y teste avec un `fetch` de papier.
export const appelAuthentifie = creerAppel({ api: API, cookie: lireCookie });

export function chargerMoi(): Promise<Moi> {
  return appelAuthentifie<Moi>("/api/me");
}

/// Le compte d'essai de la base locale, créé par
/// `node scripts/compte-dev.mjs` côté serveur. Il n'ouvre rien d'autre qu'un
/// Postgres sur le Mac ; ce n'est pas un secret, et il n'existe pas ailleurs.
///
/// `null` dès qu'on ne parle pas à une machine du réseau local : ce serait
/// afficher un bouton qui ne peut que produire « mot de passe incorrect ».
export const COMPTE_DEV = /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(API)
  ? { courriel: "dev@five.local", motDePasse: "demo-five-2026" }
  : null;
