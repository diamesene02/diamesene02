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

/// Ce que l'accueil du club affiche, en un seul aller-retour.
export type Accueil = {
  saison: { id: string; nom: string } | null;
  soiree: {
    id: string;
    date: string;
    libelle: string | null;
    annulee: boolean;
    phrase: string;
    presents: number;
    attente: number;
    compoFaite: boolean;
    maReponse: "IN" | "OUT" | "MAYBE" | null;
  } | null;
  matchs: {
    id: string;
    joueLe: string;
    statut: "LIVE" | "FINISHED";
    nomA: string;
    nomB: string;
    scoreA: number;
    scoreB: number;
    dureeMin: number | null;
  }[];
  classement: {
    rang: number;
    playerId: string;
    nom: string;
    photo: string | null;
    matchs: number;
    victoires: number;
    nuls: number;
    defaites: number;
    buts: number;
    points: number;
  }[];
};

export function chargerAccueil(clubId: string): Promise<Accueil> {
  return appelAuthentifie<Accueil>(
    `/api/clubs/${encodeURIComponent(clubId)}/accueil`,
  );
}

type Camp = { nom: string; lettre: string };
type CommunMatch = {
  id: string;
  saisonId: string | null;
  genre: "INTERNAL" | "EXTERNAL";
  a: Camp;
  b: Camp;
};

/// L'écran « Les matchs », en un aller-retour.
///
/// Aucun filtre côté serveur : chaque ligne porte sa saison et son genre, et
/// l'app filtre en local. Le site refait un tour de serveur à chaque pilule
/// tapée ; au bord d'un terrain, c'est une seconde pour changer un mot.
export type EcranMatchs = {
  saisons: { id: string; nom: string; active: boolean }[];
  saisonParDefaut: string;
  direct: (CommunMatch & { scoreA: number; scoreB: number })[];
  programmes: (CommunMatch & {
    quand: string;
    jour: string;
    heure: string;
    lieu: string | null;
    presents: number;
  })[];
  joues: (CommunMatch & {
    joueLe: string;
    heure: string;
    scoreA: number;
    scoreB: number;
    vainqueur: "A" | "B" | null;
    adversaire: string | null;
    hommeDuMatch: string | null;
    groupe: { cle: string; titreJour: string; sousTitre: string | null; date: string };
  })[];
};

export function chargerMatchs(clubId: string): Promise<EcranMatchs> {
  return appelAuthentifie<EcranMatchs>(
    `/api/clubs/${encodeURIComponent(clubId)}/matchs`,
  );
}

/// Une soirée telle que le calendrier l'affiche.
export type LigneSoiree = {
  id: string;
  date: string;
  jour: string;
  heure: string;
  aVenir: boolean;
  annulee: boolean;
  motifAnnulation: string | null;
  lieu: string | null;
  libelle: string | null;
  presents: number;
  matchs: number;
  buts: number;
  prixCents: number | null;
  prix: string | null;
  toutRegle: boolean;
};

export type GroupeMois = {
  cle: string;
  titre: string;
  compte: number;
  soirees: LigneSoiree[];
};

export type EcranSoirees = {
  club: { id: string; slug: string; peutMarquer: boolean; peutGerer: boolean };
  aujourdhui: string;
  prochaines: GroupeMois[];
  reste: GroupeMois[];
  resteTotal: number;
  passees: GroupeMois[];
  vide: boolean;
};

export function chargerSoirees(clubId: string): Promise<EcranSoirees> {
  return appelAuthentifie<EcranSoirees>(
    `/api/clubs/${encodeURIComponent(clubId)}/soirees`,
  );
}

export type StatutReponse = "IN" | "MAYBE" | "OUT";

export type FicheSoiree = {
  id: string;
  date: string;
  dateLabel: string;
  heure: string;
  lieu: string | null;
  libelle: string | null;
  notes: string | null;
  sousTitre: string;
  annulee: boolean;
  passee: boolean;
  commencee: boolean;
  soireeFinie: boolean;
  peutGerer: boolean;
  peutScorer: boolean;
  chasubles: {
    a: { nom: string; lettre: string; couleur: string };
    b: { nom: string; lettre: string; couleur: string };
  };
  presences: {
    titre: string;
    monPlayerId: string | null;
    maReponse: StatutReponse | null;
    compte: string;
    phrase: string;
    nbPresents: number;
    nbAttente: number;
    nbPeutEtre: number;
    nbAbsents: number;
    lignes: {
      playerId: string;
      nom: string;
      photo: string | null;
      moi: boolean;
      statut: StatutReponse | null;
      libelle: string;
      ton: string;
      viaAbonnement: boolean;
      enAttente: boolean;
      camp: "A" | "B" | null;
      titulaire: boolean;
    }[];
  };
  compo: {
    faite: boolean;
    nomA: string;
    nomB: string;
    joueurs: {
      playerId: string;
      nom: string;
      photo: string | null;
      niveau: number;
      gardien: boolean;
      camp: "A" | "B" | null;
    }[];
  };
  terrain: {
    visible: boolean;
    prixCents: number | null;
    prix: string | null;
    part: string | null;
    resume: string | null;
    encaisse: string;
    pourcentage: number;
    payeurs: { playerId: string; nom: string; aPaye: boolean }[];
  };
  bilan: {
    enCours: boolean;
    victoiresA: number;
    victoiresB: number;
    nuls: number;
    uniteA: string;
    uniteB: string;
    resume: string;
    buts: number;
    buteur: { nom: string; buts: number } | null;
    mvp: { nom: string } | null;
  } | null;
  mot: string | null;
  matchs: {
    id: string;
    statut: string;
    direct: boolean;
    aVenir: boolean;
    nomA: string;
    nomB: string;
    scoreA: number;
    scoreB: number;
    etat: string;
    heure: string;
    buteursA: string;
    buteursB: string;
    pied: string | null;
  }[];
  cracks: {
    rang: number;
    playerId: string;
    nom: string;
    photo: string | null;
    invite: boolean;
    matchs: number;
    victoires: number;
    nuls: number;
    defaites: number;
    buts: number;
    points: number;
  }[];
};

export function chargerSoiree(clubId: string, soireeId: string): Promise<FicheSoiree> {
  return appelAuthentifie<FicheSoiree>(
    `/api/clubs/${encodeURIComponent(clubId)}/soirees/${encodeURIComponent(soireeId)}`,
  );
}

/// Répondre à une soirée. Exige le réseau : c'est une réponse qu'on donne
/// depuis son canapé, pas au bord du terrain, et la file d'attente locale ne
/// sert que la saisie du match.
export function repondrePresence(
  clubId: string,
  soireeId: string,
  playerId: string,
  statut: StatutReponse,
): Promise<{ ok: boolean }> {
  return appelAuthentifie<{ ok: boolean }>(
    `/api/clubs/${encodeURIComponent(clubId)}/soirees/${encodeURIComponent(soireeId)}/rsvp`,
    { method: "POST", body: JSON.stringify({ playerId, statut }) },
  );
}

export type FicheMatch = {
  id: string;
  statut: "PROGRAMME" | "ANNULE" | "EN_DIRECT" | "TERMINE";
  retro: boolean;
  contexte: string | null;
  dateCourte: string;
  dateLongue: string;
  heure: string;
  joueLe: string;
  soireeId: string | null;
  saison: { id: string; nom: string } | null;
  dureeMin: number | null;
  scoreA: number;
  scoreB: number;
  camps: {
    camp: "A" | "B";
    nom: string;
    lettre: string;
    bilan: string | null;
    buteurs: { nom: string; minutes: (number | null)[] }[];
  }[];
  chasubles: { a: string; b: string };
  statistiques: { libelle: string; a: number; b: number; accent?: "or" }[];
  chronologie: {
    id: string;
    minute: number | null;
    camp: "A" | "B";
    nom: string;
    passeur: string | null;
    scoreA: number;
    scoreB: number;
  }[];
  effectifs: {
    camp: "A" | "B";
    joueurs: {
      playerId: string;
      nom: string;
      initiales: string;
      photo: string | null;
      buts: number;
      gardien: boolean;
    }[];
  }[];
  homme: {
    playerId: string;
    nom: string;
    photo: string | null;
    camp: "A" | "B" | null;
    buts: number;
    votes: { pour: number; total: number } | null;
  } | null;
  vote: {
    monVote: string | null;
    candidats: { playerId: string; nom: string; photo: string | null; voix: number }[];
  } | null;
  droits: { peutSaisir: boolean; peutGerer: boolean };
};

export function chargerFicheMatch(clubId: string, matchId: string): Promise<FicheMatch> {
  return appelAuthentifie<FicheMatch>(
    `/api/clubs/${encodeURIComponent(clubId)}/matchs/${encodeURIComponent(matchId)}`,
  );
}

export type EcranEffectif = {
  peutGerer: boolean;
  aDejaUnProfil: boolean;
  monJoueurId: string | null;
  actifs: number;
  sousTitre: string;
  joueurs: {
    id: string;
    nom: string;
    surnom: string | null;
    initiales: string;
    photo: string | null;
    niveau: number;
    gardien: boolean;
    invite: boolean;
    archive: boolean;
    abonne: boolean;
    compteLie: boolean;
    estMoi: boolean;
    matchs: number;
    buts: number;
  }[];
};

export function chargerEcranEffectif(clubId: string): Promise<EcranEffectif> {
  return appelAuthentifie<EcranEffectif>(
    `/api/clubs/${encodeURIComponent(clubId)}/effectif`,
  );
}

/// La fiche d'un joueur : la carte d'identité du vestiaire.
///
/// Tout arrive assemblé — le sous-titre, les libellés de paliers, la date
/// courte de chaque match. L'app dessine, elle ne recalcule pas : c'est ce qui
/// garantit que « 2e du tableau » veut dire la même chose sur le site et sur
/// le téléphone.
export type FicheJoueur = {
  joueur: {
    id: string;
    nom: string;
    surnom: string | null;
    photo: string | null;
    initiales: string;
    niveau: number;
    estGardien: boolean;
    estInvite: boolean;
    abonne: boolean;
    estMoi: boolean;
    camp: "A" | "B" | null;
    badge: string;
    sousTitre: string;
    couleur: string;
  };
  chasubles: { a: string; b: string };
  passesSuivies: boolean;
  droits: { peutModifier: boolean; peutReglerAbonnement: boolean };
  bilan: {
    matchs: number;
    buts: number;
    passes: number;
    hommeDuMatch: number;
    pctVictoires: number;
    victoires: number;
    nuls: number;
    defaites: number;
    butsParMatch: number;
    forme: ("W" | "D" | "L")[];
    serie: number;
    elo: number;
    eloTendance: number;
  } | null;
  gardien: {
    matchs: number;
    butsEncaisses: number;
    moyenne: number;
    cleanSheets: number;
    pctVictoires: number;
  } | null;
  paliers: {
    cle: string;
    titre: string;
    actuel: number;
    objectif: number;
    reste: number;
    libelle: string;
    part: number;
  }[];
  trophees: { cle: string; nom: string; detail: string; quand: string | null }[];
  parSaison: {
    saisonId: string | null;
    saison: string;
    matchs: number;
    buts: number;
    victoires: number;
    pctVictoires: number;
  }[];
  derniersMatchs: {
    id: string;
    date: string;
    gauche: string;
    droite: string;
    scoreA: number;
    scoreB: number;
    resultat: "W" | "D" | "L";
    buts: number;
    homme: boolean;
  }[];
};

export function chargerFicheJoueur(clubId: string, joueurId: string): Promise<FicheJoueur> {
  return appelAuthentifie<FicheJoueur>(
    `/api/clubs/${encodeURIComponent(clubId)}/joueurs/${encodeURIComponent(joueurId)}`,
  );
}

/// « Je viens tous les lundis. »
///
/// Exige le réseau, comme la réponse à une soirée : c'est un réglage qu'on
/// change depuis son canapé, et le rejouer plus tard depuis la file d'attente
/// écraserait un choix que quelqu'un d'autre aurait fait entre-temps.
export function reglerAbonnement(
  clubId: string,
  joueurId: string,
  abonne: boolean,
): Promise<{ ok: boolean; abonne: boolean }> {
  return appelAuthentifie<{ ok: boolean; abonne: boolean }>(
    `/api/clubs/${encodeURIComponent(clubId)}/joueurs/${encodeURIComponent(joueurId)}/abonnement`,
    { method: "POST", body: JSON.stringify({ abonne }) },
  );
}

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
  /// Qui désigne l'homme du match. Les trois valeurs de l'énumération
  /// serveur (prisma/schema.prisma, enum MotmMode) : les membres votent, le
  /// marqueur désigne, ou personne. Typé strictement parce que le miroir
  /// local l'exige, et qu'une chaîne libre y passerait sans bruit.
  modeHommeDuMatch: "VOTE" | "ADMIN" | "OFF";
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
  /// Le chemin de la vitrine publique (« /p/mon-club »), ou `null` si le club
  /// est fermé. C'est le serveur qui tranche, pas l'app.
  urlPublique: string | null;
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

/// Une fiche de l'effectif telle que le serveur la rend.
///
/// `estMoi` et `compteLie` remplacent le `userId` brut : l'app n'a besoin que
/// de savoir laquelle est la sienne et lesquelles sont revendiquées, pas de
/// l'identifiant de compte de chaque joueur du club.
export type FicheServeur = {
  id: string;
  name: string;
  nickname: string | null;
  photo: string | null;
  skill: number;
  isGk: boolean;
  isGuest: boolean;
  abonne: boolean;
  isArchived: boolean;
  estMoi: boolean;
  compteLie: boolean;
};

/// L'effectif du club, pour rafraîchir le miroir local.
///
/// À appeler chaque fois qu'on a du réseau, et à écrire aussitôt en base avec
/// `saveRoster` : c'est ce qui permet de composer une équipe au gymnase quand
/// le réseau n'y est pas.
export async function chargerEffectif(clubId: string): Promise<FicheServeur[]> {
  const r = await appelAuthentifie<{ players: FicheServeur[] }>(
    `/api/clubs/${encodeURIComponent(clubId)}/roster`,
  );
  return r.players;
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

/// L'écran « Stats », en un aller-retour.
///
/// La page du site fait une quinzaine de requêtes ; ici tout arrive assemblé —
/// les points de chaque ligne, l'ordre du tableau, les phrases des records.
/// L'app dessine, elle ne recalcule pas : c'est ce qui garantit que le rang
/// affiché ici est celui de la fiche joueur.
export type CarteJoueur = {
  playerId: string;
  nom: string;
  initiales: string;
  photo: string | null;
  /// La chasuble de son dernier match sur la période. C'est un CAMP, pas une
  /// couleur : l'anneau se peint avec `taR`/`tbR` du thème — les variantes
  /// redressées, sans quoi une chasuble noire disparaît sur une carte sombre.
  /// `null` quand il n'a pas joué : l'anneau reste neutre.
  camp: "A" | "B" | null;
};

export type EcranStats = {
  saisons: { choisie: string; choix: { id: string; libelle: string }[] };
  chasubles: { a: string; b: string };
  droits: { peutScorer: boolean };
  tableau: (CarteJoueur & {
    rang: number;
    invite: boolean;
    matchs: number;
    victoires: number;
    nuls: number;
    defaites: number;
    buts: number;
    points: number;
  })[];
  buteurs: (CarteJoueur & { rang: number; buts: number; part: number })[];
  forme: (CarteJoueur & { forme: ("W" | "D" | "L")[]; serie: number })[];
  palmares: {
    titre: string;
    titres: {
      cle: string;
      libelle: string;
      icone: "trophee" | "ballon" | "passe" | null;
      or?: boolean;
      playerId: string;
      nom: string;
      valeur: string;
    }[];
  };
  saisonsPassees: { saison: string; lignes: string[]; vide: boolean }[];
  derby: {
    titre: string;
    nomA: string;
    nomB: string;
    lettreA: string;
    lettreB: string;
    victoiresA: number;
    victoiresB: number;
    nuls: number;
    total: number;
    mene: "A" | "B" | null;
    butsA: number;
    butsB: number;
    soireesA: number;
    soireesB: number;
    soireesPartagees: number;
    serie: string | null;
  } | null;
  gardiens: (CarteJoueur & {
    matchs: number;
    encaisses: number;
    moyenne: number;
    cleanSheets: number;
    pctVictoires: number;
  })[];
  records: {
    lignes: {
      cle: string;
      titre: string;
      valeur: string;
      contexte: string;
      cible: { quoi: "match" | "soiree" | "joueur"; id: string } | null;
      avatar: { nom: string; initiales: string; photo: string | null } | null;
    }[];
    jeunesse: string | null;
  };
  adversaires: {
    matchs: number;
    victoires: number;
    nuls: number;
    defaites: number;
    butsPour: number;
    butsContre: number;
    points: number;
    forme: ("W" | "D" | "L")[];
    duels: {
      id: string;
      nom: string;
      victoires: number;
      nuls: number;
      defaites: number;
      butsPour: number;
      butsContre: number;
      diff: number;
    }[];
  } | null;
};

export function chargerStats(clubId: string, saison?: string): Promise<EcranStats> {
  const q = saison ? `?saison=${encodeURIComponent(saison)}` : "";
  return appelAuthentifie<EcranStats>(
    `/api/clubs/${encodeURIComponent(clubId)}/stats${q}`,
  );
}
