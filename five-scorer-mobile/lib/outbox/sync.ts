// Le drain de l'outbox, porté de « five-scorer/lib/sync.ts » (386 lignes).
//
// Ce qui ne change pas, parce que c'est ce qui a coûté des soirées :
//   - un seul drain en vol à la fois ;
//   - l'ordre FIFO pris sur la clé auto-incrémentée, jamais sur l'horodatage ;
//   - le rejeu au plus une fois par passe, la suppression APRÈS l'accusé de
//     réception (au-moins-une-fois ; le serveur est idempotent, c'est la
//     garantie qu'il faut) ;
//   - 401 → on s'arrête et on le DIT, plutôt que de tourner en rond ;
//   - refus 4xx → l'opération et toute la chaîne de son match sont mises de
//     côté, jamais supprimées ;
//   - relance exponentielle 5 s → 60 s tant qu'il reste quelque chose.
//
// Ce qui change, et pourquoi :
//   - **Rien n'est global.** Le web tenait son état dans des variables de
//     module et sa base dans un singleton ; ici tout vit dans l'objet rendu par
//     `creerDrain`. C'est ce qui permet d'en instancier deux dans un test — le
//     premier tué en pleine panne réseau, le second rouvert sur le même
//     fichier — et de vérifier qu'aucune opération ne s'est perdue.
//   - **Le réseau est injecté** (`fetch`, `cookie`, `api`). En React Native il
//     n'y a pas de bocal à cookies : `credentials: "omit"` et l'en-tête `cookie`
//     posé à la main, comme dans « lib/api.ts ».
//   - **`navigator.onLine` n'existe pas.** L'état en ligne entre par
//     `definirEnLigne()` ; c'est NetInfo qui l'appellera, quand il y aura un
//     écran pour l'afficher.
//   - **Les minuteurs sont injectables**, sinon un test de la relance
//     attendrait vraiment cinq secondes.

import type { Base } from "./base";
import type { OutboxEntry, OutboxOp } from "./types";
import {
  bloquerChaine,
  compteurs,
  debloquerToutes,
  enfiler,
  listerBloquees,
  noterEchec,
  prochaineActive,
  retirer,
} from "./outbox";

export type EtatSynchro = {
  enLigne: boolean;
  /// Ce qui partira tout seul.
  enAttente: number;
  enCours: boolean;
  derniereErreur: string | null;
  /// Refusées par le serveur et conservées : elles ne partiront pas toutes
  /// seules. La pastille doit le montrer — une file vidée en silence se lit
  /// comme « tout est enregistré ».
  bloquees: number;
  /// Le serveur ne reconnaît plus la session : il faut se reconnecter.
  reconnexionRequise: boolean;
  derniereSynchroLe: string | null;
};

type Ecouteur = (e: EtatSynchro) => void;

export type Dependances = {
  base: Base;
  /// La racine de l'app web (« https://five-scorer.vercel.app », ou le serveur
  /// du Mac). Les URL sont absolues : il n'y a pas d'origine implicite sur un
  /// téléphone.
  api: string;
  /// Le cookie de session, lu dans le trousseau. Rendu `null` quand il n'y en
  /// a pas : le rejeu partira quand même et se fera répondre 401, ce qui lève
  /// `reconnexionRequise` — plutôt que de rester coincé sans rien dire.
  cookie?: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
  maintenant?: () => Date;
  /// Minuteur de la relance. Injectable pour les tests, `setTimeout` sinon.
  planifier?: (fn: () => void, ms: number) => unknown;
  annuler?: (jeton: unknown) => void;
  enLigne?: boolean;
};

/// Aucun rejeu n'attend plus de huit secondes. En réseau dégradé — le cas réel
/// du gymnase — un fetch sans délai pouvait pendre des minutes, la file gelée
/// derrière lui et la pastille muette.
export const DELAI_REJEU_MS = 8000;
const RELANCE_MIN_MS = 5000;
const RELANCE_MAX_MS = 60000;

/// Le délai avant la prochaine tentative, après `echecs` échecs consécutifs.
/// Extrait en fonction pure pour être testable sans attendre.
export function delaiRelance(echecs: number): number {
  return Math.min(RELANCE_MAX_MS, RELANCE_MIN_MS * 2 ** Math.min(echecs, 4));
}

export type Drain = ReturnType<typeof creerDrain>;

export function creerDrain(deps: Dependances) {
  const base = deps.base;
  const appeler = deps.fetch ?? globalThis.fetch;
  const cookie = deps.cookie ?? (async () => null);
  const maintenant = deps.maintenant ?? (() => new Date());
  const planifier =
    deps.planifier ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const annuler =
    deps.annuler ?? ((jeton: unknown) => clearTimeout(jeton as never));

  const etat: EtatSynchro = {
    enLigne: deps.enLigne ?? true,
    enAttente: 0,
    enCours: false,
    derniereErreur: null,
    bloquees: 0,
    reconnexionRequise: false,
    derniereSynchroLe: null,
  };

  const ecouteurs = new Set<Ecouteur>();
  function emettre() {
    for (const e of ecouteurs) e({ ...etat });
  }

  let enVol: Promise<void> | null = null;
  let relance: unknown = null;
  let echecs = 0;

  // --- Réseau --------------------------------------------------------------

  async function fetchAvecDelai(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), DELAI_REJEU_MS);
    const jeton = await cookie();
    const entetes: Record<string, string> = {
      accept: "application/json",
      ...((init.headers ?? {}) as Record<string, string>),
    };
    if (jeton) entetes.cookie = jeton;
    try {
      return await appeler(url, {
        ...init,
        // React Native n'a pas de bocal à cookies : `credentials: "include"` ne
        // fait rien, et le cookie posé à la main suffit. « omit » pour que
        // rien ne s'en mêle.
        credentials: "omit",
        headers: entetes,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  }

  function json(corps: unknown): RequestInit {
    return {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corps),
    };
  }

  /// Les huit rejeux, un par `kind` d'OutboxOp. Mêmes routes, mêmes verbes,
  /// mêmes charges utiles que côté web : ces endpoints sont déjà en production
  /// et déjà idempotents, on n'y touche pas.
  async function rejouer(op: OutboxOp): Promise<void> {
    const racine = `${deps.api}/api/clubs/${op.clubId}`;
    switch (op.kind) {
      case "createMatch": {
        const res = await fetchAvecDelai(`${racine}/matches`, {
          method: "POST",
          ...json(op.payload),
        });
        await leverSiRefus(res, "createMatch");
        return;
      }
      case "addEvent": {
        const res = await fetchAvecDelai(`${racine}/matches/${op.matchId}/events`, {
          method: "POST",
          ...json(op.payload),
        });
        await leverSiRefus(res, "addEvent");
        return;
      }
      case "removeEvent": {
        const res = await fetchAvecDelai(
          `${racine}/matches/${op.matchId}/events?eventId=${encodeURIComponent(
            op.payload.eventId,
          )}`,
          { method: "DELETE" },
        );
        await leverSiRefus(res, "removeEvent");
        return;
      }
      case "setAssist": {
        const res = await fetchAvecDelai(`${racine}/matches/${op.matchId}/events`, {
          method: "PATCH",
          ...json(op.payload),
        });
        await leverSiRefus(res, "setAssist");
        return;
      }
      case "setScorer": {
        const res = await fetchAvecDelai(`${racine}/matches/${op.matchId}/events`, {
          method: "PATCH",
          ...json(op.payload),
        });
        await leverSiRefus(res, "setScorer");
        return;
      }
      case "addParticipant": {
        const res = await fetchAvecDelai(`${racine}/matches/${op.matchId}/lineup`, {
          method: "POST",
          ...json(op.payload),
        });
        await leverSiRefus(res, "addParticipant");
        return;
      }
      case "movePlayer": {
        const res = await fetchAvecDelai(`${racine}/matches/${op.matchId}/lineup`, {
          method: "PATCH",
          ...json(op.payload),
        });
        await leverSiRefus(res, "movePlayer");
        return;
      }
      case "finishMatch": {
        const res = await fetchAvecDelai(`${racine}/matches/${op.matchId}`, {
          method: "PATCH",
          ...json({
            status: "FINISHED",
            mvpId: op.payload.mvpId,
            durationMin: op.payload.durationMin ?? null,
          }),
        });
        await leverSiRefus(res, "finishMatch");
        return;
      }
    }
  }

  // --- Le drain ------------------------------------------------------------

  function planifierRelance() {
    if (relance) return;
    relance = planifier(() => {
      relance = null;
      void vider();
    }, delaiRelance(echecs));
  }

  async function rafraichirCompteurs() {
    const c = await compteurs(base);
    etat.enAttente = c.enAttente;
    etat.bloquees = c.bloquees;
    emettre();
  }

  /// Vide la file. Sûr à appeler plusieurs fois : un seul passage en vol.
  function vider(): Promise<void> {
    if (enVol) return enVol;
    enVol = (async () => {
      try {
        await passage();
      } finally {
        enVol = null;
      }
    })();
    return enVol;
  }

  async function passage(): Promise<void> {
    if (!etat.enLigne) return;

    etat.enCours = true;
    etat.derniereErreur = null;
    emettre();

    try {
      // Une opération à la fois, pour garder l'ordre. Chaque succès est retiré
      // de la file avant de passer à la suivante : si le processus meurt entre
      // les deux, l'opération repart — le serveur est idempotent, il la
      // reconnaît et ne la duplique pas.
      while (true) {
        const suivante = await prochaineActive(base);
        if (!suivante) break;

        try {
          await rejouer(suivante.op);
          await retirer(base, suivante.id!);
          // Une opération acceptée prouve que la session est reconnue. Sans ce
          // rabaissement, le drapeau levé au premier 401 ne redescendait
          // jamais : la pastille continuait d'exiger de se reconnecter alors
          // que la file était vide et tout parti.
          etat.reconnexionRequise = false;
          etat.derniereSynchroLe = maintenant().toISOString();
          echecs = 0;
        } catch (e) {
          if (!(await encaisserEchec(e, suivante))) break;
        }
      }
    } finally {
      etat.enCours = false;
      await rafraichirCompteurs();
      // S'il reste des opérations actives et que ce n'est pas la session qui
      // manque, on reviendra sans qu'on nous le demande.
      if (etat.enAttente > 0 && !etat.reconnexionRequise) planifierRelance();
    }
  }

  /// Traite un échec de rejeu. Rend `true` s'il faut continuer la file,
  /// `false` s'il faut arrêter ce passage.
  async function encaisserEchec(e: unknown, entree: OutboxEntry): Promise<boolean> {
    const err = e as Error & { status?: number };
    const reessayable =
      err.status === undefined || // erreur réseau, ou délai dépassé
      err.status === 0 ||
      err.status === 408 ||
      err.status === 429 ||
      err.status >= 500;
    const sessionPerdue = err.status === 401;

    await noterEchec(base, entree.id!, err.message);
    etat.derniereErreur = err.message;

    if (sessionPerdue) {
      // Réessayer ne sert à rien tant que l'utilisateur ne s'est pas
      // reconnecté. On conserve la file et on le DIT — auparavant le badge
      // restait ambre indéfiniment sans jamais indiquer quoi faire.
      etat.reconnexionRequise = true;
      return false;
    }

    if (!reessayable) {
      // On ne supprime plus. Un 4xx, c'est le plus souvent un refus de droits
      // (403) ou un match déjà terminé — pas une opération empoisonnée.
      // L'ancienne version jetait l'op, puis toutes celles qui en dépendaient
      // tombaient en 404 et étaient jetées à leur tour : une soirée entière de
      // buts disparaissait en une passe, pendant que la pastille repassait au
      // vert « Synchro OK ».
      await bloquerChaine(
        base,
        entree,
        maintenant().toISOString(),
        `${err.status ?? "?"} — ${err.message}`,
      );
      // La file continue : les autres matchs de la soirée n'ont rien à voir
      // avec ce refus.
      return true;
    }

    // Réessayable : on arrête ce passage et on se replanifie.
    echecs += 1;
    return false;
  }

  // --- Ce que l'app appelle ------------------------------------------------

  return {
    etat: (): EtatSynchro => ({ ...etat }),

    abonner(e: Ecouteur): () => void {
      ecouteurs.add(e);
      e({ ...etat });
      return () => void ecouteurs.delete(e);
    },

    /// Ajoute une mutation à la file, puis tente de l'envoyer tout de suite.
    /// Rend l'identifiant de file — l'ordre de rejeu, définitif.
    async enfiler(op: OutboxOp): Promise<number> {
      const id = await enfiler(base, op, maintenant().toISOString());
      await rafraichirCompteurs();
      if (etat.enLigne) void vider();
      return id;
    },

    vider,

    /// À appeler après une mutation locale, ou au retour au premier plan.
    async relancer(): Promise<void> {
      await rafraichirCompteurs();
      if (etat.enLigne) await vider();
    },

    /// NetInfo (ou un test) dit ce qu'il en est du réseau. Le passage de faux à
    /// vrai relance la file de lui-même.
    definirEnLigne(enLigne: boolean): void {
      const changement = etat.enLigne !== enLigne;
      etat.enLigne = enLigne;
      emettre();
      if (changement && enLigne) void vider();
    },

    listerBloquees: () => listerBloquees(base),

    /// Remet les opérations bloquées dans la file et retente.
    async rejouerBloquees(): Promise<number> {
      const n = await debloquerToutes(base);
      etat.reconnexionRequise = false;
      await rafraichirCompteurs();
      if (etat.enLigne) void vider();
      return n;
    },

    rafraichirCompteurs,

    /// Annule la relance en attente. À appeler quand l'app se ferme — et dans
    /// les tests, sans quoi un minuteur survit au fichier.
    arreter(): void {
      if (relance) {
        annuler(relance);
        relance = null;
      }
    },
  };
}

/// Transforme une réponse non-OK en erreur portant son code.
///
/// Le code, c'est tout ce qui distingue « on réessaie » de « on met de côté » :
/// il ne doit pas se perdre en route.
async function leverSiRefus(res: Response, etiquette: string): Promise<void> {
  if (res.ok) return;
  let message: string;
  try {
    const j = (await res.json()) as { error?: string };
    message = j.error ?? res.statusText;
  } catch {
    message = res.statusText;
  }
  const err = new Error(`${etiquette} → ${res.status}: ${message}`) as Error & {
    status?: number;
  };
  err.status = res.status;
  throw err;
}
