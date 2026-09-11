import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Network from "expo-network";
import { ouvrirBase, BaseTropRecente } from "../lib/outbox/baseExpo";
import { compteurs } from "../lib/outbox/outbox";
import { creerMatchLocal, type MatchLocal } from "../lib/match/local";
import { creerDrain, type Drain } from "../lib/outbox/sync";
import { API, lireCookie } from "../lib/api";
import { JETONS_NEUTRES } from "../lib/couleurs";
import { BoutonPlein } from "./base";

/// Le noyau local : la base SQLite du téléphone, la saisie du match, et la
/// file qui pousse tout ça vers le serveur.
///
/// Il s'ouvre UNE SEULE FOIS pour toute l'app. Deux instances de `Base`
/// signifieraient deux connexions à la même SQLite, donc deux transactions
/// concurrentes sur les mêmes lignes — et c'est le genre de bogue qui ne se
/// voit qu'un lundi soir, à la douzième saisie.
export type Noyau = {
  local: MatchLocal;
  drain: Drain;
  /// Ce que la file n'a pas encore réussi à pousser. Se demande AVANT de
  /// déconnecter : partir avec une soirée non synchronisée dans la poche, ce
  /// sont deux heures de saisie qui disparaissent.
  enAttente: () => Promise<{ enAttente: number; bloquees: number }>;
  /// Vide la base locale. Appelée à la déconnexion : sur un téléphone prêté,
  /// la personne suivante ne doit pas ouvrir l'app sur le vestiaire du club
  /// précédent. Le site fait exactement ça avec son cache hors-ligne
  /// (`postMessage({type:"PURGE"})` avant `signOut()`).
  purger: () => Promise<void>;
};

/// Les tables du miroir local, dans l'ordre des dépendances : on vide les
/// filles avant les mères, sinon les clés étrangères refusent.
const TABLES = ["events", "participants", "matches", "outbox", "roster", "clubs"];

const Contexte = createContext<Noyau | null>(null);

/// Le noyau, garanti prêt.
///
/// Le fournisseur ne rend ses enfants qu'une fois la base ouverte : un écran
/// n'a donc jamais à traiter le cas « pas encore là », et cette fonction peut
/// lever plutôt que de rendre `null` que chaque appelant devrait tester.
export function useNoyau(): Noyau {
  const n = useContext(Contexte);
  if (!n) throw new Error("useNoyau hors de FournisseurNoyau");
  return n;
}

export function FournisseurNoyau({ children }: { children: React.ReactNode }) {
  const [noyau, setNoyau] = useState<Noyau | null>(null);
  const [erreur, setErreur] = useState<Panne | null>(null);
  /// Incrémenté par « Réessayer ». C'est lui qui relance l'effet — une base
  /// abîmée par une coupure d'écriture peut très bien s'ouvrir au second essai,
  /// et sans ce bouton l'écran était un cul-de-sac au moment précis où l'on
  /// voulait sauver la soirée qui dort dedans.
  const [essai, setEssai] = useState(0);
  const drainRef = useRef<Drain | null>(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        // `ouvrirBase` applique déjà le schéma : rien à faire de plus ici.
        const base = await ouvrirBase();
        const local = creerMatchLocal({ base });
        const drain = creerDrain({ base, api: API, cookie: lireCookie });
        if (!vivant) return;
        drainRef.current = drain;
        setNoyau({
          local,
          drain,
          enAttente: () => compteurs(base),
          purger: async () => {
            drain.arreter();
            await base.transaction(async (b) => {
              for (const t of TABLES) await b.executer(`DELETE FROM ${t}`);
            });
          },
        });
        // Ce qui restait de la dernière fois part tout de suite : l'app a pu
        // être fermée au milieu d'une soirée, hors réseau.
        void drain.relancer();
      } catch (e) {
        if (vivant) setErreur(lirePanne(e));
      }
    })();
    return () => {
      vivant = false;
      // Sans ça, la relance planifiée survit au démontage et rallume un
      // minuteur dans le vide à chaque rechargement à chaud.
      drainRef.current?.arreter();
    };
  }, [essai]);

  // Le retour au premier plan est le moment le plus utile pour vider la file :
  // on sort de sa poche, on a repris du réseau, et l'écran va se relire.
  useEffect(() => {
    if (!noyau) return;
    const s = AppState.addEventListener("change", (etat) => {
      if (etat === "active") void noyau.drain.relancer();
    });
    return () => s.remove();
  }, [noyau]);

  return (
    <Contexte.Provider value={noyau}>
      {noyau ? (
        <>
          <Reseau drain={noyau.drain} />
          {children}
        </>
      ) : (
        <Attente panne={erreur} surReessai={() => setEssai((n) => n + 1)} />
      )}
    </Contexte.Provider>
  );
}

/// Tient le drain au courant de l'état du réseau.
///
/// Un composant à part, sans rendu, parce que `useNetworkState` est un hook :
/// il ne peut pas être appelé sous une condition, et le fournisseur, lui, rend
/// tantôt l'attente tantôt ses enfants.
function Reseau({ drain }: { drain: Drain }) {
  const etat = Network.useNetworkState();
  useEffect(() => {
    // `isInternetReachable` reste indéfini le temps du premier sondage. On ne
    // déclare pas hors ligne sur une inconnue : ce serait bloquer la file au
    // lancement, précisément quand elle a le plus à rattraper.
    if (etat.isInternetReachable === undefined) return;
    drain.definirEnLigne(Boolean(etat.isInternetReachable));
  }, [drain, etat.isInternetReachable]);
  return null;
}

/// Ce qu'on montre quand la base ne s'ouvre pas.
///
/// Avant, cet écran affichait `e.message` — la phrase ANGLAISE brute de SQLite
/// — sans bouton, sans retour, sans rien. Un cul-de-sac, au moment précis où
/// l'on voudrait récupérer la soirée déjà saisie dans le fichier (spec 0000,
/// `TRANS-65`). La constitution, article V : un refus se dit en français et
/// propose une suite.
type Panne = {
  titre: string;
  aide: string;
  /// Le message d'origine. On ne le cache pas — il est juste rangé plus bas et
  /// plus petit, pour qui sait le lire.
  technique: string | null;
  peutReessayer: boolean;
};

function lirePanne(e: unknown): Panne {
  const technique = e instanceof Error ? e.message : String(e);

  if (e instanceof BaseTropRecente) {
    return {
      titre: "Cette version de l'app est trop ancienne",
      aide:
        "Les données de ce téléphone ont été écrites par une version plus " +
        "récente. Rien n'a été touché : installe la dernière version de l'app " +
        "pour les retrouver.",
      technique,
      // Réessayer ne changerait rien : c'est le binaire qui est en retard, pas
      // la base. Proposer le bouton serait promettre une réparation qui ne
      // peut pas venir.
      peutReessayer: false,
    };
  }

  return {
    titre: "La base du téléphone n'a pas pu s'ouvrir",
    aide:
      "Rien n'est perdu : ce qui a été saisi est dans le fichier. Réessaie — " +
      "et si ça recommence, ferme l'app complètement et rouvre-la.",
    technique,
    peutReessayer: true,
  };
}

function Attente({
  panne,
  surReessai,
}: {
  panne: Panne | null;
  surReessai: () => void;
}) {
  const t = JETONS_NEUTRES;
  return (
    <View style={[s.attente, { backgroundColor: t.bgSolid }]}>
      {panne ? (
        <>
          <Text style={[s.titre, { color: t.ink }]}>{panne.titre}</Text>
          <Text style={[s.aide, { color: t.i2 }]}>{panne.aide}</Text>
          {panne.peutReessayer && (
            <BoutonPlein titre="Réessayer" onPress={surReessai} t={t} />
          )}
          {panne.technique && (
            <Text style={[s.technique, { color: t.i3 }]}>{panne.technique}</Text>
          )}
        </>
      ) : (
        <>
          <ActivityIndicator color={t.ink} />
          <Text style={[s.aide, { color: t.i2 }]}>Un instant…</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  attente: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  titre: { fontSize: 20, fontWeight: "600", textAlign: "center" },
  aide: { fontSize: 15, textAlign: "center" },
  // Le message d'origine, rangé et discret : on ne le cache pas — c'est lui
  // qu'on lira au téléphone si ça recommence — mais il ne parle pas au club.
  technique: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
